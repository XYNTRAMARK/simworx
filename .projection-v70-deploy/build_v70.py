from pathlib import Path
from urllib.request import Request,urlopen

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v69.html"
TARGET=Path("projection-screen-configurator-v70.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V70-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

old="Design the screen around your room and cockpit, then calculate the projector specification and mounting geometry your installation requires."
new="Build your own projection screen using our configurator and get an instant price."

required=[
    "projection-v69-fetch-router",
    "projection-v69-native-fetch-capture",
    old,
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V70 refused: V69 inheritance/text anchor missing "+repr(missing))

if html.count(old)!=1: raise SystemExit("V70 refused: intro text occurrence count is "+str(html.count(old)))
html=html.replace(old,new,1)

if old in html: raise SystemExit("V70 old intro text remains")
if new not in html: raise SystemExit("V70 new intro text missing")
for marker in ["projection-v69-fetch-router","projection-v65-real-pdf-js","projection-v64-hide-recalculate-strip"]:
    if marker not in html: raise SystemExit("V70 inherited marker missing "+marker)

TARGET.write_text(html)
print("V70 built strictly from V69: intro sentence changed only")
