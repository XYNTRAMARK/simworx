from pathlib import Path
from urllib.request import Request, urlopen
import re

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v34.html"
TARGET=Path("projection-screen-configurator-v35.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V35-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v34-height-control",
    "projection-v33-optimisation",
    "projection-v32-single-count",
    "projection-v31-enhancements",
    "projection-v30-direct-controls",
    "projection-v29-stable-viewer-owner",
    "projection-fixed-estimate-v24",
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("V35 refused: V34 inheritance missing "+repr(missing))

# The visible 2/3 selection is the single source of truth for calculation.
old_start="const s=getState(),p=prefs();if(!$('guided-mount-drop').reportValidity())return;"
new_start="const s=getState(),p=prefs(),requestedCount=Number(s.projectorCount);if(![2,3].includes(requestedCount))return;p.count=String(requestedCount);const guidedCount=$('guided-count');if(guidedCount)guidedCount.value=p.count;if(!$('guided-mount-drop').reportValidity())return;"
if old_start not in html:
    raise SystemExit("V35 calculate count-source anchor missing")
html=html.replace(old_start,new_start,1)

# Pass the requested count explicitly into the optimiser even if a stale saved preference exists.
old_call="preferences:{...p,supply:s.supplyStatus}"
new_call="preferences:{...p,count:String(requestedCount),supply:s.supplyStatus}"
if old_call not in html:
    raise SystemExit("V35 findLayout preference anchor missing")
html=html.replace(old_call,new_call,1)

# Reject any result that does not exactly satisfy the requested projector count.
old_best="const best=answer.best;"
new_best="const best=answer.best&&answer.best.projectors?.length===requestedCount?answer.best:null;if(answer.best&&!best){answer.issues=[...(answer.issues||[]),'The optimiser returned a different projector count. The requested '+requestedCount+'-projector constraint was not satisfied, so that result was rejected.'];}"
if old_best not in html:
    raise SystemExit("V35 best-result anchor missing")
html=html.replace(old_best,new_best,1)

css="""<style id="projection-v35-count-lock">
#v35-count-lock-note{margin:7px 0 0;font-size:11px;line-height:1.4;color:#475569}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v35-count-lock-js">
(function(){
  const q=id=>document.getElementById(id);
  function sync(){
    const n=Number(q('projection-count')?.value||3);
    const note=q('v35-count-lock-note');
    if(note)note.textContent='Hard requirement: the planner will calculate exactly '+n+' projectors and will never substitute another quantity.';
  }
  function install(){
    const section=q('v31-projector-count');
    if(!section||q('v35-count-lock-note'))return;
    const note=document.createElement('p');
    note.id='v35-count-lock-note';
    section.appendChild(note);
    q('v31-count-2')?.addEventListener('click',()=>setTimeout(sync,40));
    q('v31-count-3')?.addEventListener('click',()=>setTimeout(sync,40));
    sync();
  }
  const timer=setInterval(()=>{install();if(q('v35-count-lock-note'))clearInterval(timer);},50);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
</script>"""
html=html.replace("</body>",js+"\n</body>",1)

checks=[
    "requestedCount=Number(s.projectorCount)",
    "count:String(requestedCount)",
    "answer.best.projectors?.length===requestedCount",
    "will never substitute another quantity",
    "projection-v35-count-lock",
    "Hard requirement: the planner will calculate exactly",
    "projection-v34-height-control",
    "projection-v33-optimisation",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V35 feature/inheritance check failed "+repr(missing))

TARGET.write_text(html)
print("V35 built from published V34 with hard projector-count constraint")
