from __future__ import annotations
import ftplib,ssl,os,re
from urllib.parse import urlsplit
raw=os.environ["FTP_HOST"].strip();p=urlsplit(raw if "://" in raw else "ftp://"+raw)
f=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=45);f.connect(p.hostname,p.port or 21);f.login(os.environ["FTP_USERNAME"],os.environ["FTP_PASSWORD"]);f.prot_p()
def read(path):a=[];f.retrbinary("RETR "+path,a.append);return b"".join(a).decode("utf-8","replace")
for path in ["/htdocs/assets/js/simworx-intelligence-bootstrap-v2.js","/htdocs/assets/js/simworx-intelligence-tracker-v2.js","/htdocs/assets/js/simworx-intelligence-configurator-v2.js"]:
    s=read(path);print("\n###FILE",path,"LEN",len(s))
    strings=sorted(set(re.findall(r"['\"]([a-z][a-z0-9_]{2,79})['\"]",s)))
    ev=[x for x in strings if any(k in x for k in ["configurator","configuration","email","download","pdf","simulator","product","software","step"])]
    print("EVENT_STRINGS",ev)
    for term in ["configuration_emailed","configuration_downloaded","v37-email-send","v65-save-confirm","configurator_step_viewed","simulator_model_selected","software_product_clicked","tracking_validation","collectRequest","bootstrap"]:
        hits=[m.start() for m in re.finditer(re.escape(term),s,re.I)]
        if hits:
            print("TERM",term,"COUNT",len(hits))
            for i in hits[:5]:print(s[max(0,i-900):min(len(s),i+2400)].replace("\n"," ")[:3400])
f.quit()
