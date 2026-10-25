from pathlib import Path
import subprocess, shutil

subprocess.run(['python3','.projection-v12-deploy/build_v12.py'],check=True)

# V13: prevent hidden wall-distance inputs from blocking wizard navigation.
p=Path('projection/src/guided-planner.js')
s=p.read_text()
old="""  if(n>1&&!Array.from(document.querySelectorAll('[data-room]')).every(e=>e.reportValidity()))return;"""
new="""  if(n>1){
    const requiredRoom=['projection-room-width','projection-room-depth','projection-room-height'].map($).filter(Boolean);
    if(!requiredRoom.every(e=>e.reportValidity()))return;
    const budget=$('guided-budget');
    if(budget&&budget.value!==''&&!budget.reportValidity())return;
  }"""
if old not in s: raise SystemExit('Step navigation validation anchor not found')
s=s.replace(old,new,1)
p.write_text(s)

# Make the project-budget constraint explicit and independent of any room fields.
p=Path('projection/main.html')
s=p.read_text()
import re
s=re.sub(
  r'(<input id="guided-budget" type="number" min=")[^"]*(" max=")[^"]*(" step=")[^"]*(")',
  r'\g<1>0\g<2>10000000\g<3>100\g<4>',
  s,
  count=1
)
p.write_text(s)

# Defensive runtime reset: browser validity for the project budget must never
# inherit a room limit and collapsed exact wall-distance fields are advisory.
p=Path('projection/src/app.js')
s=p.read_text()
anchor="""function syncInputs(){
  const factor=lengthFactor(unit);"""
insert="""function syncInputs(){
  const factor=lengthFactor(unit);
  const projectBudget=$('guided-budget');
  if(projectBudget){projectBudget.min='0';projectBudget.max='10000000';projectBudget.step='100';projectBudget.setCustomValidity('');}
  for(const id of ['projection-screen-from-left','projection-screen-from-front']){
    const field=$(id);if(field)field.setCustomValidity('');
  }"""
if anchor not in s: raise SystemExit('syncInputs anchor not found')
s=s.replace(anchor,insert,1)
p.write_text(s)

subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v13.html')

guided=Path('projection/src/guided-planner.js').read_text()
main=Path('projection/main.html').read_text()
app=Path('projection/src/app.js').read_text()
assert "['projection-room-width','projection-room-depth','projection-room-height']" in guided
assert "document.querySelectorAll('[data-room]')" not in guided.split('function go(n){',1)[1].split('function render(){',1)[0]
assert 'id="guided-budget" type="number" min="0" max="10000000" step="100"' in main
assert "projectBudget.max='10000000'" in app
print('V13 Step 1 navigation validation checks passed')
