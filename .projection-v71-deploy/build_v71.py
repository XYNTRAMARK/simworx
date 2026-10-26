from pathlib import Path
from urllib.request import Request,urlopen

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v70.html"
TARGET=Path("projection-screen-configurator-v71.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V71-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

old_h1="<h1>Projection Screen Configurator</h1>"
new_h1="<h1>Build your own projection screen using our configurator and get an instant price.</h1>"
old_sub="Build your own projection screen using our configurator and get an instant price."

required=[
    "projection-v69-fetch-router",
    old_h1,
    old_sub,
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V71 refused: V70 inheritance/text anchors missing "+repr(missing))

if html.count(old_h1)!=1: raise SystemExit("V71 heading count "+str(html.count(old_h1)))
html=html.replace(old_h1,new_h1,1)

# Remove only the duplicate supporting paragraph directly beneath the heading.
patterns=[
    '<p>'+old_sub+'</p>',
    '<p class="hero-intro">'+old_sub+'</p>',
    '<p class="lead">'+old_sub+'</p>'
]
removed=False
for p in patterns:
    if p in html:
        html=html.replace(p,'',1)
        removed=True
        break
if not removed:
    # conservative fallback: remove a single exact text occurrence after the new H1.
    idx=html.find(new_h1)
    j=html.find(old_sub,idx+len(new_h1))
    if j<0: raise SystemExit("V71 duplicate subtitle occurrence not found")
    # remove just text, leaving wrapper empty only if markup is unknown.
    html=html[:j]+html[j+len(old_sub):]

if new_h1 not in html: raise SystemExit("V71 new heading missing")
if html.count(old_sub)>1: raise SystemExit("V71 duplicate text still present too many times")
for marker in ["projection-v69-fetch-router","projection-v65-real-pdf-js","projection-v64-hide-recalculate-strip"]:
    if marker not in html: raise SystemExit("V71 inherited marker missing "+marker)

TARGET.write_text(html)
print("V71 built strictly from V70: headline changed and duplicate subtitle removed only")
