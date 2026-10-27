from __future__ import annotations
import ftplib, hashlib, io, os, ssl
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT="/htdocs"
REL="assets/js/global-header.js"
OLD="title: 'Projector Configurator'"
NEW="title: 'Projection Screen'"
DESC="description: 'Design your projection screen & projector layout'"
HREF="href: '/projection-screen-configurator-v52.html'"

def sha(b): return hashlib.sha256(b).hexdigest()

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
                self.prefer_epsv=True
                return super().ntransfercmd(c,rest)
            raise

def connect():
    raw=os.environ["FTP_HOST"].strip()
    p=urlsplit(raw if "://" in raw else "ftp://"+raw)
    f=F(context=ssl.create_default_context(),timeout=45)
    f.connect(p.hostname,p.port or 21)
    f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"])
    f.prot_p()
    return f

def read(f,path):
    out=[]
    f.retrbinary("RETR "+path,out.append)
    return b"".join(out)

local=Path(REL).read_bytes()
text=local.decode("utf-8")

if text.count(NEW)!=1:
    raise RuntimeError("Reviewed new menu label missing or duplicated.")
if OLD in text:
    raise RuntimeError("Old menu label still present in reviewed file.")
if text.count(DESC)!=1 or text.count(HREF)!=1:
    raise RuntimeError("Projection menu description or destination changed unexpectedly.")

with connect() as f:
    target=ROOT+"/"+REL
    live=read(f,target)
    live_text=live.decode("utf-8")
    if live_text.count(OLD)!=1:
        raise RuntimeError("Live header no longer has the expected old menu label.")
    expected_old=text.replace(NEW,OLD,1).encode("utf-8")
    if live != expected_old:
        raise RuntimeError("Refusing deployment: reviewed header differs from live by more than the requested label.")

    staged=ROOT+"/assets/js/.global-header-projection-screen.js"
    try:f.delete(staged)
    except Exception:pass
    f.storbinary("STOR "+staged,io.BytesIO(local))
    if sha(read(f,staged))!=sha(local):
        raise RuntimeError("Staged header checksum mismatch.")
    f.rename(staged,target)
    if sha(read(f,target))!=sha(local):
        raise RuntimeError("Live header checksum mismatch after rename.")
    f.quit()

req=Request("https://www.sim-worx.com/"+REL+"?menu-label=projection-screen",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-menu-label-verifier"})
with urlopen(req,timeout=45) as r:
    public=r.read().decode("utf-8")
if NEW not in public or OLD in public or DESC not in public or HREF not in public:
    raise RuntimeError("Public header verification failed.")
print("LIVE_MENU_LABEL_PASS: Projector Configurator -> Projection Screen; href and description unchanged.")
