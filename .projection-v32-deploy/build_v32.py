from pathlib import Path
from urllib.request import Request, urlopen

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v31.html"
TARGET=Path("projection-screen-configurator-v32.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V32-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v31-enhancements",
    "projection-v31-enhancements-js",
    "projection-v30-direct-controls",
    "projection-v29-stable-viewer-owner",
    "projection-fixed-estimate-v24",
    "Find projectors with AI",
    "state.runwayPreview=on",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V32 refused: V31 inheritance missing "+repr(missing))

old="""  function setCount(n){
    const select=q('projection-count');
    if(!select)return;
    select.value=String(n);
    select.dispatchEvent(new Event('change',{bubbles:true}));
    setTimeout(()=>{syncCount();refreshSearch();},60);
  }"""
new="""  function setCount(n){
    const guided=q('guided-count');
    if(guided){
      guided.value=String(n);
      guided.dispatchEvent(new Event('change',{bubbles:true}));
    }
    const select=q('projection-count');
    if(select){
      select.value=String(n);
      select.dispatchEvent(new Event('change',{bubbles:true}));
    }
    setTimeout(()=>{
      if(guided&&guided.value!==String(n)){
        guided.value=String(n);
        guided.dispatchEvent(new Event('change',{bubbles:true}));
      }
      syncCount();
      refreshSearch();
    },100);
  }"""
if old not in html: raise SystemExit("V32 count handler anchor missing")
html=html.replace(old,new,1)

needle="""    const countSelect=q('projection-count');
    const originalField=countSelect?.closest('.led-field');
    if(originalField)originalField.classList.add('v31-hide-original-count');"""
replacement="""    const countSelect=q('projection-count');
    const originalField=countSelect?.closest('.led-field');
    if(originalField)originalField.classList.add('v31-hide-original-count');
    const guidedCount=q('guided-count');
    const guidedCountField=guidedCount?.closest('label');
    if(guidedCountField)guidedCountField.classList.add('v32-hide-guided-count');"""
if needle not in html: raise SystemExit("V32 count install anchor missing")
html=html.replace(needle,replacement,1)

css="""<style id="projection-v32-single-count">
.v32-hide-guided-count{display:none!important}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

checks=[
    "projection-v32-single-count",
    "v32-hide-guided-count",
    "const guided=q('guided-count')",
    "projection-v31-enhancements",
    "state.runwayPreview=on",
    "Find projectors with AI",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V32 feature/inheritance check failed "+repr(missing))

TARGET.write_text(html)
print("V32 built from published V31 with one projector-count control")
