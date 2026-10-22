"""Exercise deployment failures without a network connection or production writes."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import configurator_header
import header_references

spec = importlib.util.spec_from_file_location("navigation_publish", Path(__file__).with_name("publish.py"))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class FakeFTP:
    def __init__(self, files):
        self.files = dict(files)
        self.writes = []
        self.fail_rename_target = None

    def mlsd(self, folder):
        for path, content in sorted(self.files.items()):
            parent, name = path.rsplit("/", 1)
            if parent == folder:
                yield name, {"type": "file", "size": str(len(content))}

    def retrbinary(self, command, callback):
        callback(self.files[command.removeprefix("RETR ")])

    def storbinary(self, command, source):
        path = command.removeprefix("STOR ")
        self.writes.append(("store", path))
        self.files[path] = source.read()

    def rename(self, source, target):
        if target == self.fail_rename_target:
            self.fail_rename_target = None
            raise ConnectionError("Simulated second-file rename failure")
        self.writes.append(("rename", source, target))
        self.files[target] = self.files.pop(source)

    def delete(self, path):
        self.writes.append(("delete", path))
        del self.files[path]


class PublishSafetyTests(unittest.TestCase):
    def setUp(self):
        self.originals = {path: ("original " + path).encode() for path in publisher.ALLOWED}
        self.payload = {path: ("updated " + path).encode() for path in publisher.ALLOWED}
        self.manifest = {
            path: {
                "before_sha256": publisher.digest(self.originals[path]),
                "after_sha256": publisher.digest(self.payload[path]),
            }
            for path in publisher.ALLOWED
        }
        self.start = {publisher.ROOT + "/" + path: content for path, content in self.originals.items()}
        self.start["/htdocs/robots.txt"] = b"protected robots"
        self.ftp = FakeFTP(self.start)
        self.transaction = {"started": False, "owned_temps": set()}

    def update(self):
        publisher.stage_and_replace(self.ftp, self.manifest, self.payload, "test", self.transaction)

    def test_success_replaces_only_authorised_navigation_files_in_order(self):
        self.update()
        self.assertEqual(set(self.ftp.files), set(self.start))
        self.assertEqual(self.ftp.files["/htdocs/robots.txt"], b"protected robots")
        renames = [entry[2] for entry in self.ftp.writes if entry[0] == "rename"]
        self.assertEqual(renames, [publisher.ROOT + "/" + path for path in publisher.ALLOWED])
        self.assertFalse(self.transaction["owned_temps"])

    def test_changed_live_asset_stops_before_any_write(self):
        path = publisher.ROOT + "/" + publisher.ALLOWED[1]
        self.ftp.files[path] = b"concurrent edit"
        with self.assertRaisesRegex(RuntimeError, "changed immediately"):
            self.update()
        self.assertEqual(self.ftp.writes, [])

    def test_existing_staging_path_is_never_overwritten(self):
        stage = publisher.temporary_path(publisher.ALLOWED[0], "test")
        self.ftp.files[stage] = b"existing staging content"
        with self.assertRaisesRegex(RuntimeError, "already exists"):
            self.update()
        self.assertEqual(self.ftp.writes, [])
        self.assertEqual(self.ftp.files[stage], b"existing staging content")

    def test_second_rename_failure_restores_first_asset_and_removes_only_owned_temps(self):
        self.ftp.fail_rename_target = publisher.ROOT + "/" + publisher.ALLOWED[1]
        with self.assertRaises(ConnectionError):
            self.update()
        self.assertNotEqual(self.ftp.files, self.start)
        publisher.rollback(self.ftp, self.manifest, self.originals, "test", self.transaction)
        self.assertEqual(self.ftp.files, self.start)
        deleted = [entry[1] for entry in self.ftp.writes if entry[0] == "delete"]
        self.assertEqual(set(deleted), {publisher.temporary_path(path, "test") for path in publisher.ALLOWED[1:]})

    def test_configurator_rename_failure_restores_prior_assets_and_preserves_page(self):
        self.ftp.fail_rename_target = publisher.ROOT + "/" + publisher.CONFIGURATOR
        with self.assertRaises(ConnectionError):
            self.update()
        publisher.rollback(self.ftp, self.manifest, self.originals, "test", self.transaction)
        self.assertEqual(self.ftp.files, self.start)

    def test_post_publication_failure_can_restore_configurator_and_both_assets(self):
        self.update()
        publisher.rollback(self.ftp, self.manifest, self.originals, "test", self.transaction)
        self.assertEqual(self.ftp.files, self.start)

    def test_rollback_preserves_concurrent_third_party_edit(self):
        self.update()
        edited = publisher.ROOT + "/" + publisher.ALLOWED[1]
        self.ftp.files[edited] = b"concurrent edit after deployment"
        with self.assertRaisesRegex(RuntimeError, "Concurrent asset change preserved"):
            publisher.rollback(self.ftp, self.manifest, self.originals, "test", self.transaction)
        self.assertEqual(self.ftp.files[edited], b"concurrent edit after deployment")
        self.assertEqual(self.ftp.files[publisher.ROOT + "/" + publisher.ALLOWED[0]], self.originals[publisher.ALLOWED[0]])
        self.assertEqual(self.ftp.files["/htdocs/robots.txt"], b"protected robots")

    def test_scope_check_rejects_unrelated_change_but_allows_staging_directory_mtime(self):
        before = {path: {"type": "file", "size": str(len(body)), "modify": "old"} for path, body in self.start.items()}
        before["/htdocs/assets/css"] = {"type": "dir", "modify": "old"}
        after = {path: dict(facts) for path, facts in before.items()}
        after["/htdocs/assets/css"]["modify"] = "new"
        after["/htdocs/assets/css/global-header.css"]["modify"] = "new"
        publisher.verify_change_scope(before, after)
        after["/htdocs/robots.txt"]["modify"] = "new"
        with self.assertRaisesRegex(RuntimeError, "unrelated live file changed"):
            publisher.verify_change_scope(before, after)


class SnapshotFTP(FakeFTP):
    """Read-only backup fixture with explicit directories and changing file facts."""

    def __init__(self, files, directories=()):
        super().__init__(files)
        self.directories = set(directories)
        for path in self.files:
            parent = str(Path(path).parent)
            while parent != publisher.ROOT:
                self.directories.add(parent)
                parent = str(Path(parent).parent)
        self.modified = {path: "20261022000000" for path in self.files}
        self.read_counts = {}
        self.short_reads = {}
        self.after_read = None

    def mlsd(self, folder):
        result = []
        for path in self.directories:
            parent, name = path.rsplit("/", 1)
            if parent == folder:
                result.append((name, {"type": "dir", "modify": "20261022000000"}))
        for path, content in self.files.items():
            parent, name = path.rsplit("/", 1)
            if parent == folder:
                result.append((name, {"type": "file", "size": str(len(content)),
                                      "modify": self.modified.get(path, "20261022000000")}))
        yield from sorted(result)

    def retrbinary(self, command, callback):
        path = command.removeprefix("RETR ")
        self.read_counts[path] = self.read_counts.get(path, 0) + 1
        remaining = self.short_reads.get(path, 0)
        body = self.files[path]
        if remaining:
            body = body[:-1]
            if remaining > 0:
                self.short_reads[path] -= 1
        callback(body)
        if self.after_read:
            self.after_read(path)


class BackupSnapshotTests(unittest.TestCase):
    page = "/htdocs/index.html"
    runtime = "/htdocs/runtime/state.json"

    def setUp(self):
        self.ftp = SnapshotFTP({self.page: b"ORIGINAL page", self.runtime: b"count=1"},
                               directories={"/htdocs/empty"})
        self.manifest = {"index.html": {"before_sha256": publisher.digest(self.ftp.files[self.page])}}
        self.initial = publisher.inventory(self.ftp)
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.site = Path(self.temporary.name)

    def copy(self, max_passes=4):
        return publisher.copy_stable_site(self.ftp, self.site, self.initial, self.manifest,
                                          max_passes=max_passes)

    def assert_complete_read_only_snapshot(self, inventory, files):
        expected = {path.removeprefix("/"): publisher.digest(body)
                    for path, body in self.ftp.files.items()}
        self.assertEqual(files, expected)
        self.assertEqual(inventory, publisher.inventory(self.ftp))
        for name, sha in files.items():
            self.assertEqual(publisher.digest((self.site / name).read_bytes()), sha)
        self.assertTrue((self.site / "htdocs/empty").is_dir())
        self.assertEqual(self.ftp.writes, [])

    def test_stable_snapshot_copies_every_file_and_empty_directory_once(self):
        inventory, files = self.copy()
        self.assertEqual(inventory, self.initial)
        self.assertEqual(self.ftp.read_counts, {self.page: 1, self.runtime: 1})
        self.assert_complete_read_only_snapshot(inventory, files)

    def test_one_incomplete_read_is_retried_without_recopying_stable_files(self):
        self.ftp.short_reads[self.runtime] = 1
        inventory, files = self.copy()
        self.assertEqual(self.ftp.read_counts, {self.page: 1, self.runtime: 2})
        self.assert_complete_read_only_snapshot(inventory, files)

    def test_same_size_runtime_change_is_recopied_against_fresh_facts(self):
        def change_once(path):
            if path == self.runtime and self.ftp.read_counts[path] == 1:
                self.ftp.files[path] = b"count=2"
                self.ftp.modified[path] = "20261022000001"
        self.ftp.after_read = change_once
        inventory, files = self.copy()
        self.assertNotEqual(inventory, self.initial)
        self.assertEqual(self.ftp.read_counts, {self.page: 1, self.runtime: 2})
        self.assert_complete_read_only_snapshot(inventory, files)

    def test_perpetually_incomplete_read_fails_within_the_pass_limit(self):
        self.ftp.short_reads[self.runtime] = -1
        with self.assertRaisesRegex(RuntimeError, "did not stabilise after bounded"):
            self.copy(max_passes=3)
        self.assertEqual(self.ftp.read_counts, {self.page: 1, self.runtime: 3})
        self.assertEqual(self.ftp.writes, [])

    def test_authorised_content_change_is_rejected_on_catch_up(self):
        def change_once(path):
            if path == self.page and self.ftp.read_counts[path] == 1:
                self.ftp.files[path] = b"MODIFIED page"
                self.ftp.modified[path] = "20261022000001"
        self.ftp.after_read = change_once
        with self.assertRaisesRegex(RuntimeError, "authorised file changed during backup: index.html"):
            self.copy()
        self.assertEqual(self.ftp.read_counts[self.page], 2)
        self.assertEqual(self.ftp.writes, [])

    def test_added_or_removed_inventory_path_is_rejected(self):
        for change in ("added", "removed"):
            with self.subTest(change=change):
                ftp = SnapshotFTP({self.page: b"ORIGINAL page", self.runtime: b"count=1"})
                initial = publisher.inventory(ftp)
                def change_paths(path):
                    if path == self.runtime:
                        if change == "added":
                            ftp.files["/htdocs/new-file.txt"] = b"new"
                        else:
                            del ftp.files[self.page]
                ftp.after_read = change_paths
                with TemporaryDirectory() as folder:
                    with self.assertRaisesRegex(RuntimeError, "Live paths changed during backup"):
                        publisher.copy_stable_site(ftp, Path(folder), initial, self.manifest)
                self.assertEqual(ftp.writes, [])

    def test_inventory_file_to_directory_change_is_rejected(self):
        def change_type(path):
            if path == self.runtime:
                del self.ftp.files[path]
                self.ftp.directories.add(path)
        self.ftp.after_read = change_type
        with self.assertRaisesRegex(RuntimeError, "Live paths changed during backup"):
            self.copy()
        self.assertEqual(self.ftp.writes, [])


class ConfiguratorHeaderTests(unittest.TestCase):
    def setUp(self):
        # Small local fixtures exercise the byte-preserving algorithm. Production
        # input and output have independent fixed whole-page SHA-256 checksums.
        self.css = b"<style>legacy header styling only</style>"
        self.js = b"<script>legacy header toggle only</script>"
        self.source = b"<!doctype html><head>" + self.css + b"</head><body>UNTOUCHED CONFIGURATOR\x00\xff" + self.js + b"OTHER SCRIPT AND CONTENT</body>"
        self.expected = self.source.replace(self.css, configurator_header.CSS_LINK).replace(self.js, configurator_header.JS_LINK)
        self.specs = (
            (b"style", publisher.digest(self.css), configurator_header.CSS_LINK),
            (b"script", publisher.digest(self.js), configurator_header.JS_LINK),
        )
        self.constants = patch.multiple(configurator_header,
            LEGACY_PAGE_SHA256=publisher.digest(self.source),
            SHARED_PAGE_SHA256=publisher.digest(self.expected),
            HEADER_REPLACEMENTS=self.specs)
        self.constants.start()
        self.addCleanup(self.constants.stop)

    def test_only_two_header_blocks_change_and_all_other_bytes_survive(self):
        result = configurator_header.externalise_configurator_header(self.source)
        self.assertEqual(result, self.expected)
        restored = result.replace(configurator_header.CSS_LINK, self.css).replace(configurator_header.JS_LINK, self.js)
        self.assertEqual(restored, self.source)

    def test_changed_source_is_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "changed since"):
            configurator_header.externalise_configurator_header(self.source + b"changed")

    def test_duplicate_pinned_header_block_is_rejected(self):
        ambiguous = self.source + self.css
        with patch.object(configurator_header, "LEGACY_PAGE_SHA256", publisher.digest(ambiguous)):
            with self.assertRaisesRegex(RuntimeError, "Exactly one pinned style"):
                configurator_header.externalise_configurator_header(ambiguous)

    def test_missing_pinned_header_block_is_rejected(self):
        missing = self.source.replace(self.js, b"<script>different navigation</script>")
        with patch.object(configurator_header, "LEGACY_PAGE_SHA256", publisher.digest(missing)):
            with self.assertRaisesRegex(RuntimeError, "Exactly one pinned script"):
                configurator_header.externalise_configurator_header(missing)

    def test_unreviewed_output_checksum_is_rejected(self):
        with patch.object(configurator_header, "SHARED_PAGE_SHA256", "0" * 64):
            with self.assertRaisesRegex(RuntimeError, "output checksum"):
                configurator_header.externalise_configurator_header(self.source)


class HeaderReferenceTests(unittest.TestCase):
    css = "assets/css/global-header.css"
    js = "assets/js/global-header.js"

    def test_only_quoted_url_values_change(self):
        source = b'''<!doctype html><head><link href = 'assets/css/global-header.css' rel="stylesheet"></head><body>UNCHANGED\x00\xff<script defer src="assets/js/global-header.js"></script><p>assets/js/global-header.js</p></body>'''
        result = header_references.patch_header_references(source, self.css, self.js)
        expected = source.replace(b"href = '" + self.css.encode() + b"'", b"href = '" + header_references.versioned_url(self.css, "css").encode() + b"'").replace(b'src="' + self.js.encode() + b'"', b'src="' + header_references.versioned_url(self.js, "js").encode() + b'"')
        self.assertEqual(result, expected)
        self.assertIn(b'<p>assets/js/global-header.js</p>', result)

    def test_duplicate_or_missing_matching_reference_is_rejected(self):
        source = b'<link href="assets/css/global-header.css"><script src="assets/js/global-header.js"></script>'
        with self.assertRaisesRegex(RuntimeError, "Exactly one reviewed css"):
            header_references.patch_header_references(source + b'<link href="assets/css/global-header.css">', self.css, self.js)
        with self.assertRaisesRegex(RuntimeError, "Exactly one reviewed js"):
            header_references.patch_header_references(source.replace(b' src=', b' data-src='), self.css, self.js)

    def test_new_version_replaces_old_version_without_changing_other_parameters(self):
        value = "assets/js/global-header.js?other=keep&v=old#anchor"
        self.assertEqual(header_references.versioned_url(value, "js"), "assets/js/global-header.js?other=keep&v=" + header_references.NAV_VERSION + "#anchor")

    def test_unrelated_or_external_asset_url_is_rejected(self):
        for value in ("assets/js/other.js", "https://example.com/assets/js/global-header.js"):
            with self.assertRaises(RuntimeError):
                header_references.versioned_url(value, "js")


if __name__ == "__main__":
    unittest.main()
