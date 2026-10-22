"""Publish only the owner-requested guided projection preview update.

A fresh full verified, encrypted and retained /htdocs backup precedes writes.
The existing LED configurator, navigation and all other files are protected.
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

ROOT="/htdocs"
BASE_URL="https://www.sim-worx.com"
FILENAME='projection-screen-configurator-preview.html'
TARGET=ROOT+"/"+FILENAME
PUBLIC_URL=BASE_URL+"/"+FILENAME
PAYLOAD={'projection-screen-configurator-preview.html': {'target': '/htdocs/projection-screen-configurator-preview.html', 'source': 'projection-screen-configurator-preview.html', 'sha256': 'b49b4f2c0d5462b0c4636dde2ccdf1b1d958f5f78eefd515c60e323aaeaff562'}}
PROTECTED_PUBLIC={'/': '821c1f756ad8ca205bb04d7d6f5dd76e8dbb80af9a46cdac85247040bad02d87', '/led-screen-configurator.html': '659e06b8ec6f937ac80a4eaec5e1dd3b0a23e0d414f3de80d21b56f366f52b4d', '/visual-systems.html': '2bc0c67220c9b3be59339c4e5b95697f0b8b67a35a984db09c90c89f19e61d59', '/assets/css/global-header.css': 'ae395a0357f03efcaa1c9467ed4071186f422e267dbbec0056c71e9659661007', '/assets/js/global-header.js': '7d9535c5db36b18a1a556bdad9c3eaf86cb4c2394101dbfa48406c379dcadd99', '/sitemap.xml': '0a55385d1dc8ae62153cdb6f584f8813d75c1a55389706badb10df9ac4c2e65c', '/robots.txt': '2dca06af68eefa426114379271f4619708c6cd5ad9d862233e9b3cf8d361b82b'}
EXPECTED_OLD='cce65b77df49d04b74944790f8487fabf1e117271cb7560485dfb5aa0417fd9a'
EXPECTED_SHA='e9a3d9e9f56f92b627815b95413c2447fc7bfdf08fcadf0553a1ffb831d5e7e4'
WORK=Path(os.environ.get("RUNNER_TEMP","/tmp"))/"simworx-projection-guided"

def digest(data):
    return hashlib.sha256(data).hexdigest()


class ReviewFTP(ftplib.FTP_TLS):
    """Try extended passive mode after a read-only data-channel refusal."""
    prefer_epsv = False

    def makepasv(self):
        if self.prefer_epsv:
            try:
                return ftplib.parse229(self.sendcmd("EPSV"), self.sock.getpeername())
            except ftplib.error_perm:
                pass  # Servers without EPSV retain standard passive mode.
        return super().makepasv()

    def ntransfercmd(self, command, rest=None):
        try:
            return super().ntransfercmd(command, rest)
        except ftplib.error_temp as error:
            readonly = command.split(" ", 1)[0] in {"MLSD", "LIST", "RETR"}
            if str(error).startswith("425") and readonly and not self.prefer_epsv:
                self.prefer_epsv = True
                print("Read-only FTP data channel refused; retrying with extended passive mode.", flush=True)
                return super().ntransfercmd(command, rest)
            raise


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
    ftp = ReviewFTP(context=ssl.create_default_context(), timeout=45)
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


def validate_payload():
    if FILENAME!="projection-screen-configurator-preview.html" or TARGET!="/htdocs/projection-screen-configurator-preview.html" or set(PAYLOAD)!={FILENAME}:raise RuntimeError("Only the requested projection preview HTML is authorised.")
    info=PAYLOAD[FILENAME]
    if info["target"]!=TARGET or info["source"]!=FILENAME:raise RuntimeError("Path differs from the one-page allowlist.")
    if digest(json.dumps(PAYLOAD,sort_keys=True).encode())!=EXPECTED_SHA:raise RuntimeError("Prepared manifest changed.")
    html=Path(info["source"]).read_bytes();manifest=json.loads(Path('.projection-deploy/manifest.json').read_text())
    if manifest!={"schemaVersion":1,"path":FILENAME,"sha256":info["sha256"],"size":len(html)} or digest(html)!=info["sha256"]:raise RuntimeError("Prepared page failed its reviewed manifest checksum.")
    for marker in [b'noindex,nofollow',b'simworx-projection-build',b'static-preview',b'guided-steps',b'guided-calculate',b'guided-mounting',b'Find the best tested layout',b'guided-manual',b'Budget not verified',b'www.xyntraholdings.com',b'room-budget-auto-layout-v1']:
        if marker not in html:raise RuntimeError("Required guided preview feature is missing.")
    return {FILENAME:html}

def remote_sha(ftp,path):
    h=hashlib.sha256();ftp.retrbinary("RETR "+path,h.update);return h.hexdigest()

def copy_stable_site(ftp, site, initial, manifest, max_passes=4):
    """Copy every file, then re-read changed files until the inventory is stable.

    This is read-only on the server. An incomplete read is never accepted, and
    a changing authorised page still has to match its reviewed checksum.
    """
    snapshot = initial
    copied = {}
    files = {}
    for pass_number in range(1, max_passes + 1):
        for remote, facts in sorted(snapshot.items()):
            relative = remote.removeprefix(ROOT + "/")
            local = site / "htdocs" / relative
            if facts["type"].lower() == "dir":
                local.mkdir(parents=True, exist_ok=True)
                continue
            if copied.get(remote) == facts:
                continue
            local.parent.mkdir(parents=True, exist_ok=True)
            with local.open("wb") as handle:
                ftp.retrbinary("RETR " + remote, handle.write)
            size = local.stat().st_size
            if "size" in facts and size != int(facts["size"]):
                copied.pop(remote, None)
                files.pop("htdocs/" + relative, None)
                print("Rechecking backup file " + relative + ": inventory size "
                      + facts["size"] + ", copied size " + str(size) + ".", flush=True)
                continue
            sha = digest(local.read_bytes())
            if relative in manifest and sha != manifest[relative]["before_sha256"]:
                raise RuntimeError("An authorised file changed during backup: " + relative)
            copied[remote] = dict(facts)
            files["htdocs/" + relative] = sha
            if pass_number == 1 and len(files) % 25 == 0:
                print("Backed up " + str(len(files)) + " live files.", flush=True)
        current = inventory(ftp)
        if set(current) != set(initial) or any(
            current[path].get("type") != initial[path].get("type") for path in initial
        ):
            raise RuntimeError("Live paths changed during backup; no upload attempted.")
        expected_files = {path for path, facts in current.items() if facts["type"].lower() == "file"}
        if current == snapshot and set(copied) == expected_files and all(
            copied[path] == current[path] for path in expected_files
        ):
            return current, files
        changed = [path.removeprefix(ROOT + "/") for path in sorted(expected_files)
                   if copied.get(path) != current[path]]
        print("Backup verification pass " + str(pass_number) + ": re-read required for "
              + str(len(changed)) + " files: " + ", ".join(changed[:10]) + ".", flush=True)
        snapshot = current
    raise RuntimeError("Live backup did not stabilise after bounded verification passes; no upload attempted.")


class SnapshotChanged(RuntimeError):
    "A read-only full backup no longer matches its initial inventory."

def backup_once():
    validate_payload()
    WORK.mkdir(parents=True, exist_ok=True)
    site = WORK / "site"
    site.mkdir()
    protected={path:digest(public_bytes(BASE_URL+path)) for path in PROTECTED_PUBLIC}
    if protected!=PROTECTED_PUBLIC:raise RuntimeError("An existing public page changed since the prepared baseline.")
    home_sha=protected["/"]
    with connect() as ftp:
        before = inventory(ftp)
        if TARGET not in before or remote_sha(ftp,TARGET)!=EXPECTED_OLD:raise RuntimeError("Current configurator differs from the verified baseline; no write attempted.")
        (WORK/"before-inventory.json").write_text(json.dumps(before,sort_keys=True))
        before,manifest=copy_stable_site(ftp,site,before,{FILENAME:{"before_sha256":EXPECTED_OLD}})
        (WORK/"before-inventory.json").write_text(json.dumps(before,sort_keys=True))
    if not manifest or not (site / "htdocs/index.html").is_file():
        raise RuntimeError("The complete live homepage backup could not be verified.")
    if not (site / "htdocs/forms/anti-spam.php").is_file():
        raise RuntimeError("The existing shared form protection is unavailable; no quote page published.")
    if manifest.get("htdocs/"+FILENAME)!=EXPECTED_OLD:raise RuntimeError("Backed-up projection preview differs from baseline.")
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
    (WORK / "verified-backup.json").write_text(json.dumps({"files": len(manifest), "homepage_sha256": home_sha, "payload_sha256": EXPECTED_SHA, "protected_pages": protected}) + "\n")
    print("Verified a complete live /htdocs backup: " + str(len(manifest)) + " files. No remote files changed.")



def backup():
    # Retry only read-only network failures. Every attempt starts a fresh full
    # snapshot; publishing still requires the verified and retained backup.
    for attempt in range(1, 4):
        try:
            print("Starting full-site backup attempt " + str(attempt) + ".", flush=True)
            backup_once()
            return
        except (SnapshotChanged, TimeoutError, ConnectionError, EOFError, ftplib.error_temp, ssl.SSLEOFError, URLError) as error:
            if isinstance(error, HTTPError) and error.code not in {429, 500, 502, 503, 504}:
                raise
            if isinstance(error, URLError) and isinstance(error.reason, ssl.SSLCertVerificationError):
                raise
            if attempt == 3:
                raise
            print("::warning::Read-only backup snapshot interrupted (" + type(error).__name__ + "); restarting the complete backup before any upload.", flush=True)
            site = WORK / "site"
            if site.is_dir():
                shutil.rmtree(site)
            time.sleep(attempt * 15)


def publish():
    content=validate_payload();evidence=json.loads((WORK/"verified-backup.json").read_text())
    if evidence["payload_sha256"]!=EXPECTED_SHA or evidence["files"]<1:raise RuntimeError("Verified complete backup is missing.")
    if not (WORK/"live-htdocs.tar.gz.enc").is_file():raise RuntimeError("Retained encrypted backup is missing; no upload attempted.")
    if not os.environ.get("RETAINED_BACKUP_ARTIFACT_ID","").isdigit():raise RuntimeError("Encrypted backup retention was not confirmed; no write attempted.")
    original=json.loads((WORK/"before-inventory.json").read_text());info=PAYLOAD[FILENAME];temporary=ROOT+"/.projection-guided-"+info["sha256"][:16]+".html"
    with connect() as ftp:
        if inventory(ftp)!=original:raise RuntimeError("Live files changed after the backup; stopped before any remote write.")
        if remote_sha(ftp,TARGET)!=EXPECTED_OLD:raise RuntimeError("Current configurator no longer matches its backup.")
        current={posixpath.join(ROOT,n) for n,_ in entries(ftp,ROOT)}
        if temporary in current:raise RuntimeError("Temporary upload already exists; stopped without overwriting.")
        ftp.storbinary("STOR "+temporary,io.BytesIO(content[FILENAME]))
        if remote_sha(ftp,temporary)!=info["sha256"]:raise RuntimeError("Uploaded page failed checksum verification.")
        if remote_sha(ftp,TARGET)!=EXPECTED_OLD:raise RuntimeError("Existing page changed during upload; replacement refused.")
        # The owner requested this exact page update. One atomic rename replaces it.
        ftp.rename(temporary,TARGET)
        after=inventory(ftp)
        if set(after)!=set(original) or any(after.get(path)!=facts for path,facts in original.items() if path!=TARGET):raise RuntimeError("Remote change set differs from the one authorised page.")
        if remote_sha(ftp,TARGET)!=info["sha256"]:raise RuntimeError("Published preview failed verification.")
    if digest(public_bytes(PUBLIC_URL))!=info["sha256"]:raise RuntimeError("Hosted public HTML differs from the tested build.")
    protected={path:digest(public_bytes(BASE_URL+path)) for path in PROTECTED_PUBLIC}
    if protected!=evidence["protected_pages"]:raise RuntimeError("A protected endpoint changed during publication.")
    print("Updated only the guided projection preview; LED, shared assets, public pages and navigation unchanged: "+PUBLIC_URL)

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in {"validate", "backup", "publish"}:
        raise SystemExit("Use validate, backup or publish.")
    try:
        {"validate": validate_payload, "backup": backup, "publish": publish}[sys.argv[1]]()
    except Exception as error:
        description = str(error)
        for name in ("FTP_HOST", "FTP_USERNAME", "FTP_PASSWORD"):
            value = os.environ.get(name, "")
            if value:
                description = description.replace(value, "[redacted]")
        description = description[:700].replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
        print("::error::Projection guided preview publication stopped (" + type(error).__name__ + "): " + description, file=sys.stderr)
        raise SystemExit(1)
