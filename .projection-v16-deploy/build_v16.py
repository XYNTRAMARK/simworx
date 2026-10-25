from pathlib import Path
import subprocess, shutil, re

subprocess.run(['python3','.projection-v15-deploy/build_v15.py'],check=True)

# ---------- Main UI simplification ----------
p=Path('projection/main.html')
s=p.read_text()

s=s.replace('Design the screen around your room and cockpit, then see the best projector arrangement achievable for your budget.',
            'Design the screen around your room and cockpit, then calculate the projector specification and mounting geometry your installation requires.')
s=s.replace('Set the room, screen and cockpit together. The planner then places projectors automatically, shows the shadow from the pilot seat and tells you what change would improve the result.',
            'Set the room, screen and cockpit together. The planner then calculates the projector class, throw ratio, mounting positions, coverage and cockpit shadowing without recommending a brand.')
s=s.replace('<button type="button" data-guided-go="1"><b>1</b> Room &amp; budget</button>',
            '<button type="button" data-guided-go="1"><b>1</b> Room</button>')
s=s.replace('<button type="button" data-guided-go="3"><b>3</b> Projectors</button>',
            '<button type="button" data-guided-go="3"><b>3</b> Projector requirement</button>')
s=s.replace('<h2>Your room &amp; budget</h2>','<h2>Your room</h2>')
# Remove visible project budget field.
s=re.sub(r'<div class="led-field"><label for="guided-budget">.*?</div></section>',
         '</section>',s,count=1,flags=re.S)

