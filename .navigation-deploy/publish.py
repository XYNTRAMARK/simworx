"""Publish only the two shared-header assets authorised for the Visual Systems menu.

A complete verified and retained encrypted /htdocs backup is required before
any write. Existing public pages and private configuration are never deployed.
"""
from __future__ import annotations

import ftplib
import hashlib
import io
import json
import os
from pathlib import Path
import posixpath
import re
import shutil
import ssl
import sys
import tarfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = "/htdocs"
BASE_URL = "https://www.sim-worx.com"
# The order is deliberate: styling is ready before the JavaScript enables it.
ALLOWED = ("assets/css/global-header.css", "assets/js/global-header.js")
PROTECTED_PUBLIC = {
    "/": "f16e29fd6759eb3f3ce99cf38c8694ecbf2a0400b702d71513086f17e5729903",
    "/visual-systems.html": "dfd5672e16a6baab6e1eef6866577a4e52e3cca230f4e29988fac47391e8324e",
    "/led-screen-configurator.html": "e953f572b5021706a84dfa7105de3b4ab3686379ca9fc9e03c2b0cc9621d516f",
}
WORK = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "simworx-navigation-live"
MANIFEST = Path(".navigation-deploy/manifest.json")


def digest(data):
    return hashlib.sha256(data).hexdigest()


class VerifiedFTP(ftplib.FTP_TLS):
    """Use verified FTPS; retry a refused read-only data channel with EPSV."""

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
                print("Retrying refused read-only data channel with EPSV.", flush=True)
                return super().ntransfercmd(command, rest)
            raise


def connect():
    raw = os.environ.get("FTP_HOST", "").strip()
    user = os.environ.get("FTP_USERNAME", "")
    password = os.environ.get("FTP_PASSWORD", "")
    if not raw or not user or not password:
        raise RuntimeError("The existing hosting FTP secrets are required.")
    parsed = urlsplit(raw if "://" in raw else "ftp://" + raw)
    if parsed.scheme not in {"ftp", "ftps"} or not parsed.hostname:
        raise RuntimeError("FTP_HOST must identify the hosting FTP/FTPS server.")
    if parsed.username or parsed.password or parsed.path not in {"", "/"}:
        raise RuntimeError("FTP_HOST must contain only the server address.")
    ftp = VerifiedFTP(context=ssl.create_default_context(), timeout=45)
    ftp.connect(parsed.hostname, parsed.port or 21)
    ftp.login(user, password)
    ftp.prot_p()
    return ftp


def entries(ftp, folder):
    result = []
    for name, facts in ftp.mlsd(folder):
        kind = facts.get("type", "").lower()
        if kind in {"cdir", "pdir"}:
            continue
        if not name or name in {".", ".."} or any(c in name for c in "/\\\r\n\x00"):
            raise RuntimeError("Unsafe filename in the live backup.")
        if kind not in {"file", "dir"}:
            raise RuntimeError("Unsupported FTP entry prevents a complete backup.")
        result.append((name, facts))
    return sorted(result, key=lambda pair: pair[0])


def inventory(ftp, folder=ROOT):
    result = {}
    for name, facts in entries(ftp, folder):
        remote = posixpath.join(folder, name)
        result[remote] = {k: facts[k] for k in ("type", "size", "modify") if k in facts}
        if facts["type"].lower() == "dir":
            result.update(inventory(ftp, remote))
    return result


def remote_bytes(ftp, path):
    data = io.BytesIO()
    ftp.retrbinary("RETR " + path, data.write)
    return data.getvalue()


def exists(ftp, path):
    return posixpath.basename(path) in {name for name, _ in entries(ftp, posixpath.dirname(path))}


def public_bytes(path, version=None):
    url = BASE_URL + path
    if version:
        url += "?nav-verification=" + version
    request = Request(url, headers={
        "Cache-Control": "no-cache", "User-Agent": "Simworx-navigation-verification"
    })
    with urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError("Public verification did not return HTTP 200.")
        return response.read()


