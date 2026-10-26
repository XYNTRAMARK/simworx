from pathlib import Path
from urllib.request import Request,urlopen

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v63.html"
TARGET=Path("projection-screen-configurator-v64.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V64-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v63-clear-email-status",
    "HTMLFormElement.prototype.submit.call(form)",
    "projection-v60-throw-scale",
    'id="guided-viewer-status"',
    'id="guided-recalculate"',
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V64 refused: V63 inheritance/recalculate anchors missing "+repr(missing))

css=r"""<style id="projection-v64-hide-recalculate-strip">
/* V64: hide only the customer-facing recalculation strip.
   Existing dirty-state/recalculation logic remains untouched. */
#guided-viewer-status{
  display:none!important;
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

for marker in [
    "projection-v64-hide-recalculate-strip",
    "projection-v63-clear-email-status",
    "HTMLFormElement.prototype.submit.call(form)",
]:
    if marker not in html: raise SystemExit("V64 missing "+marker)

TARGET.write_text(html)
print("V64 built strictly from V63: recalculation notice/button strip hidden only")
