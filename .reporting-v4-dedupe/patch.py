from __future__ import annotations
import ftplib,ssl,os,io,hashlib,posixpath
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
    st=posixpath.dirname(p)+"/.reporting-v4-dedupe-"+posixpath.basename(p)
    try:f.delete(st)
    except:pass
    f.storbinary("STOR "+st,io.BytesIO(b)); 
    if sha(read(f,st))!=sha(b):raise RuntimeError("stage mismatch")
    f.rename(st,p)

with connect() as f:
    path=ROOT+"/assets/js/simworx-intelligence-configurator-v2.js"
    s=read(f,path).decode("utf-8","replace")
    anchor="""  function captureContact(action, contact, statusId, successPattern) {
    if (!enabled() || !contact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || '')) return;
    open();"""
    replacement="""  function captureContact(action, contact, statusId, successPattern) {
    if (!enabled() || !contact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || '')) return;
    var normalizedEmail = String(contact.email || '').toLowerCase();
    var now = Date.now();
    for (var existingKey in contactRequests) {
      var existing = contactRequests[existingKey];
      if (existing && now - existing.started < 5000 && existing.data && existing.data.copy_action === action &&
          String(existing.contact && existing.contact.email || '').toLowerCase() === normalizedEmail) return;
    }
    open();"""
    if anchor in s:s=s.replace(anchor,replacement,1)
    elif "now - existing.started < 5000" not in s:raise RuntimeError("captureContact anchor missing")
    if "now - existing.started < 5000" not in s:raise RuntimeError("dedupe patch missing")
    put(f,path,s.encode());f.quit()
with urlopen(Request(BASE+"/assets/js/simworx-intelligence-configurator-v2.js?reporting-v4-dedupe=1",headers={"Cache-Control":"no-cache"}),timeout=45) as r:s=r.read().decode()
if "now - existing.started < 5000" not in s:raise RuntimeError("public dedupe verification failed")
print("CONVERSION_DEDUPE_PASS")