# Rename Step 3 and replace the brand/budget controls with mounting choice + quantity.
start=s.index('<section class="led-panel guided-planner" data-guided-step="3">')
end=s.index('</section>\n\n</div>\n<aside class="led-preview-panel"',start)
old=s[start:end+10]
new='''<section class="led-panel guided-planner" data-guided-step="3">
<span class="led-step">PROJECTOR REQUIREMENT</span>
<h2>Calculate the projector specification you need</h2>
<p class="led-section-help">The planner calculates a matched projector layout from your screen, cockpit and room geometry. Simworx does not recommend a make or model here; use the resulting specification to source a projector that meets the requirement.</p>
<div class="projection-form-grid">
<label>Quantity<select id="guided-count"><option value="auto">Find best fit · 2 or 3</option><option value="2">2 projectors</option><option value="3">3 projectors</option></select></label>
<label>Mounting method<select id="projection-mounting-style"><option value="ceiling">Ceiling mounts</option><option value="truss">Floor-supported truss</option></select></label>
</div>
<p class="led-help" id="projection-mounting-note">Ceiling mounts are shown as generic drop mounts from the calculated lens positions. Choose truss to visualise a floor-supported truss below the ceiling.</p>
<details class="guided-preferences"><summary>Layout preferences</summary><div class="guided-manual-body">
<div class="led-field"><label for="guided-mount-drop">Ceiling allowance for projector &amp; mount (m)</label><input id="guided-mount-drop" type="number" min="0.2" max="1.5" step=".05" value=".35"></div>
<label class="projection-check"><input id="guided-resize" type="checkbox"> Allow the planner to reduce screen size if it improves the fit</label>
<p class="led-help">The cockpit stays at its chosen position. Any screen-size change is listed with the result.</p>
</div></details>
<button type="button" id="guided-calculate" class="led-button led-primary">Calculate projector requirement</button>
<p id="guided-progress" class="led-help" role="status" aria-live="polite"></p>
<div id="guided-result" class="guided-result" hidden>
  <div class="guided-result-heading"><span id="guided-light" class="guided-light" aria-hidden="true"></span><div><h3 id="guided-result-title"></h3><p id="guided-result-summary"></p></div></div>
  <div id="guided-result-metrics" class="guided-result-metrics"></div>
  <p id="guided-screen-change" class="led-help"></p>
  <section class="guided-required-spec" aria-labelledby="guided-required-spec-title">
    <h4 id="guided-required-spec-title">Projector specification required</h4>
    <p class="led-help">Use these optical requirements to source a suitable professional projector. Simworx is specifying the geometry required, not endorsing a particular brand or model.</p>
    <div id="guided-required-spec"></div>
  </section>
  <h4 class="guided-advice-title">Improve this configuration</h4>
  <ul id="guided-remedies"></ul>
  <div class="guided-advice-actions">
    <button type="button" class="led-button led-outline" id="guided-test-cockpit-back">Test cockpit farther back</button>
    <button type="button" class="led-button led-outline" id="guided-test-screen-larger">Test a larger screen</button>
    <button type="button" class="led-button led-outline" id="guided-pilot-view">Inspect from pilot eye</button>
    <button type="button" class="led-button led-outline" id="guided-optimise-screen">Test a smaller screen</button>
  </div>
  <details id="guided-mounting">
    <summary>Mounting geometry</summary>
    <p class="led-help">Lens centres are measured from the room’s left wall, front wall and floor. Confirm the chosen projector chassis datum with its supplier before drilling or fabricating mounts.</p>
    <div class="guided-table-scroll"><table><thead><tr><th>Projector</th><th>From left wall</th><th>From front wall</th><th>Lens height</th><th>Aim yaw / pitch</th></tr></thead><tbody id="guided-mounting-rows"></tbody></table></div>
    <div class="led-quote-actions"><button type="button" class="led-button led-outline" id="guided-print-mounting">Print mounting plan</button><button type="button" class="led-button led-outline" id="guided-download-mounting">Download mounting geometry</button></div>
  </details>
  <p class="led-help">Planning geometry only. Verify the selected projector’s throw range, lens offset, focus range, chassis datum and mounting orientation with its supplier.</p>
</div>
<details id="guided-manual" class="projection-placement guided-manual">
<summary>Advanced · adjust projector positions manually</summary>
<div class="guided-manual-body">
<p class="led-help">Manual positioning is for geometry comparison only. The customer-facing specification remains brand-neutral.</p>
<div class="projection-projector-tabs" id="projection-channel-tabs"></div>
<div class="projection-form-grid">
<label>X · left / right <span data-position-unit>m</span><input type="number" step="0.05" id="projection-x" data-position="0"></label>
<label>Y · lens height <span data-position-unit>m</span><input type="number" min="0" step="0.05" id="projection-y" data-position="1"></label>
<label>Z · forward / back <span data-position-unit>m</span><input type="number" step="0.05" id="projection-z" data-position="2"></label>
<label>Yaw °<input type="number" min="-180" max="180" step="1" id="projection-yaw" data-aim="yaw"></label>
<label>Pitch °<input type="number" min="-90" max="90" step="1" id="projection-pitch" data-aim="pitch"></label>
<label>Roll °<input type="number" min="-180" max="180" step="1" id="projection-roll" data-aim="roll"></label>
</div>
<div class="led-field"><label for="projection-throw">Optical throw ratio <span id="projection-throw-limits"></span></label><input id="projection-throw" type="range" min="0.2" max="2" step="0.001"><output id="projection-throw-value" for="projection-throw"></output></div>
<div class="projection-inline-actions"><button class="led-button led-outline" type="button" data-transform="translate">Move</button><button class="led-button led-outline" type="button" data-transform="rotate">Aim</button><button class="led-button led-outline" type="button" id="projection-undo">Undo move</button></div>
<label class="projection-check"><input type="checkbox" id="projection-locked"> Lock selected projector</label>
<button type="button" id="projection-suggest" class="led-button led-outline">Recalculate matched layout</button>
<p id="projection-placement-status" class="led-help" role="status"></p>
</div></details>
</section>'''
s=s[:start]+new+s[end+10:]

# Hide old enclosure chooser; full surround becomes quote-only.
s=s.replace('<div class="led-shape-bar" data-guided-step="2">','<div class="led-shape-bar" data-guided-step="2" hidden>',1)

