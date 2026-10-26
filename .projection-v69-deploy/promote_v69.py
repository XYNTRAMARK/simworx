from __future__ import annotations
import ftplib,hashlib,io,os,ssl
from pathlib import Path
from urllib.parse import urlsplit
ROOT="/htdocs";PAGE="projection-screen-configurator-v69.html";CANONICAL="projection-screen-configurator.html"
def sha(b):return hashlib.sha256(b).hexdigest()
def connect():
    raw=os.environ["FTP_HOST"].strip();p=urlsplit(raw if "://" in raw else "ftp://"+raw)
    f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45)
    f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p();return f
def read(f,path):a=[];f.retrbinary("RETR "+path,a.append);return b"".join(a)
body=Path(PAGE).read_bytes()
with connect() as f:
    stage=ROOT+"/.v69-canonical-stage.html"
    try:f.delete(stage)
    except:pass
    f.storbinary("STOR "+stage,io.BytesIO(body))
    if sha(read(f,stage))!=sha(body):raise RuntimeError("canonical staged mismatch")
    f.rename(stage,ROOT+"/"+CANONICAL)
    if sha(read(f,ROOT+"/"+CANONICAL))!=sha(body):raise RuntimeError("canonical V69 mismatch")
    f.quit()
print("Promoted V69 to canonical page")
