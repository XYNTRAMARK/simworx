from pathlib import Path
import subprocess, shutil

subprocess.run(['python3','.projection-v14-deploy/build_v14.py'],check=True)

p=Path('projection/src/projection-layer.js')
s=p.read_text()

# In Steps 1 and 2, room movement is the active transform mode by default.
s=s.replace(
"roomMoveMode = guidedStep===1;",
"roomMoveMode = guidedStep<=2;",
1
)

# Reattach the room transform after every viewer refresh/build so scene updates
# cannot silently detach the X/Z handles.
old="""    buildStructure(state);
    buildRoomGuide(state);
    suppressLegacyIntrudingUprights(state,current);
    applyGhosting(current.simulator, state.ghostCockpit === true);"""
new="""    buildStructure(state);
    buildRoomGuide(state);
    if(guidedStep<=2&&roomMoveMode&&state.room?.enabled){
      transform.setMode('translate');
      transform.setSpace('world');
      transform.showX=true;transform.showY=false;transform.showZ=true;
      transform.attach(roomGroup);
    }
    suppressLegacyIntrudingUprights(state,current);
    applyGhosting(current.simulator, state.ghostCockpit === true);"""
if old not in s:
    raise SystemExit('Viewer refresh room attachment anchor not found.')
s=s.replace(old,new,1)

# Make select() unable to detach the room handles in Steps 1-2.
old="""    if(roomMoveMode&&guidedStep<=2&&getState().room?.enabled){
      transform.setMode('translate');transform.setSpace('world');transform.showX=true;transform.showY=false;transform.showZ=true;transform.attach(roomGroup);
    }else if (object && instance"""
new="""    if(guidedStep<=2&&roomMoveMode&&getState().room?.enabled){
      transform.setMode('translate');transform.setSpace('world');transform.showX=true;transform.showY=false;transform.showZ=true;transform.attach(roomGroup);
    }else if (object && instance"""
if old not in s:
    raise SystemExit('select room attachment anchor not found.')
s=s.replace(old,new,1)

p.write_text(s)

# Keep the toolbar button visibly active by default in Steps 1-2.
p=Path('projection/src/guided-planner.js')
s=p.read_text()
old="""    moveRoomButton.hidden=step>2;
    moveRoomButton.setAttribute('aria-pressed',String(getLayer()?.isRoomMove?.()===true));"""
new="""    moveRoomButton.hidden=step>2;
    if(step<=2&&getLayer()?.isRoomMove?.()!==true)getLayer()?.setRoomMove?.(true);
    moveRoomButton.setAttribute('aria-pressed',String(step<=2&&getLayer()?.isRoomMove?.()===true));"""
if old not in s:
    raise SystemExit('Move room button render anchor not found.')
s=s.replace(old,new,1)
p.write_text(s)

subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v15.html')

layer=Path('projection/src/projection-layer.js').read_text()
guided=Path('projection/src/guided-planner.js').read_text()
assert 'roomMoveMode = guidedStep<=2;' in layer
assert 'transform.attach(roomGroup);' in layer
assert "if(step<=2&&getLayer()?.isRoomMove?.()!==true)getLayer()?.setRoomMove?.(true);" in guided
print('V15 persistent room-handle checks passed')
