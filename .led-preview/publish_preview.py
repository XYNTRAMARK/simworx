"""Back up the live site, then publish exactly one new self-contained review page.

Runs only inside the isolated preview branch's GitHub Actions job. Credentials
come from existing repository secrets and are never written to disk or logged.
"""
from __future__ import annotations

import ftplib
import hashlib
import io
import shutil
import time
import json
import os
from pathlib import Path
import posixpath
import ssl
import sys
import tarfile
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

ROOT = "/htdocs"
TARGET = "/htdocs/admin/simworx-led-preview-v6.html"
PUBLIC_URL = "https://www.sim-worx.com/admin/simworx-led-preview-v6.html"
PREVIEW = Path(".led-preview/simworx-led-preview-v6.html")
EXPECTED_SHA = "be2eba941809a3d54a84a48632fc4c18228e4450060c2f2d26f2ca0c682c9f2e"
WORK = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "simworx-led-preview"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def connect():
    raw = os.environ.get("FTP_HOST", "").strip()
    user = os.environ.get("FTP_USERNAME", "")
    password = os.environ.get("FTP_PASSWORD", "")
    if not raw or not user or not password:
        raise RuntimeError("The existing FTP_HOST, FTP_USERNAME and FTP_PASSWORD GitHub secrets are required.")
    parsed = urlsplit(raw if "://" in raw else "ftp://" + raw)
    if parsed.scheme not in {"ftp", "ftps"} or not parsed.hostname:
        raise RuntimeError("FTP_HOST must identify the hosting FTP/FTPS server.")
    if parsed.username or parsed.password or parsed.path not in {"", "/"}:
        raise RuntimeError("FTP_HOST must contain only the server address; credentials use their separate secrets.")
    ftp = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=45)
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
            raise RuntimeError("Unsafe or ambiguous filename in the live backup; stopped before publishing.")
        if kind not in {"file", "dir"}:
            raise RuntimeError("A complete backup cannot be verified for an unsupported FTP entry type.")
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


def public_bytes(url):
    request = Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "Simworx-LED-review-verification"})
    with urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError("The public website did not return HTTP 200.")
        return response.read()


def validate_preview():
    content = PREVIEW.read_bytes()
    if digest(content) != EXPECTED_SHA:
        raise RuntimeError("Preview bytes differ from the already prepared and tested file.")
    if b"excludedDashboardSolids" not in content or b"LED SCREEN COST" not in content or b"noindex" not in content or b"light-twin-cad" not in content or b"SimworxLED" not in content or b"SUPPLIER COST REVIEW" not in content or b"helicopter-h135-cad" not in content or b"Email sending disabled in preview" not in content:
        raise RuntimeError("The expected self-contained review page is missing.")
    return content


