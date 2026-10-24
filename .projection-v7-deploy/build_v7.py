from pathlib import Path
import subprocess, shutil

# V7 builds from tested V6.
subprocess.run(['python3','.projection-v6-deploy/build_v6.py'],check=True)

# 1) Project budget = screen + projector set.
p=Path('projection/main.html')
s=p.read_text()
s=s.replace('Projector budget · EUR, NET of VAT (optional)','Project budget · EUR, NET of VAT (optional)')
s=s.replace(
'Use the amount you can spend on the projector set. The planner will show the best achievable geometry at that price point. Screen, mounting, warping, delivery and VAT are priced separately.',
'Enter the amount available for the core visual system. The planner allocates this between the screen and projector set. Mounting, warping, delivery and VAT are shown separately.'
)
s=s.replace('Screen + projector budget · EUR, NET of VAT','Project budget · EUR, NET of VAT')
p.write_text(s)

p=Path('projection/src/guided-planner.js')
s=p.read_text()
s=s.replace(
"for(const [id,key] of [['guided-budget','budget'],['guided-mode','mode'],['guided-count','count'],['guided-band','band'],['guided-mount-drop','mountDrop']])",
"for(const [id,key] of [['guided-budget','totalBudget'],['guided-mode','mode'],['guided-count','count'],['guided-band','band'],['guided-mount-drop','mountDrop']])"
)
s=s.replace(
"function preferencesChanged(){const p=prefs();p.budget=$('guided-budget').value===''?null:Number($('guided-budget').value);",
"function preferencesChanged(){const p=prefs();p.totalBudget=$('guided-budget').value===''?null:Number($('guided-budget').value);p.budget=null;"
)
s=s.replace("summary.objective==='budget'&&finite(budget?.totalBudget)?","finite(budget?.totalBudget)?")
p.write_text(s)

p=Path('projection/src/layout-planner.js')
s=p.read_text()
old="const availableProjectorBudget=prefs.objective==='budget'&&finite(prefs.totalBudget)?Math.max(0,prefs.totalBudget-screenCost):(prefs.objective==='room'?null:prefs.budget);"
new="const availableProjectorBudget=finite(prefs.totalBudget)?Math.max(0,prefs.totalBudget-screenCost):(prefs.objective==='room'?null:prefs.budget);"
if old not in s: raise SystemExit('Project budget allocation anchor not found')
s=s.replace(old,new,1)
s=s.replace(
"const budgetPenalty=budget.withinKnownBudget===false?(prefs.objective==='budget'?4:2):0;",
"const budgetPenalty=budget.withinKnownBudget===false?(finite(prefs.totalBudget)||prefs.objective==='budget'?4:2):0;",
1
)
s=s.replace(
"(choice.budget?.withinKnownBudget===false?(prefs.objective==='budget'?4:2):0)",
"(choice.budget?.withinKnownBudget===false?(finite(prefs.totalBudget)||prefs.objective==='budget'?4:2):0)",
1
)
p.write_text(s)

# 2) Step 1: directly drag the room on X/Z around the fixed screen origin.
p=Path('projection/src/projection-layer.js')
s=p.read_text()
s=s.replace(
"export function createProjectionLayer({ viewer, getState, getProfile, onMove = () => {}, onSelect = () => {}, onResult = () => {} }) {",
"export function createProjectionLayer({ viewer, getState, getProfile, onMove = () => {}, onRoomMove = () => {}, onSelect = () => {}, onResult = () => {} }) {"
)

old="""    const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x7d94ac, transparent: true, opacity: 0.65, depthWrite: false }));
    outline.position.set(dimensions[0]/2-screenFromLeft,dimensions[1]/2,dimensions[2]/2-screenFromFront);
    outline.name = 'room-boundary-guide-not-surveyed-wall-geometry';
    roomGroup.add(outline);"""
new="""    const outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x7d94ac, transparent: true, opacity: 0.65, depthWrite: false }));
    roomGroup.position.set(dimensions[0]/2-screenFromLeft,0,dimensions[2]/2-screenFromFront);
    outline.position.set(0,dimensions[1]/2,0);
    outline.name = 'room-boundary-guide-not-surveyed-wall-geometry';
    roomGroup.add(outline);"""
if old not in s: raise SystemExit('Room guide geometry anchor not found')
s=s.replace(old,new,1)