def validate_payload():
    manifest = json.loads(MANIFEST.read_text())
    if set(manifest) != set(ALLOWED):
        raise RuntimeError("Publication manifest differs from the exact two-asset allowlist.")
    payload = {}
    for path in ALLOWED:
        entry = manifest[path]
        if set(entry) != {"before_sha256", "after_sha256"}:
            raise RuntimeError("Publication manifest has unexpected fields.")
        if any(not isinstance(sha, str) or not re.fullmatch(r"[a-f0-9]{64}", sha) for sha in entry.values()):
            raise RuntimeError("Publication manifest requires complete SHA-256 checksums.")
        payload[path] = Path(path).read_bytes()
        if digest(payload[path]) != entry["after_sha256"]:
            raise RuntimeError("Prepared asset differs from its reviewed checksum: " + path)
    if all(entry["before_sha256"] == entry["after_sha256"] for entry in manifest.values()):
        raise RuntimeError("Publication manifest must describe at least one intentional asset change.")
    manifest_sha = digest(json.dumps(manifest, sort_keys=True).encode())
    return manifest, payload, manifest_sha


def verify_public(expected):
    actual = {path: digest(public_bytes(path)) for path in expected}
    if actual != expected:
        raise RuntimeError("A protected public page differs from the prepared baseline.")
    return actual


def backup_once():
    manifest, _, manifest_sha = validate_payload()
    WORK.mkdir(parents=True, exist_ok=True)
    site = WORK / "site"
    site.mkdir()
    protected = verify_public(PROTECTED_PUBLIC)
    with connect() as ftp:
        before = inventory(ftp)
        for path in ALLOWED:
            remote = ROOT + "/" + path
            if before.get(remote, {}).get("type", "").lower() != "file":
                raise RuntimeError("An authorised existing header asset is unavailable.")
            if digest(remote_bytes(ftp, remote)) != manifest[path]["before_sha256"]:
                raise RuntimeError("A live header asset changed; review it before publishing.")
        (WORK / "before-inventory.json").write_text(json.dumps(before, sort_keys=True))
        files = {}
        for remote, facts in sorted(before.items()):
            relative = remote.removeprefix(ROOT + "/")
            local = site / "htdocs" / relative
            if facts["type"].lower() == "dir":
                local.mkdir(parents=True, exist_ok=True)
                continue
            local.parent.mkdir(parents=True, exist_ok=True)
            with local.open("wb") as handle:
                ftp.retrbinary("RETR " + remote, handle.write)
            if "size" in facts and local.stat().st_size != int(facts["size"]):
                raise RuntimeError("A backup file size differs from the live inventory.")
            files["htdocs/" + relative] = digest(local.read_bytes())
            if len(files) % 25 == 0:
                print("Backed up " + str(len(files)) + " live files.", flush=True)
        if inventory(ftp) != before:
            raise RuntimeError("Live files changed during the backup; no upload attempted.")
    for path in ALLOWED:
        if files.get("htdocs/" + path) != manifest[path]["before_sha256"]:
            raise RuntimeError("The backed-up header asset does not match the approved baseline.")
    for path, sha in protected.items():
        source = "htdocs/" + ("index.html" if path == "/" else path.lstrip("/"))
        if files.get(source) != sha:
            raise RuntimeError("The public page backup differs from the protected live baseline.")
    (site / "backup-manifest.json").write_text(json.dumps(files, indent=2) + "\n")
    archive = WORK / "live-htdocs.tar.gz"
    with tarfile.open(archive, "w:gz") as target:
        target.add(site / "htdocs", arcname="htdocs", recursive=True)
        target.add(site / "backup-manifest.json", arcname="backup-manifest.json")
    with tarfile.open(archive, "r:gz") as check:
        actual = {m.name for m in check.getmembers() if m.isfile() and m.name != "backup-manifest.json"}
        if actual != set(files):
            raise RuntimeError("Backup archive file list differs from the complete live backup.")
        for name, sha in files.items():
            handle = check.extractfile(name)
            if handle is None or digest(handle.read()) != sha:
                raise RuntimeError("Backup archive failed byte-for-byte verification.")
    evidence = {"files": len(files), "manifest_sha256": manifest_sha, "protected_pages": protected}
    (WORK / "verified-backup.json").write_text(json.dumps(evidence) + "\n")
    print("Verified a complete live /htdocs backup: " + str(len(files)) + " files. No remote writes.", flush=True)