# Review page: replace mounting-kit panel with quote-only surround option.
s=s.replace('<section class="led-panel"><h3>Mounting kit</h3><label class="projection-check"><input type="checkbox" id="projection-mounting-kit" checked> Add projector Mounting kit <strong id="projection-kit-price">Price to confirm</strong></label><p>One kit price per installation, for either two or three projectors.</p><p class="led-help">The semi-enclosed and fully enclosed screen options include the configured mounting kit. For screen-only systems the kit can be added separately; it is never charged twice.</p></section>',
'''<section class="led-panel"><h3>Optional full surround</h3><label class="projection-check"><input type="checkbox" id="projection-full-surround"> Add full surround enclosure <strong id="projection-full-surround-price"></strong></label><p class="led-help">Quote-only option. The surround is not modelled in the 3D preview; it is added to the commercial estimate using the current surround allowance.</p></section>''')

# Remove budget dialog entirely.
s=re.sub(r'<dialog class="led-dialog guided-budget-dialog" id="guided-budget-dialog">.*?</dialog>','',s,count=1,flags=re.S)

p.write_text(s)

# ---------- Planner/result wording ----------
p=Path('projection/src/guided-planner.js')
s=p.read_text()
s=s.replace("const names=['Room & budget','Screen & cockpit','Projectors','Review'];",
            "const names=['Room','Screen & cockpit','Projector requirement','Review'];")
# Remove budget input sync references that no longer exist.
s=s.replace("for(const [id,key] of [['guided-budget','budget'],['guided-mode','mode'],['guided-count','count'],['guided-band','band'],['guided-mount-drop','mountDrop']])if(document.activeElement!==$(id))$(id).value=p[key]??'';",
            "for(const [id,key] of [['guided-count','count'],['guided-mount-drop','mountDrop']])if($(id)&&document.activeElement!==$(id))$(id).value=p[key]??'';")
s=s.replace("$('guided-model-field').hidden=p.mode!=='fixed';\n  const select=$('guided-model'),models=getProfiles();if(select.options.length!==models.length)select.replaceChildren(...models.map(m=>new Option(m.displayName||m.model,m.id)));\n  select.value=p.modelId||s.projectors[0]?.modelId;","")
# Make calculation always brand-neutral internally.
s=s.replace("const models=p.mode==='fixed'?getProfiles().filter(m=>m.id===p.modelId):getProfiles();",
            "const models=getProfiles();")
# Summary must not name a model.
s=s.replace("objectiveLabels={current:'Current setup',room:'Best fit for my room',projector:'Best projector solution for my setup',budget:'Best overall solution for my budget'};",
            "objectiveLabels={current:'Calculated optical layout',room:'Best fit for my room',projector:'Calculated optical layout',budget:'Calculated optical layout'};")
s=s.replace("objectiveLabels[summary.objective||'current']+' · '+summary.count+' × '+summary.modelName+' · '+summary.examined.toLocaleString()+' arrangements examined.",
            "objectiveLabels[summary.objective||'current']+' · '+summary.count+' projectors · '+summary.examined.toLocaleString()+' arrangements examined.")
# Blank old budget result if present in generated DOM guard.
s=s.replace("  const budget=summary.budget;\n  $('guided-budget-result').textContent=", "  const budget=summary.budget;\n  const budgetResult=$('guided-budget-result');if(budgetResult)budgetResult.textContent=")
# Above substitution could leave a long assignment; easier remove whole budget output line blocks after generation by regex.
s=re.sub(r"\n  const budget=summary\.budget;.*?\n  if\(s\.manualLayout\)\$\('guided-budget-result'\).*?;","\n  const budget=summary.budget;",s,count=1,flags=re.S)

