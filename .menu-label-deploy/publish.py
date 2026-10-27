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
HREF="href: '/projection-screen-configurator.html'"

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

with connect() as f:
    target=ROOT+"/"+REL
    live=read(f,target)
    live_text=live.decode("utf-8")

    if live_text.count(OLD)!=1:
        raise RuntimeError("Live header does not contain exactly one expected old menu label.")
    if NEW in live_text:
        raise RuntimeError("New menu label is already present unexpectedly.")

    pos=live_text.index(OLD)
    nearby=live_text[max(0,pos-300):pos+800]
    if DESC not in nearby or HREF not in nearby:
        raise RuntimeError("Projection menu description or destination near the label is not the expected live block.")

    patched_text=live_text.replace(OLD,NEW,1)
    patched=patched_text.encode("utf-8")

    # Prove the only content change is the requested title replacement.
    if patched_text.replace(NEW,OLD,1)!=live_text:
        raise RuntimeError("Refusing deployment: patch changes more than the menu label.")

    staged=ROOT+"/assets/js/.global-header-projection-screen.js"
    try:f.delete(staged)
    except Exception:pass
    f.storbinary("STOR "+staged,io.BytesIO(patched))
    if sha(read(f,staged))!=sha(patched):
        raise RuntimeError("Staged header checksum mismatch.")
    f.rename(staged,target)
    if sha(read(f,target))!=sha(patched):
        raise RuntimeError("Live header checksum mismatch after rename.")
    f.quit()

req=Request("https://www.sim-worx.com/"+REL+"?menu-label=projection-screen",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-menu-label-verifier"})
with urlopen(req,timeout=45) as r:
    public=r.read().decode("utf-8")
if public.count(NEW)!=1 or OLD in public:
    raise RuntimeError("Public header label verification failed.")
pos=public.index(NEW)
nearby=public[max(0,pos-300):pos+800]
if DESC not in nearby or HREF not in nearby:
    raise RuntimeError("Public Projection menu description or destination changed unexpectedly.")
print("LIVE_MENU_LABEL_PASS: Projector Configurator -> Projection Screen; href and description unchanged.")