def backup():
    # Only read-only transient failures are retried; each attempt is a fresh snapshot.
    for attempt in range(1, 4):
        try:
            print("Starting complete live backup attempt " + str(attempt) + ".", flush=True)
            backup_once()
            return
        except (TimeoutError, ConnectionError, EOFError, ftplib.error_temp, ssl.SSLEOFError, URLError) as error:
            if isinstance(error, HTTPError) and error.code not in {429, 500, 502, 503, 504}:
                raise
            if isinstance(error, URLError) and isinstance(error.reason, ssl.SSLCertVerificationError):
                raise
            if attempt == 3:
                raise
            print("::warning::Read-only connection interrupted; restarting the complete backup.", flush=True)
            shutil.rmtree(WORK / "site", ignore_errors=True)
            time.sleep(attempt * 15)


def temporary_path(path, token, rollback=False):
    folder, name = posixpath.split(ROOT + "/" + path)
    suffix = ".rollback" if rollback else ".upload"
    return folder + "/.simworx-nav-" + token + "-" + name + suffix


def stage_and_replace(ftp, manifest, payload, token, transaction):
    staged = {path: temporary_path(path, token) for path in ALLOWED}
    for path in ALLOWED:
        if exists(ftp, staged[path]) or exists(ftp, temporary_path(path, token, rollback=True)):
            raise RuntimeError("A staging destination already exists; no existing staging file overwritten.")
        if digest(remote_bytes(ftp, ROOT + "/" + path)) != manifest[path]["before_sha256"]:
            raise RuntimeError("A live header asset changed immediately before publication.")
    for path in ALLOWED:
        transaction["started"] = True
        transaction["owned_temps"].add(staged[path])
        ftp.storbinary("STOR " + staged[path], io.BytesIO(payload[path]))
        if digest(remote_bytes(ftp, staged[path])) != manifest[path]["after_sha256"]:
            raise RuntimeError("A staged header asset failed checksum verification.")
    for path in ALLOWED:
        target = ROOT + "/" + path
        if digest(remote_bytes(ftp, target)) != manifest[path]["before_sha256"]:
            raise RuntimeError("A live asset changed before its atomic replacement.")
        # Direct rename over the authorised existing target; no delete/fallback gap.
        ftp.rename(staged[path], target)
        transaction["owned_temps"].discard(staged[path])
        if digest(remote_bytes(ftp, target)) != manifest[path]["after_sha256"]:
            raise RuntimeError("A replaced header asset failed checksum verification.")


def rollback(ftp, manifest, originals, token, transaction):
    failures = []
    for path in reversed(ALLOWED):
        target = ROOT + "/" + path
        try:
            current = digest(remote_bytes(ftp, target))
            if current == manifest[path]["before_sha256"]:
                continue
            if current != manifest[path]["after_sha256"]:
                raise RuntimeError("Concurrent asset change preserved; automatic rollback refused.")
            temporary = temporary_path(path, token, rollback=True)
            if exists(ftp, temporary):
                raise RuntimeError("Rollback staging path unexpectedly exists.")
            transaction["owned_temps"].add(temporary)
            ftp.storbinary("STOR " + temporary, io.BytesIO(originals[path]))
            if digest(remote_bytes(ftp, temporary)) != manifest[path]["before_sha256"]:
                raise RuntimeError("Staged rollback content failed checksum verification.")
            if digest(remote_bytes(ftp, target)) != manifest[path]["after_sha256"]:
                raise RuntimeError("Concurrent asset change preserved before rollback rename.")
            ftp.rename(temporary, target)
            transaction["owned_temps"].discard(temporary)
            if digest(remote_bytes(ftp, target)) != manifest[path]["before_sha256"]:
                raise RuntimeError("Restored header asset failed checksum verification.")
        except Exception as error:
            failures.append(path + ": " + type(error).__name__ + " " + str(error))
    for temporary in tuple(transaction["owned_temps"]):
        try:
            # Only temporary files exclusively created by this attempt can be removed.
            if exists(ftp, temporary):
                ftp.delete(temporary)
            transaction["owned_temps"].discard(temporary)
        except Exception as error:
            failures.append("Temporary cleanup: " + type(error).__name__)
    if failures:
        raise RuntimeError("Rollback needs review; the encrypted full backup is retained. " + "; ".join(failures))
    print("Restored both original header assets from the verified backup.", flush=True)


