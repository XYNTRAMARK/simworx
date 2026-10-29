from __future__ import annotations
import ftplib,ssl,os,io,hashlib,posixpath,re
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
ROOT="/htdocs";BASE="https://www.sim-worx.com"
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
    st=posixpath.dirname(p)+"/.reporting-v4-v2-"+posixpath.basename(p)
    try:f.delete(st)
    except:pass
    f.storbinary("STOR "+st,io.BytesIO(b))
    if sha(read(f,st))!=sha(b):raise RuntimeError("stage mismatch "+p)
    f.rename(st,p)
    if sha(read(f,p))!=sha(b):raise RuntimeError("live mismatch "+p)

with connect() as f:
    path=ROOT+"/assets/js/simworx-intelligence-configurator-v2.js"
    s=read(f,path).decode("utf-8","replace")
    old=r"""      if (element.id === 'v37-email-send') {
        var address = node('v37-email-address');
        var contact = { email: input('v37-email-address'), name: input('v37-email-name') };
        if (!address || !address.validity || !address.validity.valid || !contact.email) return;
        setTimeout(function () { observe(function () {
          if (!/Proposal downloaded\. Opening your email application/i.test(text('v37-email-status'))) return;
          var id = completed(snapshot(), 'proposal_email_prepared');
          var key = id + ':' + contact.email.toLowerCase();
          if (key === lastMailtoCapture) return;
          lastMailtoCapture = key;
          contact.configuration_id = id;
          sdk.identify(contact, Object.assign(dimensions(), { delivery_method: 'mailto', delivery_confirmed: false }));
          sdk.flush();
        }); }, 0);
      }"""
    new=r"""      if (element.id === 'v37-email-send') {
        var address = node('v37-email-address');
        var contact = { email: input('v37-email-address'), name: input('v37-email-name') };
        if (!address || !address.validity || !address.validity.valid || !contact.email) return;
        captureContact('email', contact, 'v37-email-status', /^Proposal .+ sent successfully to /);
      }"""
    if old in s:s=s.replace(old,new,1)
    elif "captureContact('email', contact, 'v37-email-status', /^Proposal .+ sent successfully to /)" not in s:
        raise RuntimeError("V2 Projection email tracking anchor missing")
    # Correct obsolete delivery label used by confirmation path.
    s=s.replace("delivery_method: 'projection_quote_submit_php'","delivery_method: 'projection_email_php'")
    if "Proposal downloaded\. Opening your email application" in s:raise RuntimeError("obsolete mailto success matcher remains")
    if "captureContact('email', contact, 'v37-email-status', /^Proposal .+ sent successfully to /)" not in s:raise RuntimeError("current Projection email matcher missing")
    put(f,path,s.encode())
    f.quit()

with urlopen(Request(BASE+"/assets/js/simworx-intelligence-configurator-v2.js?reporting-v4-email=1",headers={"Cache-Control":"no-cache"}),timeout=45) as r:s=r.read().decode()
if "captureContact('email', contact, 'v37-email-status', /^Proposal .+ sent successfully to /)" not in s:raise RuntimeError("public V2 email tracking verification failed")
print("PROJECTION_V2_EMAIL_TRACKING_PATCH_PASS")
