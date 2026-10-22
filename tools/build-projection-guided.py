from pathlib import Path
import json,re,hashlib
root=Path(__file__).resolve().parents[1]
p=root/'projection-screen-configurator-preview.html'
s=p.read_text();pattern=r'(<script type="application/json" id="projection-standalone-data">)(.*?)(</script>)'
m=re.search(pattern,s,re.S);data=json.loads(m[2])
for path in (root/'projection/src').glob('*.js'):data['modules']['/src/'+path.name]=path.read_text()
data['catalogue']=json.loads((root/'projection/catalogue.json').read_text())
data['guidedBuild']='room-budget-auto-layout-v1'
data['provenance']['guidedInputs']=[{'file':str(path.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()} for path in sorted((root/'projection').rglob('*')) if path.is_file()]
encoded=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
s=s[:m.start(2)]+encoded+s[m.end(2):]
s=re.sub(r'<main class="led-shell" id="projection-app">.*?</main>\n*',lambda _: (root/'projection/main.html').read_text().rstrip('\n')+'\n',s,flags=re.S)
s=re.sub(r'<dialog class="led-quote-dialog led-dialog" id="projection-guide-dialog">.*?</dialog>\n*',lambda _:(root/'projection/guide.html').read_text().rstrip('\n')+'\n',s,flags=re.S)
s=re.sub(r'(<style data-source="/src/projection.css">).*?(</style>)',lambda m:m[1]+(root/'projection/guided.css').read_text()+m[2],s,flags=re.S)
s=s.replace('Interactive projection preview · AI import and final pricing are not active','Guided projection preview · automatic layout active; prices need confirmation')
s=s.replace('Simworx Projection Configurator · Offline Planning Preview','Simworx Projection Planner · Guided Room & Budget Preview')
p.write_text(s)
manifest={'schemaVersion':1,'path':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':p.stat().st_size}
(root/'.projection-deploy/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
