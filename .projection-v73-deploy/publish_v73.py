from __future__ import annotations
import ftplib,hashlib,io,os,posixpath,ssl
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
ROOT="/htdocs";BASE="https://www.sim-worx.com";VERSIONED="projection-screen-configurator-v73.html";CANONICAL="projection-screen-configurator.html"
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
            if str(e).startswith("425") and not self.prefer_epsv:self.prefer_epsv=True;return super().ntransfercmd(c,rest)
            raise
def connect():
    raw=os.environ["FTP_HOST"].strip();p=urlsplit(raw if "://" in raw else "ftp://"+raw)
    f=F(context=ssl.create_default_context(),timeout=45);f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p();return f
def rb(f,path):a=[];f.retrbinary("RETR "+path,a.append);return b"".join(a)
def public(path):
    req=Request(BASE+"/"+path,headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V73-verifier"})
    return urlopen(req,timeout=60).read()
page=Path(VERSIONED).read_bytes()
with connect() as f:
    for rel in [VERSIONED,CANONICAL]:
        stage=ROOT+"/.v73-"+posixpath.basename(rel)
        try:f.delete(stage)
        except:pass
        f.storbinary("STOR "+stage,io.BytesIO(page))
        if digest(rb(f,stage))!=digest(page):raise RuntimeError("stage mismatch "+rel)
        f.rename(stage,ROOT+"/"+rel)
        if digest(rb(f,ROOT+"/"+rel))!=digest(page):raise RuntimeError("live mismatch "+rel)
    f.quit()
if digest(public(VERSIONED+"?verify=1"))!=digest(page):raise RuntimeError("versioned public mismatch")
if digest(public(CANONICAL+"?verify=v73"))!=digest(page):raise RuntimeError("canonical public mismatch")
print("V73_REPORTING_ONLY_PUBLISHED")