old="""  function emitTransform(finished) {
    if (syncing || !transform.object) return;
    const object = transform.object;
    const id = object.userData.projectorId;"""
new="""  function emitTransform(finished) {
    if (syncing || !transform.object) return;
    const object = transform.object;
    if(object===roomGroup){
      const state=getState(),room=state.room||{};
      const screenFromLeft=room.width/2-object.position.x;
      const screenFromFront=room.depth/2-object.position.z;
      onRoomMove({screenFromLeft,screenFromFront},finished);
      viewer.context().invalidate();
      return;
    }
    const id = object.userData.projectorId;"""
if old not in s: raise SystemExit('emitTransform anchor not found')
s=s.replace(old,new,1)

old="""    setGuidedStep: step => {
      guidedStep = Number(step) || 1;
      structureGroup.visible = getState().showStructure !== false && guidedStep >= 2;
      if (guidedStep < 3) transform.detach();
      invalidate();
    },"""
new="""    setGuidedStep: step => {
      guidedStep = Number(step) || 1;
      structureGroup.visible = getState().showStructure !== false && guidedStep >= 2;
      if(guidedStep===1&&getState().room?.enabled){
        transform.setMode('translate');
        transform.setSpace('world');
        transform.showX=true;transform.showY=false;transform.showZ=true;
        transform.attach(roomGroup);
      }else if(guidedStep<3)transform.detach();
      invalidate();
    },"""
if old not in s: raise SystemExit('V5 guided-step room visibility anchor not found')
s=s.replace(old,new,1)
p.write_text(s)

# Wire room drag back into state and synchronized sliders/exact distances.
p=Path('projection/src/app.js')
s=p.read_text()
old="""layer=createProjectionLayer({viewer,getState:()=>state,getProfile:profile,onMove:(id,patch,finished)=>{const p=state.projectors.find(p=>p.id===id);if(p)Object.assign(p,patch);if(!initialising){guided?.changed();syncInputs();queueQuote();}},onSelect:setSelected,onResult:onOpticalResult});"""
new="""layer=createProjectionLayer({viewer,getState:()=>state,getProfile:profile,onMove:(id,patch,finished)=>{const p=state.projectors.find(p=>p.id===id);if(p)Object.assign(p,patch);if(!initialising){guided?.changed();syncInputs();queueQuote();}},onRoomMove:(patch,finished)=>{Object.assign(state.room,patch);if(!initialising){guided?.changed();syncInputs();if(finished)update({price:false});}},onSelect:setSelected,onResult:onOpticalResult});"""
if old not in s: raise SystemExit('Projection layer creation anchor not found')
s=s.replace(old,new,1)
p.write_text(s)

# 3) Keep price visible as a fixed pane on desktop; sticky compact bar on smaller screens.
p=Path('projection/guided.css')
s=p.read_text()
s += """
/* V7 persistent commercial pane: mirrors the always-visible LED summary behavior. */
@media(min-width:1101px){
  .led-estimate-bar{
    position:fixed!important;
    top:calc(var(--sw-header-h,62px) + 16px)!important;
    right:18px;
    width:330px;
    max-width:calc(100vw - 36px);
    margin:0!important;
    z-index:140;
    box-shadow:0 10px 30px #00000022;
  }
  .led-shell{padding-right:360px!important;}
}
@media(max-width:1100px){
  .led-estimate-bar{position:sticky!important;top:0!important;z-index:80;}
}
"""
p.write_text(s)

# Rebuild standalone after all V7 patches.
subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v7.html')

# Guardrails.
main=Path('projection/main.html').read_text()
guided=Path('projection/src/guided-planner.js').read_text()
planner=Path('projection/src/layout-planner.js').read_text()
layer=Path('projection/src/projection-layer.js').read_text()
app=Path('projection/src/app.js').read_text()
css=Path('projection/guided.css').read_text()
assert 'Project budget · EUR, NET of VAT (optional)' in main
assert "['guided-budget','totalBudget']" in guided
assert "finite(prefs.totalBudget)?Math.max(0,prefs.totalBudget-screenCost)" in planner
assert 'onRoomMove = () => {}' in layer
assert 'transform.attach(roomGroup)' in layer
assert 'onRoomMove:(patch,finished)' in app
assert 'position:fixed!important' in css and '.led-shell{padding-right:360px!important;}' in css
print('V7 project-budget, draggable-room and fixed-price checks passed')