def verify_change_scope(before, after):
    if set(before) != set(after):
        raise RuntimeError("The live inventory gained or lost an unexpected path.")
    targets = {ROOT + "/" + path for path in ALLOWED}
    parents = {posixpath.dirname(path) for path in targets}
    for path, facts in before.items():
        if path in targets:
            if after[path].get("type", "").lower() != "file":
                raise RuntimeError("A header asset is no longer a regular file.")
        elif path in parents:
            # Staging/rename updates the containing directory's timestamp.
            if after[path].get("type") != facts.get("type"):
                raise RuntimeError("A containing asset directory changed type.")
        elif after[path] != facts:
            raise RuntimeError("An unrelated live file changed during publication.")


def publish():
    manifest, payload, manifest_sha = validate_payload()
    evidence = json.loads((WORK / "verified-backup.json").read_text())
    if evidence.get("manifest_sha256") != manifest_sha or evidence.get("files", 0) < 1:
        raise RuntimeError("A verified complete backup for this manifest is required.")
    if not (WORK / "live-htdocs.tar.gz.enc").is_file() or not os.environ.get("RETAINED_BACKUP_ARTIFACT_ID"):
        raise RuntimeError("A retained encrypted backup artifact is required before publication.")
    before = json.loads((WORK / "before-inventory.json").read_text())
    originals = {path: (WORK / "site/htdocs" / path).read_bytes() for path in ALLOWED}
    for path in ALLOWED:
        if digest(originals[path]) != manifest[path]["before_sha256"]:
            raise RuntimeError("Original header asset backup checksum is invalid.")
    token = manifest_sha[:12] + "-" + str(time.time_ns())
    transaction = {"started": False, "owned_temps": set()}
    try:
        with connect() as ftp:
            if inventory(ftp) != before:
                raise RuntimeError("Live files changed after backup; no upload attempted.")
            stage_and_replace(ftp, manifest, payload, token, transaction)
            verify_change_scope(before, inventory(ftp))
        for path in ALLOWED:
            expected = manifest[path]["after_sha256"]
            for version in (None, expected[:16]):
                if digest(public_bytes("/" + path, version)) != expected:
                    raise RuntimeError("Public header asset differs from the tested build: " + path)
        verify_public(evidence["protected_pages"])
    except Exception:
        if transaction["started"]:
            # A fresh verified connection can recover even after a failed data channel.
            with connect() as ftp:
                rollback(ftp, manifest, originals, token, transaction)
        raise
    print("Published exactly the two shared-header assets. Verified HTTPS checksums, unchanged public pages and unrelated inventory.", flush=True)


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"backup", "publish", "validate"}:
        raise SystemExit("Use validate, backup or publish.")
    try:
        {"validate": validate_payload, "backup": backup, "publish": publish}[sys.argv[1]]()
    except Exception as error:
        description = str(error)
        for name in ("FTP_HOST", "FTP_USERNAME", "FTP_PASSWORD"):
            value = os.environ.get(name, "")
            if value:
                description = description.replace(value, "[redacted]")
        description = description[:1000].replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print("::error::Navigation publication stopped (" + type(error).__name__ + "): " + description, file=sys.stderr)
        raise SystemExit(1)
