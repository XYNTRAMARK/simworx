from __future__ import annotations
import ftplib,hashlib,io,os,ssl,subprocess
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

ROOT="/htdocs"; BASE="https://www.sim-worx.com"
BUSINESS_REL="assets/js/simworx-intelligence-business-v1.js"
PATCH_FILES=[
  "assets/js/simworx-intelligence-bootstrap-v1.js",
  "assets/js/simworx-intelligence-bootstrap-v2.js",
  "assets/js/simworx-intelligence-tracker-v1.js",
  "assets/js/simworx-intelligence-tracker-v2.js"
]
BACK=Path("/tmp/simworx-intelligence-backup");BACK.mkdir(parents=True,exist_ok=True)
OUT=Path("/tmp/simworx-intelligence-patched");OUT.mkdir(parents=True,exist_ok=True)
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
def rb(f,path):a=[];f.retrbinary("RETR "+path,a.append);return b"".join(a)

with connect() as f:
    for rel in PATCH_FILES:
        body=rb(f,ROOT+"/"+rel);(BACK/Path(rel).name).write_bytes(body)
        text=body.decode("utf-8")
        if "bootstrap" in rel:
            if "simworx-intelligence-business-v1.js" not in text:
                anchor="if (document.getElementById('contact-form')) load('simworx-intelligence-contact-v1.js');"
                if anchor not in text: raise RuntimeError("Bootstrap business-loader anchor missing: "+rel)
                text=text.replace(anchor,anchor+"\n    load('simworx-intelligence-business-v1.js');",1)
        else:
            if "configurator_session_id: uuid()" not in text: raise RuntimeError("Tracker config anchor absent: "+rel)
            old="""    if (!enabled || !options.configurator_type) return;
    var key = session.id + ':' + options.configurator_type;"""
            new="""    if (!enabled || !options.configurator_type) return;
    if (!config) config = { configurator_session_id: uuid(), configuration_id: null, started: false, completed: false, last_step: 'opened' };
    var key = session.id + ':' + options.configurator_type;"""
            if old not in text: raise RuntimeError("Tracker opened-session anchor missing: "+rel)
            text=text.replace(old,new,1)
        patched=text.encode();(OUT/Path(rel).name).write_bytes(patched)
    f.quit()

business=Path(BUSINESS_REL).read_bytes()
(OUT/Path(BUSINESS_REL).name).write_bytes(business)

for p in OUT.iterdir():
    if p.suffix==".js": subprocess.run(["node","--check",str(p)],check=True)

with connect() as f:
    payload={rel:(OUT/Path(rel).name).read_bytes() for rel in PATCH_FILES}
    payload[BUSINESS_REL]=business
    for rel,data in payload.items():
        target=ROOT+"/"+rel;stage=ROOT+"/assets/js/.wi-stage-"+Path(rel).name
        try:f.delete(stage)
        except Exception:pass
        f.storbinary("STOR "+stage,io.BytesIO(data))
        if sha(rb(f,stage))!=sha(data):raise RuntimeError("Stage checksum mismatch: "+rel)
        f.rename(stage,target)
        if sha(rb(f,target))!=sha(data):raise RuntimeError("Live checksum mismatch: "+rel)
    f.quit()

for rel in PATCH_FILES+[BUSINESS_REL]:
    req=Request(BASE+"/"+rel+"?wi-business-v1=1",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-WI-verifier"})
    public=urlopen(req,timeout=45).read()
    expected=(OUT/Path(rel).name).read_bytes()
    if sha(public)!=sha(expected):raise RuntimeError("Public verification mismatch: "+rel)
print("WEBSITE_INTELLIGENCE_BUSINESS_V1_PUBLISHED")
