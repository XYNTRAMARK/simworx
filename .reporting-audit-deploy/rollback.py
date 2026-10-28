from __future__ import annotations
import ftplib,io,os,ssl
from pathlib import Path
from urllib.parse import urlsplit
ROOT="/htdocs/reports";p=Path("/tmp/reports-audit-backup/app.js")
if not p.exists():raise SystemExit("No reports backup available")
raw=os.environ["FTP_HOST"].strip();u=urlsplit(raw if "://" in raw else "ftp://"+raw)
f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45);f.connect(u.hostname,u.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p()
f.storbinary("STOR "+ROOT+"/app.js",io.BytesIO(p.read_bytes()));f.quit()
print("REPORTING_AUDIT_EXTENSION_ROLLED_BACK")