# Replace required-spec assembly with neutral optical specification.
start=s.index("  const model=best?getProfiles().find")
end=s.index("  const remedies=[];",start)
spec='''  const model=best?getProfiles().find(m=>m.id===s.projectors[0]?.modelId):null;
  const throws=best?s.projectors.map(p=>p.throwRatio).filter(finite):[];
  const currentThrow=throws.length?Math.min(...throws):null;
  const targetThrow=finite(summary.requiredThrowRatio)?summary.requiredThrowRatio:currentThrow;
  const projectorClass=finite(targetThrow)?(targetThrow<=.4?'Ultra-short throw (UST)':targetThrow<=1?'Short throw (ST)':'Standard throw'):'Throw class to verify';
  const brightness=model?.brightness?.lumens;
  const brightnessClass=finite(brightness)?Math.max(1000,Math.round(brightness/500)*500):null;
  const count=best?s.projectors.length:0;
  let distanceMin=null,distanceMax=null;
  if(best){
    const radius=s.diameter/2,arc=s.horizontalFov*Math.PI/180;
    const distances=s.projectors.map((p,i)=>{
      const theta=((i+.5)/count-.5)*arc;
      const target=[Math.sin(theta)*radius,s.screenBottom+s.viewableHeight/2,-Math.cos(theta)*radius];
      return Math.hypot(target[0]-p.position[0],target[1]-p.position[1],target[2]-p.position[2]);
    });
    distanceMin=Math.min(...distances);distanceMax=Math.max(...distances);
  }
  const spec=[];
  if(best)spec.push('<div><strong>'+count+'</strong><span>matched projectors required</span></div>');
  spec.push('<div><strong>'+projectorClass+'</strong><span>projection class</span></div>');
  if(finite(targetThrow))spec.push('<div><strong>≈ '+targetThrow.toFixed(2)+'</strong><span>target throw ratio · verify chosen lens covers this value</span></div>');
  if(finite(distanceMin))spec.push('<div><strong>'+formatLength(distanceMin,getUnit())+(distanceMax-distanceMin>.03?'–'+formatLength(distanceMax,getUnit()):'')+'</strong><span>calculated lens-to-screen planning distance</span></div>');
  if(finite(brightnessClass))spec.push('<div><strong>~'+brightnessClass.toLocaleString()+' lm class</strong><span>planning brightness class · final luminance depends on gain and ambient light</span></div>');
  spec.push('<div><strong>WUXGA or better</strong><span>recommended professional simulation resolution class</span></div>');
  if(best)spec.push('<div><strong>'+formatLength(s.projectors[0].position[1],getUnit())+'</strong><span>calculated lens height</span></div>');
  spec.push('<div><strong>'+(s.mountingStyle==='truss'?'Floor-supported truss':'Ceiling mounts')+'</strong><span>selected mounting method</span></div>');
  $('guided-required-spec').innerHTML=spec.join('')||'<p class="led-help">Calculate the layout to generate the required projector specification.</p>';
'''
s=s[:start]+spec+s[end:]

# Remove brand-specific provisional warning.
s=s.replace("  if(best&&summary.provisional)remedies.push('This projector profile is provisional; its documented offset, focus and chassis mounting datums need confirmation.');",
            "  if(best)remedies.push('Confirm the selected projector supplier’s throw range, lens offset, focus range, ceiling/truss mounting orientation and chassis datum before purchase.');")

# Preferences change no longer references removed fields.
old="function preferencesChanged(){const p=prefs();p.budget=$('guided-budget').value===''?null:Number($('guided-budget').value);p.mode=$('guided-mode').value;p.modelId=$('guided-model').value;p.count=$('guided-count').value;p.band=$('guided-band').value;p.mountDrop=Number($('guided-mount-drop').value);p.allowScreenResize=$('guided-resize').checked;changed();render();}"
new="function preferencesChanged(){const p=prefs();p.budget=null;p.totalBudget=null;p.mode='recommend';p.count=$('guided-count').value;p.band='any';p.mountDrop=Number($('guided-mount-drop').value);p.allowScreenResize=$('guided-resize').checked;changed();render();}"
if old in s:s=s.replace(old,new,1)

# Bind only controls that still exist.
s=s.replace("for(const id of ['guided-budget','guided-mode','guided-model','guided-count','guided-band','guided-mount-drop','guided-resize'])$(id).addEventListener('change',preferencesChanged);",
            "for(const id of ['guided-count','guided-mount-drop','guided-resize'])$(id)?.addEventListener('change',preferencesChanged);")
# Remove smart objective and budget dialog listeners.
s=re.sub(r"\n for\(const button of document\.querySelectorAll\('\[data-guided-objective\]'\)\).*?\n \$\('guided-budget-run'\).*?;","",s,count=1,flags=re.S)

