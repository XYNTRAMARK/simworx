"""Dimension-driven grey B-rep cockpit, reconstructed from eight customer views.

Run with CadQuery 2.7: python3 build-light-twin.py
All CAD dimensions are millimetres. Front = +Y; up = +Z; origin = floor centre.
Overall W/D/H are customer measurements; unmeasured details are illustrative.
No textures or occupant mannequins are included.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import os
import struct

os.environ.setdefault("XDG_CACHE_HOME", "/tmp/simworx-light-twin-cad/cache")
import cadquery as cq
from OCP.BRepTools import BRepTools
from OCP.BRepMesh import BRepMesh_IncrementalMesh

ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--parameters',type=Path,default=ROOT/'dimensions.json')
parser.add_argument('--output',type=Path,default=ROOT)
args=parser.parse_args()
params=json.loads(args.parameters.read_text())
OUT=args.output;OUT.mkdir(parents=True,exist_ok=True)
BREP=OUT/'components';BREP.mkdir(exist_ok=True)
W,D,H=(float(params[k]) for k in ('width','depth','height'))
T=float(params['wall_thickness'])
if not all(math.isfinite(n) and n>0 for n in (W,D,H,T)) or T>=min(W,D,H)*.10:
    raise ValueError('Choose positive dimensions and a wall thickness below one tenth of the smallest overall dimension.')

COLOURS={'shell':(.57,.58,.59),'frame':(.40,.41,.42),'seats':(.49,.50,.51),'padding':(.61,.62,.63),'dark':(.24,.25,.26),'instruments':(.16,.17,.18),'metal':(.68,.69,.70)}
components=[]
assembly=cq.Assembly(name='Simworx_light_twin_cockpit')

def add(name,shape,colour='shell'):
    if isinstance(shape,cq.Workplane):shape=shape.val()
    if shape.isNull() or not shape.isValid() or len(shape.Solids())==0:
        raise RuntimeError('Invalid solid: '+name)
    rgb=COLOURS[colour]
    components.append({'name':name,'shape':shape,'colour':rgb})
    assembly.add(shape,name=name,color=cq.Color(*rgb))
    return shape

def rounded_box(w,d,h,x,y,z,radius=0):
    result=cq.Workplane('XY').box(w,d,h)
    if radius:result=result.edges().fillet(min(radius,min(w,d,h)*.28))
    return result.translate((x,y,z)).val()

def profile(y,width,top,bottom=0):
    # Smooth rounded fuselage cross-section, with vertical lower side panels.
    w=width;span=top-bottom
    def p(x,z):return cq.Vector(x*w,y,bottom+z*span)
    def line(a,b):return cq.Edge.makeLine(p(*a),p(*b))
    def curve(points):return cq.Edge.makeBezier([p(*point) for point in points])
    # Bezier control hulls stay inside the measured envelope: no interpolating
    # spline or circular-arc overshoot beyond the floor, roof or overall width.
    edges=[line((-.43,0),(.43,0)),curve([(.43,0),(.48,0),(.5,.04),(.5,.12)]),line((.5,.12),(.5,.70)),curve([(.5,.70),(.5,.92),(.36,1),(0,1)]),curve([(0,1),(-.36,1),(-.5,.92),(-.5,.70)]),line((-.5,.70),(-.5,.12)),curve([(-.5,.12),(-.5,.04),(-.48,0),(-.43,0)])]
    return cq.Wire.assembleEdges(edges)

sections=[(-.50*D,W,.965*H),(-.35*D,W,H),(.025*D,W,.985*H),(.36*D,.955*W,.64*H),(.50*D,.86*W,.59*H)]
outer=cq.Solid.makeLoft([profile(y,width,top) for y,width,top in sections],ruled=True)
inner_sections=[(sections[0][0]+T,sections[0][1]-2*T,sections[0][2]-T)]
inner_sections += [(y,width-2*T,top-T) for y,width,top in sections[1:-1]]
inner_sections += [(sections[-1][0]-T,sections[-1][1]-2*T,sections[-1][2]-T)]
inner=cq.Solid.makeLoft([profile(y,width,top,T) for y,width,top in inner_sections],ruled=True)
shell=outer.cut(inner)

def yz_prism(points,start_x,length):
    return cq.Workplane('YZ',origin=(start_x,0,0)).polyline(points).close().extrude(length).val()

# Two actual front-windscreen apertures, with a retained centre mullion.
front_polygon=[(.24*D,.64*H),(.45*D,.64*H),(.15*D,.94*H),(.045*D,.94*H)]
for x0,x1 in [(-.425*W,-.024*W),(.024*W,.425*W)]:shell=shell.cut(yz_prism(front_polygon,x0,x1-x0))

# Rear side windows and separate forward quarter windows on both sides.
rear_window=(cq.Workplane('YZ',origin=(-W,-.235*D,.715*H)).rect(.33*D,.31*H).extrude(2*W).edges('|X').fillet(min(.043*H,.07*D)).val())
shell=shell.cut(rear_window)
quarter=yz_prism([(-.015*D,.57*H),(-.015*D,.865*H),(.285*D,.60*H),(.22*D,.57*H)],-W,2*W)
quarter=cq.Workplane(obj=quarter).edges('|X').fillet(min(28,.015*min(W,H))).val()
shell=shell.cut(quarter)

# Open rear entry matches the split rear cheeks in the supplied rear views.
opening_width=W*float(params['rear_opening_fraction'])
rear_entry=rounded_box(opening_width,.13*D,H+2*T,0,-.505*D,H/2+T,0)
shell=shell.cut(rear_entry)

# Small left-hand access slots visible in the supplied side view.
for z in [.425*H,.355*H]:
    slot=rounded_box(.28*W,.155*D,.045*H,-.49*W,-.17*D,z,4)
    shell=shell.cut(slot)
add('Cabin_shell_with_window_and_rear_openings',shell,'shell')

# Separate, slightly inset floor lining; exterior lowest surface remains Z=0.
add('Cabin_floor_lining',rounded_box(.80*W,.85*D,15,0,-.005*D,T+7.5,5),'frame')

# Instrument panel and brow, in front of the two seats.
panel_y=.265*D
panel=cq.Workplane('XZ',origin=(0,panel_y,0)).polyline([(-.375*W,.36*H),(.375*W,.36*H),(.39*W,.535*H),(.30*W,.585*H),(-.30*W,.585*H),(-.39*W,.535*H)]).close().extrude(.065*D).val()
add('Main_instrument_panel',panel,'frame')
add('Instrument_panel_glareshield',rounded_box(.81*W,.155*D,.035*H,0,.24*D,.594*H,22),'dark')
face_y=panel_y-.065*D-1
for pilot in [-1,1]:
    centre=pilot*.225*W
    for row in range(2):
        for col in range(3):
            x=centre+(col-1)*.071*W;z=(.47+.063*row)*H;r=.026*W
            ring=cq.Workplane('XZ',origin=(x,face_y,z)).circle(r).extrude(10).val()
            disc=cq.Workplane('XZ',origin=(x,face_y-10,z)).circle(r*.78).extrude(2).val()
            add(f'Gauge_rim_{pilot}_{row}_{col}'.replace('-','L'),ring,'metal')
            add(f'Gauge_face_{pilot}_{row}_{col}'.replace('-','L'),disc,'instruments')
    add('Avionics_display_'+str(pilot).replace('-','L'),rounded_box(.14*W,12,.065*H,centre,face_y-9,.398*H,6),'instruments')

def cylinder_between(a,b,r):
    av,bv=cq.Vector(*a),cq.Vector(*b);direction=bv-av
    return cq.Solid.makeCylinder(r,direction.Length,av,direction.normalized())

# Two upholstered seats with separate cushions, headrests and simple pedestals.
for side in [-1,1]:
    key='Left' if side<0 else 'Right';x=side*.225*W;y=-.235*D
    add(key+'_seat_pedestal',rounded_box(.19*W,.18*D,.19*H,x,y,.185*H,22),'dark')
    add(key+'_seat_cushion',rounded_box(.26*W,.25*D,.065*H,x,y,.32*H,35),'seats')
    for offset in [-1,1]:
        add(key+'_seat_cushion_pad_'+str(offset).replace('-','L'),rounded_box(.117*W,.225*D,.023*H,x+offset*.063*W,y+.005*D,.356*H,16),'padding')
    back=rounded_box(.265*W,.058*D,.355*H,x,y-.125*D,.55*H,35).rotate((x,y-.125*D,.55*H),(x+1,y-.125*D,.55*H),10)
    add(key+'_seat_back',back,'seats')
    head=rounded_box(.21*W,.072*D,.115*H,x,y-.165*D,.79*H,35).rotate((x,y-.165*D,.79*H),(x+1,y-.165*D,.79*H),10)
    add(key+'_seat_headrest',head,'padding')
    for outer in [-1,1]:
        add(key+'_armrest_'+str(outer).replace('-','L'),rounded_box(.035*W,.16*D,.035*H,x+outer*.142*W,y+.005*D,.405*H,12),'dark')
    # Yokes and columns are solid geometry, not textures or flat silhouettes.
    column=cylinder_between((x,.035*D,.16*H),(x,.10*D,.485*H),16)
    cross=cylinder_between((x-.075*W,.10*D,.49*H),(x+.075*W,.10*D,.49*H),14)
    pieces=[column,cross]
    for offset in [-1,1]:pieces.append(cylinder_between((x+offset*.075*W,.10*D,.49*H),(x+offset*.075*W,.10*D,.555*H),15))
    add(key+'_yoke_and_column',cq.Compound.makeCompound(pieces),'dark')
    for offset in [-1,1]:
        add(key+'_pedal_'+str(offset).replace('-','L'),rounded_box(.065*W,.085*D,.017*H,x+offset*.047*W,.235*D,.115*H,5),'metal')

add('Centre_pedestal',rounded_box(.145*W,.315*D,.23*H,0,-.06*D,.18*H,24),'frame')
add('Centre_console_top',rounded_box(.15*W,.29*D,.018*H,0,-.055*D,.305*H,10),'dark')
for i,x in enumerate([-.042*W,-.014*W,.014*W,.042*W]):
    lever=cylinder_between((x,.025*D,.315*H),(x,.045*D,.385*H),8)
    grip=rounded_box(.021*W,.028*D,.025*H,x,.045*D,.39*H,8)
    add('Throttle_lever_'+str(i+1),cq.Compound.makeCompound([lever,grip]),'dark')
add('Rear_overhead_panel',rounded_box(.31*W,.07*D,.038*H,0,-.42*D,.905*H,10),'dark')
for i in range(7):
    add('Overhead_control_'+str(i+1),rounded_box(.022*W,.018*D,10,(i-3)*.037*W,-.42*D,.883*H,3),'metal')

compound=cq.Compound.makeCompound([c['shape'] for c in components]);box=compound.BoundingBox()
bounds={'width':box.xlen,'depth':box.ylen,'height':box.zlen,'min':[box.xmin,box.ymin,box.zmin],'max':[box.xmax,box.ymax,box.zmax]}
for got,want in zip([box.xlen,box.ylen,box.zlen],[W,D,H]):
    if abs(got-want)>1e-4:raise RuntimeError('Assembly exceeds requested outer dimensions: '+str(bounds))
for index,c in enumerate(components):
    file=f'{index:03d}-{c["name"]}.brep';c['shape'].exportBrep(str(BREP/file));c['brep']=file

step=OUT/'simworx-light-twin-cockpit.step'
assembly.export(str(step),exportType='STEP')
glb=OUT/'simworx-light-twin-cockpit.glb'
for c in components:
    BRepTools.Clean_s(c['shape'].wrapped)
    BRepMesh_IncrementalMesh(c['shape'].wrapped,4.0,False,.35,True)
assembly.export(str(glb),exportType='GLTF',tolerance=4.0,angularTolerance=.35)
# This OpenCascade writer preserves the CAD's millimetre numbers in its mesh.
# glTF units are metres: scale the root nodes explicitly, retaining its Y-up
# rotation and all child/component positions. STEP itself stays in millimetres.
raw=glb.read_bytes();offset=12;chunks=[];document=None
while offset<len(raw):
    size,kind=struct.unpack_from('<II',raw,offset);offset+=8;content=raw[offset:offset+size];offset+=size
    if kind==0x4E4F534A:document=json.loads(content)
    else:chunks.append((kind,content))
for scene in document['scenes']:
    for index in scene['nodes']:
        node=document['nodes'][index];node['scale']=[value*.001 for value in node.get('scale',[1,1,1])]
encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
body=struct.pack('<II',len(encoded),0x4E4F534A)+encoded
for kind,content in chunks:body+=struct.pack('<II',len(content),kind)+content
glb.write_bytes(struct.pack('<III',0x46546C67,2,len(body)+12)+body)

mesh_parts=[]
for c in components:
    vertices,triangles=c['shape'].tessellate(4.0,.35)
    # Web coordinates are metres: X right, Y up, front = -Z.
    mesh_parts.append({'name':c['name'],'colour':c['colour'],'positions':[round(value,7) for p in vertices for value in (p.x/1000,p.z/1000,-p.y/1000)],'indices':[n for triangle in triangles for n in triangle]})
(OUT/'model-mesh.json').write_text(json.dumps({'dimensions_mm':{'width':W,'depth':D,'height':H},'parts':mesh_parts},separators=(',',':')))
manifest={'name':params['name'],'units':'mm','outer_dimensions_mm':bounds,'component_count':len(components),'all_components_valid':True,'shell_solid_count':len(shell.Solids()),'triangles':sum(len(p['indices'])//3 for p in mesh_parts),'parameters':params,'parts':[{'name':c['name'],'colour':c['colour'],'brep':c['brep']} for c in components],'files':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [step,glb]}}
(OUT/'cad-validation.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ['outer_dimensions_mm','component_count','all_components_valid','shell_solid_count','triangles','files']},indent=2))
