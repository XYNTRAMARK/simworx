"""Publish immutable projection V9 while preserving all earlier versions."""
from __future__ import annotations
import ftplib, hashlib, os, posixpath, ssl
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
ROOT="/htdocs"; BASE_URL="https://www.sim-worx.com"
PROTECTED=[
"projection-screen-configurator-preview.html",
"projection-screen-configurator-v2.html",
"projection-screen-configurator-v3.html",
"projection-screen-configurator-v4.html",
"projection-screen-configurator-v5.html",
"projection-screen-configurator-v6.html",
"projection-screen-configurator-v7.html",
"projection-screen-configurator-v8.html"
]
TARGET="projection-screen-configurator-v9.html"; LOCAL=Path(TARGET)
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
                self.prefer_epsv=True; return super().ntransfercmd(command,rest)
            raise
def connect():
    raw=os.environ.get("FTP_HOST","").strip(); user=os.environ.get("FTP_USERNAME",""); password=os.environ.get("FTP_PASSWORD","")
    if not raw or not user or not password: raise RuntimeError("FTP credentials required")
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
        if response.status!=200: raise RuntimeError(f"HTTP verification failed for {name}")
        return response.read()
def main():
    if not LOCAL.is_file() or LOCAL.stat().st_size<100000: raise RuntimeError("V9 build missing")
    payload=LOCAL.read_bytes(); sha=digest(payload); target=posixpath.join(ROOT,TARGET); temp=target+".uploading-"+sha[:12]
    with connect() as ftp:
        before={n:digest(remote_bytes(ftp,posixpath.join(ROOT,n))) for n in PROTECTED}
        if exists(ftp,target):
            if digest(remote_bytes(ftp,target))!=sha: raise RuntimeError("V9 already exists with different bytes")
        else:
            if exists(ftp,temp):
                try: ftp.delete(temp)
                except ftplib.error_perm: pass
            with LOCAL.open("rb") as h: ftp.storbinary("STOR "+temp,h)
            if digest(remote_bytes(ftp,temp))!=sha:
                try: ftp.delete(temp)
                finally: raise RuntimeError("Staged V9 checksum mismatch")
            ftp.rename(temp,target)
        for n,s in before.items():
            if digest(remote_bytes(ftp,posixpath.join(ROOT,n)))!=s: raise RuntimeError("Protected version changed: "+n)
        if digest(remote_bytes(ftp,target))!=sha: raise RuntimeError("Published V9 checksum mismatch")
    if digest(public_bytes(TARGET))!=sha: raise RuntimeError("Public V9 mismatch")
    print("Published immutable V9:",BASE_URL+"/"+TARGET)
if __name__=="__main__": main()
