"""Independently reimport STEP and inspect the actual GLB geometry and units."""
from pathlib import Path
import json
import os
import struct
os.environ.setdefault('XDG_CACHE_HOME','/tmp/simworx-light-twin-cad/cache')
import cadquery as cq
import numpy as np
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib

root=Path(__file__).resolve().parent
checks=[]
def check(value,label):
    assert value,label
    checks.append(label)
step=cq.importers.importStep(str(root/'simworx-light-twin-cockpit.step')).val()
check(step.isValid() and len(step.Solids())>60,'Exported STEP reimports as valid solid geometry with the cockpit components retained.')
box=Bnd_Box();BRepBndLib.AddOptimal_s(step.wrapped,box,False,False);b=box.Get()
actual=[b[i+3]-b[i] for i in range(3)]
check(all(abs(a-b)<.01 for a,b in zip(actual,[1700,1900,1900])),'Reimported STEP has the measured 1700 × 1900 × 1900 mm outer dimensions.')
check(abs(b[2])<.01,'Reimported STEP rests on the Z=0 floor.')
text=(root/'simworx-light-twin-cockpit.step').read_text()
check('COLOUR_RGB' in text and 'SI_UNIT(.MILLI.,.METRE.)' in text.replace(' ',''),'STEP contains explicit colour definitions and millimetre units.')
shell=cq.Shape.importBrep(str(root/'components/000-Cabin_shell_with_window_and_rear_openings.brep'))
check(len(shell.Solids())==1 and shell.isValid(),'The hollow cabin, window apertures and rear access remain one valid solid shell.')
W,D,H=1700,1900,1900
check(not shell.isInside((W*.495,-D*.235,H*.715),.1),'Right rear side window is a real opening.')
check(not shell.isInside((-W*.495,-D*.235,H*.715),.1),'Left rear side window is a real opening.')
check(not shell.isInside((0,-D*.5+5,H*.5),.1),'Rear centre access is a real opening.')
check(shell.isInside((W*.40,-D*.5+5,H*.5),.1),'Rear cheek wall remains beside the access opening.')
check(shell.isInside((0,0,15),.1),'Cabin floor remains beneath the interior.')

raw=(root/'simworx-light-twin-cockpit.glb').read_bytes()
magic,version,length=struct.unpack_from('<III',raw)
check(magic==0x46546C67 and version==2 and length==len(raw),'Web file is a correctly sized binary glTF 2.0 container.')
offset=12;document=None;binary=None
while offset<len(raw):
    size,kind=struct.unpack_from('<II',raw,offset);offset+=8;chunk=raw[offset:offset+size];offset+=size
    if kind==0x4E4F534A:document=json.loads(chunk)
    elif kind==0x004E4942:binary=chunk
check(document is not None and binary is not None,'GLB contains both geometry metadata and embedded binary data.')
check(not document.get('textures') and not document.get('images'),'GLB has no textures or external image dependencies.')
check(all('baseColorTexture' not in m.get('pbrMetallicRoughness',{}) for m in document.get('materials',[])),'All web materials use solid colours.')
for material in document.get('materials',[]):
    colour=material.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])[:3]
    check(max(colour)-min(colour)<.05,'Material '+material.get('name','grey')+' is grey.')

def transform(node):
    if 'matrix' in node:return np.array(node['matrix']).reshape((4,4),order='F')
    x,y,z,w=node.get('rotation',[0,0,0,1])
    r=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
    matrix=np.eye(4);matrix[:3,:3]=r@np.diag(node.get('scale',[1,1,1]));matrix[:3,3]=node.get('translation',[0,0,0]);return matrix
def accessor(index):
    a=document['accessors'][index];v=document['bufferViews'][a['bufferView']]
    dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    start=v.get('byteOffset',0)+a.get('byteOffset',0)
    return np.frombuffer(binary,dtype=dtype,count=a['count']*width,offset=start).reshape((-1,width))
mins=[];maxs=[];triangles=0
def visit(index,parent):
    global triangles
    node=document['nodes'][index];matrix=parent@transform(node)
    if 'mesh' in node:
        for primitive in document['meshes'][node['mesh']]['primitives']:
            vertices=accessor(primitive['attributes']['POSITION']);indices=accessor(primitive['indices'])
            assert np.isfinite(vertices).all() and indices.max()<len(vertices)
            points=np.c_[vertices,np.ones(len(vertices))]@matrix.T
            mins.append(points[:,:3].min(axis=0));maxs.append(points[:,:3].max(axis=0));triangles+=len(indices)//3
    for child in node.get('children',[]):visit(child,matrix)
for node in document['scenes'][document.get('scene',0)]['nodes']:visit(node,np.eye(4))
low=np.min(mins,axis=0);high=np.max(maxs,axis=0);size=high-low
print('GLB measured bounds:',json.dumps({'min':low.tolist(),'max':high.tolist(),'size':size.tolist()}),flush=True)
check(all(abs(a-b)<.001 for a,b in zip(size,[1.7,1.9,1.9])),'GLB has 1.7 × 1.9 × 1.9 metre bounds in the website coordinate system.')
check(abs(low[1])<.001,'GLB uses Y-up with its base on the floor.')
check(triangles<60000,'Web geometry stays below 60,000 triangles.')
report={'checks_passed':len(checks),'checks':checks,'step_dimensions_mm':actual,'step_solid_count':len(step.Solids()),'glb_bounds_metres':{'min':low.tolist(),'max':high.tolist(),'size':size.tolist()},'glb_triangles':triangles,'textures':0}
(root/'independent-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
