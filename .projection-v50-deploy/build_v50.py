from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v49.html"
TARGET=Path("projection-screen-configurator-v50.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V50-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v49-viewer-priority",
    "projection-v48-delivery-fix",
    "projection-v48-antispam",
    "projection-v47-site-shell",
    "projection-v37-space-optimisation",
    "projection-v30-direct-controls",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V50 refused: live V49 inheritance missing "+repr(missing))
if "Content-Security-Policy" in html: raise SystemExit("V50 source unexpectedly contains obsolete CSP")

css=r"""<style id="projection-v50-consistent-viewer">
/* V50: Step 3 must use the same workbench/viewer footprint as the normal configurator steps.
   Projector controls move below the viewer instead of taking horizontal viewer space. */
.led-workbench.v49-step3.v50-step3{
  grid-template-columns:var(--v50-base-workbench-grid)!important;
}
.led-workbench.v49-step3.v50-step3 .guided-planner{
  padding:var(--v50-base-planner-padding)!important;
}
.led-workbench.v49-step3.v50-step3 #led-preview{
  padding:var(--v50-base-preview-padding)!important;
}
.led-workbench.v49-step3.v50-step3 .projection-v29-edit-row.is-step3{
  grid-template-columns:1fr!important;
  gap:12px!important;
  align-items:start!important;
}
.led-workbench.v49-step3.v50-step3 #v37-left-column,
.led-workbench.v49-step3.v50-step3 #led-canvas-home,
.led-workbench.v49-step3.v50-step3 #projection-v25-controls{
  width:100%!important;
  min-width:0!important;
}
.led-workbench.v49-step3.v50-step3 #led-canvas{
  height:var(--v50-base-canvas-height)!important;
  min-height:var(--v50-base-canvas-min-height)!important;
}
.led-workbench.v49-step3.v50-step3 #projection-v25-controls{
  grid-column:1!important;
  margin-top:0!important;
  padding:14px!important;
}
@media(max-width:1050px){
  .led-workbench.v49-step3.v50-step3{grid-template-columns:1fr!important}
  .led-workbench.v49-step3.v50-step3 .projection-v29-edit-row.is-step3{grid-template-columns:1fr!important}
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v50-consistent-viewer-js">
(function(){
  const work=document.querySelector('.led-workbench');
  const canvas=document.getElementById('led-canvas');
  const planner=document.querySelector('.guided-planner');
  const preview=document.getElementById('led-preview');
  if(!work||!canvas||!planner||!preview)return;

  function step(){
    return Number(document.querySelector('[data-guided-go][aria-current="step"]')?.dataset?.guidedGo||1);
  }
  function px(v,fallback){return v&&v!=='auto'?v:fallback}
  function captureNormalGeometry(){
    const had49=work.classList.contains('v49-step3');
    const had50=work.classList.contains('v50-step3');
    work.classList.remove('v49-step3','v50-step3');
    const ws=getComputedStyle(work),cs=getComputedStyle(canvas),ps=getComputedStyle(planner),vs=getComputedStyle(preview);
    work.style.setProperty('--v50-base-workbench-grid',ws.gridTemplateColumns);
    work.style.setProperty('--v50-base-canvas-height',px(cs.height,canvas.getBoundingClientRect().height+'px'));
    work.style.setProperty('--v50-base-canvas-min-height',px(cs.minHeight,'0px'));
    work.style.setProperty('--v50-base-planner-padding',ps.padding);
    work.style.setProperty('--v50-base-preview-padding',vs.padding);
    if(had49)work.classList.add('v49-step3');
    if(had50)work.classList.add('v50-step3');
  }
  function sync(){
    if(step()===3){
      captureNormalGeometry();
      work.classList.add('v50-step3');
      requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
    }else{
      work.classList.remove('v50-step3');
      captureNormalGeometry();
    }
  }
  new MutationObserver(records=>{
    if(records.some(r=>r.type==='attributes'&&r.attributeName==='aria-current'))setTimeout(sync,0);
  }).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['aria-current']});
  document.querySelectorAll('[data-guided-go]').forEach(b=>b.addEventListener('click',()=>setTimeout(sync,10)));
  window.addEventListener('resize',()=>{if(step()!==3)captureNormalGeometry();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(sync,0));else setTimeout(sync,0);
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V50 body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    "projection-v50-consistent-viewer",
    "projection-v50-consistent-viewer-js",
    "projection-v49-viewer-priority",
    "projection-v48-delivery-fix",
    "grid-template-columns:1fr!important",
    "--v50-base-workbench-grid",
    "--v50-base-canvas-height",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V50 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v50-consistent-viewer-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V50 script missing")
Path("/tmp/v50.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v50.js"],check=True)

TARGET.write_text(html)
print("V50 built strictly from live V49: Step 3 viewer footprint locked to normal-step geometry; tuning controls below viewer")
