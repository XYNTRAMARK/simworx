from __future__ import annotations
import ftplib,hashlib,io,os,posixpath,ssl,json
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

ROOT="/htdocs";BASE="https://www.sim-worx.com"
PAGE="projection-screen-configurator-v66.html";CANONICAL="projection-screen-configurator.html";PHP="projection-quote-submit.php"
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
    req=Request(BASE+"/"+path,headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V66-verifier"})
    with urlopen(req,timeout=60) as r:return r.read()
def main():
    page=Path(PAGE).read_bytes();php=Path(".projection-v66-deploy/"+PHP).read_bytes()
    with connect() as f:
        for rel,data in [(PAGE,page),(CANONICAL,page),(PHP,php)]:
            target=ROOT+"/"+rel;staged=ROOT+"/.v66-"+posixpath.basename(rel)
            if exists(f,staged):f.delete(staged)
            f.storbinary("STOR "+staged,io.BytesIO(data))
            if digest(rb(f,staged))!=digest(data):raise RuntimeError("staged mismatch "+rel)
            f.rename(staged,target)
            if digest(rb(f,target))!=digest(data):raise RuntimeError("live mismatch "+rel)
        f.quit()
    if digest(public(PAGE+"?verify=1"))!=digest(page):raise RuntimeError("public V66 mismatch")
    if digest(public(CANONICAL+"?verify=v66"))!=digest(page):raise RuntimeError("canonical page not V66")
    caps=json.loads(public(PHP+"?action=capabilities").decode("utf-8"))
    if not caps.get("ok") or not caps.get("protected") or not caps.get("mail"):raise RuntimeError("endpoint capability regression")
    print("Published V66 Projection email sender matched to LED pattern")
if __name__=="__main__":main()
