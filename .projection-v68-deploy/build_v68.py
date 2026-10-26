from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v67.html"
TARGET=Path("projection-screen-configurator-v68.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V68-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection_images",
    "projection-v65-real-pdf-js",
    'id="v48-email-form"',
    'action="projection-quote-submit.php"',
    "payload.set('quote_action','email')",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V68 refused: V67 inheritance/email anchors missing "+repr(missing))

# Only reroute customer proposal email to the proven LED endpoint/delivery routine.
html=html.replace('action="projection-quote-submit.php"','action="led-quote-submit.php"',1)
html=html.replace("payload.set('quote_action','email')","payload.set('quote_action','projection-email')",1)

checks=[
    'action="led-quote-submit.php"',
    "payload.set('quote_action','projection-email')",
    "projection_images",
    "projection-v65-real-pdf-js",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V68 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v37-proposal-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V68 proposal script missing")
Path("/tmp/v68-proposal.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v68-proposal.js"],check=True)

TARGET.write_text(html)
print("V68 built from V67: Projection customer email rerouted to live LED endpoint")