# Add mounting geometry CSV download.
anchor="$('guided-back').addEventListener('click',()=>go(getState().guidedStep-1));"
download_fn='''function downloadMountingGeometry(){
  const s=getState();if(!s.layoutReady||s.layoutDirty)return;
  const rows=['Projector,From left wall,From front wall,Lens height,Yaw deg,Pitch deg,Mounting method'];
  for(const p of s.projectors){
    rows.push([p.id,(p.position[0]+s.room.width/2).toFixed(3),(p.position[2]+s.room.depth/2).toFixed(3),p.position[1].toFixed(3),p.yaw.toFixed(2),p.pitch.toFixed(2),s.mountingStyle==='truss'?'Truss':'Ceiling'].join(','));
  }
  const blob=new Blob([rows.join('\\n')],{type:'text/csv'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Simworx_Projector_Mounting_Geometry.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
 '''
if anchor not in s: raise SystemExit('guided back anchor missing')
s=s.replace(anchor,download_fn+anchor,1)
s=s.replace("$('guided-print-mounting').addEventListener('click',printMounting);",
            "$('guided-print-mounting').addEventListener('click',printMounting);$('guided-download-mounting')?.addEventListener('click',downloadMountingGeometry);")
p.write_text(s)

# ---------- App state, quote, wiring ----------
p=Path('projection/src/app.js')
s=p.read_text()

# Add mounting style/full surround defaults and force screen-only commercial base.
s=s.replace("mountingKit:true,servicePlan:'self',currency:'EUR'",
            "mountingKit:false,mountingStyle:'ceiling',fullSurround:false,servicePlan:'self',currency:'EUR'",1)
s=s.replace("enclosure:'semi-enclosed'","enclosure:'screen-only'",1)

# Avoid removed DOM controls crashing syncInputs/renderCatalogue.
s=s.replace("  $('projection-count').value=state.projectorCount;","  if($('projection-count'))$('projection-count').value=state.projectorCount;")
s=s.replace("  $('projection-supply').value=state.supplyStatus;","  if($('projection-supply'))$('projection-supply').value=state.supplyStatus;")
s=s.replace("  const kitIncluded=(catalogue?.commercial?.mountingKit?.includedIn||[]).includes(state.enclosure);if(kitIncluded)state.mountingKit=true;$('projection-mounting-kit').checked=state.mountingKit;$('projection-mounting-kit').disabled=kitIncluded;",
            "  state.mountingKit=false;")
s=s.replace("  $('projection-placement-mode').value=state.placementMode;","  if($('projection-placement-mode'))$('projection-placement-mode').value=state.placementMode;")
s=s.replace("  $('projection-kit-price').textContent=(catalogue.commercial.mountingKit.includedIn||[]).includes(state.enclosure)?'Included':money(convertCurrency(catalogue.commercial.mountingKit.priceEur,'EUR',state.currency,catalogue.ledTariff));",
            "  const surroundPrice=$('projection-full-surround-price');if(surroundPrice)surroundPrice.textContent=money(convertCurrency(Number(catalogue.commercial.enclosures?.['fully-enclosed']?.fixedEur||0),'EUR',state.currency,catalogue.ledTariff));")

# Specification rows: neutral projectors/mounting.
s=s.replace("['Projectors',state.projectorCount+' · '+state.projectors.map(p=>p.id+': '+(profile(p.modelId)?.model||p.modelId)).join(' · ')],",
            "['Projector requirement',state.projectorCount+' matched projectors · see calculated optical specification'],")
s=s.replace("['Projector supply',state.supplyStatus==='simworx'?'Simworx supply':state.supplyStatus==='mixed'?'Mixed · defined per projector':'Customer supplied'],",
            "['Projector selection','Customer/projector supplier to source units matching the calculated specification'],")
s=s.replace("['Mounting kit',state.mountingKit?'One kit per installation':'Customer supplied / not selected'],",
            "['Mounting method',state.mountingStyle==='truss'?'Floor-supported truss':'Ceiling mounts'],")
