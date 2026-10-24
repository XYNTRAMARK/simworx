"""Publish projection configurator V3 without modifying protected earlier versions."""
from __future__ import annotations
import ftplib, hashlib, os, posixpath, ssl
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT="/htdocs"
BASE_URL="https://www.sim-worx.com"
PROTECTED=["projection-screen-configurator-preview.html","projection-screen-configurator-v2.html"]
TARGET="projection-screen-configurator-v3.html"
LOCAL=Path(TARGET)

def digest(data): return hashlib.sha256(data).hexdigest()

class ReviewFTP(ftplib.FTP_TLS):
    prefer_epsv=False
    def makepasv(self):
        if self.prefer_epsv:
            try:return ftplib.parse229(self.sendcmd("EPSV"),self.sock.getpeername())
            except ftplib.error_perm:pass
        return super().makepasv()
    def ntransfercmd(self,command,rest=None):
        try:return super().ntransfercmd(command,rest)
        except ftplib.error_temp as error:
            if str(error).startswith("425") and command.split(" ",1)[0] in {"RETR","STOR","LIST","MLSD"} and not self.prefer_epsv:
                self.prefer_epsv=True
                return super().ntransfercmd(command,rest)
            raise

def connect():
    raw=os.environ.get("FTP_HOST","").strip(); user=os.environ.get("FTP_USERNAME",""); password=os.environ.get("FTP_PASSWORD","")
    if not raw or not user or not password: raise RuntimeError("FTP credentials are required.")
    parsed=urlsplit(raw if "://" in raw else "ftp://"+raw)
    ftp=ReviewFTP(context=ssl.create_default_context(),timeout=45)
    ftp.connect(parsed.hostname,parsed.port or 21); ftp.login(user,password); ftp.prot_p(); return ftp

def remote_bytes(ftp,path):
    chunks=[]; ftp.retrbinary("RETR "+path,chunks.append); return b"".join(chunks)

def exists(ftp,path):
    try: ftp.size(path); return True
    except ftplib.error_perm as e:
        if str(e).startswith("550"): return False
        raise

def public_bytes(name):
    req=Request(BASE_URL+"/"+name,headers={"Cache-Control":"no-cache","User-Agent":"Simworx-projection-version-publisher"})
    with urlopen(req,timeout=45) as response:
        if response.status!=200: raise RuntimeError(f"HTTP verification failed for {name}: {response.status}")
        return response.read()

def main():
    if not LOCAL.is_file() or LOCAL.stat().st_size<100000: raise RuntimeError("V3 build is missing or implausibly small.")
    payload=LOCAL.read_bytes(); payload_sha=digest(payload)
    target_path=posixpath.join(ROOT,TARGET); temp_path=target_path+".uploading-"+payload_sha[:12]
    with connect() as ftp:
        protected_before={name:digest(remote_bytes(ftp,posixpath.join(ROOT,name))) for name in PROTECTED}
        if exists(ftp,target_path):
            existing=remote_bytes(ftp,target_path)
            if digest(existing)!=payload_sha: raise RuntimeError("V3 already exists with different bytes; immutable version not overwritten.")
        else:
            if exists(ftp,temp_path):
                try: ftp.delete(temp_path)
                except ftplib.error_perm: pass
            with LOCAL.open("rb") as handle: ftp.storbinary("STOR "+temp_path,handle)
            if digest(remote_bytes(ftp,temp_path))!=payload_sha:
                try: ftp.delete(temp_path)
                finally: raise RuntimeError("Staged V3 checksum mismatch.")
            ftp.rename(temp_path,target_path)
        for name,sha in protected_before.items():
            if digest(remote_bytes(ftp,posixpath.join(ROOT,name)))!=sha:
                raise RuntimeError("Protected earlier version changed during V3 publication: "+name)
        if digest(remote_bytes(ftp,target_path))!=payload_sha: raise RuntimeError("Published V3 checksum mismatch.")
    if digest(public_bytes(TARGET))!=payload_sha: raise RuntimeError("Public V3 does not match reviewed build.")
    for name in PROTECTED:
        if not public_bytes(name): raise RuntimeError("Protected version unavailable: "+name)
    print("Published immutable V3:",BASE_URL+"/"+TARGET)
    print("V3 checksum:",payload_sha)

if __name__=="__main__": main()
