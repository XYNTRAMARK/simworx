import {createGuidedPlanner} from 'projection:/src/guided-planner.js';
import {createViewer} from 'projection:/src/led-viewer.js';
import {createProjectionLayer} from 'projection:/src/projection-layer.js';
import {createEyeControls} from 'projection:/assets/js/led/eye-controls.js';
import {pilotStations} from 'projection:/assets/js/led/pilot-view.js';
import {normalisePilotEyes} from 'projection:/assets/js/led/pilot-eyes.js';
import {formatLength,formatArea,lengthFactor,lengthSymbol} from 'projection:/assets/js/led/units.js';
import {computeFov} from 'projection:/src/optics.js';
import {dimensions} from 'projection:/src/screen-geometry.js';
import {createImportUI} from 'projection:/src/import-ui.js';
import {createAdminUI} from 'projection:/src/admin-ui.js';
import {convertCurrency} from 'projection:/src/pricing.js';

const $=id=>document.getElementById(id);
const all=selector=>Array.from(document.querySelectorAll(selector));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=value=>JSON.parse(JSON.stringify(value));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const percent=value=>finite(value)?(value<1&&value>.9995?'<100%':(value*100).toFixed(1)+'%'):'Not assessed';
const money=(amount,currency=state.currency)=>finite(amount)?new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:2}).format(amount):'Price to confirm';
const lengthKeys=new Set(['diameter','viewableHeight','screenBottom','simulatorWidth','simulatorHeight','simulatorDepth','simulatorX','simulatorY','simulatorZ']);
const savedKey='simworx.projection.config.v1';
let catalogue,reference,state,viewer,layer,eyeControls,quote=null,result=null,unit='metric',pilotSeat='primary',pilotMode=false,quoteTimer,quoteSerial=0,fineTimer;
let guided=null;
let customProfiles=[],initialising=true,geometryError=false,lastEnquiryKey=null;
function toast(message){const old=document.querySelector('.projection-toast');old?.remove();const node=document.createElement('div');node.className='projection-toast';node.setAttribute('role','status');node.textContent=message;document.body.append(node);setTimeout(()=>node.remove(),5000);}
function fail(error){$('projection-error').hidden=false;$('projection-error').textContent=error?.message||String(error);}
async function request(path,body){const response=await fetch(path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok||data.ok===false)throw new Error(data.error?.message||data.message||'The local request could not be completed.');return data;}
function profiles(){const base=Array.isArray(catalogue?.projectors)?catalogue.projectors:catalogue?.projectors?.projectors||[];return [...base,...customProfiles.filter(p=>!base.some(b=>b.id===p.id))];}
function profile(id){return profiles().find(p=>p.id===id);}
function syncSupply(){const choices=new Set(state.projectors.map(p=>p.supplyStatus==='simworx'?'simworx':'customer'));state.supplyStatus=choices.size===1?[...choices][0]:'mixed';}
function selected(){return state.projectors.find(p=>p.id===state.selectedProjector)||state.projectors[0];}
function screen(){return {radius:state.diameter/2,height:state.viewableHeight,bottom:state.screenBottom,arcDegrees:state.horizontalFov};}
function initialProjector(i,modelId='benq-lh600st'){const p=profile(modelId);return {id:'P'+(i+1),modelId,supplyStatus:'simworx',position:[(i-1)*1.3,3.15,1.15],yaw:0,pitch:0,roll:180,throwRatio:p?.throwRatio?.min??null,shiftX:0,shiftY:0,locked:false};}
function setSelected(id){state.selectedProjector=id;layer?.select(id,false);const label=$('projection-manual-selected');if(label)label.textContent=id;renderProjectorControls();}
function setPilot(value){pilotMode=value===true&&state.showSimulator;$('led-pilot-view').checked=pilotMode;viewer?.setPilotView(pilotMode,pilotSeat);eyeControls?.refresh();layer?.update();}

