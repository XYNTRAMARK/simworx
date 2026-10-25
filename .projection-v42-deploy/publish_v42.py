from __future__ import annotations
import ftplib,hashlib,os,posixpath,ssl,json
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

ROOT="/htdocs";BASE_URL="https://www.sim-worx.com"
HTML="projection-screen-configurator-v42.html"
PHP="projection-quote-submit.php"

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
    raw=os.environ["FTP_HOST"].strip();p=urlsplit(raw if "://" in raw else "ftp://"+raw)
    f=F(context=ssl.create_default_context(),timeout=45);f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p();return f
def rb(f,p):a=[];f.retrbinary("RETR "+p,a.append);return b"".join(a)
def exists(f,p):
    try:f.size(p);return True
    except ftplib.error_perm as e:
        if str(e).startswith("550"):return False
        raise
def public(path):
    with urlopen(Request(BASE_URL+"/"+path,headers={"Cache-Control":"no-cache","User-Agent":"Simworx-projection-v42-publisher"}),timeout=45) as r:return r.read()

def main():
    html=Path(HTML).read_bytes()
    php=Path(".projection-v42-deploy/"+PHP).read_bytes()
    with connect() as f:
        html_remote=posixpath.join(ROOT,HTML)
        if exists(f,html_remote):
            if digest(rb(f,html_remote))!=digest(html):raise RuntimeError("immutable V42 conflict")
        else:
            with open(HTML,"rb") as h:f.storbinary("STOR "+html_remote,h)
        php_remote=posixpath.join(ROOT,PHP)
        # Endpoint is intentionally version-independent so future projection pages can reuse it.
        with open(".projection-v42-deploy/"+PHP,"rb") as h:f.storbinary("STOR "+php_remote,h)
        if digest(rb(f,html_remote))!=digest(html):raise RuntimeError("V42 FTP checksum mismatch")
        if digest(rb(f,php_remote))!=digest(php):raise RuntimeError("projection email endpoint FTP checksum mismatch")
    if digest(public(HTML))!=digest(html):raise RuntimeError("V42 public checksum mismatch")
    caps=json.loads(public(PHP+"?action=capabilities").decode("utf-8"))
    if not caps.get("ok") or not caps.get("protected") or not caps.get("mail"):
        raise RuntimeError("Projection email endpoint capabilities failed: "+repr(caps))
    print("Published V42:",BASE_URL+"/"+HTML)
    print("Projection email endpoint protected and mail-capable")

if __name__=="__main__":main()
