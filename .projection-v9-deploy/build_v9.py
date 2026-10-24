from pathlib import Path
import subprocess, shutil

subprocess.run(['python3','.projection-v8-deploy/build_v8.py'],check=True)

# V9: projector placement is screen-relative, with a hard 500 mm rear overhang.
p=Path('projection/src/layout-planner.js')
s=p.read_text()
anchor="const screenOf=s=>({radius:s.diameter/2,height:s.viewableHeight,bottom:s.screenBottom,arcDegrees:s.horizontalFov});\n"
insert="""const screenOf=s=>({radius:s.diameter/2,height:s.viewableHeight,bottom:s.screenBottom,arcDegrees:s.horizontalFov});
const MAX_PROJECTOR_REAR_OVERHANG=0.5;
function visibleScreenRearZ(state){
 const screen=screenOf(state);let rear=-Infinity;
 for(let i=0;i<=128;i++)rear=Math.max(rear,screenPoint(screen,i/128,.5)[2]);
 return rear;
}
"""
if anchor not in s: raise SystemExit('screenOf anchor not found')
s=s.replace(anchor,insert,1)

anchor2=" const bounds=roomBounds(state);"
if anchor2 not in s: raise SystemExit('placement bounds anchor not found')
s=s.replace(anchor2,anchor2+"const rearLimit=visibleScreenRearZ(state)+MAX_PROJECTOR_REAR_OVERHANG;",1)

# This is intentionally a hard design constraint: room size cannot permit deeper placement.
needle=""" if(list.some(p=>p.position[0]-wall<=bounds.minX||p.position[0]+wall>=bounds.maxX||p.position[2]-wall<=bounds.minZ||p.position[2]+wall>=bounds.maxZ||p.position[1]+margin>=state.room.height||p.position[1]-margin<=0)){penalty+=.75;reasons.push('A projector position is close to or beyond the entered room envelope; coverage is still calculated so you can judge the compromise.');}"""
hard=""" if(list.some(p=>p.position[2]>rearLimit+1e-6))return {hard:true,penalty:99,reasons:['Projector mounting is limited to 500 mm behind the rear-most visible screen edge. The optimiser must solve coverage using throw ratio, height and aim within that envelope.']};
"""+needle
if needle not in s: raise SystemExit('soft room placement rule not found')
s=s.replace(needle,hard,1)

s=s.replace(
"method:'Matched ceiling-mounted layouts; lens centres constrained inside the screen footprint; closer placement and optical pitch searched before wider room positions; one lens height per layout; optional room/projector/budget objectives; imperfect arrangements retained and scored'",
"method:'Matched ceiling-mounted layouts; projector lens centres never more than 500 mm behind the rear-most visible screen edge; throw ratio, height and optical pitch searched inside that envelope; one lens height per layout; imperfect arrangements retained and scored'"
)
p.write_text(s)

# Enforce the same limit for drag/manual input in the viewer.
p=Path('projection/src/projection-layer.js')
s=p.read_text()
s=s.replace(
"import { evaluateProjection, projectorCornerRays, firstScreenIntersection } from 'projection:/src/optics.js';",
"import { evaluateProjection, projectorCornerRays, firstScreenIntersection, screenPoint } from 'projection:/src/optics.js';"
)
anchor="""  function emitTransform(finished) {"""
helper="""  function projectorRearLimit(state){
    const screen={radius:state.diameter/2,height:state.viewableHeight,bottom:state.screenBottom,arcDegrees:state.horizontalFov};
    let rear=-Infinity;
    for(let i=0;i<=128;i++)rear=Math.max(rear,screenPoint(screen,i/128,.5)[2]);
    return rear+0.5;
  }
  function constrainProjectorPosition(position,state=getState()){
    const next=[...position];
    next[2]=Math.min(next[2],projectorRearLimit(state));
    return next;
  }

  function emitTransform(finished) {"""
if anchor not in s: raise SystemExit('emit transform anchor not found')
s=s.replace(anchor,helper,1)

needle="""    const limits = getState().mountLimits?.[id];"""
replace="""    const constrained=constrainProjectorPosition(object.position.toArray());
    object.position.set(...constrained);
    const limits = getState().mountLimits?.[id];"""
if needle not in s: raise SystemExit('manual transform constraint anchor not found')
s=s.replace(needle,replace,1)

ret="""    update, select, planningContext, testObstruction:obstruction,"""
if ret not in s: raise SystemExit('layer return anchor not found')
s=s.replace(ret,ret+"\n    constrainProjectorPosition,",1)
p.write_text(s)

# Numeric manual X/Y/Z inputs must obey the same rear limit.
p=Path('projection/src/app.js')
s=p.read_text()
old="""  all('[data-position]').forEach(input=>input.addEventListener('change',()=>{const p=selected(),value=Number(input.value)/lengthFactor(unit);if(!finite(value)||Math.abs(value)>100)return;p.position[Number(input.dataset.position)]=value;update({fine:true});}));"""
new="""  all('[data-position]').forEach(input=>input.addEventListener('change',()=>{const p=selected(),value=Number(input.value)/lengthFactor(unit);if(!finite(value)||Math.abs(value)>100)return;const next=[...p.position];next[Number(input.dataset.position)]=value;p.position=layer?.constrainProjectorPosition(next)||next;update({fine:true});}));"""
if old not in s: raise SystemExit('numeric projector position listener not found')
s=s.replace(old,new,1)
p.write_text(s)

subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v9.html')

planner=Path('projection/src/layout-planner.js').read_text()
layer=Path('projection/src/projection-layer.js').read_text()
app=Path('projection/src/app.js').read_text()
assert 'MAX_PROJECTOR_REAR_OVERHANG=0.5' in planner
assert 'p.position[2]>rearLimit+1e-6' in planner
assert 'return rear+0.5;' in layer
assert 'constrainProjectorPosition' in layer
assert 'layer?.constrainProjectorPosition(next)' in app
print('V9 500 mm screen-relative projector envelope checks passed')
