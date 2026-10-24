from pathlib import Path
import subprocess, shutil

# Start from the tested V4 workspace logic.
subprocess.run(['python3','.projection-v4-deploy/build_v4.py'],check=True)

# V5: Step 1 must show only the room, never the screen/cockpit/structure.
p=Path('projection/src/projection-layer.js')
s=p.read_text()
anchor="let overlay = null;\n"
if anchor not in s:
    raise SystemExit('Projection layer state anchor not found')
s=s.replace(anchor, anchor+"  let guidedStep = 1;\n",1)

s=s.replace(
"if (key === enclosureKey) { structureGroup.visible = state.showStructure !== false; return; }",
"if (key === enclosureKey) { structureGroup.visible = state.showStructure !== false && guidedStep >= 2; return; }"
)
s=s.replace(
"structureGroup.visible = state.showStructure !== false;\n    structureGroup.updateMatrixWorld(true);",
"structureGroup.visible = state.showStructure !== false && guidedStep >= 2;\n    structureGroup.updateMatrixWorld(true);"
)
ret="return {\n    update, select, planningContext, testObstruction:obstruction,"
if ret not in s:
    raise SystemExit('Projection layer return anchor not found')
s=s.replace(ret,
"""return {
    update, select, planningContext, testObstruction:obstruction,
    setGuidedStep: step => {
      guidedStep = Number(step) || 1;
      structureGroup.visible = getState().showStructure !== false && guidedStep >= 2;
      if (guidedStep < 3) transform.detach();
      invalidate();
    },""",1)
p.write_text(s)

p=Path('projection/src/guided-planner.js')
s=p.read_text()
anchor="const s=getState(),p=prefs(),step=s.guidedStep;\n"
if anchor not in s:
    raise SystemExit('Guided render anchor not found')
insert="""const s=getState(),p=prefs(),step=s.guidedStep;
  // Step 1 is room definition only. Apply this after any synchronous viewer
  // update so the room guide remains visible while the screen/model is hidden.
  requestAnimationFrame(()=>{
    const view=getViewer?.(),ctx=view?.context?.();
    if(ctx?.model)ctx.model.visible=step>=2;
    if(ctx?.simulator)ctx.simulator.visible=step>=2&&s.showSimulator;
    getLayer()?.setGuidedStep?.(step);
    ctx?.invalidate?.();
  });
"""
s=s.replace(anchor,insert,1)
p.write_text(s)

# Rebuild after V5 patches.
subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v5.html')

# Static guardrails for the requested behavior.
layer=Path('projection/src/projection-layer.js').read_text()
guided=Path('projection/src/guided-planner.js').read_text()
assert 'setGuidedStep' in layer
assert 'structureGroup.visible = state.showStructure !== false && guidedStep >= 2' in layer
assert 'if(ctx?.model)ctx.model.visible=step>=2;' in guided
assert 'if(ctx?.simulator)ctx.simulator.visible=step>=2&&s.showSimulator;' in guided
print('V5 Step-1 room-only checks passed')
