from pathlib import Path
from urllib.request import Request, urlopen
import re

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v32.html"
TARGET=Path("projection-screen-configurator-v33.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V33-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v32-single-count",
    "projection-v31-enhancements",
    "projection-v30-direct-controls",
    "projection-v29-stable-viewer-owner",
    "projection-fixed-estimate-v24",
    "Find projectors with AI",
    "state.runwayPreview=on",
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("V33 refused: V32 inheritance missing "+repr(missing))

# --- 1. Add an efficient mirror operation inside the existing app module state. ---
anchor="function setSelected(id){state.selectedProjector=id;layer?.select(id,false);const label=$('projection-manual-selected');if(label)label.textContent=id;renderProjectorControls();}\\nfunction setPilot"
mirror_fn="""function setSelected(id){state.selectedProjector=id;layer?.select(id,false);const label=$('projection-manual-selected');if(label)label.textContent=id;renderProjectorControls();}
function mirrorSelectedProjector(){
  const source=selected();
  if(!source)return {ok:false,reason:'No projector selected'};
  const count=state.projectors.length;
  const targetId=count===2?(source.id==='P1'?'P2':source.id==='P2'?'P1':null):(source.id==='P1'?'P3':source.id==='P3'?'P1':null);
  const target=state.projectors.find(p=>p.id===targetId);
  if(!target)return {ok:false,reason:count===3?'Select P1 or P3 to mirror across the centreline.':'Select P1 or P2.'};
  target.position=[-(source.position?.[0]||0),source.position?.[1]||0,source.position?.[2]||0];
  target.yaw=-(source.yaw||0);
  target.pitch=source.pitch||0;
  target.roll=-(source.roll||0);
  target.throwRatio=source.throwRatio;
  target.planningThrowRange=source.planningThrowRange?[...source.planningThrowRange]:[.30,2.10];
  state.manualLayout=true;
  layer?.update({fine:true});
  guided?.changed();
  syncInputs();
  queueQuote();
  return {ok:true,source:source.id,target:target.id};
}
window.__projectionMirrorSelectedProjector=mirrorSelectedProjector;
function setPilot"""
if anchor not in html:
    raise SystemExit("V33 setSelected app anchor missing")
html=html.replace(anchor,mirror_fn.replace("\n","\\n"),1)

# --- 2. Throw always applies to the whole matched projector set. ---
old_throw="$('projection-throw').addEventListener('input',e=>{const ratio=Number(e.target.value),targets=$('projection-throw-all')?.checked?state.projectors:[selected()];for(const p of targets){p.throwRatio=ratio;p.planningThrowRange=[.30,2.10];}state.manualLayout=true;guided?.changed();layer?.update();syncInputs();queueQuote();});"
new_throw="$('projection-throw').addEventListener('input',e=>{const ratio=Number(e.target.value),targets=state.projectors;for(const p of targets){p.throwRatio=ratio;p.planningThrowRange=[.30,2.10];}const all=$('projection-throw-all');if(all)all.checked=true;state.manualLayout=true;guided?.changed();layer?.update();syncInputs();queueQuote();});"
if old_throw not in html:
    raise SystemExit("V33 V30 throw event anchor missing")
html=html.replace(old_throw,new_throw,1)

# --- 3. Remove the Improve this configuration block and compact Step 3 layout. ---
css="""<style id="projection-v33-optimisation">
.guided-advice-title,#guided-remedies,.guided-advice-actions,#guided-mounting,#guided-mounting + .led-help{display:none!important}
#v30-throw-all,.v30-check{display:none!important}
.v33-throw-note{margin-top:8px;font-size:11px;color:#475569}
#v33-mirror{grid-column:1/-1}
#v33-mirror[disabled]{opacity:.45;cursor:not-allowed}
#v33-mirror-status{margin:7px 0 0;font-size:11px;color:#475569}
.projection-v29-edit-row.is-step3{grid-template-columns:minmax(0,1.6fr) minmax(300px,360px)!important;gap:12px!important}
.projection-v29-edit-row.is-step3 #led-canvas-home{position:sticky;top:122px;align-self:start}
.projection-v29-edit-row.is-step3 #led-canvas{height:clamp(560px,68vh,760px)!important;min-height:560px!important}
.projection-v29-edit-row.is-step3 #projection-v25-controls{align-self:start}
@media(max-width:1050px){
  .projection-v29-edit-row.is-step3{grid-template-columns:1fr!important}
  .projection-v29-edit-row.is-step3 #led-canvas-home{position:static}
  .projection-v29-edit-row.is-step3 #led-canvas{height:520px!important;min-height:420px!important}
}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v33-optimisation-js">
(function(){
  const q=id=>document.getElementById(id);

  function activeProjector(){
    const pressed=Array.from(q('v30-projector-selector')?.querySelectorAll('button')||[]).find(b=>b.getAttribute('aria-pressed')==='true');
    return pressed?.textContent?.trim()||'P1';
  }
  function count(){return Number(q('projection-count')?.value||3);}
  function syncMirror(){
    const button=q('v33-mirror'),status=q('v33-mirror-status');
    if(!button)return;
    const selected=activeProjector(),n=count();
    let target=null;
    if(n===2)target=selected==='P1'?'P2':selected==='P2'?'P1':null;
    else target=selected==='P1'?'P3':selected==='P3'?'P1':null;
    button.disabled=!target;
    button.textContent=target?'Mirror '+selected+' → '+target:'Mirror opposite projector';
    if(status)status.textContent=target
      ?'Copies the selected projector to the opposite side: mirrored horizontal position and aim, same gantry height and fore/aft position.'
      :(n===3?'P2 is the centre projector. Select P1 or P3 to mirror an outer projector.':'Select a projector to mirror.');
  }

  function install(){
    const modes=q('v30-move')?.closest('.v30-mode-buttons');
    if(!modes||q('v33-mirror'))return;

    const mirror=document.createElement('button');
    mirror.type='button';
    mirror.id='v33-mirror';
    mirror.className='led-button led-outline';
    mirror.textContent='Mirror opposite projector';
    modes.appendChild(mirror);

    const status=document.createElement('p');
    status.id='v33-mirror-status';
    modes.parentElement?.appendChild(status);

    mirror.addEventListener('click',()=>{
      const result=window.__projectionMirrorSelectedProjector?.();
      if(result?.ok){
        q('v33-mirror-status').textContent='Mirrored '+result.source+' to '+result.target+'.';
      }else{
        q('v33-mirror-status').textContent=result?.reason||'Unable to mirror this projector.';
      }
      setTimeout(syncMirror,80);
    });

    // Matched installations use one throw ratio for the whole projector set.
    const v30all=q('v30-throw-all');
    if(v30all)v30all.checked=true;
    const originalAll=q('projection-throw-all');
    if(originalAll)originalAll.checked=true;
    const throwSection=q('v30-throw')?.closest('.v30-section');
    if(throwSection&&!q('v33-throw-note')){
      const note=document.createElement('p');
      note.id='v33-throw-note';
      note.className='v33-throw-note';
      note.textContent='Throw ratio is applied to all projectors in the matched set.';
      throwSection.appendChild(note);
    }

    q('v30-projector-selector')?.addEventListener('click',()=>setTimeout(syncMirror,50));
    q('projection-count')?.addEventListener('change',()=>setTimeout(syncMirror,50));
    q('guided-count')?.addEventListener('change',()=>setTimeout(syncMirror,50));
    syncMirror();
  }

  const timer=setInterval(()=>{install();if(q('v33-mirror'))clearInterval(timer);},50);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
</script>"""
html=html.replace("</body>",js+"\n</body>",1)

checks=[
    "window.__projectionMirrorSelectedProjector=mirrorSelectedProjector",
    "targets=state.projectors",
    "projection-v33-optimisation",
    "projection-v33-optimisation-js",
    "id='v33-mirror'",
    ".guided-advice-title,#guided-remedies",
    "Throw ratio is applied to all projectors in the matched set.",
    "height:clamp(560px,68vh,760px)",
    "projection-v32-single-count",
    "projection-v31-enhancements",
    "projection-v30-direct-controls",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V33 feature/inheritance check failed "+repr(missing))

TARGET.write_text(html)
print("V33 built from published V32")
