from pathlib import Path
from urllib.request import Request,urlopen

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v71.html"
TARGET=Path("projection-screen-configurator-v72.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V72-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v69-fetch-router",
    "projection-v65-real-pdf-js",
    "projection-v55-vat-selection-js",
    "box.id='v55-vat-selector'",
    'id="v39-country"',
    'id="v37-customer-type"',
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V72 refused: V71 inheritance/VAT anchors missing "+repr(missing))

css=r"""<style id="projection-v72-vat-fit">
/* V72: contain the VAT selector inside the commercial proposal card only. */
#v55-vat-selector{
  box-sizing:border-box!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
}
#v55-vat-selector .v37-finance-grid{
  grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  box-sizing:border-box!important;
}
#v55-vat-selector .v37-finance-grid>label{
  min-width:0!important;
  max-width:100%!important;
}
#v55-vat-selector #v39-country,
#v55-vat-selector #v37-customer-type{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  box-sizing:border-box!important;
}
@media(max-width:560px){
  #v55-vat-selector .v37-finance-grid{
    grid-template-columns:1fr!important;
  }
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

for marker in [
    "projection-v72-vat-fit",
    "minmax(0,1fr) minmax(0,1fr)",
    "projection-v69-fetch-router",
]:
    if marker not in html: raise SystemExit("V72 missing "+marker)

TARGET.write_text(html)
print("V72 built strictly from V71: VAT box containment only")
