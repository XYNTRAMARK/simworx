from pathlib import Path

# V3 runtime fix, isolated to V4 build workspace.
p=Path('projection/src/projection-layer.js')
s=p.read_text()
s=s.replace(
"const screenFromLeft=finite(room.screenFromLeft)?room.screenFromLeft:dimensions[0]/2;",
"const screenFromLeft=numeric(room.screenFromLeft)!==null?room.screenFromLeft:dimensions[0]/2;"
).replace(
"const screenFromFront=finite(room.screenFromFront)?room.screenFromFront:dimensions[2]/2;",
"const screenFromFront=numeric(room.screenFromFront)!==null?room.screenFromFront:dimensions[2]/2;"
)
if 'finite(room.screenFrom' in s: raise SystemExit('V4 runtime fix incomplete')
p.write_text(s)

p=Path('projection/src/layout-planner.js')
s=p.read_text()
start=s.index('export function roomIssues(state){')
end=s.index('\nfunction screenSellingPrice', start)
s=s[:start]+"""export function roomIssues(state){
 const room=state.room;
 if(!room||!['width','depth','height'].every(k=>finite(room[k])&&room[k]>=1&&room[k]<=50))return ['Enter valid internal room dimensions.'];
 if(!finite(room.screenFromLeft))room.screenFromLeft=room.width/2;
 if(!finite(room.screenFromFront))room.screenFromFront=room.depth/2;
 return [];
}"""+s[end:]

old=" if(list.some(p=>p.position[0]-wall<=bounds.minX||p.position[0]+wall>=bounds.maxX||p.position[2]-wall<=bounds.minZ||p.position[2]+wall>=bounds.maxZ||p.position[1]+margin>=state.room.height||p.position[1]-margin<=0))return {hard:true,penalty:99,reasons:['Projector body would lie outside the measured room boundary.']};"
new=" if(list.some(p=>p.position[0]-wall<=bounds.minX||p.position[0]+wall>=bounds.maxX||p.position[2]-wall<=bounds.minZ||p.position[2]+wall>=bounds.maxZ||p.position[1]+margin>=state.room.height||p.position[1]-margin<=0)){penalty+=.75;reasons.push('A projector position is close to or beyond the entered room envelope; coverage is still calculated so you can judge the compromise.');}"
if old not in s: raise SystemExit('room boundary rule not found')
s=s.replace(" const bounds=roomBounds(state);\n if(list.some"," const bounds=roomBounds(state);let penalty=0,reasons=[];\n if(list.some",1)
s=s.replace(old,new,1)
s=s.replace(" let penalty=0,reasons=[];\n if(list.some((a,i)=>"," if(list.some((a,i)=>",1)
old=" if(list.some(p=>Math.hypot(p.position[0],p.position[2])>footprintRadius+1e-6))return {hard:true,penalty:99,reasons:['A projector lens centre would sit outside the screen footprint. Move it closer to the screen and use optical pitch instead.']};"
new=" if(list.some(p=>Math.hypot(p.position[0],p.position[2])>footprintRadius+1e-6)){penalty+=.5;reasons.push('A projector lens centre falls outside the screen plan footprint; the arrangement is retained because coverage and shadow performance take priority.');}"
if old not in s: raise SystemExit('screen footprint rule not found')
s=s.replace(old,new,1)
p.write_text(s)

p=Path('projection/src/guided-planner.js')
s=p.read_text()
repls={
"'The physical room or screen inputs must be corrected before projector positions can be calculated.'":"'No suitable catalogue arrangement was found in the tested search. Room fit is advisory and never blocks assessment.'",
"'Room constraints must be valid before a projector arrangement can be shown.'":"'Room dimensions are advisory; the best tested projector arrangement is still assessed.'",
"'Correct the room or screen inputs to calculate the projector specification.'":"'Projector specification is based on the best tested coverage and shadow result; room fit is advisory.'",
"'Correct the physical room/screen inputs and calculate again.'":"'No catalogue layout completed this search; room fit itself does not block assessment.'"
}
for a,b in repls.items(): s=s.replace(a,b)
p.write_text(s)

# Build standalone V4.
import subprocess, shutil
subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v4.html')

# Guardrails.
assert 'Part of the screen lies outside the measured room' not in Path('projection/src/layout-planner.js').read_text()
assert 'Projector body would lie outside the measured room boundary' not in Path('projection/src/layout-planner.js').read_text()
assert 'Room constraints must be valid before a projector arrangement can be shown' not in Path('projection/src/guided-planner.js').read_text()
assert 'finite(room.screenFrom' not in Path('projection/src/projection-layer.js').read_text()
print('V4 build checks passed')
