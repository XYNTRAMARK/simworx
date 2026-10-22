#!/usr/bin/env python3
"""Publish one new Simworx projection preview; never synchronise the site."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import ftplib
import hashlib
from html.parser import HTMLParser
import io
import json
import os
from pathlib import Path
import posixpath
import re
import ssl
import sys
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import uuid


ROOT = "/htdocs"
FILENAME = "projection-screen-configurator-preview.html"
TARGET = ROOT + "/" + FILENAME
BASE_URL = "https://www.sim-worx.com"
PROTECTED = (
    "/", "/led-screen-configurator.html", "/visual-systems.html",
    "/assets/css/global-header.css", "/assets/js/global-header.js",
    "/sitemap.xml", "/robots.txt",
)
MAX_PAYLOAD_BYTES = 32 * 1024 * 1024
PROJECT_ROOT = Path(__file__).resolve().parents[1]


class DeploymentError(Exception):
    """Messages are fixed, credential-free descriptions safe for action logs."""


def fingerprint(data):
    return {"sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}


class MetaReader(HTMLParser):
    def __init__(self):
        super().__init__()
        self.noindex = False
        self.preview = False

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "meta":
            return
        values = {key.lower(): (value or "") for key, value in attrs}
        name = values.get("name", "").lower()
        content = values.get("content", "").lower()
        if name == "robots" and "noindex" in re.split(r"[\s,;]+", content):
            self.noindex = True
        if name == "simworx-projection-build" and content == "static-preview":
            self.preview = True


def validate_bytes(payload, manifest):
    if not isinstance(manifest, dict) or set(manifest) != {"schemaVersion", "path", "sha256", "size"}:
        raise DeploymentError("The preview manifest has an unsupported shape.")
    if manifest["schemaVersion"] != 1 or manifest["path"] != FILENAME:
        raise DeploymentError("The manifest must identify the fixed new preview file.")
    if not isinstance(manifest["sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", manifest["sha256"]):
        raise DeploymentError("The preview manifest checksum is invalid.")
    if type(manifest["size"]) is not int or not 0 < manifest["size"] <= MAX_PAYLOAD_BYTES:
        raise DeploymentError("The preview manifest byte count is invalid.")
    expected = {key: manifest[key] for key in ("sha256", "size")}
    if fingerprint(payload) != expected:
        raise DeploymentError("The local preview does not match its reviewed manifest.")
    try:
        parser = MetaReader()
        parser.feed(payload.decode("utf-8"))
    except (UnicodeError, ValueError):
        raise DeploymentError("The preview must be valid UTF-8 HTML.") from None
    if not parser.noindex or not parser.preview:
        raise DeploymentError("The preview requires noindex and the static-preview build marker.")
    return expected


def load_payload(root=PROJECT_ROOT):
    try:
        manifest = json.loads((root / ".projection-deploy/manifest.json").read_text(encoding="utf-8"))
        path = root / FILENAME
        if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_PAYLOAD_BYTES:
            raise DeploymentError("The payload must be a bounded regular preview file.")
        payload = path.read_bytes()
    except (OSError, ValueError):
        raise DeploymentError("The local preview or publication manifest could not be read.") from None
    validate_bytes(payload, manifest)
    return payload, manifest


class VerifiedFTP(ftplib.FTP_TLS):
    """Retain certificate verification and TLS for both control and data."""

    prefer_epsv = False

    def makepasv(self):
        if self.prefer_epsv:
            try:
                return ftplib.parse229(self.sendcmd("EPSV"), self.sock.getpeername())
            except ftplib.error_perm:
                pass
        return super().makepasv()

    def ntransfercmd(self, command, rest=None):
        try:
            return super().ntransfercmd(command, rest)
        except ftplib.error_temp as error:
            readonly = command.split(" ", 1)[0] in {"MLSD", "LIST", "RETR"}
            if str(error).startswith("425") and readonly and not self.prefer_epsv:
                self.prefer_epsv = True
                print("Retrying a refused read-only data channel with EPSV.", flush=True)
                return super().ntransfercmd(command, rest)
            raise


def connect():
    raw = os.environ.get("FTP_HOST", "").strip()
    username = os.environ.get("FTP_USERNAME", "")
    password = os.environ.get("FTP_PASSWORD", "")
    if not raw or not username or not password:
        raise DeploymentError("The existing hosting FTP secrets are required.")
    try:
        parsed = urlsplit(raw if "://" in raw else "ftp://" + raw)
        if (parsed.scheme not in {"ftp", "ftps"} or not parsed.hostname
                or parsed.username or parsed.password or parsed.path not in {"", "/"}
                or parsed.query or parsed.fragment):
            raise ValueError()
        port = parsed.port or 21
    except ValueError:
        raise DeploymentError("FTP_HOST must contain only the hosting server address.") from None
    ftp = VerifiedFTP(context=ssl.create_default_context(), timeout=45)
    try:
        ftp.connect(parsed.hostname, port)
        ftp.login(username, password)
        ftp.prot_p()
    except Exception:
        ftp.close()
        raise
    return ftp


def exists(ftp, path):
    parent, name = posixpath.split(path)
    return any(entry == name for entry, _facts in ftp.mlsd(parent, facts=["type"]))


def remote_fingerprint(ftp, path):
    hasher = hashlib.sha256()
    size = 0

    def consume(chunk):
        nonlocal size
        size += len(chunk)
        if size > MAX_PAYLOAD_BYTES:
            raise DeploymentError("An existing remote file exceeds the preview payload limit.")
        hasher.update(chunk)

    ftp.retrbinary("RETR " + path, consume)
    return {"sha256": hasher.hexdigest(), "size": size}


def public_fingerprint(path, nonce):
    if path not in PROTECTED + ("/" + FILENAME,):
        raise DeploymentError("Public verification requested an unapproved path.")
    request = Request(BASE_URL + path + "?projection-preview-verification=" + nonce,
                      headers={"Cache-Control": "no-cache", "User-Agent": "Simworx-projection-preview-verification"})
    with urlopen(request, timeout=45, context=ssl.create_default_context()) as response:
        destination = urlsplit(response.geturl())
        if (response.status != 200 or destination.scheme != "https"
                or destination.hostname not in {"www.sim-worx.com", "sim-worx.com"}):
            raise DeploymentError("HTTPS verification did not return the expected Simworx response.")
        hasher = hashlib.sha256()
        size = 0
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > 64 * 1024 * 1024:
                raise DeploymentError("A protected public response exceeds the verification limit.")
            hasher.update(chunk)
        return {"sha256": hasher.hexdigest(), "size": size}


def protected_snapshot(reader, nonce):
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda path: reader(path, nonce), PROTECTED))
    return dict(zip(PROTECTED, results))


class SingleFilePublisher:
    def __init__(self, ftp, payload, manifest, reader=public_fingerprint,
                 sleeper=time.sleep, token=None, attempts=5):
        self.expected = validate_bytes(payload, manifest)
        self.ftp, self.payload, self.reader, self.sleeper = ftp, payload, reader, sleeper
        self.token = token or uuid.uuid4().hex
        if not re.fullmatch(r"[0-9a-f]{32}", self.token):
            raise DeploymentError("The temporary upload identifier is invalid.")
        self.temporary = ROOT + "/.projection-preview-" + self.token + ".upload"
        self.attempts = max(1, min(int(attempts), 5))
        self.temporary_owned = False
        self.target_created = False
        self.phase = "initialisation"

    def matches(self, path):
        return exists(self.ftp, path) and remote_fingerprint(self.ftp, path) == self.expected

    def conditional_delete(self, path, owned):
        if path not in (self.temporary, TARGET) or not owned:
            return False
        try:
            if self.matches(path):
                self.ftp.delete(path)
                return True
        except Exception:
            pass
        return False

    def cleanup(self):
        # A renamed file is ours only after RNTO returned success. If the
        # connection fails during rename, preserve the uncertain outcome.
        self.conditional_delete(TARGET, self.target_created)
        self.conditional_delete(self.temporary, self.temporary_owned)

    def verify_public_target(self):
        for attempt in range(self.attempts):
            try:
                actual = self.reader("/" + FILENAME, self.token + "-" + str(attempt))
                if actual == self.expected:
                    return
            except Exception:
                pass
            if attempt + 1 < self.attempts:
                self.sleeper(3)
        raise DeploymentError("The public preview could not be verified against the reviewed payload.")

    def run(self):
        try:
            self.phase = "protected baseline"
            baseline = protected_snapshot(self.reader, self.token + "-before")
            self.phase = "create-only preflight"
            if exists(self.ftp, TARGET):
                if not self.matches(TARGET):
                    raise DeploymentError("The preview target already exists with different content; no overwrite is allowed.")
                status = "already-current"
            else:
                if exists(self.ftp, self.temporary):
                    raise DeploymentError("The unique staging path already exists; it will not be overwritten.")
                self.phase = "staging"
                self.temporary_owned = True
                self.ftp.storbinary("STOR " + self.temporary, io.BytesIO(self.payload))
                if not self.matches(self.temporary):
                    raise DeploymentError("The staged upload failed its checksum verification.")
                self.phase = "final target recheck"
                if exists(self.ftp, TARGET):
                    if not self.matches(TARGET):
                        raise DeploymentError("The target appeared during upload; the concurrent file was preserved.")
                    if not self.conditional_delete(self.temporary, True):
                        raise DeploymentError("The redundant staged upload could not be removed safely.")
                    status = "already-current"
                else:
                    self.phase = "rename new preview"
                    self.ftp.rename(self.temporary, TARGET)
                    self.target_created = True
                    if not self.matches(TARGET):
                        raise DeploymentError("The final remote preview failed its checksum verification.")
                    status = "created"
            self.phase = "public preview verification"
            self.verify_public_target()
            self.phase = "protected final verification"
            if protected_snapshot(self.reader, self.token + "-after") != baseline:
                raise DeploymentError("A protected live file changed during publication; existing files will not be restored or overwritten.")
            self.phase = "complete"
            return {"status": status, "url": BASE_URL + "/" + FILENAME,
                    **self.expected, "protectedFilesUnchanged": len(PROTECTED)}
        except Exception:
            self.cleanup()
            raise


def main():
    mode = sys.argv[1] if len(sys.argv) == 2 else ""
    if mode not in {"validate", "publish"}:
        print("Usage: python3 .projection-deploy/publish.py validate|publish", file=sys.stderr)
        return 2
    ftp, publisher = None, None
    phase = "local validation"
    try:
        payload, manifest = load_payload()
        if mode == "validate":
            print(json.dumps({"status": "validated", "path": FILENAME, **fingerprint(payload)}))
            return 0
        phase = "verified FTPS connection"
        ftp = connect()
        publisher = SingleFilePublisher(ftp, payload, manifest)
        result = publisher.run()
        print(json.dumps(result))
        return 0
    except DeploymentError as error:
        print("Projection preview publication stopped: " + str(error), file=sys.stderr)
        return 1
    except Exception as error:
        phase = publisher.phase if publisher is not None else phase
        print("Projection preview publication failed during " + phase + " (" + type(error).__name__ + "). Credential details withheld.", file=sys.stderr)
        return 1
    finally:
        if ftp is not None:
            try:
                ftp.quit()
            except Exception:
                ftp.close()


if __name__ == "__main__":
    raise SystemExit(main())
