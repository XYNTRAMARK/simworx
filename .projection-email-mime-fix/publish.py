from __future__ import annotations
import ftplib,hashlib,io,os,ssl,json
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

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
    req=Request(BASE+"/"+path,headers={"Cache-Control":"no-cache","User-Agent":"Simworx-projector-mail-mime-fix"})
    with urlopen(req,timeout=45) as r:return r.read()
def main():
    body=Path(".projection-email-mime-fix/"+PHP).read_bytes()
    for marker in [b"multipart/related",b"multipart/alternative",b"Content-ID:",b"cid:",b"2500000",b"1800000"]:
        if marker not in body:raise RuntimeError("Endpoint repair missing marker "+repr(marker))
    with connect() as f:
        target=ROOT+"/"+PHP;staged=ROOT+"/.projection-email-mime-fix.php"
        try:f.delete(staged)
        except Exception:pass
        f.storbinary("STOR "+staged,io.BytesIO(body))
        if digest(rb(f,staged))!=digest(body):raise RuntimeError("staged endpoint checksum mismatch")
        f.rename(staged,target)
        if digest(rb(f,target))!=digest(body):raise RuntimeError("live endpoint checksum mismatch")
        f.quit()
    caps=json.loads(public(PHP+"?action=capabilities").decode("utf-8"))
    if not caps.get("ok") or not caps.get("protected") or not caps.get("mail"):
        raise RuntimeError("endpoint capabilities regressed "+repr(caps))
    print("Published projector email MIME repair only")
if __name__=="__main__":main()
