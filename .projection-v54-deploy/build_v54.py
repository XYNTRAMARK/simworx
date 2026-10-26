from pathlib import Path
from urllib.request import Request,urlopen
import re,subprocess

BASE="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v53.html"
TARGET=Path("projection-screen-configurator-v54.html")

req=Request(f"{BASE}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V54-builder"})
with urlopen(req,timeout=60) as r:
    html=r.read().decode("utf-8","replace")

required=[
    "projection-v53-two-column-step3",
    "projection-v52-proposal-views",
    "projection-v51-step3-simplification",
    "projection-v50-consistent-viewer",
]
missing=[x for x in required if x not in html]
if missing: raise SystemExit("V54 refused: V53 inheritance missing "+repr(missing))

js=r"""<script id="projection-v54-step3-reversible-js">
(function(){
  const q=id=>document.getElementById(id);
  const work=document.querySelector('.led-workbench');
  const planner=document.querySelector('.guided-planner');
  const preview=q('led-preview');
  if(!work||!planner||!preview)return;

  const saved=new Map();
  let captured=false;

  function currentStep(){
    return Number(document.querySelector('[data-guided-go][aria-current="step"]')?.dataset?.guidedGo||1);
  }

  function remember(el,key){
    if(!el||saved.has(key))return;
    saved.set(key,{
      el,
      parent:el.parentNode,
      next:el.nextSibling,
      hidden:el.hidden
    });
  }

  function captureOriginalState(){
    if(captured)return;
    const home=q('led-canvas-home');
    const button=q('guided-calculate');
    const progress=q('guided-progress');
    const result=q('guided-result');
    const live=q('v30-coverage')?.closest('.v30-section');
    const lookup=q('v31-projector-lookup');
    const row=q('projection-v29-edit-row');
    const panel=q('projection-v25-controls');

    remember(home,'home');
    remember(button,'button');
    remember(progress,'progress');
    remember(result,'result');
    remember(live,'live');
    remember(lookup,'lookup');
    remember(row,'row');
    remember(panel,'panel');
    captured=true;
    window.__v54OriginalOwnership=Object.fromEntries(
      [...saved].map(([k,v])=>[k,{parentId:v.parent?.id||'',parentClass:v.parent?.className||'',hidden:v.hidden}])
    );
  }

  function restoreOne(key){
    const s=saved.get(key);
    if(!s?.el||!s.parent)return;
    if(s.next&&s.next.parentNode===s.parent)s.parent.insertBefore(s.el,s.next);
    else s.parent.appendChild(s.el);
    s.el.hidden=s.hidden;
  }

  function restoreV52(){
    ['home','button','progress','result','live','lookup','row','panel'].forEach(restoreOne);
    work.classList.remove('v53-step3');
    const stack=q('v53-left-stack');
    if(stack)stack.remove();
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }

  function applyStep3(){
    /* Let V53 build its temporary Step-3 layout after original ownership has been captured. */
    work.classList.add('v53-step3');
  }

  function sync(){
    captureOriginalState();
    if(currentStep()===3){
      applyStep3();
      /* V53's own observer performs the actual Step-3 reparenting. */
      setTimeout(()=>window.dispatchEvent(new Event('resize')),80);
    }else{
      restoreV52();
    }
  }

  let timer;
  function schedule(){clearTimeout(timer);timer=setTimeout(sync,140);}
  new MutationObserver(records=>{
    if(records.some(r=>r.type==='attributes'&&r.attributeName==='aria-current'))schedule();
  }).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['aria-current']});
  document.querySelectorAll('[data-guided-go]').forEach(b=>b.addEventListener('click',schedule));

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(sync,1100));
  else setTimeout(sync,1100);
})();
</script>"""
body_close=html.rfind("</body>")
if body_close<0: raise SystemExit("V54 body close missing")
html=html[:body_close]+js+"\n"+html[body_close:]

checks=[
    "projection-v54-step3-reversible-js",
    "__v54OriginalOwnership",
    "restoreV52",
    "projection-v53-two-column-step3",
    "projection-v52-proposal-views",
]
missing=[x for x in checks if x not in html]
if missing: raise SystemExit("V54 checks failed "+repr(missing))

m=re.search(r'<script id="projection-v54-step3-reversible-js">(.*?)</script>',html,re.S)
if not m: raise SystemExit("V54 script missing")
Path("/tmp/v54.js").write_text(m.group(1))
subprocess.run(["node","--check","/tmp/v54.js"],check=True)

TARGET.write_text(html)
print("V54 built from V53: Step-3 DOM rearrangement is fully reversible; Step 2/other steps restore exact original ownership")
