from pathlib import Path
import subprocess, shutil

subprocess.run(['python3','.projection-v11-deploy/build_v11.py'],check=True)

# V12: add an explicit viewer-level room move mode for Steps 1-2.
p=Path('projection/main.html')
s=p.read_text()
old='<div class="led-viewer-toolbar"><span>Drag to orbit · projector positions are calculated together</span><div class="led-viewer-buttons"><button type="button" data-viewer="zoomIn" aria-label="Zoom in">+</button><button type="button" data-viewer="zoomOut" aria-label="Zoom out">−</button><button type="button" data-viewer="reset" class="led-reset">Reset view</button></div></div>'
new='<div class="led-viewer-toolbar"><span id="projection-viewer-hint">Drag to orbit · projector positions are calculated together</span><div class="led-viewer-buttons"><button type="button" id="projection-move-room" aria-pressed="false">Move room</button><button type="button" data-viewer="zoomIn" aria-label="Zoom in">+</button><button type="button" data-viewer="zoomOut" aria-label="Zoom out">−</button><button type="button" data-viewer="reset" class="led-reset">Reset view</button></div></div>'
if old not in s: raise SystemExit('Viewer toolbar anchor not found')
s=s.replace(old,new,1)
p.write_text(s)

p=Path('projection/src/projection-layer.js')
s=p.read_text()

# Track room move state separately from projector manual mode.
anchor="  let previousControlsEnabled = true;\n"
if anchor not in s: raise SystemExit('Layer state anchor not found')
s=s.replace(anchor,anchor+"  let roomMoveMode = false;\n  let guidedStep = 1;\n",1)

# V5 already introduced guidedStep; avoid duplicate if present.
s=s.replace("  let guidedStep = 1;\n  let guidedStep = 1;\n","  let guidedStep = 1;\n")

# Keep room transform attached while room move mode is active.
old="""  function select(id, notify = true) {
    const instance = getState().projectors?.find(p => p.id === id);
    const object = objects.get(id);
    syncing = true;
    if (object && instance && !instance.locked && !viewer.context().pilotMode && getState().manualPlacement === true) transform.attach(object);
    else transform.detach();
    syncing = false;"""
new="""  function select(id, notify = true) {
    const instance = getState().projectors?.find(p => p.id === id);
    const object = objects.get(id);
    syncing = true;
    if(roomMoveMode&&guidedStep<=2&&getState().room?.enabled){
      transform.setMode('translate');transform.setSpace('world');transform.showX=true;transform.showY=false;transform.showZ=true;transform.attach(roomGroup);
    }else if (object && instance && !instance.locked && !viewer.context().pilotMode && getState().manualPlacement === true) transform.attach(object);
    else transform.detach();
    syncing = false;"""
if old not in s: raise SystemExit('select() anchor not found')
s=s.replace(old,new,1)

# Room drag should not trigger optical recalculation on every mousemove.
old="""  function onObjectChange() {
    if (syncing) return;
    // The owner writes the patch immediately. Coalesce high-frequency pointer
    // events into one coarse physical-coverage calculation per rendered frame.
    emitTransform(false);"""
new="""  function onObjectChange() {
    if (syncing) return;
    if(transform.object===roomGroup){
      emitTransform(false);
      viewer.context().invalidate();
      return;
    }
    // The owner writes the patch immediately. Coalesce high-frequency pointer
    // events into one coarse physical-coverage calculation per rendered frame.
    emitTransform(false);"""
if old not in s: raise SystemExit('onObjectChange anchor not found')
s=s.replace(old,new,1)

# Replace the V7 setGuidedStep implementation with one that exposes room move in Step 2 too.
old="""    setGuidedStep: step => {
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
new="""    setGuidedStep: step => {
      guidedStep = Number(step) || 1;
      structureGroup.visible = getState().showStructure !== false && guidedStep >= 2;
      roomMoveMode = guidedStep===1;
      if(roomMoveMode&&getState().room?.enabled){
        transform.setMode('translate');transform.setSpace('world');transform.showX=true;transform.showY=false;transform.showZ=true;transform.attach(roomGroup);
      }else if(guidedStep<3)transform.detach();
      invalidate();
    },
    setRoomMove: active => {
      roomMoveMode = Boolean(active) && guidedStep<=2 && getState().room?.enabled;
      if(roomMoveMode){
        transform.setMode('translate');transform.setSpace('world');transform.showX=true;transform.showY=false;transform.showZ=true;transform.attach(roomGroup);
      }else if(guidedStep<3)transform.detach();
      invalidate();
      return roomMoveMode;
    },
    isRoomMove:()=>roomMoveMode,"""
if old not in s: raise SystemExit('setGuidedStep anchor not found')
s=s.replace(old,new,1)
p.write_text(s)

# Wire the viewer button and keep its state synced with guided step.
p=Path('projection/src/guided-planner.js')
s=p.read_text()
anchor="""  const s=getState(),p=prefs(),step=s.guidedStep;
"""
if anchor not in s: raise SystemExit('guided render anchor not found')
insert="""  const s=getState(),p=prefs(),step=s.guidedStep;
  const moveRoomButton=$('projection-move-room');
  if(moveRoomButton){
    moveRoomButton.hidden=step>2;
    moveRoomButton.setAttribute('aria-pressed',String(getLayer()?.isRoomMove?.()===true));
  }
"""
s=s.replace(anchor,insert,1)
p.write_text(s)

p=Path('projection/src/app.js')
s=p.read_text()
anchor="""  all('[data-viewer]').forEach(b=>b.addEventListener('click',()=>viewer?.[b.dataset.viewer]?.()));
"""
if anchor not in s: raise SystemExit('viewer buttons anchor not found')
insert="""  $('projection-move-room')?.addEventListener('click',e=>{
    const active=layer?.setRoomMove?.(e.currentTarget.getAttribute('aria-pressed')!=='true')===true;
    e.currentTarget.setAttribute('aria-pressed',String(active));
    const hint=$('projection-viewer-hint');
    if(hint)hint.textContent=active?'Drag the red/blue room handles to move the room around the fixed screen and cockpit.':'Drag to orbit · projector positions are calculated together';
  });
  all('[data-viewer]').forEach(b=>b.addEventListener('click',()=>viewer?.[b.dataset.viewer]?.()));
"""
s=s.replace(anchor,insert,1)
p.write_text(s)

# Style the move-room mode like a first-class viewer control.
p=Path('projection/guided.css')
s=p.read_text()
s += """
/* V12 room-move control in the 3D viewer. */
#projection-move-room[aria-pressed="true"]{
  background:#f2a900!important;
  border-color:#b47e00!important;
  color:#111!important;
}
#projection-move-room{min-width:92px}
"""
p.write_text(s)

subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v12.html')

main=Path('projection/main.html').read_text()
layer=Path('projection/src/projection-layer.js').read_text()
guided=Path('projection/src/guided-planner.js').read_text()
app=Path('projection/src/app.js').read_text()
assert 'id="projection-move-room"' in main
assert 'setRoomMove: active =>' in layer
assert 'guidedStep<=2' in layer
assert "moveRoomButton.hidden=step>2" in guided
assert "$('projection-move-room')?.addEventListener" in app
print('V12 viewer room-move checks passed')
