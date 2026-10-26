"""Bounded tests for first-deployment scope; no network or production writes."""
import ftplib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("reports_ftp", Path(__file__).with_name("reports_ftp.py"))
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class FakeFTP:
    def __init__(self):
        self.files = {"/htdocs/index.html": b"protected home", "/htdocs/assets/old.js": b"protected asset"}
        self.dirs = {"/htdocs", "/htdocs/assets"}
        self.writes = []
        self.corrupt = None
        self.modified = {}
        self.reads = []

    def mlsd(self, folder):
        if folder not in self.dirs:
            raise ftplib.error_perm("550 missing")
        for path in sorted(self.dirs | set(self.files)):
            if path != folder and str(Path(path).parent) == folder:
                if path in self.dirs:
                    yield Path(path).name, {"type": "dir", "modify": "20261025000000"}
                else:
                    yield Path(path).name, {"type": "file", "size": str(len(self.files[path])), "modify": self.modified.get(path, "20261025000000")}

    def mkd(self, path):
        if path in self.dirs or path in self.files:
            raise ftplib.error_perm("550 already exists")
        self.dirs.add(path)
        self.writes.append(("MKD", path))

    def storbinary(self, command, handle, blocksize=8192):
        path = command.removeprefix("STOR ")
        if path in self.files:
            raise AssertionError("Existing file overwrite attempted")
        self.files[path] = handle.read() + (b"corrupt" if path == self.corrupt else b"")
        self.writes.append(("STOR", path))

    def retrbinary(self, command, callback, blocksize=8192):
        path = command.removeprefix("RETR ")
        self.reads.append(path)
        callback(self.files[path])