function syncInputs(){
  const factor=lengthFactor(unit);
  for(const input of all('[data-led-number],[data-led-range]')){
    const key=input.dataset.ledNumber||input.dataset.ledRange;
    if(!finite(state[key]))continue;
    const scaled=state[key]*(lengthKeys.has(key)?factor:1);
    if(!input.dataset.metresMin){input.dataset.metresMin=input.min;input.dataset.metresMax=input.max;input.dataset.metresStep=input.step;}
    if(lengthKeys.has(key)){input.min=Number(input.dataset.metresMin)*factor;input.max=Number(input.dataset.metresMax)*factor;if(input.type==='range')input.step=Number(input.dataset.metresStep)*factor;}
    if(document.activeElement!==input)input.value=String(Number(scaled.toFixed(4)));
    input.setAttribute('aria-valuetext',lengthKeys.has(key)?formatLength(state[key],unit):state[key]+' degrees');
  }
  all('[data-unit-for]').forEach(n=>n.textContent=lengthKeys.has(n.dataset.unitFor)?lengthSymbol(unit):'°');
  all('#led-simulator-controls .led-control-head').forEach(n=>{const input=n.querySelector('label')?.htmlFor;const span=n.querySelector('span');if(span)span.textContent=input?.includes('Yaw')?'°':lengthSymbol(unit);});
  all('[data-position-unit]').forEach(n=>n.textContent=lengthSymbol(unit));
  $('led-showSimulator').checked=state.showSimulator;
  $('led-simulatorType').disabled=!state.showSimulator;
  $('led-simulatorType').value=state.simulatorType;
  $('led-simulator-controls').hidden=!state.showSimulator;
  $('led-simulator-adjust').hidden=!state.showSimulator;
  $('led-pilot-settings').hidden=!state.showSimulator;
  $('led-pilot-view').disabled=!state.showSimulator;
  $('projection-ghost').disabled=!state.showSimulator;
  $('projection-ghost').checked=state.ghostCockpit;
  const hint=$('led-simulator-reference').querySelector('p');
  if(hint)hint.textContent=state.showSimulator?'Move the same cockpit model used by the LED configurator.':'Enable “Add simulator” in the 3D preview to position your cockpit.';
  const seats=pilotStations(state,reference);
  $('led-pilot-seat').replaceChildren(...seats.map((s,i)=>new Option(s.label,i?'secondary':'primary')));
  if(seats.length===1)pilotSeat='primary';
  $('led-pilot-seat').value=pilotSeat;
  $('led-pilot-seat').disabled=seats.length===1;
  all('[name=projection-enclosure]').forEach(n=>n.checked=n.value===state.enclosure);
  all('[name=projection-material]').forEach(n=>n.checked=n.value===state.material);
  $('projection-count').value=state.projectorCount;
  $('projection-supply').value=state.supplyStatus;
  $('projection-currency').value=state.currency;
  const kitIncluded=(catalogue?.commercial?.mountingKit?.includedIn||[]).includes(state.enclosure);if(kitIncluded)state.mountingKit=true;$('projection-mounting-kit').checked=state.mountingKit;$('projection-mounting-kit').disabled=kitIncluded;
  all('[name=projection-warp]').forEach(n=>n.checked=n.value===state.servicePlan);
  for(const [id,key] of [['coverage','showCoverage'],['shadows','showShadows'],['frusta','showFrusta'],['structure','showStructure']])$('projection-'+id).checked=state[key];
  $('projection-placement-mode').value=state.placementMode;
  $('projection-room-enabled').checked=state.room.enabled;
  if(!finite(state.room.screenFromLeft))state.room.screenFromLeft=state.room.width/2;
  if(!finite(state.room.screenFromFront))state.room.screenFromFront=state.room.depth/2;
  all('[data-room]').forEach(n=>{if(!n.dataset.metresMin){n.dataset.metresMin=n.min;n.dataset.metresMax=n.max;}n.min=Number(n.dataset.metresMin)*factor;const key=n.dataset.room,maxMetres=key==='screenFromLeft'?state.room.width:key==='screenFromFront'?state.room.depth:Number(n.dataset.metresMax);n.max=maxMetres*factor;n.step='any';if(document.activeElement!==n)n.value=Number((state.room[key]*factor).toFixed(3));});
  const roomOffsetX=state.room.width/2-state.room.screenFromLeft,roomOffsetZ=state.room.depth/2-state.room.screenFromFront;
  const roomX=$('projection-room-offset-x'),roomZ=$('projection-room-offset-z');
  if(roomX){roomX.min=(-state.room.width/2*factor).toFixed(3);roomX.max=(state.room.width/2*factor).toFixed(3);if(document.activeElement!==roomX)roomX.value=(roomOffsetX*factor).toFixed(3);$('projection-room-offset-x-value').textContent=formatLength(roomOffsetX,unit);}
  if(roomZ){roomZ.min=(-state.room.depth/2*factor).toFixed(3);roomZ.max=(state.room.depth/2*factor).toFixed(3);if(document.activeElement!==roomZ)roomZ.value=(roomOffsetZ*factor).toFixed(3);$('projection-room-offset-z-value').textContent=formatLength(roomOffsetZ,unit);}
  const manualViewer=$('projection-manual-viewer');if(manualViewer)manualViewer.checked=state.manualPlacement===true;
  const manualTools=$('projection-manual-viewer-tools');if(manualTools)manualTools.hidden=state.manualPlacement!==true;
  const manualSelected=$('projection-manual-selected');if(manualSelected)manualSelected.textContent=state.selectedProjector||'P1';
  $('projection-notes').value=state.notes||'';
  $('projection-enclosure-note').textContent=state.enclosure==='screen-only'?'Screen and frame only. Add a Mounting kit for projector hardware.':state.enclosure==='semi-enclosed'?'The semi enclosed screen carries its projector support structure. The Mounting kit adds projector hardware once.':'Screen, support structure and surrounding enclosure. Panels are schematic until your STEP assembly is supplied.';
  const material=catalogue.commercial.materials[state.material];
  state.materialGain=finite(material?.gain)?material.gain:null;
  $('projection-material-note').textContent=(material?.label||'Screen material')+' · '+(state.materialGain!==null?'Declared gain '+state.materialGain+'.':'Gain and optical surface properties await approval.')+' Material prices and fabrication rules are managed in the development catalogue.';
  renderProjectorControls();
  const d=dimensions(state);
  $('led-readout-diameter').textContent=formatLength(d.diameter,unit);
  $('led-readout-height').textContent=formatLength(d.viewableHeight,unit);
  $('led-readout-overall').textContent=formatLength(d.overallHeight,unit);
  $('led-readout-fov').textContent=state.horizontalFov+'°';
  $('led-readout-area').textContent=formatArea(d.area,unit);
  if(state.showSimulator){const station=seats[pilotSeat==='secondary'?1:0],fov=computeFov(station.eye,screen());$('projection-pilot-fov').textContent=station.label+' · geometric screen extent '+fov.horizontalDegrees.toFixed(1)+'° horizontal / '+fov.verticalDegrees.toFixed(1)+'° vertical. Cockpit-obstructed pilot visibility is a separate check.';}
  else $('projection-pilot-fov').textContent='Add your simulator to inspect the screen from the original pilot eye system.';
  renderSpecification();renderFlags();
  eyeControls?.refresh();guided?.render();
}
function update({geometry=true,price=true,fine=false}={}){
  guided?.changed();
  state.overallHeight=state.screenBottom+state.viewableHeight;state.geometry='curved';state.projectorCount=state.projectors.length;
  syncInputs();
  if(geometry&&!geometryError){viewer?.update(state);layer?.update({fine});}
  if(price)queueQuote();
}