s=s.replace("['Warping package',catalogue.ledTariff.servicePlans.find(p=>p.id===state.servicePlan)?.quoteLabel||state.servicePlan],",
            "['Full surround',state.fullSurround?'Included in quote · not modelled':'Not selected'],\n    ['Warping package',catalogue.ledTariff.servicePlans.find(p=>p.id===state.servicePlan)?.quoteLabel||state.servicePlan],")

# Quote: no projector products, no generic mounting kit; add truss and surround.
loop_start=s.index("  for(const channel of state.projectors){",s.index("function localQuote()"))
loop_end=s.index("  const plan=catalogue.ledTariff.servicePlans.find",loop_start)
replacement="""  if(state.mountingStyle==='truss')lines.push({id:'truss',label:'Floor-supported projector truss',amount:eur(1000),status:'priced'});
  if(state.fullSurround){
    const surround=Number(commercial.enclosures?.['fully-enclosed']?.fixedEur||0);
    lines.push({id:'full-surround',label:'Full surround enclosure',amount:eur(surround),status:'priced'});
  }
"""
s=s[:loop_start]+replacement+s[loop_end:]

# Remove mounting-kit line from localQuote.
s=re.sub(r"  const kitIncluded=.*?\n  if\(state\.mountingKit\)\{.*?\n  \}","",s,count=1,flags=re.S)

# Quote notes no longer mention projector price.
s=s.replace("  const partial=quote.status!=='complete';","  const partial=quote.status!=='complete';")
s=s.replace("  $('led-running-note').textContent=partial?'Screen, enclosure and warping update live. Selected Simworx projector prices still need confirmation.':'Screen, enclosure, mounting and selected warping included. Delivery and VAT are additional.';",
            "  $('led-running-note').textContent='Screen and selected Simworx options update live. Projectors are not included in this quote. Delivery and VAT are additional.';")
s=s.replace("  $('led-price-status').textContent=quote.errors.length?quote.errors.join(' '):partial?'The screen and selected options are priced. Any unpriced projector remains clearly separated from this total.':'Indicative configuration price. Final projector suitability, delivery and VAT are confirmed before order.';",
            "  $('led-price-status').textContent=quote.errors.length?quote.errors.join(' '):'Indicative Simworx screen/mounting/services estimate. Projectors are intentionally excluded; source units matching the calculated optical specification.';")

# Wire mounting style and full surround.
anchor="  $('projection-room-enabled').addEventListener('change',e=>{state.room.enabled=e.target.checked;update({price:false});});"
extra="""  $('projection-mounting-style')?.addEventListener('change',e=>{state.mountingStyle=e.target.value==='truss'?'truss':'ceiling';update({price:true,fine:true});});
  $('projection-full-surround')?.addEventListener('change',e=>{state.fullSurround=e.target.checked;update({geometry:false,price:true});});
"""
if anchor not in s: raise SystemExit('room enabled anchor missing')
s=s.replace(anchor,extra+anchor,1)

# Guard removed old controls listeners.
for old,new in [
("$('projection-count').addEventListener","$('projection-count')?.addEventListener"),
("$('projection-supply').addEventListener","$('projection-supply')?.addEventListener"),
("$('projection-mounting-kit').addEventListener","$('projection-mounting-kit')?.addEventListener"),
("$('projection-placement-mode').addEventListener","$('projection-placement-mode')?.addEventListener"),
("$('projection-channel-model').addEventListener","$('projection-channel-model')?.addEventListener"),
("$('projection-channel-supply').addEventListener","$('projection-channel-supply')?.addEventListener"),
("$('projection-import').addEventListener","$('projection-import')?.addEventListener")
]: s=s.replace(old,new)

p.write_text(s)

# ---------- Mount visuals + screen frame uprights ----------
p=Path('projection/src/projection-layer.js')
s=p.read_text()

# Make structure key include mounting arrangement/projector positions.
old="const key = JSON.stringify([state.enclosure, state.diameter, state.viewableHeight, state.screenBottom]);"
new="const key = JSON.stringify([state.enclosure,state.diameter,state.viewableHeight,state.screenBottom,state.horizontalFov,state.mountingStyle,state.room?.height,state.layoutReady,(state.projectors||[]).map(p=>[p.position,p.yaw,p.pitch])]);"
if old not in s: raise SystemExit('structure key anchor missing')
s=s.replace(old,new,1)

