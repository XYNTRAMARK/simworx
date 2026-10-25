"""First deployment of new /htdocs/reports only; never replace existing files.

Run backup, retain an encrypted verified archive in GitHub, then run deploy.
No command in this module deletes, renames, mirrors, or writes an existing file.
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
import ssl
import sys
import tarfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = "/htdocs"
TARGET = ROOT + "/reports"
PUBLIC = "https://www.sim-worx.com"
WORK = Path("/tmp/simworx-reports-deploy")
SOURCE = Path(__file__).resolve().parents[1] / "reports"
FILES = ("app.js", "analytics.js", "config.js", "demo-data.js", "styles.css", "robots.txt", ".htaccess", "index.html")
UPLOAD_ORDER = tuple(name for name in FILES if name != "index.html") + ("deployment.json", "index.html")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stream_hash(handle) -> str:
    checksum = hashlib.sha256()
    while True:
        block = handle.read(1024 * 1024)
        if not block:
            return checksum.hexdigest()
        checksum.update(block)


def file_hash(path: Path) -> str:
    with path.open("rb") as handle:
        return stream_hash(handle)


def canonical(data) -> bytes:
    return (json.dumps(data, sort_keys=True, indent=2) + "\n").encode()


def destination(name: str) -> str:
    """Only fixed direct children of the new reports directory are writable."""
    if name not in UPLOAD_ORDER or "/" in name or "\\" in name:
        raise RuntimeError("File is outside the exact reports payload allowlist.")
    path = posixpath.join(TARGET, name)
    if posixpath.dirname(path) != TARGET:
        raise RuntimeError("Upload destination escaped the reports directory.")
    return path


class VerifiedFTP(ftplib.FTP_TLS):
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
            if str(error).startswith("425") and command.split(" ", 1)[0] in {"RETR", "STOR", "LIST", "MLSD"} and not self.prefer_epsv:
                self.prefer_epsv = True
                return super().ntransfercmd(command, rest)
            raise


def parse_host(raw: str):
    parsed = urlsplit(raw.strip() if "://" in raw else "ftp://" + raw.strip())
    if parsed.scheme not in {"ftp", "ftps"} or not parsed.hostname:
        raise RuntimeError("FTP_HOST must identify an FTP/FTPS host.")
    if parsed.username or parsed.password or parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise RuntimeError("FTP_HOST must contain only the server address and optional port.")
    if any(char in raw for char in "\r\n\x00"):
        raise RuntimeError("FTP_HOST contains unsafe characters.")
    return parsed.hostname, parsed.port or 21


def connect():
    raw = os.environ.get("FTP_HOST", "")
    user, password = os.environ.get("FTP_USERNAME", ""), os.environ.get("FTP_PASSWORD", "")
    if not raw or not user or not password:
        raise RuntimeError("The existing hosting FTP secrets are required.")
    host, port = parse_host(raw)
    ftp = VerifiedFTP(context=ssl.create_default_context(), timeout=45)
    ftp.connect(host, port)
    ftp.login(user, password)
    ftp.prot_p()
    return ftp


def entries(ftp, folder):
    result, seen = [], set()
    for name, facts in ftp.mlsd(folder):
        kind = facts.get("type", "").lower()
        if kind in {"cdir", "pdir"}:
            continue
        if not name or name in {".", ".."} or any(c in name for c in "/\\\r\n\x00") or name in seen:
            raise RuntimeError("Unsafe or duplicate live filename prevents a complete backup.")
        if kind not in {"file", "dir"}:
            raise RuntimeError("Unsupported FTP entry prevents a complete backup.")
        seen.add(name)
        result.append((name, {key: str(facts[key]) for key in ("type", "size", "modify") if key in facts}))
    return sorted(result)


def inventory(ftp, folder=ROOT):
    if folder != ROOT and not folder.startswith(ROOT + "/"):
        raise RuntimeError("Read inventory escaped the website root.")
    result = {}
    for name, facts in entries(ftp, folder):
        remote = posixpath.join(folder, name)
        result[remote] = facts
        if facts["type"].lower() == "dir":
            result.update(inventory(ftp, remote))
    return result


def remote_hash(ftp, path, output=None):
    checksum, length = hashlib.sha256(), 0

    def consume(block):
        nonlocal length
        checksum.update(block)
        length += len(block)
        if output is not None:
            output.write(block)

    ftp.retrbinary("RETR " + path, consume, blocksize=65536)
    return checksum.hexdigest(), length


def public_bytes(path="/", version=""):
    if path != "/" and not path.startswith("/reports/"):
        raise RuntimeError("Unexpected public verification path.")
    url = PUBLIC + path + ("?reports-verification=" + version if version else "")
    request = Request(url, headers={"Cache-Control": "no-cache", "User-Agent": "Simworx-reports-deployment-verification"})
    with urlopen(request, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError("Public verification did not return HTTP 200.")
        return response.read(), dict(response.headers.items())


class RobotsParser(HTMLParser):
    robots = ""

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag.lower() == "meta" and attributes.get("name", "").lower() == "robots":
            self.robots = attributes.get("content", "").lower()


def validate_payload():
    if SOURCE.is_symlink() or not SOURCE.is_dir():
        raise RuntimeError("Reports source must be a real directory.")
    if {path.name for path in SOURCE.iterdir()} != set(FILES):
        raise RuntimeError("Reports source must contain exactly the eight reviewed static files.")
    payload = {}
    for name in FILES:
        path = SOURCE / name
        if path.is_symlink() or not path.is_file() or path.stat().st_size == 0:
            raise RuntimeError("Reports payload includes an empty or non-regular file.")
        payload[name] = path.read_bytes()
    parser = RobotsParser()
    parser.feed(payload["index.html"].decode())
    if not {"noindex", "nofollow"}.issubset(set(re.split(r"[,\s]+", parser.robots))):
        raise RuntimeError("The reports page must declare noindex and nofollow.")
    if b"-Indexes" not in payload[".htaccess"]:
        raise RuntimeError("Reports directory listing must be disabled.")
    hashes = {name: digest(data) for name, data in payload.items()}
    return payload, hashes, digest(canonical(hashes))


def assert_target_absent(state):
    if any(path == TARGET or path.startswith(TARGET + "/") for path in state):
        raise RuntimeError("The reports path already exists. First-deployment code will not overwrite or adopt it.")


def backup():
    payload, hashes, payload_sha = validate_payload()
    if WORK.exists():
        raise RuntimeError("Backup work directory already exists; preserve and review prior evidence before retrying.")
    WORK.mkdir(mode=0o700)
    site = WORK / "site"
    site.mkdir(mode=0o700)
    home, _ = public_bytes("/", payload_sha[:16])
    home_sha = digest(home)
    if not home:
        raise RuntimeError("The protected homepage is empty.")
    (WORK / "homepage-before.html").write_bytes(home)
    checksums = {}
    with connect() as ftp:
        before = inventory(ftp)
        assert_target_absent(before)
        if before.get(ROOT + "/index.html", {}).get("type", "").lower() != "file":
            raise RuntimeError("The expected website root has no regular index.html.")
        for path, facts in sorted(before.items()):
            relative = path[len(ROOT) + 1:]
            local = site / "htdocs" / relative
            if facts["type"].lower() == "dir":
                local.mkdir(parents=True, exist_ok=True)
                continue
            local.parent.mkdir(parents=True, exist_ok=True)
            with local.open("wb") as handle:
                sha, count = remote_hash(ftp, path, handle)
            if "size" in facts and count != int(facts["size"]):
                raise RuntimeError("A live file changed size while being backed up; no upload attempted.")
            checksums[path] = sha
            if len(checksums) % 20 == 0:
                print("Downloaded complete-backup files:", len(checksums), flush=True)
        if inventory(ftp) != before:
            raise RuntimeError("The live inventory changed during backup; no upload attempted.")
        # Independent second reads verify every backed-up file against the server.
        for count, (path, expected) in enumerate(checksums.items(), 1):
            if remote_hash(ftp, path)[0] != expected:
                raise RuntimeError("A live file changed during backup verification; no upload attempted.")
            if count % 20 == 0:
                print("Independently verified backup files:", count, flush=True)
        if inventory(ftp) != before:
            raise RuntimeError("The live inventory changed during backup verification; no upload attempted.")
    archive = WORK / "live-htdocs.tar.gz"
    manifest = {"inventory": before, "sha256": checksums, "homepage_http_sha256": home_sha}
    (site / "backup-manifest.json").write_bytes(canonical(manifest))
    with tarfile.open(archive, "w:gz") as target:
        target.add(site / "htdocs", arcname="htdocs", recursive=True)
        target.add(site / "backup-manifest.json", arcname="backup-manifest.json")
    expected_names = {path.removeprefix("/") for path in checksums}
    with tarfile.open(archive, "r:gz") as check:
        members = {member.name for member in check.getmembers() if member.isfile() and member.name != "backup-manifest.json"}
        if members != expected_names:
            raise RuntimeError("Complete backup archive file list failed verification.")
        for path, expected in checksums.items():
            handle = check.extractfile(path.removeprefix("/"))
            if handle is None or stream_hash(handle) != expected:
                raise RuntimeError("Complete backup archive checksum failed verification.")
    marker = canonical({"project": "simworx-website-intelligence", "commit": os.environ.get("GITHUB_SHA", "source-" + payload_sha), "payload_sha256": payload_sha, "created_at": datetime.now(timezone.utc).isoformat()})
    (WORK / "deployment.json").write_bytes(marker)
    hashes["deployment.json"] = digest(marker)
    evidence = {"version": 1, "inventory": before, "sha256": checksums, "homepage_http_sha256": home_sha,
                "payload_sha256": payload_sha, "payload_files": hashes, "archive_sha256": file_hash(archive),
                "created_at": datetime.now(timezone.utc).isoformat()}
    (WORK / "verified-backup.json").write_bytes(canonical(evidence))
    print("Verified complete read-only /htdocs backup:", len(checksums), "files. No remote writes.", flush=True)


def upload_new_reports(ftp, before, payload):
    """One writable directory and nine exact new files; no deletion or rename."""
    assert_target_absent(before)
    if set(payload) != set(UPLOAD_ORDER):
        raise RuntimeError("Deployment payload does not match the exact reports allowlist.")
    # Recheck immediately before the first write; MKD must fail if someone won a race.
    if inventory(ftp) != before:
        raise RuntimeError("Live inventory changed before the first write.")
    ftp.mkd(TARGET)
    for name in UPLOAD_ORDER:
        path = destination(name)
        existing = {entry_name for entry_name, _ in entries(ftp, TARGET)}
        if name in existing:
            raise RuntimeError("A reports destination already exists; overwrite refused.")
        ftp.storbinary("STOR " + path, io.BytesIO(payload[name]), blocksize=65536)
        if remote_hash(ftp, path)[0] != digest(payload[name]):
            raise RuntimeError("An uploaded reports file failed checksum verification.")


def verify_scope(ftp, before, originals, payload):
    after = inventory(ftp)
    expected_new = {TARGET} | {destination(name) for name in UPLOAD_ORDER}
    if set(after) != set(before) | expected_new:
        raise RuntimeError("Unexpected live paths appeared or disappeared during deployment.")
    verified_count = 0
    for path, facts in before.items():
        if after[path].get("type") != facts.get("type"):
            raise RuntimeError("A pre-existing live path changed type.")
        if facts["type"].lower() == "file" and remote_hash(ftp, path)[0] != originals[path]:
            raise RuntimeError("A pre-existing live file changed during deployment; no whole-site rollback will run.")
        if facts["type"].lower() == "file":
            verified_count += 1
            if verified_count % 20 == 0:
                print("Verified unchanged existing live files:", verified_count, flush=True)
    for name, data in payload.items():
        if remote_hash(ftp, destination(name))[0] != digest(data):
            raise RuntimeError("Reports payload no longer matches the verified build.")


def deploy():
    payload, hashes, payload_sha = validate_payload()
    if os.environ.get("REPORTS_BACKUP_RETAINED") != "true":
        raise RuntimeError("The workflow must retain the encrypted complete backup before deployment.")
    if not re.fullmatch(r"[1-9][0-9]*", os.environ.get("RETAINED_BACKUP_ARTIFACT_ID", "")):
        raise RuntimeError("The retained encrypted backup artifact ID is required.")
    evidence_path = WORK / "verified-backup.json"
    if not evidence_path.is_file():
        raise RuntimeError("A verified complete backup is required.")
    evidence = json.loads(evidence_path.read_text())
    archive = WORK / "live-htdocs.tar.gz"
    encrypted = WORK / "live-htdocs.tar.gz.enc"
    if not archive.is_file() or file_hash(archive) != evidence.get("archive_sha256"):
        raise RuntimeError("The complete verified backup archive is missing or changed.")
    if not encrypted.is_file() or encrypted.stat().st_size == 0:
        raise RuntimeError("The encrypted complete backup must exist before deployment.")
    if evidence.get("payload_sha256") != payload_sha:
        raise RuntimeError("The reports payload changed after its backup was prepared.")
    payload["deployment.json"] = (WORK / "deployment.json").read_bytes()
    if {name: digest(data) for name, data in payload.items()} != evidence.get("payload_files"):
        raise RuntimeError("Reports payload evidence does not match its exact files.")
    before, originals = evidence["inventory"], evidence["sha256"]
    assert_target_absent(before)
    home, _ = public_bytes("/", payload_sha[:16] + "-pre")
    if digest(home) != evidence.get("homepage_http_sha256"):
        raise RuntimeError("The protected public homepage changed after backup; no upload attempted.")
    # All pre-existing files must still match the complete backup before any write.
    with connect() as ftp:
        if inventory(ftp) != before:
            raise RuntimeError("The live inventory changed after backup; no upload attempted.")
        for count, (path, expected) in enumerate(originals.items(), 1):
            if remote_hash(ftp, path)[0] != expected:
                raise RuntimeError("A pre-existing live file changed after backup; no upload attempted.")
            if count % 20 == 0:
                print("Reverified pre-upload live files:", count, flush=True)
        upload_new_reports(ftp, before, payload)
        verify_scope(ftp, before, originals, payload)
    for name in UPLOAD_ORDER:
        if name == ".htaccess":
            continue  # Apache configuration must not be publicly retrievable.
        body, headers = public_bytes("/reports/" + name, hashes.get(name, digest(payload[name]))[:16])
        if digest(body) != digest(payload[name]):
            raise RuntimeError("Public reports content does not match the reviewed build.")
        if name == "index.html":
            parser = RobotsParser()
            parser.feed(body.decode())
            if not {"noindex", "nofollow"}.issubset(set(re.split(r"[,\s]+", parser.robots))):
                raise RuntimeError("The public reports page is missing noindex/nofollow.")
    body, _ = public_bytes("/reports/", payload_sha[:16])
    if digest(body) != digest(payload["index.html"]):
        raise RuntimeError("The /reports/ directory does not serve the reviewed index.")
    home, _ = public_bytes("/", payload_sha[:16] + "-post")
    if digest(home) != evidence["homepage_http_sha256"]:
        raise RuntimeError("The protected public homepage changed during deployment.")
    proof = {"url": PUBLIC + "/reports/", "payload_sha256": payload_sha, "files": evidence["payload_files"],
             "unchanged_existing_files": len(originals), "homepage_http_sha256": digest(home), "completed_at": datetime.now(timezone.utc).isoformat()}
    (WORK / "deployment-verified.json").write_bytes(canonical(proof))
    print("Published only nine new files under /htdocs/reports. Existing live files and public homepage verified unchanged.", flush=True)
    print(PUBLIC + "/reports/", flush=True)


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"backup", "deploy", "validate"}:
        raise RuntimeError("Use validate, backup or deploy.")
    {"validate": validate_payload, "backup": backup, "deploy": deploy}[sys.argv[1]]()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        description = str(error)
        for name in ("FTP_HOST", "FTP_USERNAME", "FTP_PASSWORD"):
            secret = os.environ.get(name, "")
            if secret:
                description = description.replace(secret, "[redacted]")
        description = description[:1000].replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print("::error::Reports deployment stopped (" + type(error).__name__ + "): " + description, file=sys.stderr)
        print("No whole-site rollback or remote cleanup is attempted. Preserve the complete backup and deployment evidence for review.", file=sys.stderr)
        raise SystemExit(1)
