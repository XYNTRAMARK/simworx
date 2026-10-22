"""Exercise deployment failures without a network connection or production writes."""
import importlib.util
from pathlib import Path
import unittest

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
        self.start["/htdocs/index.html"] = b"protected homepage"
        self.ftp = FakeFTP(self.start)
        self.transaction = {"started": False, "owned_temps": set()}

    def update(self):
        publisher.stage_and_replace(self.ftp, self.manifest, self.payload, "test", self.transaction)

    def test_success_replaces_only_two_authorised_assets_css_first(self):
        self.update()
        self.assertEqual(set(self.ftp.files), set(self.start))
        self.assertEqual(self.ftp.files["/htdocs/index.html"], b"protected homepage")
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
        self.assertEqual(deleted, [publisher.temporary_path(publisher.ALLOWED[1], "test")])

    def test_rollback_preserves_concurrent_third_party_edit(self):
        self.update()
        edited = publisher.ROOT + "/" + publisher.ALLOWED[1]
        self.ftp.files[edited] = b"concurrent edit after deployment"
        with self.assertRaisesRegex(RuntimeError, "Concurrent asset change preserved"):
            publisher.rollback(self.ftp, self.manifest, self.originals, "test", self.transaction)
        self.assertEqual(self.ftp.files[edited], b"concurrent edit after deployment")
        self.assertEqual(self.ftp.files[publisher.ROOT + "/" + publisher.ALLOWED[0]], self.originals[publisher.ALLOWED[0]])
        self.assertEqual(self.ftp.files["/htdocs/index.html"], b"protected homepage")

    def test_scope_check_rejects_unrelated_change_but_allows_staging_directory_mtime(self):
        before = {path: {"type": "file", "size": str(len(body)), "modify": "old"} for path, body in self.start.items()}
        before["/htdocs/assets/css"] = {"type": "dir", "modify": "old"}
        after = {path: dict(facts) for path, facts in before.items()}
        after["/htdocs/assets/css"]["modify"] = "new"
        after["/htdocs/assets/css/global-header.css"]["modify"] = "new"
        publisher.verify_change_scope(before, after)
        after["/htdocs/index.html"]["modify"] = "new"
        with self.assertRaisesRegex(RuntimeError, "unrelated live file changed"):
            publisher.verify_change_scope(before, after)


if __name__ == "__main__":
    unittest.main()
