from pathlib import Path
import subprocess, shutil, re

subprocess.run(['python3','.projection-v13-deploy/build_v13.py'],check=True)

# V14: repair the V12 viewer-state regression.
p=Path('projection/src/projection-layer.js')
s=p.read_text()

# There must be one and only one guidedStep state in createProjectionLayer.
needle='  let guidedStep = 1;\n'
count=s.count(needle)
if count < 1:
    raise SystemExit('guidedStep state is missing.')
if count > 1:
    first=s.index(needle)
    before=s[:first+len(needle)]
    after=s[first+len(needle):].replace(needle,'')
    s=before+after

# roomMoveMode must also have one declaration.
room='  let roomMoveMode = false;\n'
if s.count(room)>1:
    first=s.index(room)
    s=s[:first+len(room)]+s[first+len(room):].replace(room,'')
elif s.count(room)==0:
    anchor='  let previousControlsEnabled = true;\n'
    if anchor not in s: raise SystemExit('Room move state anchor missing.')
    s=s.replace(anchor,anchor+room,1)

p.write_text(s)

# Make startup failure impossible to leave a misleading eternal loading message.
p=Path('projection/src/app.js')
s=p.read_text()
old="""    catch(error){geometryError=true;$('led-viewer-status').textContent='3D preview unavailable in this browser. Configuration and pricing controls remain available.';console.error(error);}"""
new="""    catch(error){geometryError=true;const status=$('led-viewer-status');if(status)status.textContent='3D preview could not start. '+(error?.message||String(error));console.error(error);}"""
if old in s:
    s=s.replace(old,new,1)
p.write_text(s)

# Rebuild standalone.
subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v14.html')

layer=Path('projection/src/projection-layer.js').read_text()
assert layer.count('let guidedStep = 1;')==1, layer.count('let guidedStep = 1;')
assert layer.count('let roomMoveMode = false;')==1
assert 'setRoomMove: active =>' in layer
assert 'transform.attach(roomGroup)' in layer
print('V14 viewer state checks passed: one guidedStep, one roomMoveMode.')
