from pathlib import Path
import subprocess, shutil

subprocess.run(['python3','.projection-v7-deploy/build_v7.py'],check=True)

p=Path('projection/src/projection-layer.js')
s=p.read_text()

# Add explicit outside-screen uprights to the schematic support frame.
old="""      // Do not draw temporary vertical support legs in the customer preview.
      // The real support geometry will come from the supplied STEP assemblies.
      addBox(structureGroup, [side * 2, 0.035, 0.035], [0, railHeight, back], railMaterial, 'schematic-rear-cross-rail');"""
new="""      // V8: uprights must always sit outside the active screen envelope.
      // Place them beyond the actual arc endpoints with fixed clearance so they
      // can never cut across the viewable screen as diameter/arc changes.
      const uprightClearance = 0.10;
      const uprightX = side + uprightClearance;
      const uprightZ = back;
      const uprightHeight = top + 0.34;
      for (const sign of [-1, 1]) addBox(
        structureGroup,
        [0.035, uprightHeight, 0.035],
        [sign * uprightX, uprightHeight / 2, uprightZ],
        railMaterial,
        'schematic-upright-outside-active-screen'
      );
      addBox(structureGroup, [uprightX * 2, 0.035, 0.035], [0, railHeight, back], railMaterial, 'schematic-rear-cross-rail');"""
if old not in s: raise SystemExit('Support-frame anchor not found')
s=s.replace(old,new,1)

# Hide legacy vertical frame members from the inherited screen model if they
# intrude across the active image. Retain horizontal/curved frame members.
anchor="""  function update({ fine = false } = {}) {"""
helper="""  function suppressLegacyIntrudingUprights(state,current){
    const model=current.model,frameMaterial=current.frameMaterial,screenMesh=current.screenMesh;
    if(!model||!frameMaterial)return;
    const halfArc=Math.min(Math.PI*.985,Math.max(.05,state.horizontalFov*Math.PI/360));
    const endpointX=Math.abs(Math.sin(halfArc)*(state.diameter/2));
    model.traverse(mesh=>{
      if(!mesh.isMesh||mesh===screenMesh)return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(!materials.includes(frameMaterial))return;
      const geometry=mesh.geometry;
      if(!geometry)return;
      if(!geometry.boundingBox)geometry.computeBoundingBox();
      const box=geometry.boundingBox;
      if(!box)return;
      const size=new THREE.Vector3();box.getSize(size);
      const vertical=size.y>Math.max(size.x,size.z)*2.5&&size.y>.5;
      if(!vertical)return;
      const world=new THREE.Vector3();mesh.getWorldPosition(world);
      // Any inherited vertical member inside/at the active arc width is hidden;
      // V8 replaces it with explicit outside-screen uprights.
      mesh.visible=Math.abs(world.x)>endpointX+.04;
    });
  }

  function update({ fine = false } = {}) {"""
if anchor not in s: raise SystemExit('Update anchor not found')
s=s.replace(anchor,helper,1)

old="""    buildStructure(state);
    buildRoomGuide(state);
    applyGhosting(current.simulator, state.ghostCockpit === true);"""
new="""    buildStructure(state);
    buildRoomGuide(state);
    suppressLegacyIntrudingUprights(state,current);
    applyGhosting(current.simulator, state.ghostCockpit === true);"""
if old not in s: raise SystemExit('Update body anchor not found')
s=s.replace(old,new,1)
p.write_text(s)

subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v8.html')

layer=Path('projection/src/projection-layer.js').read_text()
assert 'schematic-upright-outside-active-screen' in layer
assert 'suppressLegacyIntrudingUprights' in layer
assert 'mesh.visible=Math.abs(world.x)>endpointX+.04;' in layer
print('V8 support-upright checks passed')
