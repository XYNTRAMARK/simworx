from pathlib import Path
from urllib.request import Request, urlopen
import re

BASE_URL="https://www.sim-worx.com"
SOURCE="projection-screen-configurator-v33.html"
TARGET=Path("projection-screen-configurator-v34.html")

req=Request(f"{BASE_URL}/{SOURCE}",headers={"Cache-Control":"no-cache","User-Agent":"Simworx-V34-builder"})
with urlopen(req,timeout=45) as r:
    html=r.read().decode("utf-8")

required=[
    "projection-v33-optimisation",
    "projection-v32-single-count",
    "projection-v31-enhancements",
    "projection-v30-direct-controls",
    "projection-v29-stable-viewer-owner",
    "projection-fixed-estimate-v24",
    "generic-ceiling-projector-drop",
]
missing=[x for x in required if x not in html]
if missing:
    raise SystemExit("V34 refused: V33 inheritance missing "+repr(missing))

# 1) Projection layer: add a Y-only direct-manipulation mode.
old_constraint = """    setManualConstraint: mode => {\n      if(mode==='tilt'){transform.setMode('rotate');transform.setSpace('local');transform.showX=true;transform.showY=false;transform.showZ=false;}\n      else{transform.setMode('translate');transform.setSpace('world');transform.showX=true;transform.showY=false;transform.showZ=true;}\n      invalidate();\n    },"""
new_constraint = """    setManualConstraint: mode => {\n      if(mode==='height'){transform.setMode('translate');transform.setSpace('world');transform.showX=false;transform.showY=true;transform.showZ=false;}\n      else if(mode==='tilt'){transform.setMode('rotate');transform.setSpace('local');transform.showX=true;transform.showY=false;transform.showZ=false;}\n      else{transform.setMode('translate');transform.setSpace('world');transform.showX=true;transform.showY=false;transform.showZ=true;}\n      invalidate();\n    },"""
old_escaped=old_constraint.replace("\n","\\n")
new_escaped=new_constraint.replace("\n","\\n")
if old_escaped not in html:
    raise SystemExit("V34 manual constraint anchor missing")
html=html.replace(old_escaped,new_escaped,1)

# 2) App state: Y-handle moves the entire matched gantry plane together.
old_move = "onMove:(id,patch,finished)=>{const p=state.projectors.find(p=>p.id===id);if(p)Object.assign(p,patch);if(!initialising){guided?.changed();syncInputs();queueQuote();}}"
new_move = """onMove:(id,patch,finished)=>{
  const p=state.projectors.find(p=>p.id===id);
  if(p){
    if(state.gantryHeightMode===true&&Array.isArray(patch.position)){
      const ceiling=finite(state.room?.height)?state.room.height:4;
      const maxY=Math.max(.35,ceiling-.08);
      const nextY=Math.min(maxY,Math.max(.35,patch.position[1]));
      for(const projector of state.projectors){
        if(Array.isArray(projector.position))projector.position[1]=nextY;
      }
      Object.assign(p,patch,{position:[patch.position[0],nextY,patch.position[2]]});
    }else Object.assign(p,patch);
  }
  if(!initialising){guided?.changed();syncInputs();queueQuote();}
}""".replace("\n","\\n")
if old_move not in html:
    raise SystemExit("V34 app onMove anchor missing")
html=html.replace(old_move,new_move,1)

# 3) App helpers exposed to the compact V34 controls.
anchor="window.__projectionMirrorSelectedProjector=mirrorSelectedProjector;\\nfunction setPilot"
helpers="""window.__projectionMirrorSelectedProjector=mirrorSelectedProjector;
function gantryHeightInfo(){
  const ceiling=finite(state.room?.height)?state.room.height:4;
  const height=state.projectors.length?Math.max(...state.projectors.map(p=>p.position?.[1]||0)):0;
  return {height,ceiling,drop:Math.max(0,ceiling-height),maxHeight:Math.max(.35,ceiling-.08)};
}
function setGantryHeightMode(on){
  state.gantryHeightMode=on===true;
  if(state.gantryHeightMode){
    state.manualPlacement=true;
    layer?.setManualConstraint('height');
    layer?.select(state.selectedProjector,false);
  }
  syncInputs();
  return gantryHeightInfo();
}
function adjustGantryHeight(delta){
  const info=gantryHeightInfo();
  const base=state.projectors.length?state.projectors[0].position[1]:0;
  const next=Math.min(info.maxHeight,Math.max(.35,base+Number(delta||0)));
  for(const projector of state.projectors)projector.position[1]=next;
  state.gantryHeightMode=true;
  state.manualPlacement=true;
  layer?.setManualConstraint('height');
  layer?.select(state.selectedProjector,false);
  layer?.update({fine:true});
  guided?.changed();
  syncInputs();
  queueQuote();
  return gantryHeightInfo();
}
window.__projectionSetGantryHeightMode=setGantryHeightMode;
window.__projectionAdjustGantryHeight=adjustGantryHeight;
window.__projectionGantryHeightInfo=gantryHeightInfo;
function setPilot""".replace("\n","\\n")
if anchor not in html:
    raise SystemExit("V34 app helper anchor missing")
