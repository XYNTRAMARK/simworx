from pathlib import Path
from urllib.request import Request,urlopen
import re

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v57.html"
TARGET=Path("projection-screen-configurator-v58.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V58-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "compactProposalHtmlForEmail",
    "projection-v56-restore-projector-controls",
    "projection-v55-vat-selection",
    "projection-v54-step3-reversible-js",
    "led-estimate-bar",
    "led-running-price",
    "projection-estimate-actions",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V58 refused: V57 inheritance/price-bar anchors missing "+repr(missing))

css=r"""<style id="projection-v58-compact-price-bar">
/* V58: price-bar-only compaction. No workflow or pricing logic changes. */
.led-estimate-bar{
  min-height:0!important;
  padding:10px 18px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:18px!important;
}
.led-estimate-bar .led-running-price{
  display:grid!important;
  grid-template-columns:auto auto auto!important;
  grid-template-areas:
    "title total note"!important;
  align-items:center!important;
  column-gap:16px!important;
  row-gap:0!important;
  min-width:0!important;
}
.led-estimate-bar #led-running-title{
  grid-area:title!important;
  margin:0!important;
  white-space:nowrap!important;
  font-size:12px!important;
  line-height:1.2!important;
}
.led-estimate-bar #led-running-total{
  grid-area:total!important;
  margin:0!important;
  white-space:nowrap!important;
  font-size:24px!important;
  line-height:1!important;
}
.led-estimate-bar #led-running-note{
  grid-area:note!important;
  margin:0!important;
  max-width:none!important;
  white-space:normal!important;
  font-size:11px!important;
  line-height:1.25!important;
}
.led-estimate-bar .projection-estimate-actions{
  display:flex!important;
  align-items:center!important;
  margin:0!important;
}
.led-estimate-bar #projection-currency{
  height:42px!important;
  min-width:86px!important;
  margin:0!important;
}
@media(max-width:760px){
  .led-estimate-bar{
    align-items:flex-start!important;
    gap:10px!important;
    padding:9px 12px!important;
  }
  .led-estimate-bar .led-running-price{
    grid-template-columns:auto auto!important;
    grid-template-areas:
      "title total"
      "note note"!important;
    column-gap:10px!important;
    row-gap:4px!important;
  }
  .led-estimate-bar #led-running-title{white-space:normal!important}
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

checks=[
    "projection-v58-compact-price-bar",
    "grid-template-areas:",
    "title total note",
    "compactProposalHtmlForEmail",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V58 checks failed "+repr(missing))

TARGET.write_text(html)
print("V58 built strictly from V57: price bar compacted only")
