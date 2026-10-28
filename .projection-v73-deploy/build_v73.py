from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v72.html"
TARGET=Path("projection-screen-configurator-v73.html")
req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V73-reporting-builder"})
with urlopen(req,timeout=60) as r: html=r.read().decode("utf-8","replace")

required=["projection-v69-fetch-router","projection-v72-vat-fit","projection-v65-real-pdf-js","pdf.save('Simworx_Projection_Proposal_'+safe+'.pdf');",
"status.textContent='Proposal '+(reply.reference||reference)+' sent successfully to '+email+'.';"]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V73 refused: inherited/reporting anchors missing "+repr(missing))

pdf_old="pdf.save('Simworx_Projection_Proposal_'+safe+'.pdf');"
pdf_new=pdf_old+"""
      try{
        const wi=window.SimworxIntelligence;
        wi?.identify?.({email:address},{action:'pdf_download',proposal_reference:ref});
        wi?.trackEvent?.('configuration_downloaded',{download_type:'pdf',proposal_reference:ref});
        wi?.flush?.();
      }catch(_){}
"""
if html.count(pdf_old)!=1: raise SystemExit("V73 PDF save anchor count "+str(html.count(pdf_old)))
html=html.replace(pdf_old,pdf_new,1)

email_old="      status.textContent='Proposal '+(reply.reference||reference)+' sent successfully to '+email+'.';"
email_new=email_old+"""
      try{
        const wi=window.SimworxIntelligence;
        wi?.configurationEmailed?.({email,name,proposal_reference:reply.reference||reference,delivery_method:'server'});
        wi?.flush?.();
      }catch(_){}
"""
if html.count(email_old)!=1: raise SystemExit("V73 email success anchor count "+str(html.count(email_old)))
html=html.replace(email_old,email_new,1)

# Update only explicit Intelligence configurator-version declarations, not historical feature IDs.
html=html.replace('data-configurator-version="projection-v63"','data-configurator-version="projection-v73"',1)
html=html.replace("var version='projection-v63'","var version='projection-v73'",1)

checks=["configuration_downloaded","configurationEmailed","action:'pdf_download'","projection-v73","projection-v69-fetch-router","projection-v72-vat-fit"]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V73 feature checks failed "+repr(missing))

# Check every identifiable inline reporting script we touched remains syntactically valid.
for sid in ["projection-v37-proposal-js","projection-v65-real-pdf-js","projection-v69-fetch-router"]:
    m=re.search(r'<script id="'+re.escape(sid)+r'">(.*?)</script>',html,re.S)
    if not m: raise SystemExit("V73 script missing "+sid)
    p=Path("/tmp/"+sid+".js");p.write_text(m.group(1));subprocess.run(["node","--check",str(p)],check=True)

TARGET.write_text(html)
print("V73 built strictly from V72: explicit PDF/email reporting only")