class ReportsPublisherTests(unittest.TestCase):
    def payload(self):
        return {name: (name + " reviewed payload").encode() for name in publisher.UPLOAD_ORDER}

    def test_only_exact_direct_reports_children_are_allowed(self):
        for name in publisher.UPLOAD_ORDER:
            self.assertEqual(publisher.destination(name), "/htdocs/reports/" + name)
        for name in ("../index.html", "/htdocs/index.html", "assets/site.js", "other.html", "../reports/index.html", "a\\index.html"):
            with self.assertRaises(RuntimeError):
                publisher.destination(name)

    def test_host_only_parsing_and_rejection(self):
        self.assertEqual(publisher.parse_host("ftp.example.com"), ("ftp.example.com", 21))
        self.assertEqual(publisher.parse_host("ftps://ftp.example.com:2121/"), ("ftp.example.com", 2121))
        for raw in ("https://example.com", "ftp://u:p@example.com", "ftp://example.com/htdocs", "ftp://example.com/?x=1", "ftp://example.com/#x", "example.com\n"):
            with self.assertRaises((RuntimeError, ValueError)):
                publisher.parse_host(raw)

    def test_first_upload_creates_only_reports_and_index_is_last(self):
        ftp = FakeFTP()
        before = publisher.inventory(ftp)
        originals = dict(ftp.files)
        payload = self.payload()
        publisher.upload_new_reports(ftp, before, payload)
        self.assertEqual(ftp.writes[0], ("MKD", "/htdocs/reports"))
        self.assertEqual(ftp.writes[-1], ("STOR", "/htdocs/reports/index.html"))
        self.assertEqual(len(ftp.writes), 10)
        self.assertTrue(all(path.startswith("/htdocs/reports") for _, path in ftp.writes))
        for path, value in originals.items():
            self.assertEqual(ftp.files[path], value)
        publisher.verify_scope(ftp, before, {path: publisher.digest(value) for path, value in originals.items()}, payload)

    def test_existing_empty_reports_directory_is_not_adopted(self):
        ftp = FakeFTP()
        ftp.dirs.add("/htdocs/reports")
        with self.assertRaises(RuntimeError):
            publisher.upload_new_reports(ftp, publisher.inventory(ftp), self.payload())
        self.assertEqual(ftp.writes, [])

    def test_changed_inventory_blocks_first_write(self):
        ftp = FakeFTP()
        before = publisher.inventory(ftp)
        ftp.files["/htdocs/concurrent.txt"] = b"someone else"
        with self.assertRaises(RuntimeError):
            publisher.upload_new_reports(ftp, before, self.payload())
        self.assertEqual(ftp.writes, [])

    def test_extra_payload_file_blocks_first_write(self):
        ftp = FakeFTP()
        payload = self.payload()
        payload["../index.html"] = b"forbidden"
        with self.assertRaises(RuntimeError):
            publisher.upload_new_reports(ftp, publisher.inventory(ftp), payload)
        self.assertEqual(ftp.writes, [])

    def test_checksum_failure_stops_partial_upload_without_cleanup(self):
        ftp = FakeFTP()
        ftp.corrupt = "/htdocs/reports/app.js"
        with self.assertRaises(RuntimeError):
            publisher.upload_new_reports(ftp, publisher.inventory(ftp), self.payload())
        self.assertEqual(ftp.writes, [("MKD", "/htdocs/reports"), ("STOR", "/htdocs/reports/app.js")])
        self.assertEqual(ftp.files["/htdocs/index.html"], b"protected home")

    def test_preexisting_file_changes_fail_final_verification(self):
        ftp = FakeFTP()
        before = publisher.inventory(ftp)
        originals = {path: publisher.digest(data) for path, data in ftp.files.items()}
        publisher.upload_new_reports(ftp, before, self.payload())
        ftp.files["/htdocs/index.html"] = b"concurrent change"
        with self.assertRaises(RuntimeError):
            publisher.verify_scope(ftp, before, originals, self.payload())

    def test_preexisting_nonprotected_file_metadata_change_fails_verification(self):
        ftp = FakeFTP()
        before = publisher.inventory(ftp)
        originals = {path: publisher.digest(data) for path, data in ftp.files.items()}
        publisher.upload_new_reports(ftp, before, self.payload())
        ftp.files["/htdocs/assets/old.js"] = b"changed content"
        ftp.modified["/htdocs/assets/old.js"] = "20261025000001"
        with self.assertRaises(RuntimeError):
            publisher.verify_scope(ftp, before, originals, self.payload())

    def test_protected_homepage_hash_catches_same_size_silent_change(self):
        ftp = FakeFTP()
        before = publisher.inventory(ftp)
        originals = {path: publisher.digest(data) for path, data in ftp.files.items()}
        publisher.upload_new_reports(ftp, before, self.payload())
        ftp.files["/htdocs/index.html"] = b"unexpected!!!!"
        self.assertEqual(len(ftp.files["/htdocs/index.html"]), len(b"protected home"))
        with self.assertRaises(RuntimeError):
            publisher.verify_scope(ftp, before, originals, self.payload())

    def test_protected_shared_header_hashes_catch_silent_content_changes(self):
        for target in ("/htdocs/assets/css/global-header.css", "/htdocs/assets/js/global-header.js"):
            with self.subTest(target=target):
                ftp = FakeFTP()
                ftp.dirs.update({"/htdocs/assets/css", "/htdocs/assets/js"})
                ftp.files[target] = b"header before"
                before = publisher.inventory(ftp)
                originals = {path: publisher.digest(data) for path, data in ftp.files.items()}
                publisher.upload_new_reports(ftp, before, self.payload())
                ftp.files[target] = b"header after!"
                self.assertEqual(len(ftp.files[target]), len(b"header before"))
                with self.assertRaises(RuntimeError):
                    publisher.verify_scope(ftp, before, originals, self.payload())

    def test_stable_backup_resyncs_changed_added_and_removed_files(self):
        old_files = {"/htdocs/index.html": b"old home", "/htdocs/assets/remove.js": b"remove me"}
        new_files = {"/htdocs/index.html": b"new home content", "/htdocs/assets/added.js": b"added content"}

        def state(files, version):
            return {"/htdocs/assets": {"type": "dir", "modify": "20261025000000"}, **{
                path: {"type": "file", "size": str(len(data)), "modify": version} for path, data in files.items()
            }}

        initial = state(old_files, "20261025000000")
        final = state(new_files, "20261025000001")
        active_files = dict(old_files)
        downloads = []

        def downloader(tasks):
            results = {}
            for path, facts, local in tasks:
                downloads.append(path)
                local = Path(local)
                local.parent.mkdir(parents=True, exist_ok=True)
                data = active_files[path]
                self.assertEqual(len(data), int(facts["size"]))
                local.write_bytes(data)
                results[path] = publisher.digest(data)
            return results

        def inventory_reader():
            active_files.clear()
            active_files.update(new_files)
            return final

        with tempfile.TemporaryDirectory() as folder:
            site = Path(folder)
            snapshot, checksums, total_bytes = publisher.stable_copy_site(site, initial, downloader=downloader, inventory_reader=inventory_reader)
            self.assertEqual(snapshot, final)
            self.assertEqual(checksums, {path: publisher.digest(data) for path, data in new_files.items()})
            self.assertEqual(total_bytes, sum(map(len, new_files.values())))
            self.assertEqual((site / "htdocs/index.html").read_bytes(), new_files["/htdocs/index.html"])
            self.assertEqual((site / "htdocs/assets/added.js").read_bytes(), new_files["/htdocs/assets/added.js"])
            self.assertFalse((site / "htdocs/assets/remove.js").exists())
            self.assertEqual(downloads.count("/htdocs/index.html"), 2)

    def test_backup_resync_is_bounded_when_live_files_never_stabilize(self):
        generation = 1

        def state():
            return {"/htdocs/index.html": {"type": "file", "size": str(generation), "modify": str(generation)}}

        initial = state()

        def downloader(tasks):
            result = {}
            for path, facts, local in tasks:
                data = b"x" * int(facts["size"])
                local = Path(local)
                local.parent.mkdir(parents=True, exist_ok=True)
                local.write_bytes(data)
                result[path] = publisher.digest(data)
            return result

        def inventory_reader():
            nonlocal generation
            generation += 1
            return state()

        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(RuntimeError):
                publisher.stable_copy_site(Path(folder), initial, downloader=downloader, inventory_reader=inventory_reader, max_passes=3)
        self.assertLessEqual(generation, 7)

    def test_reports_appearing_during_backup_resync_blocks_deployment(self):
        initial = {"/htdocs/index.html": {"type": "file", "size": "4", "modify": "20261025000000"}}

        def downloader(tasks):
            result = {}
            for path, _, local in tasks:
                self.assertFalse(path.startswith("/htdocs/reports"))
                local = Path(local)
                local.parent.mkdir(parents=True, exist_ok=True)
                local.write_bytes(b"home")
                result[path] = publisher.digest(b"home")
            return result

        def inventory_reader():
            return {**initial, "/htdocs/reports": {"type": "dir", "modify": "20261025000001"}}

        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(RuntimeError):
                publisher.stable_copy_site(Path(folder), initial, downloader=downloader, inventory_reader=inventory_reader)

    def test_unsafe_or_symlink_inventory_entries_are_rejected(self):
        class UnsafeFTP:
            def mlsd(self, folder):
                return iter([("outside", {"type": "OS.unix=slink"})])
        with self.assertRaises(RuntimeError):
            publisher.inventory(UnsafeFTP())

    def test_real_source_payload_is_exact_and_noindex(self):
        payload, hashes, sha = publisher.validate_payload()
        self.assertEqual(set(payload), set(publisher.FILES))
        self.assertEqual(set(hashes), set(publisher.FILES))
        self.assertEqual(len(sha), 64)


if __name__ == "__main__":
    unittest.main()
