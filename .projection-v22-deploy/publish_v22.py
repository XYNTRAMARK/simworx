"""Publish immutable projection V22."""
from __future__ import annotations
import ftplib, hashlib, os, posixpath, ssl
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
ROOT="/htdocs";BASE_URL="https://www.sim-worx.com";TARGET="projection-screen-configurator-v22.html";LOCAL=Path(TARGET)
def digest(d):return hashlib.sha256(d).hexdigest()
class F(ftplib.FTP_TLS):
    prefer_epsv=False
    def makepasv(self):
        if self.prefer_epsv:
            try:return ftplib.parse229(self.sendcmd("EPSV"),self.sock.getpeername())
            except ftplib.error_perm:pass
        return super().makepasv()
    def ntransfercmd(self,c,rest=None):
        try:return super().ntransfercmd(c,rest)
        except ftplib.error_temp as e:
            if str(e).startswith("425") and c.split(" ",1)[0] in {"RETR","STOR","LIST","MLSD"} and not self.prefer_epsv:
                self.prefer_epsv=True;return super().ntransfercmd(c,rest)
            raise
def connect():
    raw=os.environ["FTP_HOST"].strip();p=urlsplit(raw if "://" in raw else "ftp://"+raw);f=F(context=ssl.create_default_context(),timeout=45);f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p();return f
def rb(f,p):a=[];f.retrbinary("RETR "+p,a.append);return b"".join(a)
def exists(f,p):
    try:f.size(p);return True
    except ftplib.error_perm as e:
        if str(e).startswith("550"):return False
        raise
def public(name):
    with urlopen(Request(BASE_URL+"/"+name,headers={"Cache-Control":"no-cache","User-Agent":"Simworx-projection-version-publisher"}),timeout=45) as r:return r.read()
def main():
    data=LOCAL.read_bytes();sha=digest(data);remote=posixpath.join(ROOT,TARGET)
    with connect() as f:
        if exists(f,remote):
            if digest(rb(f,remote))!=sha:raise RuntimeError("immutable V22 conflict")
        else:
            with LOCAL.open("rb") as h:f.storbinary("STOR "+remote,h)
        if digest(rb(f,remote))!=sha:raise RuntimeError("FTP checksum mismatch")
    if digest(public(TARGET))!=sha:raise RuntimeError("public checksum mismatch")
    print("Published",BASE_URL+"/"+TARGET)
if __name__=="__main__":main()