function renderProjectorControls(){
  if(!state)return;
  $('projection-channel-tabs').replaceChildren(...state.projectors.map(p=>{const b=document.createElement('button');b.type='button';b.textContent=p.id;b.setAttribute('aria-pressed',String(p.id===state.selectedProjector));b.setAttribute('aria-label','Select projector '+p.id);b.addEventListener('click',()=>setSelected(p.id));return b;}));
  const p=selected(),model=profile(p.modelId),select=$('projection-channel-model');
  if(select.options.length!==profiles().length||!Array.from(select.options).some(o=>o.value===p.modelId))select.replaceChildren(...profiles().map(p=>new Option((p.displayName||[p.manufacturer,p.model].filter(Boolean).join(' ')),p.id)));
  select.value=p.modelId;
  $('projection-channel-supply').value=p.supplyStatus==='simworx'?'simworx':'customer';
  for(const n of all('[data-position]')){if(document.activeElement!==n)n.value=Number((p.position[Number(n.dataset.position)]*lengthFactor(unit)).toFixed(3));n.disabled=p.locked;}
  for(const n of all('[data-aim]')){if(document.activeElement!==n)n.value=Number(p[n.dataset.aim].toFixed(2));n.disabled=p.locked;}
  const min=model?.throwRatio?.min,max=model?.throwRatio?.max;
  $('projection-throw').disabled=p.locked||!finite(min)||!finite(max)||max===min;
  if(finite(min)&&finite(max)){$('projection-throw').min=min;$('projection-throw').max=max;$('projection-throw').value=p.throwRatio??min;}
  $('projection-throw-limits').textContent=finite(min)&&finite(max)?'('+min+'–'+max+')':'(unknown)';
  $('projection-throw-value').textContent=finite(p.throwRatio)?p.throwRatio.toFixed(3):'Unknown';
  $('projection-locked').checked=p.locked;
  $('projection-placement-status').textContent=(model?.planningWarnings?.[1]||model?.planningWarnings?.[0]||'Customer-supplied projector data must be reviewed.')+' Optical lens shift is held at zero until its supported range is documented.';
}
function renderCatalogue(){
  $('projection-materials').replaceChildren(...Object.entries(catalogue.commercial.materials).map(([id,m])=>{const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='projection-material';input.value=id;input.checked=id===state.material;input.addEventListener('change',()=>{state.material=id;update();});label.append(input,document.createTextNode(m.label));return label;}));
  $('projection-projector-cards').replaceChildren(...profiles().map(p=>{
    const card=document.createElement('article');card.className='projection-projector-card';card.dataset.selected=String(state.projectors.every(x=>x.modelId===p.id));
    const name=p.displayName||[p.manufacturer,p.model].filter(Boolean).join(' ');
    const tr=p.throwRatio,br=p.brightness;
    card.innerHTML='<span class="projection-tier">'+esc(p.tierLabel||'Your projector')+'</span><h3>'+esc(name)+'</h3><div class="projection-projector-icon"><svg viewBox="0 0 120 70" fill="none" aria-hidden="true"><path d="M17 23L32 10h60l13 14v32H17z" fill="#dce3e8" stroke="#81909d" stroke-width="1.5"/><path d="M17 24h88M32 10l1 14m59-14l-1 14" stroke="#81909d"/><rect x="25" y="32" width="28" height="15" rx="2" fill="#b0bec9"/><path d="M29 35h20m-20 4h20m-20 4h20" stroke="#7b8b98"/><circle cx="83" cy="40" r="11" fill="#263e54"/><circle cx="83" cy="40" r="7" fill="#6ea0bd"/><circle cx="81" cy="38" r="3" fill="#b6d5e5"/><path d="M22 57v3m77-3v3" stroke="#81909d" stroke-width="3"/></svg></div><dl><div><dt>Light source</dt><dd>'+esc(p.lightSource||'Unknown')+'</dd></div><div><dt>Throw ratio</dt><dd>'+esc(finite(tr?.min)?tr.min+'–'+tr.max:'Unknown')+'</dd></div><div><dt>Native image</dt><dd>'+esc(p.resolution?.width?p.resolution.width+' × '+p.resolution.height:'Unknown')+'</dd></div><div><dt>Declared output</dt><dd>'+esc(finite(br?.lumens)?br.lumens.toLocaleString()+' '+(br.basis||'lumens'):'Unknown')+'</dd></div></dl><p>'+esc(money(convertCurrency(catalogue.commercial.projectorPricesEur[p.id]??null,'EUR',state.currency,catalogue.ledTariff)))+' per projector · candidate model</p><details><summary>Specification evidence &amp; limits</summary><ul>'+(p.planningWarnings||[]).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul><div class="projection-sources"></div></details>';
    const sources=card.querySelector('.projection-sources');for(const source of p.sources||[]){try{const url=new URL(source.url);if(!['http:','https:'].includes(url.protocol))continue;const a=document.createElement('a');a.href=url.href;a.textContent=source.title||'Specification source';a.target='_blank';a.rel='noopener noreferrer';sources.append(a,document.createElement('br'));}catch{}}
    const button=document.createElement('button');button.type='button';button.className='led-button '+(state.projectors.every(x=>x.modelId===p.id)?'led-primary':'led-outline');button.textContent=state.projectors.every(x=>x.modelId===p.id)?'Selected for all projectors':'Use for all projectors';button.addEventListener('click',()=>{for(const channel of state.projectors){channel.modelId=p.id;channel.throwRatio=p.throwRatio?.min??null;channel.shiftX=0;channel.shiftY=0;}renderCatalogue();update();toast('Model changed. Your projector positions have been preserved; check coverage or suggest a new starting arrangement.');});card.append(button);return card;
  }));
  $('projection-warp-options').replaceChildren(...catalogue.ledTariff.servicePlans.map(plan=>{const label=document.createElement('label');label.className='projection-warp-option';const input=document.createElement('input');input.type='radio';input.name='projection-warp';input.value=plan.id;input.checked=state.servicePlan===plan.id;input.addEventListener('change',()=>{state.servicePlan=plan.id;update({geometry:false});});const text=document.createElement('span');const strong=document.createElement('strong');strong.textContent=plan.label||plan.name||plan.quoteLabel;const small=document.createElement('small');small.textContent=plan.description||plan.note||'';text.append(strong,small);const price=document.createElement('b');price.textContent=money(convertCurrency(plan.rate.amount,plan.rate.currency,state.currency,catalogue.ledTariff));label.append(input,text,price);return label;}));
  $('projection-kit-price').textContent=(catalogue.commercial.mountingKit.includedIn||[]).includes(state.enclosure)?'Included':money(convertCurrency(catalogue.commercial.mountingKit.priceEur,'EUR',state.currency,catalogue.ledTariff));
}
function specificationRows(){
  const d=dimensions(state),model=reference.simulatorReferences.find(m=>m.id===state.simulatorType);
  return [
    ['Enclosure',catalogue.commercial.enclosures[state.enclosure]?.label||state.enclosure],
    ['Screen material',catalogue.commercial.materials[state.material]?.label||state.material],
    ['Diameter / arc',formatLength(state.diameter,unit)+' / '+state.horizontalFov+'°'],
    ['Viewable height / floor clearance',formatLength(state.viewableHeight,unit)+' / '+formatLength(state.screenBottom,unit)],
    ['Active projection area',formatArea(d.area,unit)],
    ['Projectors',state.projectorCount+' · '+state.projectors.map(p=>p.id+': '+(profile(p.modelId)?.model||p.modelId)).join(' · ')],
    ['Projector supply',state.supplyStatus==='simworx'?'Simworx supply':state.supplyStatus==='mixed'?'Mixed · defined per projector':'Customer supplied'],
    ['Mounting kit',state.mountingKit?'One kit per installation':'Customer supplied / not selected'],
    ['Cockpit',state.showSimulator?model.label:'Not added'],
    ['Pilot eye',state.showSimulator?pilotStations(state,reference)[pilotSeat==='secondary'?1:0].eye.map(x=>formatLength(x,unit)).join(' / '):'Not assessed'],
    ['Coverage estimate',result?.stats?percent(result.stats.coverage)+' light reaches · '+percent(result.stats.fullyShadowedFraction)+' fully blocked':'Not yet assessed'],
    ['Warping package',catalogue.ledTariff.servicePlans.find(p=>p.id===state.servicePlan)?.quoteLabel||state.servicePlan],
    ['Catalogue',catalogue.commercial.catalogueVersion],
    ['Project notes',state.notes||'None supplied']
  ];
}
function renderSpecification(){$('led-specification').innerHTML=specificationRows().map(([a,b])=>'<div><dt>'+esc(a)+'</dt><dd>'+esc(b)+'</dd></div>').join('');}
function technicalWarnings(){
  const warnings=['Screen frame, enclosure and support rails remain schematic until the supplied STEP assemblies are integrated.','Projector catalogue entries are candidate profiles; exact lens-to-body origins and curved-surface focus require review.'];
  if(result?.stats){
    if(result.stats.uncoveredFraction>0)warnings.push(percent(result.stats.uncoveredFraction)+' of the sampled screen has no projector footprint.');
    if(result.stats.fullyShadowedFraction>0)warnings.push(percent(result.stats.fullyShadowedFraction)+' of the screen is fully blocked by the physical cockpit or structure.');
    if(result.stats.partialShadowedFraction>0)warnings.push(percent(result.stats.partialShadowedFraction)+' of the screen loses one or more overlapping channels.');
    if(result.stats.boundaryGaps>0)warnings.push('The screen perimeter has uncovered sample points. A high area percentage does not establish full edge coverage.');
  }
  for(const p of state.projectors){
    const spec=profile(p.modelId);if(!spec){warnings.push(p.id+': projector profile is missing.');continue;}
    const pitchLimit=spec.installation?.maxPitchFromLevelDeg;
    if(finite(pitchLimit)&&Math.abs(p.pitch)>pitchLimit)warnings.push(p.id+': pitch exceeds the documented '+pitchLimit+'° installation limit.');
    if(state.room.enabled&&(Math.abs(p.position[0])>state.room.width/2||Math.abs(p.position[2])>state.room.depth/2||p.position[1]<0||p.position[1]>state.room.height))warnings.push(p.id+': lens position is outside the room guide.');
    if(spec.opticalOffset?.conflict)warnings.push(p.id+': official offset sources conflict. The manual-derived preview needs confirmation.');
    if(!finite(spec.opticalOffset?.normalizedCenterOffsetImageHeights)||!finite(p.throwRatio)||!spec.resolution?.aspectWidth)warnings.push(p.id+': missing optical values prevent a complete assessment.');
  }
  if(state.room.enabled){if(state.diameter>state.room.width||state.diameter/2>state.room.depth/2||state.overallHeight>state.room.height)warnings.push('The screen extends beyond the entered room guide.');}
  if(!state.showSimulator)warnings.push('No cockpit is included. Add your cockpit to assess its shadows.');
  if(state.materialGain===null)warnings.push('Screen gain is unknown; no luminance estimate is claimed.');
  if(state.placementMode==='mounted')warnings.push('Mounting positions use a schematic rail envelope; actual brackets, load capacity and movement limits await STEP data.');
  for(const c of result?.channels||[])warnings.push(...c.warnings.map(w=>c.id+': '+w));
  return [...new Set(warnings)];
}
function renderFlags(){$('projection-review-flags').replaceChildren(...technicalWarnings().map(w=>{const li=document.createElement('li');li.textContent=w;return li;}));}
function onOpticalResult(next){
  result=next;
  $('projection-coverage-metric').textContent=percent(next.stats?.coverage);
  $('projection-shadow-metric').textContent=percent(next.stats?.fullyShadowedFraction);
  $('projection-overlap-metric').textContent=percent(next.stats?.overlapFraction);
  const status=$('projection-calculation-status'),unassessed=!next.stats||next.channels?.every(c=>!c.canCalculate);
  status.dataset.level=unassessed?'error':'partial';
  status.textContent=unassessed?'Optical assessment unavailable. Complete the projector throw, aspect ratio and image-centre offset.':'Sampled planning estimate · '+next.columns+' × '+next.rows+' cells. '+(next.stats.uncoveredFraction>0?'Coverage gaps remain. ':'')+(next.stats.fullyShadowedFraction>0?'Physical shadows remain. ':'')+'Projector optics and STEP geometry still require approval.';
  const map=$('projection-map'),ctx=map.getContext('2d');ctx.clearRect(0,0,map.width,map.height);
  const colors=['#1766b2','#188a71','#8c59c5'];
  for(const cell of next.cells||[]){const lit=cell.contributions.filter(p=>p.usable);ctx.fillStyle=cell.classification==='shadow'?'#db423d':cell.classification==='partial-shadow'?'#e5a433':cell.classification==='overlap'?'#2cbac0':lit.length?colors[lit[0].index%3]:'#a6afb9';ctx.fillRect(cell.column*map.width/next.columns,map.height-(cell.row+1)*map.height/next.rows,Math.ceil(map.width/next.columns),Math.ceil(map.height/next.rows));}
  $('projection-channel-results').replaceChildren(...(next.channels||[]).map(channel=>{const div=document.createElement('div');div.className='projection-channel-result';const label=document.createElement('strong');label.textContent=channel.id+' · '+(profile(state.projectors[channel.index]?.modelId)?.model||'Custom');const readout=document.createElement('span');readout.textContent=channel.distanceRange?'Lens-to-screen '+channel.distanceRange.map(d=>formatLength(d,unit)).join('–'):'No assessable footprint';div.append(label,readout);return div;}));
  const brightness=next.brightness;
  $('projection-brightness').textContent=finite(brightness?.meanFootLamberts)?'Indicative average '+brightness.meanFootLamberts.toFixed(1)+' fL / '+brightness.meanNits.toFixed(1)+' cd/m². Declared output, uniform raster and configured gain; calibrated brightness, ambient contrast and real screen directionality are not verified.':'Brightness not assessed: documented diffuse-screen gain and compatible light-output data are required.';
  $('projection-overlap-details').textContent=(next.overlaps||[]).map(pair=>'P'+(pair.indices[0]+1)+' / P'+(pair.indices[1]+1)+': '+(pair.fullHeight?'overlap spans every sampled row':'overlap does not span the full height')+', row fractions '+percent(pair.minimumRowFraction)+'–'+percent(pair.maximumRowFraction)).join('. ')+'. Blend suitability awaits the approved warping overlap requirement.';
  renderSpecification();renderFlags();guided?.onResult(next);
}
function queueQuote(){clearTimeout(quoteTimer);const serial=++quoteSerial;$('led-running-title').textContent='Updating configuration estimate';quoteTimer=setTimeout(()=>refreshQuote(serial),120);}
function localQuote(){
  const d=dimensions(state),commercial=catalogue.commercial,lines=[],missing=[],eur=v=>convertCurrency(v,'EUR',state.currency,catalogue.ledTariff);
  const screenRate=Number(commercial.fabrication?.screenSystemPerM2Eur||0);
  const screenPriceEur=d.area*screenRate;
  lines.push({id:'screen-system',label:'Curved projection screen & frame',amount:eur(screenPriceEur),status:'priced'});
  const enclosure=commercial.enclosures?.[state.enclosure];
  const enclosureAmount=Number(enclosure?.fixedEur||0);
  if(enclosureAmount>0)lines.push({id:'enclosure',label:enclosure.label,amount:eur(enclosureAmount),status:'priced'});
  const kitIncluded=(commercial.mountingKit?.includedIn||[]).includes(state.enclosure);
  if(state.mountingKit){
    lines.push({id:'mounting-kit',label:'Projector mounting kit',amount:kitIncluded?0:eur(Number(commercial.mountingKit?.priceEur??0)),status:kitIncluded?'included':'priced'});
  }
  for(const channel of state.projectors){
    if(channel.supplyStatus!=='simworx'){lines.push({id:'projector-'+channel.id,label:channel.id+' · '+(profile(channel.modelId)?.displayName||profile(channel.modelId)?.model||channel.modelId),amount:0,status:'customer-supplied'});continue;}
    const value=commercial.projectorPricesEur?.[channel.modelId];
    if(finite(value)&&value>0)lines.push({id:'projector-'+channel.id,label:channel.id+' · '+(profile(channel.modelId)?.displayName||profile(channel.modelId)?.model||channel.modelId),amount:eur(value),status:'priced'});
    else{lines.push({id:'projector-'+channel.id,label:channel.id+' · '+(profile(channel.modelId)?.displayName||profile(channel.modelId)?.model||channel.modelId),amount:null,status:'pending'});missing.push((profile(channel.modelId)?.displayName||channel.modelId)+' selling price');}
  }
  const plan=catalogue.ledTariff.servicePlans.find(p=>p.id===state.servicePlan);
  if(plan)lines.push({id:'warping',label:plan.quoteLabel||plan.label,amount:convertCurrency(plan.rate.amount,plan.rate.currency,state.currency,catalogue.ledTariff),status:'priced'});
  const knownSubtotal=lines.reduce((sum,l)=>sum+(finite(l.amount)?l.amount:0),0);
  const complete=!missing.length;
  return {reference:'SWX-PROJ-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),date:new Date().toISOString(),catalogueVersion:commercial.catalogueVersion,status:complete?'complete':'partial',lineItems:lines,knownSubtotal,total:complete?knownSubtotal:null,tax:null,delivery:null,missing,errors:[]};
}
async function refreshQuote(serial=++quoteSerial){
  const next=localQuote();if(serial!==quoteSerial)return;quote=next;renderQuote();
}
function renderQuote(){
  if(!quote)return;
  const partial=quote.status!=='complete';
  $('led-running-title').textContent=partial?'Current screen & configured options':'Configuration estimate';
  const knownCharge=quote.lineItems.some(l=>finite(l.amount)&&l.amount>0);
  const value=partial?(knownCharge?money(quote.knownSubtotal)+' + projector price to confirm':'Awaiting approved prices'):money(quote.total);
  $('led-running-total').textContent=value;$('led-estimate').textContent=value;
  $('led-running-note').textContent=partial?'Screen, enclosure and warping update live. Selected Simworx projector prices still need confirmation.':'Screen, enclosure, mounting and selected warping included. Delivery and VAT are additional.';
  $('led-price-status').textContent=quote.errors.length?quote.errors.join(' '):partial?'The screen and selected options are priced. Any unpriced projector remains clearly separated from this total.':'Indicative configuration price. Final projector suitability, delivery and VAT are confirmed before order.';
  $('led-price-lines').innerHTML=quote.lineItems.filter(l=>l.id!=='enclosure-area'||state.enclosure!=='screen-only').map(line=>'<div><dt>'+esc(line.label)+(line.status==='customer-supplied'?' <small>· customer supplied</small>':line.status==='included'?' <small>· included</small>':'')+'</dt><dd class="'+(line.amount===null?'projection-missing-price':'')+'">'+esc(line.amount===null?'To confirm':money(line.amount))+'</dd></div>').join('')+'<div><dt>Tax</dt><dd>'+esc(quote.tax===null?'To confirm':money(quote.tax))+'</dd></div><div><dt>Delivery</dt><dd>'+esc(quote.delivery===null?'To confirm':money(quote.delivery))+'</dd></div>';
  $('projection-quote-missing').innerHTML=quote.missing.length?'<details><summary>'+quote.missing.length+' pricing inputs or approvals still needed</summary><ul>'+quote.missing.map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul></details>':'';
  $('projection-quote-reference').textContent=quote.reference+' · '+quote.catalogueVersion+' · Warping prices match the LED configurator tariff.';
}

function validateLoaded(data){
  if(data?.format!=='simworx-projection-configuration'||data.version!==1)throw new Error('Choose a version 1 Simworx projection configuration.');
  const s=data.configuration;if(!s||s.geometry!=='curved'||![2,3].includes(s.projectors?.length))throw new Error('Only cylindrical projection configurations with two or three projectors can be loaded.');
  for(const [k,min,max] of [['diameter',.5,50],['viewableHeight',.1,20],['screenBottom',0,10],['horizontalFov',1,359],['simulatorWidth',.1,50],['simulatorDepth',.1,50],['simulatorHeight',.1,50],['simulatorX',-50,50],['simulatorY',0,50],['simulatorZ',-50,50],['simulatorYaw',-180,180]])if(!finite(s[k])||s[k]<min||s[k]>max)throw new Error('Invalid saved '+k+'.');
  if(!catalogue.commercial.enclosures[s.enclosure]||!catalogue.commercial.materials[s.material]||!reference.simulatorReferences.some(r=>r.id===s.simulatorType))throw new Error('This file refers to a screen or cockpit option outside the current catalogue.');
  if(!['EUR','USD','GBP'].includes(s.currency)||!catalogue.ledTariff.servicePlans.some(p=>p.id===s.servicePlan))throw new Error('Unknown currency or warping package.');
  s.pilotEyes=normalisePilotEyes(s.pilotEyes,reference);
  const customs=Array.isArray(data.customProfiles)?data.customProfiles.slice(0,20):[];
  for(const p of s.projectors){if(!Array.isArray(p.position)||p.position.length!==3||!p.position.every(v=>finite(v)&&Math.abs(v)<=100)||!['yaw','pitch','roll'].every(k=>finite(p[k])&&Math.abs(p[k])<=360))throw new Error('Invalid saved projector transform.');if(!profiles().some(m=>m.id===p.modelId)&&!customs.some(m=>m.id===p.modelId))throw new Error('A saved projector profile is missing.');}
  return {configuration:s,customProfiles:customs};
}
function savePayload(){return {format:'simworx-projection-configuration',version:1,savedAt:new Date().toISOString(),configuration:clone(state),customProfiles:clone(customProfiles),catalogueVersion:catalogue.commercial.catalogueVersion,sourceVersion:reference.source.sha256,quoteSnapshot:quote};}
function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function save(){const data=savePayload(),text=JSON.stringify(data,null,2);try{localStorage.setItem(savedKey,text);}catch{}download('Simworx_Projection_Configuration.json',text);$('projection-profile-status').textContent='Saved locally and downloaded with projector and pilot positions.';}
function specificationDocument(){
  const rows=specificationRows(),lines=quote?.lineItems||[];
  return '<!doctype html><html><head><meta charset="utf-8"><title>Simworx Projection Specification</title><style>body{font:14px Arial;max-width:900px;margin:40px auto;color:#20262c}h1{font-size:28px}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{width:40%}.price{text-align:right}small{color:#667}</style></head><body><h1>Simworx Projection System Specification</h1><p>'+esc(quote?.reference||'Planning configuration')+'</p><table>'+rows.map(([a,b])=>'<tr><th>'+esc(a)+'</th><td>'+esc(b)+'</td></tr>').join('')+'</table><h2>Commercial estimate</h2><table>'+lines.map(l=>'<tr><td>'+esc(l.label)+'</td><td class="price">'+esc(l.amount===null?'To confirm':money(l.amount))+'</td></tr>').join('')+'<tr><th>Known subtotal</th><td class="price">'+esc(money(quote?.knownSubtotal||0))+'</td></tr></table><p><small>Planning specification. Final projector suitability, delivery, VAT and installation details are confirmed before order.</small></p></body></html>';
}
function downloadSpecification(){if(!quote)quote=localQuote();download('Simworx_Projection_Specification_'+(quote.reference||'planning')+'.html',specificationDocument(),'text/html');}
function proposalEmailText(){
 const rows=specificationRows().map(([a,b])=>a+': '+b).join('\n');
 const prices=(quote?.lineItems||[]).map(l=>l.label+': '+(l.amount===null?'To confirm':money(l.amount))).join('\n');
 return 'Simworx Projection System Proposal\n\n'+(quote?.reference||'')+'\n\nSPECIFICATION\n'+rows+'\n\nPRICING\n'+prices+'\n\nKnown subtotal: '+money(quote?.knownSubtotal||0)+'\n\nFinal projector suitability, delivery and VAT are confirmed before order.';
}

function loadPayload(data){const loaded=validateLoaded(data);customProfiles=loaded.customProfiles;state={...state,...loaded.configuration,projectorCount:loaded.configuration.projectors.length};state.selectedProjector=state.projectors[0].id;state.room={enabled:true,width:7,depth:6,height:4,screenFromLeft:3.5,screenFromFront:3,...state.room};state.guidedStep=4;state.layoutReady=state.layoutReady===true;state.layoutDirty=true;guided?.restore();setPilot(false);renderCatalogue();update();$('projection-profile-status').textContent='Configuration restored. Prices recalculated with the current development catalogue.';}
async function printQuote(){
  clearTimeout(quoteTimer);await refreshQuote();if(!quote){toast('A current quote response is needed before printing.');return;}
  layer?.select(null,false);
  const views=viewer?.captureViews()||[],warnings=technicalWarnings();
  layer?.select(state.selectedProjector,false);
  $('projection-print-document').innerHTML='<h1>Simworx · Projection system</h1><p>'+esc(quote.reference)+' · '+esc(new Date(quote.date).toLocaleDateString('en-GB'))+'<br>Catalogue '+esc(quote.catalogueVersion)+'</p><p class="print-notice"><strong>Development planning estimate.</strong> '+(quote.status==='complete'?'Commercial total '+esc(money(quote.total))+'.':'Incomplete price: '+esc(money(quote.knownSubtotal))+' of items currently priced. This is not the total system price.')+' Screen STEP geometry and final optics await approval.</p><h2>Configuration</h2><table>'+specificationRows().map(([a,b])=>'<tr><th>'+esc(a)+'</th><td>'+esc(b)+'</td></tr>').join('')+'</table><h2>Projector positions</h2><table><tr><th>Channel</th><th>Lens X / Y / Z</th><th>Yaw / pitch / roll</th><th>Throw</th></tr>'+state.projectors.map(p=>'<tr><td>'+esc(p.id)+'</td><td>'+p.position.map(x=>esc(formatLength(x,unit))).join(' / ')+'</td><td>'+[p.yaw,p.pitch,p.roll].map(x=>x.toFixed(1)+'°').join(' / ')+'</td><td>'+esc(p.throwRatio)+'</td></tr>').join('')+'</table><h2>Views</h2><div class="print-views">'+views.map(v=>'<figure><img src="'+v.data+'" alt="'+esc(v.caption)+'"><figcaption>'+esc(v.caption)+'</figcaption></figure>').join('')+'<figure><img src="'+$('projection-map').toDataURL()+'" alt="Unwrapped coverage map"><figcaption>Unwrapped coverage · blue/green/purple channels, cyan overlap, red fully blocked, amber partly blocked, grey uncovered.</figcaption></figure></div><h2>Commercial estimate</h2><table>'+quote.lineItems.map(l=>'<tr><td>'+esc(l.label)+'</td><td>'+esc(l.amount===null?'To confirm':money(l.amount))+'</td></tr>').join('')+'<tr><th>Known subtotal</th><td>'+esc(money(quote.knownSubtotal))+'</td></tr><tr><th>Tax / delivery</th><td>'+esc(quote.tax===null?'To confirm':money(quote.tax))+' / '+esc(quote.delivery===null?'To confirm':money(quote.delivery))+'</td></tr><tr><th>Total</th><td>'+esc(quote.total===null?'Incomplete — additional prices required':money(quote.total))+'</td></tr></table><h2>Items awaiting price or approval</h2><ul>'+quote.missing.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul><h2>Technical review</h2><ul>'+warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul><p>Original LED cockpit and pilot system. Warping prices are a read-only snapshot of the LED configurator. Geometry and photometry are sampled planning estimates, not an engineering approval.</p>';
  window.print();
}

function wire(){
  all('[data-reference-link]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();toast('This separate preview keeps the existing website unchanged.');}));
  all('[data-led-number],[data-led-range]').forEach(input=>input.addEventListener('input',()=>{
    const key=input.dataset.ledNumber||input.dataset.ledRange;const value=Number(input.value)/(lengthKeys.has(key)?lengthFactor(unit):1);
    if(input.value===''||!finite(value))return;
    const min=Number(input.min)/(lengthKeys.has(key)?lengthFactor(unit):1),max=Number(input.max)/(lengthKeys.has(key)?lengthFactor(unit):1);
    if(value<min||value>max){input.setCustomValidity('Enter a value within the displayed preview range.');return;}input.setCustomValidity('');state[key]=value;update();
  }));
  $('led-dimension-unit').addEventListener('change',e=>{unit=e.target.value;syncInputs();if(result)onOpticalResult(result);});
  all('[name=projection-enclosure]').forEach(n=>n.addEventListener('change',()=>{state.enclosure=n.value;if((catalogue.commercial.mountingKit.includedIn||[]).includes(state.enclosure))state.mountingKit=true;update();}));
  $('led-showSimulator').addEventListener('change',e=>{state.showSimulator=e.target.checked;if(!state.showSimulator)setPilot(false);update();});
  $('led-simulatorType').addEventListener('change',e=>{state.simulatorType=e.target.value;$('led-cockpit-size').open=false;Object.assign(state,reference.simulatorReferences.find(r=>r.id===e.target.value).exampleDimensions);pilotSeat='primary';update();});
  $('led-reset-cockpit-size').addEventListener('click',()=>{const original=reference.simulatorReferences.find(r=>r.id===state.simulatorType).exampleDimensions;for(const key of ['simulatorWidth','simulatorHeight','simulatorDepth'])state[key]=original[key];$('led-cockpit-reset-status').textContent='Original cockpit dimensions restored.';update();});
  $('led-pilot-view').addEventListener('change',e=>setPilot(e.target.checked));
  $('led-pilot-seat').addEventListener('change',e=>{pilotSeat=e.target.value;viewer?.setPilotView(pilotMode,pilotSeat);syncInputs();});
  $('led-runway-view').addEventListener('change',async e=>{if(e.target.checked){state.showCoverage=false;$('projection-coverage').checked=false;}await viewer?.setRunwayVisible(e.target.checked);layer?.update();});
  $('projection-ghost').addEventListener('change',e=>{state.ghostCockpit=e.target.checked;update({price:false});});
  for(const [id,key] of [['coverage','showCoverage'],['shadows','showShadows'],['frusta','showFrusta'],['structure','showStructure']])$('projection-'+id).addEventListener('change',e=>{state[key]=e.target.checked;if(key==='showCoverage'&&e.target.checked){$('led-runway-view').checked=false;viewer?.setRunwayVisible(false);}update({price:false});});
  $('projection-manual-viewer')?.addEventListener('change',e=>{state.manualPlacement=e.target.checked;if(state.manualPlacement){layer?.setManualConstraint('slide');layer?.select(state.selectedProjector,false);}else layer?.select(null,false);syncInputs();});
  $('projection-manual-slide')?.addEventListener('click',()=>{state.manualPlacement=true;layer?.setManualConstraint('slide');layer?.select(state.selectedProjector,false);syncInputs();});
  $('projection-manual-tilt')?.addEventListener('click',()=>{state.manualPlacement=true;layer?.setManualConstraint('tilt');layer?.select(state.selectedProjector,false);syncInputs();});
  $('projection-manual-undo')?.addEventListener('click',()=>{if(layer?.undo()){guided?.changed();syncInputs();}});

  all('[data-viewer]').forEach(b=>b.addEventListener('click',()=>viewer?.[b.dataset.viewer]?.()));
  all('[data-view]').forEach(b=>b.addEventListener('click',()=>{setPilot(false);viewer?.setView(b.dataset.view);all('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
  all('[data-position]').forEach(input=>input.addEventListener('change',()=>{const p=selected(),value=Number(input.value)/lengthFactor(unit);if(!finite(value)||Math.abs(value)>100)return;p.position[Number(input.dataset.position)]=value;update({fine:true});}));
  all('[data-aim]').forEach(input=>input.addEventListener('change',()=>{const value=Number(input.value);if(!finite(value)||Math.abs(value)>360)return;selected()[input.dataset.aim]=value;update({fine:true});}));
  $('projection-throw').addEventListener('input',e=>{selected().throwRatio=Number(e.target.value);update();});
  $('projection-channel-model').addEventListener('change',e=>{const p=selected(),m=profile(e.target.value);p.modelId=m.id;p.throwRatio=m.throwRatio?.min??null;p.shiftX=0;p.shiftY=0;renderCatalogue();update();});
  $('projection-channel-supply').addEventListener('change',e=>{selected().supplyStatus=e.target.value;syncSupply();update({geometry:false});});
  $('projection-locked').addEventListener('change',e=>{selected().locked=e.target.checked;update({price:false});});
  $('projection-placement-mode').addEventListener('change',e=>{state.placementMode=e.target.value;update();});
  all('[data-transform]').forEach(b=>b.addEventListener('click',()=>{layer?.setTransformMode(b.dataset.transform);all('[data-transform]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
  $('projection-undo').addEventListener('click',()=>{layer?.undo();update();});
  $('projection-suggest').addEventListener('click',()=>guided?.calculate());
  $('projection-count').addEventListener('change',e=>{const count=Number(e.target.value);while(state.projectors.length<count){const p=initialProjector(state.projectors.length,state.projectors[0].modelId);p.supplyStatus=state.supplyStatus==='mixed'?'simworx':state.supplyStatus;state.projectors.push(p);}state.projectors=state.projectors.slice(0,count);state.projectorCount=count;state.selectedProjector=state.projectors[0].id;update();toast('Projector count changed. Existing positions are retained; use Suggest starting positions to rearrange.');});
  $('projection-supply').addEventListener('change',e=>{state.supplyStatus=e.target.value;if(state.supplyStatus!=='mixed')state.projectors.forEach(p=>p.supplyStatus=state.supplyStatus);update({geometry:false});});
  $('projection-mounting-kit').addEventListener('change',e=>{state.mountingKit=e.target.checked;update({geometry:false});});
  $('projection-currency').addEventListener('change',e=>{state.currency=e.target.value;renderCatalogue();update({geometry:false});});
  $('projection-room-enabled').addEventListener('change',e=>{state.room.enabled=e.target.checked;update({price:false});});
  all('[data-room]').forEach(input=>input.addEventListener('change',()=>{const n=Number(input.value)/lengthFactor(unit),key=input.dataset.room,allowZero=key==='screenFromLeft'||key==='screenFromFront';if(finite(n)&&(allowZero?n>=0:n>0)&&n<=100){state.room[key]=n;update({price:false});}}));
  $('projection-room-offset-x')?.addEventListener('input',e=>{const offset=Number(e.target.value)/lengthFactor(unit);if(!finite(offset))return;state.room.screenFromLeft=state.room.width/2-offset;update({price:false});});
  $('projection-room-offset-z')?.addEventListener('input',e=>{const offset=Number(e.target.value)/lengthFactor(unit);if(!finite(offset))return;state.room.screenFromFront=state.room.depth/2-offset;update({price:false});});

  $('projection-notes').addEventListener('input',e=>{state.notes=e.target.value;renderSpecification();queueQuote();});
  $('projection-save').addEventListener('click',save);
  $('projection-load').addEventListener('click',()=>$('projection-file').click());
  $('projection-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2e6)throw new Error('Choose a configuration smaller than 2 MB.');loadPayload(JSON.parse(await file.text()));}catch(error){toast(error.message);}e.target.value='';});
  $('projection-restore').addEventListener('click',()=>{try{const text=localStorage.getItem(savedKey);if(!text)throw new Error('No saved projection configuration exists in this browser yet.');loadPayload(JSON.parse(text));}catch(error){toast(error.message);}});
  $('projection-print').addEventListener('click',printQuote);$('projection-spec-download')?.addEventListener('click',downloadSpecification);
  $('projection-guide').addEventListener('click',()=>$('projection-guide-dialog').showModal());
  all('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  $('projection-enquiry').addEventListener('click',()=>{lastEnquiryKey=crypto.randomUUID();$('projection-enquiry-dialog').showModal();});
  $('projection-enquiry-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button[type=submit]');b.disabled=true;try{if(!quote)quote=localQuote();const contact=Object.fromEntries(new FormData(e.target));const email=e.target.querySelector('input[type=email]')?.value?.trim()||contact.Email||contact.email||'';downloadSpecification();const subject='Simworx projection proposal '+(quote.reference||'');const body=proposalEmailText();$('projection-enquiry-status').textContent='Your proposal specification has been prepared. Your email application will open with the proposal summary; the downloaded specification can be attached if required.';if(email)location.href='mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);else location.href='mailto:?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);}catch(error){$('projection-enquiry-status').textContent=error.message;}finally{b.disabled=false;}});
  const importer=createImportUI({onAddProfile:async p=>{customProfiles=customProfiles.filter(x=>x.id!==p.id);customProfiles.push(p);const s=selected();s.modelId=p.id;s.throwRatio=p.throwRatio?.min??null;s.shiftX=0;s.shiftY=0;s.supplyStatus='customer';syncSupply();renderCatalogue();update();toast('Your projector profile has been added to '+s.id+'. Review its optical values and coverage.');}});
  $('projection-import').addEventListener('click',()=>importer.open());
  const admin=createAdminUI({onCatalogueChanged:async fresh=>{catalogue=fresh;renderCatalogue();update();toast('Development catalogue updated. Your estimate has been recalculated.');}});
  $('projection-admin').addEventListener('click',()=>admin.open());
  eyeControls=createEyeControls({data:reference,getState:()=>state,getUnit:()=>unit,getSeat:()=>pilotSeat,onSeat:seat=>{pilotSeat=seat;viewer.setPilotView(pilotMode,pilotSeat);syncInputs();},onChange:next=>{state.pilotEyes=next;update({geometry:true,price:true});},onMode:setPilot,getPilotMode:()=>pilotMode,setMarker:value=>viewer?.setEyeMarkerVisible(value),onOpen:async()=>{
    setPilot(true);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const container=$('led-canvas'),context=viewer?.context?.();
    if(container&&context){
      const rect=container.getBoundingClientRect(),credit=container.querySelector('.led-viewer-credit')?.getBoundingClientRect().height||0;
      const width=Math.max(1,Math.round(rect.width)),height=Math.max(1,Math.round(rect.height-credit));
      context.renderer.setSize(width,height,false);
      context.camera.aspect=width/height;
      context.camera.updateProjectionMatrix();
      context.invalidate();
    }
  }});
}

async function boot(){
  try{
    [catalogue,reference]=await Promise.all([request('/api/catalogue'),fetch('/data/led-reference.json').then(r=>{if(!r.ok)throw new Error('Original cockpit reference could not be loaded.');return r.json();})]);
    state={...clone(reference.defaults),geometry:'curved',diameter:4.5,horizontalFov:180,viewableHeight:2.4,screenBottom:.6,overallHeight:3,enclosure:'semi-enclosed',material:'matte-white',projectorCount:3,projectors:[],supplyStatus:'simworx',mountingKit:true,servicePlan:'self',currency:'EUR',showCoverage:true,showShadows:true,showFrusta:true,showStructure:true,ghostCockpit:false,placementMode:'free',manualPlacement:false,selectedProjector:'P1',room:{enabled:false,width:7,depth:6,height:4,screenFromLeft:3.5,screenFromFront:3},notes:'',materialGain:null};
    state.projectors=[0,1,2].map(i=>initialProjector(i));
    $('led-simulatorType').replaceChildren(...reference.simulatorReferences.map(s=>new Option(s.label,s.id)));
    renderCatalogue();
    try{viewer=createViewer($('led-canvas'),state,reference);layer=createProjectionLayer({viewer,getState:()=>state,getProfile:profile,onMove:(id,patch,finished)=>{const p=state.projectors.find(p=>p.id===id);if(p)Object.assign(p,patch);if(!initialising){guided?.changed();syncInputs();queueQuote();}},onSelect:setSelected,onResult:onOpticalResult});}
    catch(error){geometryError=true;$('led-viewer-status').textContent='3D preview unavailable in this browser. Configuration and pricing controls remain available.';console.error(error);}
    wire();
    guided=createGuidedPlanner({getState:()=>state,getCatalogue:()=>catalogue,getProfiles:profiles,getLayer:()=>layer,getViewer:()=>viewer,eyesFor:s=>pilotStations(s,reference).map(seat=>seat.eye),update,formatLength,getUnit:()=>unit});
    guided.start();initialising=false;update({fine:true});
    window.SimworxProjection=Object.freeze({snapshot:()=>({configuration:clone(state),quote:clone(quote),activeProjectors:result?.opticalRecords?.length||0,optics:result?{stats:result.stats,pilotVisible:state.layoutSummary?.metrics}:null}),viewerSnapshot:()=>viewer?.snapshot(),plannerBusy:()=>guided.isBusy()});
    const header=document.querySelector('header'),toggle=header?.querySelector('button[aria-expanded]');toggle?.addEventListener('click',()=>{const expanded=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(expanded));header.classList.toggle('menu-open',expanded);});
  }catch(error){fail(error);$('led-running-total').textContent='Preview could not start';console.error(error);}
}
boot();
