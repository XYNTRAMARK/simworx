from __future__ import annotations
import ftplib,hashlib,io,os,posixpath,ssl
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

ROOT="/htdocs";BASE="https://www.sim-worx.com"
VERSIONED="projection-screen-configurator-v59.html"
CANONICAL="projection-screen-configurator.html"

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
    f=F(context=ssl.create_default_context(),timeout=45)
    f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p()
    return f
def rb(f,path):a=[];f.retrbinary("RETR "+path,a.append);return b"".join(a)
def exists(f,path):
    folder,name=posixpath.split(path)
    try:return name in {n for n,_ in f.mlsd(folder)}
    except Exception:return False
def public(path):
    req=Request(BASE+"/"+path,headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V59-verifier"})
    with urlopen(req,timeout=60) as r:return r.read()

def main():
    page=Path(VERSIONED).read_bytes()
    text=page.decode("utf-8","replace")
    for marker in ["projection-v59-hide-material-choice","projection-v58-compact-price-bar","compactProposalHtmlForEmail"]:
        if marker not in text:raise RuntimeError("V59 local page missing "+marker)
    with connect() as f:
        for rel in [VERSIONED,CANONICAL]:
            target=ROOT+"/"+rel
            staged=posixpath.dirname(target)+"/.v59-upload-"+posixpath.basename(target)
            if exists(f,staged):f.delete(staged)
            f.storbinary("STOR "+staged,io.BytesIO(page))
            if digest(rb(f,staged))!=digest(page):raise RuntimeError("staged checksum mismatch "+rel)
            f.rename(staged,target)
            if digest(rb(f,target))!=digest(page):raise RuntimeError("live checksum mismatch "+rel)
        f.quit()
    if digest(public(VERSIONED+"?verify=1"))!=digest(page):raise RuntimeError("public V59 mismatch")
    if digest(public(CANONICAL+"?verify=v59"))!=digest(page):raise RuntimeError("canonical page not exact V59")
    print("Published V59 material-choice removal only")

if __name__=="__main__":main()
