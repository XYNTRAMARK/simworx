from __future__ import annotations
import ftplib,hashlib,io,os,ssl
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
import json

ROOT="/htdocs";BASE="https://www.sim-worx.com";PHP="projection-quote-submit.php"

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
def public(path):
    req=Request(BASE+"/"+path,headers={"Cache-Control":"no-cache","User-Agent":"Simworx-proposal-email-fix"})
    with urlopen(req,timeout=45) as r:return r.read()

def main():
    body=Path(".projection-email-fix/"+PHP).read_bytes()
    if b"2500000" not in body or b"1800000" not in body:raise RuntimeError("New proposal limits missing")
    with connect() as f:
        target=ROOT+"/"+PHP
        staged=ROOT+"/.projection-quote-submit-email-fix.php"
        try:
            f.delete(staged)
        except Exception:
            pass
        f.storbinary("STOR "+staged,io.BytesIO(body))
        if digest(rb(f,staged))!=digest(body):raise RuntimeError("Staged endpoint checksum mismatch")
        f.rename(staged,target)
        if digest(rb(f,target))!=digest(body):raise RuntimeError("Live endpoint checksum mismatch")
        f.quit()
    caps=json.loads(public(PHP+"?action=capabilities").decode("utf-8"))
    if not caps.get("ok") or not caps.get("protected") or not caps.get("mail"):
        raise RuntimeError("Endpoint capabilities regressed: "+repr(caps))
    print("Published proposal-email size-limit repair only; Turnstile and mail capability remain active")

if __name__=="__main__":main()
