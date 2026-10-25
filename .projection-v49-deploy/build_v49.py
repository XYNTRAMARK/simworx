from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v48.html"
TARGET=Path("projection-screen-configurator-v49.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V49-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v47-site-shell",
    "projection-v48-delivery-fix",
    "projection-v48-antispam",
    "projection-v37-space-optimisation",
    "projection-v30-direct-controls",
    "projection-v34-height-control",
    "projection-v42-proposal-delivery",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V49 refused: V48 inheritance missing "+repr(missing))
if "Content-Security-Policy" in html: raise SystemExit("V49 source unexpectedly contains obsolete CSP")
if "escproposalLineValue" in html: raise SystemExit("V49 source regressed proposal serializer")

css=r"""<style id="projection-v49-viewer-priority">
/* Step 3 is a visual-design task: the 3D viewer is deliberately the dominant surface. */
.led-workbench.v49-step3{
  grid-template-columns:minmax(230px,255px) minmax(0,1fr)!important;
  gap:18px!important;
  align-items:start!important;
}
.led-workbench.v49-step3>.led-controls{min-width:0!important}
.led-workbench.v49-step3 .guided-planner{
  padding:14px!important;
  min-width:0!important;
}
.led-workbench.v49-step3 .guided-planner .projection-form-grid{
  grid-template-columns:1fr!important;
  gap:8px!important;
}
.led-workbench.v49-step3 .guided-planner .guided-smart-grid{
  grid-template-columns:1fr!important;
  gap:7px!important;
}
.led-workbench.v49-step3 .guided-result-metrics{
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  gap:7px!important;
}
.led-workbench.v49-step3 #led-preview{
  min-width:0!important;
  padding:16px!important;
}
.led-workbench.v49-step3 .projection-v29-edit-row.is-step3{
  grid-template-columns:minmax(0,1fr) 250px!important;
  gap:12px!important;
  align-items:start!important;
}
.led-workbench.v49-step3 #v37-left-column{
  min-width:0!important;
  width:auto!important;
}
.led-workbench.v49-step3 #led-canvas-home{
  width:100%!important;
  min-width:0!important;
}
.led-workbench.v49-step3 #led-canvas{
  height:clamp(600px,70vh,780px)!important;
  min-height:600px!important;
}
.led-workbench.v49-step3 #projection-v25-controls{
  width:auto!important;
  min-width:0!important;
  padding:10px!important;
}
.led-workbench.v49-step3 #projection-v30-control-surface{gap:9px!important}
.led-workbench.v49-step3 .v30-head{gap:7px!important}
.led-workbench.v49-step3 .v30-head h3{
  font-size:16px!important;
  line-height:1.15!important;
}
.led-workbench.v49-step3 .v30-section{
  padding:9px!important;
  border-radius:6px!important;
}
.led-workbench.v49-step3 .v30-projector-selector{gap:5px!important}
.led-workbench.v49-step3 .v30-projector-selector button{
  min-height:36px!important;
  padding:6px 4px!important;
  font-size:11px!important;
}
.led-workbench.v49-step3 .v30-mode-buttons{gap:6px!important}
.led-workbench.v49-step3 .v30-mode-buttons button{
  min-height:40px!important;
  padding:7px 5px!important;
  font-size:10.5px!important;
}
.led-workbench.v49-step3 .v34-height-tools{gap:5px!important}
.led-workbench.v49-step3 .v34-height-tools button{
  min-height:36px!important;
  padding:6px 3px!important;
  font-size:9.5px!important;
}
.led-workbench.v49-step3 .v30-mode-help,
.led-workbench.v49-step3 .v34-height-note,
.led-workbench.v49-step3 .v33-throw-note{
  font-size:9.5px!important;
  line-height:1.35!important;
}
.led-workbench.v49-step3 .v30-throw-scale{font-size:8.5px!important;gap:3px!important}
.led-workbench.v49-step3 .v30-fit-grid{gap:4px!important}
.led-workbench.v49-step3 .v30-fit-grid div{padding:6px!important}
.led-workbench.v49-step3 .v31-ai-card{
  padding:10px!important;
  font-size:10px!important;
}
.led-workbench.v49-step3 .v31-ai-card h4{font-size:13px!important;margin:0 0 7px!important}
.led-workbench.v49-step3 .v31-ai-card p{line-height:1.4!important}
@media(max-width:1050px){
  .led-workbench.v49-step3{grid-template-columns:1fr!important}
  .led-workbench.v49-step3 .guided-planner{padding:18px!important}
  .led-workbench.v49-step3 .projection-v29-edit-row.is-step3{grid-template-columns:1fr!important}
  .led-workbench.v49-step3 #led-canvas{height:560px!important;min-height:460px!important}
  .led-workbench.v49-step3 #projection-v25-controls{padding:14px!important}
}
@media(max-width:650px){
  .led-workbench.v49-step3 #led-canvas{height:440px!important;min-height:360px!important}
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v49-viewer-priority-js">
(function(){
  const workbench=document.querySelector('.led-workbench');
  if(!workbench)return;
  function currentStep(){
    return Number(document.querySelector('[data-guided-go][aria-current="step"]')?.dataset?.guidedGo||1);
  }
  function sync(){
    const active=currentStep()===3;
    workbench.classList.toggle('v49-step3',active);
    if(active){
      requestAnimationFrame(()=>{
        window.dispatchEvent(new Event('resize'));
        setTimeout(()=>window.dispatchEvent(new Event('resize')),80);
      });
    }
  }
  new MutationObserver(records=>{
    if(records.some(r=>r.type==='attributes'&&r.attributeName==='aria-current'))sync();
  }).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['aria-current']});
  document.querySelectorAll('[data-guided-go]').forEach(b=>b.addEventListener('click',()=>setTimeout(sync,0)));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync);else sync();
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V49 body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    "projection-v49-viewer-priority",
    "projection-v49-viewer-priority-js",
    "grid-template-columns:minmax(230px,255px) minmax(0,1fr)",
    "grid-template-columns:minmax(0,1fr) 250px",
    "height:clamp(600px,70vh,780px)",
    "projection-v48-delivery-fix",
    "projection-v48-antispam",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V49 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v49-viewer-priority-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V49 viewer-priority script missing")
Path("/tmp/v49-viewer.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v49-viewer.js"],check=True)

TARGET.write_text(html)
print("V49 built: viewer-first Step 3 layout, V48 proposal delivery preserved")
