#!/usr/bin/env python3
"""Deterministic publication tests; never connect to the live host."""
import importlib.util
from pathlib import Path
import posixpath
import unittest

spec = importlib.util.spec_from_file_location("projection_publish", Path(__file__).with_name("publish.py"))
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)

PAYLOAD = (b'<!doctype html><html><head><meta name="robots" content="noindex, nofollow">'
           b'<meta name="simworx-projection-build" content="static-preview"></head><body>Preview</body></html>')
MANIFEST = {"schemaVersion": 1, "path": publish.FILENAME, **publish.fingerprint(PAYLOAD)}
TOKEN = "1" * 32
TEMPORARY = publish.ROOT + "/.projection-preview-" + TOKEN + ".upload"


class FakeFTP:
    def __init__(self, files=None):
        self.files = dict(files or {})
        self.writes = []
        self.corrupt_upload = False
        self.on_upload = None

    def mlsd(self, folder, facts=None):
        return [(posixpath.basename(path), {"type": "file"}) for path in self.files
                if posixpath.dirname(path) == folder]

    def retrbinary(self, command, callback):
        verb, path = command.split(" ", 1)
        assert verb == "RETR"
        callback(self.files[path])

    def storbinary(self, command, source):
        verb, path = command.split(" ", 1)
        assert verb == "STOR"
        self.writes.append(("store", path))
        self.files[path] = b"corrupted" if self.corrupt_upload else source.read()
        if self.on_upload:
            self.on_upload(self)

    def rename(self, old, new):
        self.writes.append(("rename", old, new))
        self.files[new] = self.files.pop(old)

    def delete(self, path):
        self.writes.append(("delete", path))
        del self.files[path]


class FakePublic:
    def __init__(self, ftp):
        self.ftp = ftp
        self.target_wrong = False
        self.protected_changed = False
        self.target_callback = None

    def __call__(self, path, nonce):
        if path == "/" + publish.FILENAME:
            if self.target_callback:
                self.target_callback(self.ftp)
            if self.target_wrong:
                return publish.fingerprint(b"wrong public response")
            return publish.fingerprint(self.ftp.files[publish.TARGET])
        value = path.encode()
        if self.protected_changed and nonce.endswith("-after") and path == "/led-screen-configurator.html":
            value += b"concurrent change"
        return publish.fingerprint(value)


def publisher(ftp, reader=None):
    return publish.SingleFilePublisher(ftp, PAYLOAD, MANIFEST, reader=reader or FakePublic(ftp),
                                       sleeper=lambda _seconds: None, token=TOKEN, attempts=1)


