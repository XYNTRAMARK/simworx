from __future__ import annotations
import ftplib,ssl,os,io,hashlib,posixpath,re
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
ROOT="/htdocs";BASE="https://www.sim-worx.com"
V1='<script id="simworx-intelligence-tracking" defer src="/assets/js/simworx-intelligence-bootstrap-v1.js"></script>'
def sha(b):return hashlib.sha256(b).hexdigest()
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
def read(f,p):a=[];f.retrbinary("RETR "+p,a.append);return b"".join(a)
def put(f,p,b):
    st=posixpath.dirname(p)+"/.reporting-v4-correct-"+posixpath.basename(p)
    try:f.delete(st)
    except:pass
    f.storbinary("STOR "+st,io.BytesIO(b))
    if sha(read(f,st))!=sha(b):raise RuntimeError("stage mismatch")
    f.rename(st,p)
with connect() as f:
    for rel in ["projection-screen-configurator.html","projection-screen-configurator-v73.html"]:
        p=ROOT+"/"+rel;s=read(f,p).decode("utf-8","replace")
        if V1 in s:s=s.replace(V1+"\n","",1).replace(V1,"",1)
        if "simworx-intelligence-bootstrap-v2.js" not in s:raise RuntimeError(rel+" does not contain live V2 intelligence stack")
        if V1 in s:raise RuntimeError(rel+" still contains redundant V1 bootstrap")
        put(f,p,s.encode())
    f.quit()
for rel in ["projection-screen-configurator.html","projection-screen-configurator-v73.html"]:
    with urlopen(Request(BASE+"/"+rel+"?reporting-v4-correct=1",headers={"Cache-Control":"no-cache"}),timeout=45) as r:s=r.read().decode()
    if "simworx-intelligence-bootstrap-v2.js" not in s or V1 in s:raise RuntimeError("public correction failed "+rel)
print("PROJECTION_V2_ONLY_PASS")
