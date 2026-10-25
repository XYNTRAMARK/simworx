from pathlib import Path
import subprocess, shutil

subprocess.run(['python3','.projection-v16-deploy/build_v16.py'],check=True)

# V17 hardens the simplified workflow against legacy code paths that still
# expect former projector shopping controls to exist.
p=Path('projection/main.html')
s=p.read_text()
compat='''<div id="projection-legacy-compat" hidden aria-hidden="true">
<select id="guided-mode"><option value="recommend" selected>Recommend</option></select>
<div id="guided-model-field"></div><select id="guided-model"></select>
<select id="guided-band"><option value="any" selected>Any</option></select>
<input id="guided-budget" type="number" min="0" max="10000000" step="100">
<p id="guided-budget-result"></p>
<div id="projection-projector-cards"></div>
<select id="projection-count"><option value="2">2</option><option value="3" selected>3</option></select>
<select id="projection-supply"><option value="customer" selected>Customer</option></select>
<select id="projection-channel-model"></select>
<select id="projection-channel-supply"><option value="customer" selected>Customer</option></select>
<select id="projection-placement-mode"><option value="free" selected>Free</option></select>
<input id="projection-mounting-kit" type="checkbox">
<strong id="projection-kit-price"></strong>
<button id="projection-import" type="button"></button>
</div>
'''
anchor='<aside class="led-preview-panel" id="led-preview"'
if anchor not in s: raise SystemExit('Preview anchor missing')
s=s.replace(anchor,compat+anchor,1)
s=s.replace('Choose truss to visualise a floor-supported truss below the ceiling.',
            'Choose truss to visualise a floor-supported truss below the ceiling. Truss adds €1,000 to the Simworx quote.')
p.write_text(s)

# Ensure mounting selector/full-surround stay synced to state.
p=Path('projection/src/app.js')
s=p.read_text()
anchor="  state.mountingKit=false;\n"
if anchor not in s: raise SystemExit('mountingKit state anchor missing')
s=s.replace(anchor,anchor+"  if($('projection-mounting-style'))$('projection-mounting-style').value=state.mountingStyle==='truss'?'truss':'ceiling';\n  if($('projection-full-surround'))$('projection-full-surround').checked=state.fullSurround===true;\n",1)

# Projectors are deliberately not quoted/supplied by Simworx in this workflow.
s=s.replace("supplyStatus:'simworx'","supplyStatus:'customer'",1)
# Internal candidate channels should also default to customer supplied.
s=s.replace("return {id:'P'+(i+1),modelId,supplyStatus:'simworx'", "return {id:'P'+(i+1),modelId,supplyStatus:'customer'",1)
p.write_text(s)

# Refine neutral projector spec.
p=Path('projection/src/guided-planner.js')
s=p.read_text()
needle="  spec.push('<div><strong>WUXGA or better</strong><span>recommended professional simulation resolution class</span></div>');"
if needle not in s: raise SystemExit('required spec resolution anchor missing')
s=s.replace(needle,needle+"\n  spec.push('<div><strong>Laser / LED preferred</strong><span>professional solid-state light-source class · confirm supplier suitability</span></div>');",1)
p.write_text(s)

# Keep truss below ceiling while remaining above the projector bank.
p=Path('projection/src/projection-layer.js')
s=p.read_text()
old="const trussY=Math.max(Math.max(...ps.map(p=>p.position[1]))+.25,(state.room?.height||4)-.35);"
new="const ceiling=Math.max(.5,(state.room?.height||4)-.20),projectorClearance=Math.max(...ps.map(p=>p.position[1]))+.25;const trussY=Math.min(ceiling,projectorClearance);"
if old not in s: raise SystemExit('truss height anchor missing')
s=s.replace(old,new,1)
p.write_text(s)

subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v17.html')

main=Path('projection/main.html').read_text()
app=Path('projection/src/app.js').read_text()
guided=Path('projection/src/guided-planner.js').read_text()
layer=Path('projection/src/projection-layer.js').read_text()
assert 'projection-legacy-compat' in main
assert 'Truss adds €1,000' in main
assert "supplyStatus:'customer'" in app
assert 'Laser / LED preferred' in guided
assert 'const trussY=Math.min(ceiling,projectorClearance);' in layer
print('V17 runtime compatibility and mounting checks passed')