html=html.replace(anchor,helpers,1)

css="""<style id="projection-v34-height-control">
#v34-height{grid-column:1/-1}
#v34-height[aria-pressed="true"]{border-color:#d52b1e!important;background:#fff2f1!important;color:#991b1b!important}
.v34-height-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.v34-height-readout{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:9px;padding:9px;border:1px solid #e1e6ea;border-radius:6px;background:#f8fafc;font-size:11px}
.v34-height-readout strong{display:block;font-size:14px;margin-top:2px}
.v34-height-note{font-size:11px;color:#475569;line-height:1.45;margin:8px 0 0}
@media(max-width:650px){.v34-height-tools{grid-template-columns:1fr}}
</style>"""
html=html.replace("</head>",css+"\n</head>",1)

js=r"""<script id="projection-v34-height-control-js">
(function(){
  const q=id=>document.getElementById(id);
  function fmt(m){return Number(m||0).toFixed(2)+' m';}
  function refresh(){
    const info=window.__projectionGantryHeightInfo?.();
    if(!info)return;
    if(q('v34-lens-height'))q('v34-lens-height').textContent=fmt(info.height);
    if(q('v34-ceiling-drop'))q('v34-ceiling-drop').textContent=fmt(info.drop);
    if(q('v34-height'))q('v34-height').title='Maximum lens height '+fmt(info.maxHeight);
  }
  function clearHeightMode(){
    window.__projectionSetGantryHeightMode?.(false);
    q('v34-height')?.setAttribute('aria-pressed','false');
  }
  function install(){
    const modes=q('v30-move')?.closest('.v30-mode-buttons');
    if(!modes||q('v34-height'))return;

    const button=document.createElement('button');
    button.type='button';
    button.id='v34-height';
    button.className='led-button led-outline';
    button.setAttribute('aria-pressed','false');
    button.textContent='Raise / lower gantry';
    modes.appendChild(button);

    const tools=document.createElement('div');
    tools.className='v34-height-tools';
    tools.innerHTML='<button type="button" class="led-button led-outline" id="v34-lower">Lower 50 mm</button><button type="button" class="led-button led-outline" id="v34-raise">Raise 50 mm</button>';
    modes.parentElement?.appendChild(tools);

    const readout=document.createElement('div');
    readout.className='v34-height-readout';
    readout.innerHTML='<div><span>Projector lens height</span><strong id="v34-lens-height">—</strong></div><div><span>Ceiling mount drop</span><strong id="v34-ceiling-drop">—</strong></div>';
    modes.parentElement?.appendChild(readout);

    const note=document.createElement('p');
    note.className='v34-height-note';
    note.textContent='All projectors remain on one horizontal gantry plane. Raise them and the ceiling-mount stems shorten automatically; lower them and the stems extend.';
    modes.parentElement?.appendChild(note);

    button.addEventListener('click',()=>{
      window.__projectionSetGantryHeightMode?.(true);
      button.setAttribute('aria-pressed','true');
      q('v30-move')?.setAttribute('aria-pressed','false');
      q('v30-aim')?.setAttribute('aria-pressed','false');
      const help=q('v30-mode-help');
      if(help)help.textContent='Drag the vertical handle on the selected projector. All projectors move together and remain on the same lens-height plane.';
      refresh();
    });

    q('v34-raise').addEventListener('click',()=>{window.__projectionAdjustGantryHeight?.(.05);button.setAttribute('aria-pressed','true');refresh();});
    q('v34-lower').addEventListener('click',()=>{window.__projectionAdjustGantryHeight?.(-.05);button.setAttribute('aria-pressed','true');refresh();});

    q('v30-move')?.addEventListener('click',clearHeightMode);
    q('v30-aim')?.addEventListener('click',clearHeightMode);
    q('v30-projector-selector')?.addEventListener('click',()=>setTimeout(refresh,50));
    q('projection-room-height')?.addEventListener('change',()=>setTimeout(refresh,100));
    new MutationObserver(refresh).observe(q('projection-y'),{attributes:true,attributeFilter:['value']});

    refresh();
    setInterval(refresh,500);
  }
  const timer=setInterval(()=>{install();if(q('v34-height'))clearInterval(timer);},50);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
</script>"""
html=html.replace("</body>",js+"\n</body>",1)

checks=[
    "mode==='height'",
    "state.gantryHeightMode===true",
    "window.__projectionAdjustGantryHeight",
    "window.__projectionGantryHeightInfo",
    "projection-v34-height-control",
    "Raise / lower gantry",
    "Ceiling mount drop",
    "Lower 50 mm",
    "Raise 50 mm",
    "generic-ceiling-projector-drop",
    "drop=Math.max(.08,ceiling-p.position[1])",
    "projection-v33-optimisation",
]
missing=[x for x in checks if x not in html]
if missing:
    raise SystemExit("V34 feature/inheritance check failed "+repr(missing))

TARGET.write_text(html)
print("V34 built from published V33")
