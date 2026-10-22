"""Update only the existing public LED configurator page, as requested by its owner.

A complete byte-verified, encrypted and retained live backup is mandatory.
The current page must match its verified SHA before a single atomic replacement.
The quote API, assets, homepage and navigation are protected and never uploaded.
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
PUBLIC_URL=BASE_URL+"/led-screen-configurator.html"
TARGET=ROOT+"/led-screen-configurator.html"
PAYLOAD={'led-screen-configurator.html': {'target': '/htdocs/led-screen-configurator.html', 'source': '.led-live/led-screen-configurator.html', 'sha256': '6239ccf3300c86f9593603ff482f022120d16f53990b37d9235ac9baf3b6d861'}}
PROTECTED_PUBLIC={'/': 'f16e29fd6759eb3f3ce99cf38c8694ecbf2a0400b702d71513086f17e5729903', '/visual-systems.html': 'dfd5672e16a6baab6e1eef6866577a4e52e3cca230f4e29988fac47391e8324e', '/sitemap.xml': '0a55385d1dc8ae62153cdb6f584f8813d75c1a55389706badb10df9ac4c2e65c', '/robots.txt': '2dca06af68eefa426114379271f4619708c6cd5ad9d862233e9b3cf8d361b82b', '/admin/simworx-led-preview-v30.php': 'a0ca0c5bcdfcd5cca16998cdff0edff138aaf877cbe0e1984634151781ce793a', '/led-quote-submit.php?action=capabilities': 'd4ac4be3a275f210a404de89bed8ebb4e352d8c27f3a73a8ca6d228392bf5949'}
EXPECTED_OLD='91c6aef7ce39216938899c4bafe29fc58f2604228f5530496d087a7f58321105'
API_SHA='247f762d5e79322295920d3bc8a042bc51286f5e0dc72df61124f4b1eb7f49e0'
EXPECTED_SHA='43f108ef8d5cc17ee0bc018a6dd81dd24e2cc0aeeb9ed1b02bdb6d090d6943b1'
WORK=Path(os.environ.get("RUNNER_TEMP","/tmp"))/"simworx-led-designer-domain"

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
    if set(PAYLOAD)!={"led-screen-configurator.html"} or TARGET!="/htdocs/led-screen-configurator.html":raise RuntimeError("Only the existing public configurator HTML is authorised.")
    info=PAYLOAD["led-screen-configurator.html"]
    if info["target"]!=TARGET or info["source"]!=".led-live/led-screen-configurator.html":raise RuntimeError("Publication path differs from the one-page allowlist.")
    if digest(json.dumps(PAYLOAD,sort_keys=True).encode())!=EXPECTED_SHA:raise RuntimeError("Prepared publication manifest changed.")
    html=Path(info["source"]).read_bytes()
    if digest(html)!=info["sha256"]:raise RuntimeError("Prepared public page failed checksum verification.")
    for marker in [b'id="led-cockpit-size"',b'Change the size of your cockpit',b'id="led-reset-cockpit-size"',b'Reset cockpit size',b'id="led-simulatorY"',b'id="led-simulatorZ"',b'Custom configurator by',b'www.xyntraholdings.com',b'action="led-quote-submit.php"',b'https://www.sim-worx.com/led-screen-configurator.html']:
        if marker not in html:raise RuntimeError("A required public feature is missing.")
    for removed in [b'Interactive preview',b'Review version',b'led-preview-notice',b'noindex,nofollow',b'data-led-quote-preview="offline"']:
        if removed in html:raise RuntimeError("A preview marker remains in the public page.")
    return {"led-screen-configurator.html":html}

def remote_sha(ftp,path):
    h=hashlib.sha256();ftp.retrbinary("RETR "+path,h.update);return h.hexdigest()

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
                raise SnapshotChanged("A backup file size did not match the live file; restarting the full snapshot.")
            manifest["htdocs/" + relative] = digest(local.read_bytes())
        if inventory(ftp) != before:
            raise SnapshotChanged("The live files changed during the read-only backup; restarting the full snapshot.")
    if not manifest or not (site / "htdocs/index.html").is_file():
        raise RuntimeError("The complete live homepage backup could not be verified.")
    if not (site / "htdocs/forms/anti-spam.php").is_file():
        raise RuntimeError("The existing shared form protection is unavailable; no quote page published.")
    if manifest.get("htdocs/led-screen-configurator.html")!=EXPECTED_OLD or manifest.get("htdocs/led-quote-submit.php")!=API_SHA:raise RuntimeError("Backed-up configurator or protected quote API differs from baseline.")
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
    original=json.loads((WORK/"before-inventory.json").read_text());info=PAYLOAD["led-screen-configurator.html"];temporary=ROOT+"/.led-designer-domain-"+info["sha256"][:16]+".html"
    with connect() as ftp:
        if inventory(ftp)!=original:raise RuntimeError("Live files changed after the backup; stopped before any remote write.")
        if remote_sha(ftp,TARGET)!=EXPECTED_OLD:raise RuntimeError("Current configurator no longer matches its backup.")
        current={posixpath.join(ROOT,n) for n,_ in entries(ftp,ROOT)}
        if temporary in current:raise RuntimeError("Temporary upload already exists; stopped without overwriting.")
        ftp.storbinary("STOR "+temporary,io.BytesIO(content["led-screen-configurator.html"]))
        if remote_sha(ftp,temporary)!=info["sha256"]:raise RuntimeError("Uploaded page failed checksum verification.")
        if remote_sha(ftp,TARGET)!=EXPECTED_OLD:raise RuntimeError("Existing page changed during upload; replacement refused.")
        # The owner requested this exact page update. One atomic rename replaces it.
        ftp.rename(temporary,TARGET)
        after=inventory(ftp)
        if set(after)!=set(original) or any(after.get(path)!=facts for path,facts in original.items() if path!=TARGET):raise RuntimeError("Remote change set differs from the one authorised page.")
        if remote_sha(ftp,TARGET)!=info["sha256"] or remote_sha(ftp,ROOT+"/led-quote-submit.php")!=API_SHA:raise RuntimeError("Published page or protected quote API failed verification.")
    if digest(public_bytes(PUBLIC_URL))!=info["sha256"]:raise RuntimeError("Hosted public HTML differs from the tested build.")
    protected={path:digest(public_bytes(BASE_URL+path)) for path in PROTECTED_PUBLIC}
    if protected!=evidence["protected_pages"]:raise RuntimeError("A protected endpoint changed during publication.")
    print("Updated only the public LED configurator HTML; quote API, existing pages and navigation unchanged: "+PUBLIC_URL)

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
        print("::error::LED cockpit controls publication stopped (" + type(error).__name__ + "): " + description, file=sys.stderr)
        raise SystemExit(1)
