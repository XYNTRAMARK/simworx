from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v52.html"
TARGET=Path("projection-screen-configurator-v53.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V53-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v52-proposal-views",
    "projection-v51-step3-simplification",
    "projection-v50-consistent-viewer",
    "projection-v49-viewer-priority",
    'id="guided-calculate"',
    'id="guided-mount-drop"',
    'id="led-preview"',
    'id="led-canvas-home"',
    'id="projection-v25-controls"',
    'id="v31-projector-lookup"',
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V53 refused: V52 inheritance/anchors missing "+repr(missing))

css=r"""<style id="projection-v53-two-column-step3">
/* V53: Step 3 is exactly two columns. Left is action/results; right is model/viewer/controls. */
.led-workbench.v53-step3{
  grid-template-columns:minmax(330px,435px) minmax(0,1fr)!important;
  gap:20px!important;
  align-items:start!important;
}

/* The left column is deliberately free of setup/manipulation controls. */
.led-workbench.v53-step3 .guided-preferences,
.led-workbench.v53-step3 #projection-mounting-style-v51-hidden,
.led-workbench.v53-step3 #projection-mounting-note,
.led-workbench.v53-step3 .guided-catalogue,
.led-workbench.v53-step3 #guided-manual,
.led-workbench.v53-step3 #projection-v25-controls,
.led-workbench.v53-step3 #projection-v29-edit-row,
.led-workbench.v53-step3 #v37-left-column,
.led-workbench.v53-step3 #v37-left-below{
  display:none!important;
}

.led-workbench.v53-step3 .guided-planner{
  display:block!important;
  padding:18px!important;
  min-width:0!important;
}
.led-workbench.v53-step3 .guided-planner > :not(#v53-left-stack){
  display:none!important;
}
#v53-left-stack{
  display:grid;
  gap:12px;
  align-content:start;
}
#v53-left-stack #guided-calculate{
  order:0;
  width:100%;
  margin:0!important;
  min-height:52px!important;
  font-size:15px!important;
  font-weight:850!important;
}
#v53-left-stack #guided-progress{order:1;margin:0!important}
#v53-left-stack #guided-result{order:2;margin:0!important}
#v53-left-stack .v53-live-fit{order:3;margin:0!important}
#v53-left-stack #v31-projector-lookup{order:4;margin:0!important}

/* Remove the legacy/raw throw control from the left/result surfaces.
   The customer-facing Step 3 has no manual throw manipulation controls. */
.led-workbench.v53-step3 #projection-throw,
.led-workbench.v53-step3 label[for="projection-throw"],
.led-workbench.v53-step3 #projection-throw-value,
.led-workbench.v53-step3 #projection-throw-all,
.led-workbench.v53-step3 .projection-throw-scale,
.led-workbench.v53-step3 #v30-throw,
.led-workbench.v53-step3 #v30-throw-all{
  display:none!important;
}

/* Right column: normal parametric header -> viewer -> viewer controls. */
.led-workbench.v53-step3 #led-preview{
  display:block!important;
  min-width:0!important;
  padding:20px!important;
  overflow:visible!important;
}
.led-workbench.v53-step3 #led-canvas-home{
  display:block!important;
  position:relative!important;
  width:100%!important;
  min-width:0!important;
  margin-top:12px!important;
}
.led-workbench.v53-step3 #led-canvas{
  width:100%!important;
  overflow:hidden!important;
}
.led-workbench.v53-step3 .led-viewer-toolbar,
.led-workbench.v53-step3 .projection-view-tabs{
  position:relative!important;
  z-index:1!important;
}
@media(max-width:1050px){
  .led-workbench.v53-step3{grid-template-columns:1fr!important}
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v53-two-column-step3-js">
(function(){
  const q=id=>document.getElementById(id);
  const work=document.querySelector('.led-workbench');
  const planner=document.querySelector('.guided-planner');
  const preview=q('led-preview');
  if(!work||!planner||!preview)return;

  function step(){
    return Number(document.querySelector('[data-guided-go][aria-current="step"]')?.dataset?.guidedGo||1);
  }

  function silentDefaults(){
    const clearance=q('guided-mount-drop');
    if(clearance){
      clearance.min='0.2';
      if(clearance.value!=='0.2'&&clearance.value!=='0.20'){
        clearance.value='0.20';
        clearance.dispatchEvent(new Event('input',{bubbles:true}));
        clearance.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }
    const mount=q('projection-mounting-style-v51-hidden')||q('projection-mounting-style');
    if(mount&&mount.value!=='ceiling'){
      mount.value='ceiling';
      mount.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }

  function buildLeft(){
    let stack=q('v53-left-stack');
    if(!stack){
      stack=document.createElement('div');
      stack.id='v53-left-stack';
      planner.insertBefore(stack,planner.firstChild);
    }
    const button=q('guided-calculate');
    const progress=q('guided-progress');
    const result=q('guided-result');
    if(button&&button.parentNode!==stack)stack.appendChild(button);
    if(progress&&progress.parentNode!==stack)stack.appendChild(progress);
    if(result&&result.parentNode!==stack)stack.appendChild(result);

    const live=q('v30-coverage')?.closest('.v30-section');
    if(live){
      live.classList.add('v53-live-fit');
      if(live.parentNode!==stack)stack.appendChild(live);
    }
    const lookup=q('v31-projector-lookup');
    if(lookup&&lookup.parentNode!==stack)stack.appendChild(lookup);
  }

  function buildRight(){
    const home=q('led-canvas-home');
    const toolbar=preview.querySelector('.led-viewer-toolbar');
    const panel=q('projection-v25-controls');
    const row=q('projection-v29-edit-row');

    /* Undo legacy Step-3 ownership: the WebGL viewer belongs directly to the right preview. */
    if(home&&toolbar&&home.parentNode!==preview)preview.insertBefore(home,toolbar);
    if(panel)panel.hidden=true;
    if(row)row.hidden=true;

    /* Keep normal viewer controls directly after the viewer. */
    if(home&&toolbar&&toolbar.previousElementSibling!==home){
      preview.insertBefore(home,toolbar);
    }

    window.dispatchEvent(new Event('resize'));
  }

  function apply(){
    silentDefaults();
    const active=step()===3;
    work.classList.toggle('v53-step3',active);
    if(!active)return;
    buildLeft();
    buildRight();
    requestAnimationFrame(()=>{
      buildRight();
      window.dispatchEvent(new Event('resize'));
    });
  }

  let timer;
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,30);}
  new MutationObserver(records=>{
    if(records.some(r=>r.type==='attributes'&&r.attributeName==='aria-current'))schedule();
  }).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['aria-current']});
  document.querySelectorAll('[data-guided-go]').forEach(b=>b.addEventListener('click',schedule));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,300));
  else setTimeout(apply,300);
  setTimeout(apply,900);
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V53 body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    "projection-v53-two-column-step3",
    "projection-v53-two-column-step3-js",
    "v53-left-stack",
    "grid-template-columns:minmax(330px,435px) minmax(0,1fr)",
    "projection-v52-proposal-views",
    "Click To Generate Projector Profile",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V53 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v53-two-column-step3-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V53 script missing")
Path("/tmp/v53.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v53.js"],check=True)

TARGET.write_text(html)
print("V53 built strictly from V52: exact two-column Step 3, no preferences/manual controls, viewer restored to right preview")
