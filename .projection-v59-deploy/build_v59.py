from pathlib import Path
from urllib.request import Request,urlopen

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v58.html"
TARGET=Path("projection-screen-configurator-v59.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V59-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v58-compact-price-bar",
    "compactProposalHtmlForEmail",
    "projection-v56-restore-projector-controls",
    "projection-v55-vat-selection",
    "projection-material-bar",
    'id="projection-materials"',
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V59 refused: V58 inheritance/material anchors missing "+repr(missing))

css=r"""<style id="projection-v59-hide-material-choice">
/* V59: remove only the customer-facing screen-material choice bar.
   Existing default material state/pricing logic remains untouched. */
.projection-material-bar{
  display:none!important;
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

for marker in [
    "projection-v59-hide-material-choice",
    "projection-v58-compact-price-bar",
    "compactProposalHtmlForEmail",
]:
    if marker not in html: raise SystemExit("V59 missing "+marker)

TARGET.write_text(html)
print("V59 built strictly from V58: screen material choice bar hidden only")
