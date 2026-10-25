"""Bounded tests for first-deployment scope; no network or production writes."""
import ftplib
import importlib.util
import io
from pathlib import Path
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

    def mlsd(self, folder):
        if folder not in self.dirs:
            raise ftplib.error_perm("550 missing")
        for path in sorted(self.dirs | set(self.files)):
            if path != folder and str(Path(path).parent) == folder:
                if path in self.dirs:
                    yield Path(path).name, {"type": "dir", "modify": "20261025000000"}
                else:
                    yield Path(path).name, {"type": "file", "size": str(len(self.files[path])), "modify": "20261025000000"}

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
        callback(self.files[command.removeprefix("RETR ")])


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