def backup_once():
    validate_preview()
    WORK.mkdir(parents=True, exist_ok=True)
    site = WORK / "site"
    site.mkdir()
    home_sha = digest(public_bytes("https://www.sim-worx.com/?led-review-before=" + EXPECTED_SHA[:12]))
    with connect() as ftp:
        before = inventory(ftp)
        if TARGET in before:
            raise RuntimeError("The preview path already exists. Nothing has been overwritten.")
        if before.get("/htdocs/admin", {}).get("type", "").lower() != "dir":
            raise RuntimeError("The existing /htdocs/admin directory was not found; no directories will be created.")
        manifest = {}
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
                raise RuntimeError("A backup file size did not match the live file.")
            manifest["htdocs/" + relative] = digest(local.read_bytes())
        if inventory(ftp) != before:
            raise RuntimeError("The live files changed while the backup was being made; stopped before any upload.")
    if not manifest or not (site / "htdocs/index.html").is_file():
        raise RuntimeError("The complete live homepage backup could not be verified.")
    (site / "backup-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    archive = WORK / "live-htdocs.tar.gz"
    with tarfile.open(archive, "w:gz") as target:
        target.add(site / "htdocs", arcname="htdocs", recursive=True)
        target.add(site / "backup-manifest.json", arcname="backup-manifest.json")
    with tarfile.open(archive, "r:gz") as check:
        actual = {member.name for member in check.getmembers() if member.isfile() and member.name != "backup-manifest.json"}
        if actual != set(manifest):
            raise RuntimeError("The backup archive does not contain exactly the downloaded live files.")
        for name, sha in manifest.items():
            handle = check.extractfile(name)
            if handle is None or digest(handle.read()) != sha:
                raise RuntimeError("The backup archive failed byte-for-byte verification.")
    (WORK / "verified-backup.json").write_text(json.dumps({"files": len(manifest), "homepage_sha256": home_sha, "preview_sha256": EXPECTED_SHA}) + "\n")
    print("Verified a complete live /htdocs backup: " + str(len(manifest)) + " files. No remote files changed.")



def backup():
    # Retry only read-only network failures. Every attempt starts a fresh full
    # snapshot; publishing still requires the verified and retained backup.
    for attempt in range(1, 4):
        try:
            print("Starting full-site backup attempt " + str(attempt) + ".", flush=True)
            backup_once()
            return
        except (TimeoutError, ConnectionError, EOFError, ftplib.error_temp, ssl.SSLEOFError, URLError) as error:
            if isinstance(error, HTTPError) and error.code not in {429, 500, 502, 503, 504}:
                raise
            if isinstance(error, URLError) and isinstance(error.reason, ssl.SSLCertVerificationError):
                raise
            if attempt == 3:
                raise
            print("::warning::Read-only backup connection interrupted (" + type(error).__name__ + "); restarting the complete backup before any upload.", flush=True)
            site = WORK / "site"
            if site.is_dir():
                shutil.rmtree(site)
            time.sleep(attempt * 3)


def publish():
    content = validate_preview()
    evidence = json.loads((WORK / "verified-backup.json").read_text())
    if evidence["preview_sha256"] != EXPECTED_SHA or evidence["files"] < 1:
        raise RuntimeError("The required verified full backup is missing.")
    # The workflow retains the encrypted, verified backup before calling this.
    if not (WORK / "live-htdocs.tar.gz.enc").is_file():
        raise RuntimeError("The encrypted backup is missing; no upload attempted.")
    temporary = "/htdocs/admin/.led-review-" + EXPECTED_SHA[:16] + ".upload"
    with connect() as ftp:
        current = {posixpath.join("/htdocs/admin", name) for name, _ in entries(ftp, "/htdocs/admin")}
        if TARGET in current or temporary in current:
            raise RuntimeError("A preview or temporary upload already exists; no files overwritten.")
        ftp.storbinary("STOR " + temporary, io.BytesIO(content))
        received = io.BytesIO()
        ftp.retrbinary("RETR " + temporary, received.write)
        if digest(received.getvalue()) != EXPECTED_SHA:
            raise RuntimeError("The new preview upload failed checksum verification.")
        current = {posixpath.join("/htdocs/admin", name) for name, _ in entries(ftp, "/htdocs/admin")}
        if TARGET in current:
            raise RuntimeError("The destination appeared during upload; existing file protected.")
        ftp.rename(temporary, TARGET)
    online = public_bytes(PUBLIC_URL + "?v=" + EXPECTED_SHA[:12])
    if digest(online) != EXPECTED_SHA:
        raise RuntimeError("The hosted preview did not match the prepared file byte for byte.")
    home = public_bytes("https://www.sim-worx.com/?led-review-after=" + EXPECTED_SHA[:12])
    if digest(home) != evidence["homepage_sha256"]:
        raise RuntimeError("The live homepage changed during this run. The preview uploader only writes its one new admin file.")
    print("Verified the exact hosted preview and unchanged live homepage: " + PUBLIC_URL)


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"backup", "publish"}:
        raise SystemExit("Use backup or publish.")
    try:
        {"backup": backup, "publish": publish}[sys.argv[1]]()
    except Exception as error:
        description = str(error)
        for name in ("FTP_HOST", "FTP_USERNAME", "FTP_PASSWORD"):
            value = os.environ.get(name, "")
            if value:
                description = description.replace(value, "[redacted]")
        description = description[:700].replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print("::error::Preview upload stopped (" + type(error).__name__ + "): " + description, file=sys.stderr)
        raise SystemExit(1)
