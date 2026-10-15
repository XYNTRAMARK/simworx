"""Create a natively editable FreeCAD document without requiring a macro/add-on.

Run using a Python installation with FreeCAD available. The document's standard
Spreadsheet and App::Link expressions remain editable after saving and reopening.
No custom FeaturePython class or external callback is needed in the saved file.
"""
from pathlib import Path
import json
import sys
sys.path.extend(['/usr/lib/freecad/lib','/usr/lib/freecad-python3/lib'])
import FreeCAD as App
import Part

root=Path(__file__).resolve().parent
manifest=json.loads((root/'cad-validation.json').read_text())
params=manifest['parameters']
doc=App.newDocument('SimworxLightTwinCockpit')
doc.Label='Simworx light twin cockpit — editable overall dimensions'
sheet=doc.addObject('Spreadsheet::Sheet','Dimensions')
sheet.Label='Dimensions — edit the three blue value cells (mm)'
sheet.set('A1','Overall width');sheet.set('B1',str(params['width'])+' mm');sheet.setAlias('B1','OverallWidth')
sheet.set('A2','Front-to-back length');sheet.set('B2',str(params['depth'])+' mm');sheet.setAlias('B2','OverallDepth')
sheet.set('A3','Overall height');sheet.set('B3',str(params['height'])+' mm');sheet.setAlias('B3','OverallHeight')
sheet.set('A5','Customer measurements');sheet.set('B5','1700 mm wide × 1900 mm long × 1900 mm high')
sheet.set('A6','Model purpose');sheet.set('B6','Visual planning from eight views; unmeasured details approximate.')
sheet.set('A7','Editing');sheet.set('B7','Change B1–B3, then recompute (F5). Dimensions scale the complete cockpit.')
sheet.set('A8','Coordinate convention');sheet.set('B8','Millimetres; X width, +Y front, +Z up; origin at floor centre.')
sheet.set('A9','STEP');sheet.set('B9','STEP is the fixed geometry export. This FCStd retains editable dimensions.')
sheet.setColumnWidth('A',220);sheet.setColumnWidth('B',490)
sheet.setBackground('B1:B3',(0.82,0.91,1.0));sheet.setStyle('A1:A3','bold','add')
master=doc.addObject('App::Part','ReferenceGeometry')
master.Label='Reference geometry — original measured size'
for i,item in enumerate(manifest['parts']):
    part=doc.addObject('Part::Feature','Component'+str(i+1))
    part.Label=item['name'].replace('_',' ')
    shape=Part.Shape();shape.read(str(root/'components'/item['brep']))
    if not shape.isValid():raise RuntimeError('Invalid native component: '+part.Label)
    part.Shape=shape
    part.addProperty('App::PropertyColor','ReferenceGrey','Appearance');part.ReferenceGrey=tuple(item['colour'])
    master.addObject(part)
link=doc.addObject('App::Link','Cockpit')
link.Label='LIGHT TWIN COCKPIT — dimension-driven assembly'
link.setLink(master)
link.setExpression('ScaleVector.x','Dimensions.OverallWidth / ('+str(params['width'])+' mm)')
link.setExpression('ScaleVector.y','Dimensions.OverallDepth / ('+str(params['depth'])+' mm)')
link.setExpression('ScaleVector.z','Dimensions.OverallHeight / ('+str(params['height'])+' mm)')
master.Visibility=False;link.Visibility=True
doc.recompute()
def dimensions():
    # Exact trimmed-surface bounds, rather than the loose NURBS control-pole
    # bounding box produced by OpenCascade after a non-uniform link scale.
    b=Part.getShape(link).optimalBoundingBox()
    return {'width':b.XLength,'depth':b.YLength,'height':b.ZLength,'floor_z':b.ZMin}
original=dimensions()
for key,want in [('width',params['width']),('depth',params['depth']),('height',params['height'])]:
    assert abs(original[key]-want)<.01,(key,original)
path=root/'simworx-light-twin-cockpit.FCStd'
doc.saveAs(str(path));App.closeDocument(doc.Name)
doc=App.openDocument(str(path));sheet=doc.getObject('Dimensions');link=doc.getObject('Cockpit');doc.recompute()
checks=['Saved native FreeCAD document reopened without a custom macro or add-on.']
for cell,key,want in [('B1','width',params['width']*1.1),('B2','depth',params['depth']*1.1),('B3','height',params['height']*1.1)]:
    old=str(sheet.get(cell));sheet.set(cell,str(want)+' mm');doc.recompute();actual=dimensions()
    assert abs(actual[key]-want)<.01,(key,want,actual)
    assert abs(actual['floor_z'])<.01
    checks.append('Editing '+cell+' recomputes actual '+key+' to '+str(want)+' mm and keeps the floor fixed.')
    sheet.set(cell,old);doc.recompute()
assert all(abs(dimensions()[key]-value)<.01 for key,value in [('width',params['width']),('depth',params['depth']),('height',params['height'])])
App.closeDocument(doc.Name)
(root/'freecad-validation.json').write_text(json.dumps({'checks_passed':len(checks)+1,'checks':checks+['Original 1700 × 1900 × 1900 mm dimensions restored; saved file remains at customer dimensions.'],'original_dimensions_mm':original,'native_features':'Spreadsheet dimensions and App::Link ScaleVector expressions; no external Python dependency when opening the FCStd.'},indent=2)+'\n')
print(json.dumps({'file':str(path),'bytes':path.stat().st_size,'dimensions_mm':original,'checks_passed':len(checks)+1},indent=2))