# Insert visible frame uprights outside screen radius and mounting structures.
anchor="    const radius = state.diameter / 2;\n    const top = state.screenBottom + state.viewableHeight;\n"
addition="""    const radius = state.diameter / 2;
    const top = state.screenBottom + state.viewableHeight;
    // V16: visible screen-frame uprights live just outside the projection surface.
    const arc=state.horizontalFov*Math.PI/180;
    for(const u of [0,.333,.667,1]){
      const theta=(u-.5)*arc, rr=radius+.10;
      const x=rr*Math.sin(theta),z=-rr*Math.cos(theta),height=top+.10;
      addBox(structureGroup,[.045,height,.045],[x,height/2,z],railMaterial,'screen-frame-upright-outside-surface');
    }
    // Generic mounting visualisation derived from calculated lens positions.
    if(state.layoutReady&&(state.projectors||[]).length){
      const ps=state.projectors;
      if(state.mountingStyle==='truss'){
        const xs=ps.map(p=>p.position[0]),zs=ps.map(p=>p.position[2]);
        const xMin=Math.min(...xs)-.45,xMax=Math.max(...xs)+.45,z=zs.reduce((a,b)=>a+b,0)/zs.length;
        const trussY=Math.max(Math.max(...ps.map(p=>p.position[1]))+.25,(state.room?.height||4)-.35);
        addBox(structureGroup,[xMax-xMin,.14,.14],[(xMin+xMax)/2,trussY,z],railMaterial,'projector-truss-beam');
        for(const x of [xMin,xMax])addBox(structureGroup,[.10,trussY,.10],[x,trussY/2,z],railMaterial,'projector-truss-leg');
        for(const p of ps)addBox(structureGroup,[.035,Math.max(.05,trussY-p.position[1]),.035],[p.position[0],(trussY+p.position[1])/2,p.position[2]],railMaterial,'projector-truss-drop');
      }else{
        const ceiling=state.room?.height||4;
        for(const p of ps){
          const drop=Math.max(.08,ceiling-p.position[1]);
          addBox(structureGroup,[.035,drop,.035],[p.position[0],p.position[1]+drop/2,p.position[2]],railMaterial,'generic-ceiling-projector-drop');
          addBox(structureGroup,[.18,.025,.18],[p.position[0],ceiling-.012,p.position[2]],railMaterial,'generic-ceiling-projector-plate');
        }
      }
    }
"""
if anchor not in s: raise SystemExit('structure radius anchor missing')
s=s.replace(anchor,addition,1)

p.write_text(s)

# ---------- Styling ----------
p=Path('projection/guided.css')
s=p.read_text()
s += """
/* V16 simplified projector-requirement workflow. */
.led-shape-bar[data-guided-step="2"][hidden]{display:none!important}
#guided-required-spec{grid-template-columns:repeat(2,minmax(0,1fr))}
#projection-mounting-style{width:100%}
@media(max-width:700px){#guided-required-spec{grid-template-columns:1fr}}
"""
p.write_text(s)

# Rebuild.
subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v16.html')

# Guardrails.
main=Path('projection/main.html').read_text()
app=Path('projection/src/app.js').read_text()
layer=Path('projection/src/projection-layer.js').read_text()
guided=Path('projection/src/guided-planner.js').read_text()
assert 'Projector specification required' in main
assert 'projection-mounting-style' in main
assert 'guided-download-mounting' in main
assert 'projection-full-surround' in main
assert 'Floor-supported projector truss' in app
assert "state.mountingStyle==='truss'" in app
assert 'screen-frame-upright-outside-surface' in layer
assert 'projector-truss-beam' in layer
assert 'generic-ceiling-projector-drop' in layer
assert 'WUXGA or better' in guided
assert "summary.count+' × '+summary.modelName" not in guided
assert "summary.count+' projectors · '" in guided
print('V16 simplified brand-neutral projector requirement workflow checks passed')
