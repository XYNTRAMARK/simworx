from pathlib import Path
from urllib.request import Request,urlopen

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v59.html"
TARGET=Path("projection-screen-configurator-v60.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V60-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=["projection-v59-hide-material-choice","projection-v58-compact-price-bar","v30-throw-scale","0.30 · UST","0.45","1.00","2.10 · zoom"]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V60 refused: V59 inheritance/throw legend anchors missing "+repr(missing))

css=r"""<style id="projection-v60-throw-scale">
/* V60: align throw legend to the actual linear slider range 0.30 -> 2.10. */
.v30-throw-scale{
  position:relative!important;
  display:block!important;
  height:16px!important;
  margin-top:2px!important;
}
.v30-throw-scale span{
  position:absolute!important;
  top:0!important;
  white-space:nowrap!important;
}
.v30-throw-scale span:nth-child(1){left:0!important;transform:none!important}
.v30-throw-scale span:nth-child(2){left:8.333333%!important;transform:translateX(-50%)!important}
.v30-throw-scale span:nth-child(3){left:38.888889%!important;transform:translateX(-50%)!important}
.v30-throw-scale span:nth-child(4){right:0!important;left:auto!important;transform:none!important}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

for marker in ["projection-v60-throw-scale","8.333333%","38.888889%","projection-v59-hide-material-choice"]:
    if marker not in html: raise SystemExit("V60 missing "+marker)

TARGET.write_text(html)
print("V60 built from V59: throw legend positions corrected only")
