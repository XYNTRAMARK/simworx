from __future__ import annotations
import ftplib,hashlib,io,os,posixpath,ssl
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

ROOT="/htdocs";BASE="https://www.sim-worx.com"
PAGE="projection-screen-configurator-v51.html"
HEADER="assets/js/global-header.js"
def digest(b):return hashlib.sha256(b).hexdigest()
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
            if str(e).startswith("425") and not self.prefer_epsv:
                self.prefer_epsv=True;return super().ntransfercmd(c,rest)
            raise
def connect():
    raw=os.environ["FTP_HOST"].strip();p=urlsplit(raw if "://" in raw else "ftp://"+raw)
    f=F(context=ssl.create_default_context(),timeout=45);f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p();return f
def rb(f,path):a=[];f.retrbinary("RETR "+path,a.append);return b"".join(a)
def exists(f,path):
    folder,name=posixpath.split(path)
    try:return name in {n for n,_ in f.mlsd(folder)}
    except Exception:return False
def public(path):
    req=Request(BASE+"/"+path,headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V51-verifier"})
    with urlopen(req,timeout=60) as r:return r.read()

def main():
    page=Path(PAGE).read_bytes();header=Path(HEADER).read_bytes()
    with connect() as f:
        remote=ROOT+"/"+PAGE
        if exists(f,remote):
            if digest(rb(f,remote))!=digest(page):raise RuntimeError("immutable V51 conflict")
        else:f.storbinary("STOR "+remote,io.BytesIO(page))
        if digest(rb(f,remote))!=digest(page):raise RuntimeError("V51 FTP checksum mismatch")
        staged=ROOT+"/assets/js/.global-header-v51-upload.js"
        f.storbinary("STOR "+staged,io.BytesIO(header))
        if digest(rb(f,staged))!=digest(header):raise RuntimeError("staged header checksum mismatch")
        f.rename(staged,ROOT+"/"+HEADER)
        if digest(rb(f,ROOT+"/"+HEADER))!=digest(header):raise RuntimeError("header FTP checksum mismatch")
        f.quit()
    if digest(public(PAGE))!=digest(page):raise RuntimeError("public V51 checksum mismatch")
    if digest(public(HEADER+"?v51=1"))!=digest(header):raise RuntimeError("public header checksum mismatch")
    text=public(PAGE).decode("utf-8","replace")
    for required in ["projection-v50-consistent-viewer","projection-v51-step3-simplification","Click To Generate Projector Profile","v51-viewer-overlays"]:
        if required not in text:raise RuntimeError("live V51 inheritance missing "+required)
    print("Published V51 from accepted V50; simplified Step 3 verified and navigation switched to V51")

if __name__=="__main__":main()
