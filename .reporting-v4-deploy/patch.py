from __future__ import annotations
import ftplib,ssl,os,io,re,hashlib,posixpath
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

ROOT="/htdocs"
BASE="https://www.sim-worx.com"
BOOT='<script id="simworx-intelligence-tracking" defer src="/assets/js/simworx-intelligence-bootstrap-v1.js"></script>'

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
    f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p();return f
def read(f,path):
    a=[];f.retrbinary("RETR "+path,a.append);return b"".join(a)
def sha(b):return hashlib.sha256(b).hexdigest()
def publish(f,path,data,label):
    stage=posixpath.dirname(path)+"/."+label+"-"+posixpath.basename(path)
    try:f.delete(stage)
    except Exception:pass
    f.storbinary("STOR "+stage,io.BytesIO(data))
    if sha(read(f,stage))!=sha(data):raise RuntimeError("staged checksum mismatch "+path)
    f.rename(stage,path)
    if sha(read(f,path))!=sha(data):raise RuntimeError("live checksum mismatch "+path)

with connect() as f:
    canonical=read(f,ROOT+"/projection-screen-configurator.html").decode("utf-8","replace")
    if "projection-v69-fetch-router" not in canonical: raise RuntimeError("Projection live baseline is not the tested V69+ chain")
    if BOOT not in canonical:
        if "</head>" not in canonical: raise RuntimeError("Projection head close missing")
        canonical=canonical.replace("</head>",BOOT+"\n</head>",1)
    if canonical.count(BOOT)!=1: raise RuntimeError("Projection bootstrap missing/duplicated")
    publish(f,ROOT+"/projection-screen-configurator.html",canonical.encode(),"reporting-v4")
    publish(f,ROOT+"/projection-screen-configurator-v73.html",canonical.encode(),"reporting-v4")

    obs_path=ROOT+"/assets/js/simworx-intelligence-configurator-v1.js"
    obs=read(f,obs_path).decode("utf-8","replace")
    if "projection-email-click-v4" not in obs:
        anchor="""    if (!element || element.id !== 'v65-save-confirm' || type !== 'projection') return;
    var email = node('v65-save-email');"""
        if anchor not in obs: raise RuntimeError("Projection PDF click tracking anchor missing")
        replacement="""    if (!element || type !== 'projection') return;
    if (element.id === 'v37-email-send') {
      var proposalEmail = node('v37-email-address');
      if (!proposalEmail || !proposalEmail.validity || !proposalEmail.validity.valid) return;
      captureContact('email', { email: input('v37-email-address'), name: input('v37-email-name'), tracking_patch: 'projection-email-click-v4' }, 'v37-email-status', /^Proposal .+ sent successfully to /);
      return;
    }
    if (element.id !== 'v65-save-confirm') return;
    var email = node('v65-save-email');"""
        obs=obs.replace(anchor,replacement,1)
    if "projection-email-click-v4" not in obs: raise RuntimeError("Projection email tracking patch missing")
    publish(f,obs_path,obs.encode(),"reporting-v4")

    ana_path=ROOT+"/reports/analytics.js"
    ana=read(f,ana_path).decode("utf-8","replace")
    old="""const marked=p=>p.utm_source==='tracking_validation'&&p.utm_medium==='verification'&&p.utm_content==='deployed-sdk'&&/^TRACKING-VALIDATION-[A-Za-z0-9_-]+-[0-9a-f]{8}$/.test(String(p.utm_campaign||''));"""
    new="""const marked=p=>p.utm_source==='tracking_validation'&&p.utm_medium==='verification'&&/^TRACKING-VALIDATION-[A-Za-z0-9_-]+/.test(String(p.utm_campaign||''));"""
    if old in ana: ana=ana.replace(old,new,1)
    elif new not in ana: raise RuntimeError("Validation-session filter anchor missing")
    publish(f,ana_path,ana.encode(),"reporting-v4")
    f.quit()

for path,need in [
    ("/projection-screen-configurator.html","simworx-intelligence-bootstrap-v1.js"),
    ("/assets/js/simworx-intelligence-configurator-v1.js","projection-email-click-v4"),
    ("/reports/analytics.js","p.utm_source==='tracking_validation'")
]:
    req=Request(BASE+path+"?reporting-v4=1",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-reporting-v4-verifier"})
    with urlopen(req,timeout=45) as r:s=r.read().decode("utf-8","replace")
    if need not in s: raise RuntimeError("Public verification failed "+path)

print("REPORTING_V4_PATCH_PASS")