class PublicationTests(unittest.TestCase):
    def test_new_preview_only_writes_fixed_target_and_owned_staging(self):
        protected = {publish.ROOT + path: b"untouched" for path in publish.PROTECTED}
        ftp = FakeFTP(protected)
        result = publisher(ftp).run()
        self.assertEqual(result["status"], "created")
        self.assertEqual(result["protectedFilesUnchanged"], 7)
        self.assertEqual(ftp.files[publish.TARGET], PAYLOAD)
        self.assertNotIn(TEMPORARY, ftp.files)
        self.assertEqual(ftp.writes, [("store", TEMPORARY), ("rename", TEMPORARY, publish.TARGET)])
        for path, value in protected.items():
            self.assertEqual(ftp.files[path], value)

    def test_different_existing_target_is_never_overwritten(self):
        ftp = FakeFTP({publish.TARGET: b"another page"})
        with self.assertRaisesRegex(publish.DeploymentError, "already exists"):
            publisher(ftp).run()
        self.assertEqual(ftp.files[publish.TARGET], b"another page")
        self.assertEqual(ftp.writes, [])

    def test_matching_existing_target_is_idempotent_without_writes(self):
        ftp = FakeFTP({publish.TARGET: PAYLOAD})
        self.assertEqual(publisher(ftp).run()["status"], "already-current")
        self.assertEqual(ftp.writes, [])

    def test_corrupt_staging_is_never_renamed_or_deleted_as_verified_content(self):
        ftp = FakeFTP()
        ftp.corrupt_upload = True
        with self.assertRaisesRegex(publish.DeploymentError, "staged upload"):
            publisher(ftp).run()
        self.assertNotIn(publish.TARGET, ftp.files)
        self.assertEqual(ftp.writes, [("store", TEMPORARY)])

    def test_target_created_by_another_writer_during_upload_is_preserved(self):
        ftp = FakeFTP()
        ftp.on_upload = lambda connection: connection.files.update({publish.TARGET: b"concurrent page"})
        with self.assertRaisesRegex(publish.DeploymentError, "appeared during upload"):
            publisher(ftp).run()
        self.assertEqual(ftp.files, {publish.TARGET: b"concurrent page"})
        self.assertEqual(ftp.writes, [("store", TEMPORARY), ("delete", TEMPORARY)])

    def test_same_target_appearing_during_upload_becomes_idempotent(self):
        ftp = FakeFTP()
        ftp.on_upload = lambda connection: connection.files.update({publish.TARGET: PAYLOAD})
        self.assertEqual(publisher(ftp).run()["status"], "already-current")
        self.assertEqual(ftp.writes, [("store", TEMPORARY), ("delete", TEMPORARY)])

    def test_failed_public_check_removes_only_our_matching_new_preview(self):
        ftp = FakeFTP()
        reader = FakePublic(ftp)
        reader.target_wrong = True
        with self.assertRaisesRegex(publish.DeploymentError, "public preview"):
            publisher(ftp, reader).run()
        self.assertEqual(ftp.files, {})
        self.assertEqual(ftp.writes[-1], ("delete", publish.TARGET))

    def test_failed_public_check_never_deletes_an_existing_matching_preview(self):
        ftp = FakeFTP({publish.TARGET: PAYLOAD})
        reader = FakePublic(ftp)
        reader.target_wrong = True
        with self.assertRaises(publish.DeploymentError):
            publisher(ftp, reader).run()
        self.assertEqual(ftp.files[publish.TARGET], PAYLOAD)
        self.assertEqual(ftp.writes, [])

    def test_concurrent_changed_preview_is_preserved_during_cleanup(self):
        ftp = FakeFTP()
        reader = FakePublic(ftp)
        reader.target_callback = lambda connection: connection.files.update({publish.TARGET: b"later edit"})
        with self.assertRaises(publish.DeploymentError):
            publisher(ftp, reader).run()
        self.assertEqual(ftp.files[publish.TARGET], b"later edit")
        self.assertFalse(any(command[0] == "delete" for command in ftp.writes))

    def test_protected_change_causes_conditional_removal_without_touching_protected_files(self):
        ftp = FakeFTP({publish.ROOT + "/led-screen-configurator.html": b"LED"})
        reader = FakePublic(ftp)
        reader.protected_changed = True
        with self.assertRaisesRegex(publish.DeploymentError, "protected live file"):
            publisher(ftp, reader).run()
        self.assertEqual(ftp.files, {publish.ROOT + "/led-screen-configurator.html": b"LED"})

    def test_existing_staging_file_is_never_overwritten_or_deleted(self):
        ftp = FakeFTP({TEMPORARY: b"unrelated staging"})
        with self.assertRaisesRegex(publish.DeploymentError, "staging path"):
            publisher(ftp).run()
        self.assertEqual(ftp.writes, [])

    def test_cleanup_rejects_any_path_outside_fixed_allowlist(self):
        ftp = FakeFTP({publish.ROOT + "/index.html": PAYLOAD})
        deployment = publisher(ftp)
        self.assertFalse(deployment.conditional_delete(publish.ROOT + "/index.html", True))
        self.assertEqual(ftp.writes, [])

    def test_manifest_cannot_select_an_existing_site_path(self):
        for path in ("index.html", "../index.html", "led-screen-configurator.html", "/htdocs/index.html"):
            with self.subTest(path=path), self.assertRaises(publish.DeploymentError):
                publish.validate_bytes(PAYLOAD, {**MANIFEST, "path": path})

    def test_local_checksum_and_size_are_both_required(self):
        for change in ({"sha256": "0" * 64}, {"size": len(PAYLOAD) + 1}, {"size": True}):
            with self.subTest(change=change), self.assertRaises(publish.DeploymentError):
                publish.validate_bytes(PAYLOAD, {**MANIFEST, **change})

    def test_noindex_and_static_preview_marker_are_required(self):
        for body in (PAYLOAD.replace(b"noindex", b"index"), PAYLOAD.replace(b"static-preview", b"released")):
            with self.subTest(body=body), self.assertRaises(publish.DeploymentError):
                publish.validate_bytes(body, {**MANIFEST, **publish.fingerprint(body)})


if __name__ == "__main__":
    unittest.main(verbosity=2)
