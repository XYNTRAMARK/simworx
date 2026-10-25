from pathlib import Path
from urllib.request import Request, urlopen

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v35.html"
TARGET=Path("projection-screen-configurator-v36.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V36-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v35-count-lock",
    "projection-v34-height-control",
    "projection-v33-optimisation",
    "projection-v32-single-count",
    "projection-v31-enhancements",
    "projection-v30-direct-controls",
    "Move on gantry",
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("V36 refused: V35 inheritance missing "+repr(missing))

# When a fresh projector layout is loaded, shadows are enabled automatically.
old="if(best){s.diameter=best.state.diameter;s.viewableHeight=best.state.viewableHeight;s.simulatorZ=best.state.simulatorZ;s.projectors=best.projectors;s.projectorCount=best.projectors.length;s.selectedProjector='P1';"
new="if(best){s.diameter=best.state.diameter;s.viewableHeight=best.state.viewableHeight;s.simulatorZ=best.state.simulatorZ;s.projectors=best.projectors;s.projectorCount=best.projectors.length;s.selectedProjector='P1';s.showShadows=true;const shadowBox=$('projection-shadows');if(shadowBox)shadowBox.checked=true;"
if old not in html:
    raise SystemExit("V36 calculated-layout anchor missing")
html=html.replace(old,new,1)

# Clearer movement label: horizontal/direct projector movement, not the gantry-height control.
html=html.replace("Move on gantry","Move projector")

checks=[
    "s.showShadows=true",
    "shadowBox.checked=true",
    "Move projector",
    "Raise / lower gantry",
    "projection-v35-count-lock",
    "projection-v34-height-control",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V36 feature/inheritance check failed "+repr(missing))
if "Move on gantry" in html:
    raise SystemExit("Old Move on gantry label still present")

TARGET.write_text(html)
print("V36 built from published V35")
