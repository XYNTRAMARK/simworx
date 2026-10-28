from __future__ import annotations
import ftplib,io,os,ssl
from pathlib import Path
from urllib.parse import urlsplit
ROOT="/htdocs";BACK=Path("/tmp/simworx-intelligence-backup")
files=["simworx-intelligence-bootstrap-v1.js","simworx-intelligence-bootstrap-v2.js","simworx-intelligence-tracker-v1.js","simworx-intelligence-tracker-v2.js"]
raw=os.environ["FTP_HOST"].strip();p=urlsplit(raw if "://" in raw else "ftp://"+raw)
f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45);f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p()
for name in files:
    path=BACK/name
    if path.exists():f.storbinary("STOR "+ROOT+"/assets/js/"+name,io.BytesIO(path.read_bytes()))
try:f.delete(ROOT+"/assets/js/simworx-intelligence-business-v1.js")
except:pass
f.quit()
print("WEBSITE_INTELLIGENCE_ROLLED_BACK")
