"""Publish projection configurator V2 without modifying the protected preview.

V2 is immutable: if the target already exists with different bytes, publication
stops. The protected preview is hashed before and after the write and must remain
byte-identical.
"""
from __future__ import annotations
import ftplib
import hashlib
import os
from pathlib import Path
import posixpath
import ssl
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = "/htdocs"
BASE_URL = "https://www.sim-worx.com"
PROTECTED = "projection-screen-configurator-preview.html"
TARGET = "projection-screen-configurator-v2.html"
LOCAL = Path(TARGET)

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

class ReviewFTP(ftplib.FTP_TLS):
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
            if str(error).startswith("425") and command.split(" ",1)[0] in {"RETR","STOR","LIST","MLSD"} and not self.prefer_epsv:
                self.prefer_epsv = True
                return super().ntransfercmd(command, rest)
            raise

def connect():
    raw = os.environ.get("FTP_HOST","").strip()
    user = os.environ.get("FTP_USERNAME","")
    password = os.environ.get("FTP_PASSWORD","")
    if not raw or not user or not password:
        raise RuntimeError("FTP credentials are required.")
    parsed = urlsplit(raw if "://" in raw else "ftp://" + raw)
    ftp = ReviewFTP(context=ssl.create_default_context(), timeout=45)
    ftp.connect(parsed.hostname, parsed.port or 21)
    ftp.login(user, password)
    ftp.prot_p()
    return ftp

def remote_bytes(ftp, path):
    chunks=[]
    ftp.retrbinary("RETR " + path, chunks.append)
    return b"".join(chunks)

def exists(ftp, path):
    try:
        ftp.size(path)
        return True
    except ftplib.error_perm as e:
        if str(e).startswith("550"):
            return False
        raise

def public_bytes(name):
    req = Request(BASE_URL + "/" + name, headers={"Cache-Control":"no-cache","User-Agent":"Simworx-projection-version-publisher"})
    with urlopen(req, timeout=45) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP verification failed for {name}: {response.status}")
        return response.read()

def main():
    if not LOCAL.is_file() or LOCAL.stat().st_size < 100000:
        raise RuntimeError("V2 build is missing or implausibly small.")
    payload = LOCAL.read_bytes()
    payload_sha = digest(payload)
    protected_path = posixpath.join(ROOT, PROTECTED)
    target_path = posixpath.join(ROOT, TARGET)
    temp_path = target_path + ".uploading-" + payload_sha[:12]

    with connect() as ftp:
        protected_before = remote_bytes(ftp, protected_path)
        protected_sha = digest(protected_before)

        if exists(ftp, target_path):
            existing = remote_bytes(ftp, target_path)
            if digest(existing) != payload_sha:
                raise RuntimeError("V2 already exists with different bytes; immutable version not overwritten.")
            print("V2 already exists with identical bytes; verifying protected preview.")
        else:
            if exists(ftp, temp_path):
                try:
                    ftp.delete(temp_path)
                except ftplib.error_perm:
                    pass
            with LOCAL.open("rb") as handle:
                ftp.storbinary("STOR " + temp_path, handle)
            staged = remote_bytes(ftp, temp_path)
            if digest(staged) != payload_sha:
                try: ftp.delete(temp_path)
                finally: raise RuntimeError("Staged V2 checksum mismatch.")
            ftp.rename(temp_path, target_path)

        protected_after = remote_bytes(ftp, protected_path)
        if digest(protected_after) != protected_sha:
            raise RuntimeError("Protected preview changed during V2 publication.")
        published = remote_bytes(ftp, target_path)
        if digest(published) != payload_sha:
            raise RuntimeError("Published V2 checksum mismatch.")

    # Public verification is read-only and proves both URLs remain distinct.
    live_v2 = public_bytes(TARGET)
    if digest(live_v2) != payload_sha:
        raise RuntimeError("Public V2 does not match the reviewed build.")
    live_protected = public_bytes(PROTECTED)
    if digest(live_protected) != protected_sha:
        raise RuntimeError("Protected public preview changed.")
    print("Published immutable V2:", BASE_URL + "/" + TARGET)
    print("Protected preview unchanged:", protected_sha)
    print("V2 checksum:", payload_sha)

if __name__ == "__main__":
    main()
