from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v62.html"
TARGET=Path("projection-screen-configurator-v63.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V63-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "HTMLFormElement.prototype.submit.call(form)",
    "projection-v60-throw-scale",
    "projection-v59-hide-material-choice",
    "projection-v58-compact-price-bar",
    'id="v37-email-proposal"',
    'id="v37-email-status"',
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V63 refused: V62 inheritance/email anchors missing "+repr(missing))

js=r"""<script id="projection-v63-clear-email-status">
(function(){
  const open=document.getElementById('v37-email-proposal');
  const status=document.getElementById('v37-email-status');
  if(!open||!status)return;
  open.addEventListener('click',()=>{
    status.textContent='';
    status.classList.remove('v42-error','v42-success','v48-error','v48-success');
  });
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V63 body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    "projection-v63-clear-email-status",
    "status.textContent=''",
    "HTMLFormElement.prototype.submit.call(form)",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V63 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v63-clear-email-status">(.*?)</script>',html,re.S)
Path("/tmp/v63.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v63.js"],check=True)

TARGET.write_text(html)
print("V63 built from V62: clear stale email status only when opening dialog")
