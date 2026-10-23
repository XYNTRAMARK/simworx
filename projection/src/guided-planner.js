import {findLayout,roomIssues,evaluatePilotCoverage,normalisePreferences} from 'projection:/src/layout-planner.js';
const $=id=>document.getElementById(id),finite=n=>typeof n==='number'&&Number.isFinite(n),pct=n=>finite(n)?(n*100).toFixed(1)+'%':'Not assessed';
const esc=n=>String(n??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createGuidedPlanner({getState,getCatalogue,getProfiles,getLayer,getViewer,eyesFor,update,formatLength,getUnit}){
 let busy=false,liveMetrics=null;
 const names=['Room & budget','Screen & cockpit','Projectors','Review'];
 const prefs=()=>getState().layoutPreferences;
 function fingerprint(){const s=getState();return JSON.stringify([s.room,s.diameter,s.viewableHeight,s.screenBottom,s.horizontalFov,s.enclosure,s.material,s.showSimulator,s.simulatorType,s.simulatorWidth,s.simulatorHeight,s.simulatorDepth,s.simulatorX,s.simulatorY,s.simulatorZ,s.simulatorYaw,s.pilotEyes,s.layoutPreferences,s.servicePlan,s.mountingKit,s.supplyStatus,s.projectors]);}
 function baseFingerprint(){const s=getState();return JSON.stringify([s.room,s.diameter,s.viewableHeight,s.screenBottom,s.horizontalFov,s.enclosure,s.material,s.showSimulator,s.simulatorType,s.simulatorWidth,s.simulatorHeight,s.simulatorDepth,s.simulatorX,s.simulatorY,s.simulatorZ,s.simulatorYaw,s.pilotEyes,s.layoutPreferences,s.servicePlan,s.mountingKit,s.supplyStatus]);}
 function changed(){const s=getState();if(!busy&&s.layoutReady&&s.layoutFingerprint!==fingerprint()){if(s.manualPlacement&&s.layoutBaseFingerprint===baseFingerprint()){s.manualLayout=true;s.layoutDirty=false;s.layoutFingerprint=fingerprint();}else s.layoutDirty=true;}}

 function centre(){const s=getState();s.simulatorX=0;s.simulatorZ=0;s.simulatorYaw=0;update();}
 function go(n){
  const s=getState();if(busy)return;
  if(n>1&&!Array.from(document.querySelectorAll('[data-room]')).every(e=>e.reportValidity()))return;
  if(n===4&&(!s.layoutReady||s.layoutDirty)){n=3;$('guided-progress').textContent='Optimise a current projector layout before reviewing the proposal.';}
  s.guidedStep=Math.max(1,Math.min(4,n));
  if(n===2&&!s.showSimulator){s.showSimulator=true;if(!s.cockpitPositioned){centre();s.cockpitPositioned=true;}}
  s.manualPlacement=false;$('guided-manual').open=false;render();update({price:false});requestAnimationFrame(()=>$('guided-steps').scrollIntoView({block:'start',behavior:'instant'}));
 }
 function render(){
  const s=getState(),p=prefs(),step=s.guidedStep;
  document.querySelectorAll('[data-guided-step]').forEach(e=>e.hidden=Number(e.dataset.guidedStep)!==step);
  $('led-controls').hidden=step===4;
  document.querySelectorAll('[data-guided-go]').forEach(e=>{if(Number(e.dataset.guidedGo)===step)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');});
  $('guided-step-status').textContent='Step '+step+' of 4 · '+names[step-1];
  $('guided-back').disabled=step===1||busy;$('guided-next').hidden=step===4;$('guided-next').disabled=busy||step===3&&(!s.layoutReady||s.layoutDirty);$('guided-next').textContent=step<4?'Continue to '+names[step].toLowerCase():'';
  document.querySelector('.led-viewer-simulator').hidden=step<2;document.querySelector('.led-view-options').hidden=step<2;
  for(const id of ['projection-coverage','projection-shadows','projection-frusta'])$(id).disabled=busy||!s.layoutReady||step<3;
  document.querySelectorAll('.projection-metrics,.projection-legend,.projection-analysis,.projection-overlay-controls').forEach(e=>{if(e.closest('#led-preview'))e.hidden=!(s.layoutReady&&step>=3);});
  $('projection-calculation-status').hidden=!(s.layoutReady&&step>=3);
  const fitIssues=roomIssues(s);$('guided-room-fit').textContent=fitIssues.join(' ');
  $('guided-model-field').hidden=p.mode!=='fixed';
  const select=$('guided-model'),models=getProfiles();if(select.options.length!==models.length)select.replaceChildren(...models.map(m=>new Option(m.displayName||m.model,m.id)));
  select.value=p.modelId||s.projectors[0]?.modelId;
  for(const [id,key] of [['guided-budget','budget'],['guided-mode','mode'],['guided-count','count'],['guided-band','band'],['guided-mount-drop','mountDrop']])if(document.activeElement!==$(id))$(id).value=p[key]??'';
  $('guided-resize').checked=p.allowScreenResize===true;
  const status=$('guided-viewer-status'),statusText=$('guided-viewer-status-text'),recalc=$('guided-recalculate');status.dataset.dirty=String(s.layoutDirty===true);
  statusText.textContent=!busy&&step<3&&fitIssues.length?fitIssues[0]:busy?'Searching layouts and checking cockpit shadows…':step<3?'Screen & cockpit setup · projectors are hidden.':!s.layoutReady?'Optimise a layout to show the projectors.':s.layoutDirty?'Layout needs recalculation after your changes.':'Best achievable layout · '+s.projectors.length+' projectors on one lens height. Open Advanced only if you need individual adjustments.';
  recalc.hidden=!(s.layoutReady&&s.layoutDirty&&!busy);recalc.disabled=busy;
  $('guided-manual').inert=busy;
  $('guided-calculate').disabled=busy||!getLayer();
  if(s.layoutSummary)renderResult();else $('guided-result').hidden=true;
 }
 function renderResult(){
  const s=getState(),summary=s.layoutSummary;if(!summary)return;
  const best=summary.found,metrics=liveMetrics||summary.metrics||{},objectiveLabels={current:'Current setup',room:'Best fit for my room',projector:'Best projector solution for my setup',budget:'Best overall solution for my budget'};let level='red',title='Best achievable layout needs changes';
  if(best){const good=metrics.pilotCoverage>=.98&&metrics.coverage>=.95&&metrics.boundaryGaps===0&&summary.metrics.overlapEveryRow&&s.showSimulator;level=good?'green':(metrics.pilotCoverage??0)<.9?'red':'amber';title=good?'Strong result':level==='red'?'Best achievable layout · significant compromises':'Best achievable layout · manageable compromises';if(!metrics.visibleSamples){level='red';title='Pilot visibility needs review';}}
  if(s.manualLayout){level='amber';title='Manual layout · review coverage';}
  if(s.layoutDirty){level='amber';title='Recalculate after your changes';}
  $('guided-result').hidden=false;$('guided-light').dataset.level=level;$('guided-result-title').textContent=title;
  $('guided-result-summary').textContent=best?(objectiveLabels[summary.objective||'current']+' · '+summary.count+' × '+summary.modelName+' · '+summary.examined.toLocaleString()+' arrangements examined. '+(s.layoutDirty?'Previous positions are shown for reference.':'The optimiser has kept the best-scoring practical arrangement and leaves the compromises visible so you can compare them.')):(summary.issues?.[0]||'The physical room or screen inputs must be corrected before projector positions can be calculated.');
  if(s.manualLayout)$('guided-result-summary').textContent='Individually adjusted projector positions. The coverage below is recalculated from your current arrangement.';
  const budget=summary.budget;
  $('guided-budget-result').textContent=best?(summary.objective==='budget'&&finite(budget?.totalBudget)?('Total screen + projector budget €'+budget.totalBudget.toLocaleString()+'. Screen configuration €'+Math.round(budget.screenCost||0).toLocaleString()+', leaving €'+Math.round(budget.availableProjectorBudget||0).toLocaleString()+' for projectors.'+(budget?.projectorCost===null?' Projector selling prices are not yet approved, so the optical result is indicative.':budget.withinKnownBudget===false?' Closest known projector set is above the remaining allowance.':' Projector set fits the remaining allowance.')):(budget?.projectorCost===null?(finite(prefs().budget)?'Projector budget €'+prefs().budget.toLocaleString()+'. This layout uses an indicative projector class because selling prices are not yet approved.':'Projector selling prices are not yet approved; this result is geometric rather than a confirmed price match.'):(finite(prefs().budget)&&budget.withinKnownBudget===false?'Closest known-price option: €'+budget.projectorCost.toLocaleString()+' for the projector set, €'+Math.max(0,budget.projectorCost-prefs().budget).toLocaleString()+' above your €'+prefs().budget.toLocaleString()+' projector budget. The geometry is still shown so you can judge whether the upgrade is worthwhile.':(finite(prefs().budget)?'Projector budget €'+prefs().budget.toLocaleString()+'. ':'')+'Projector subtotal €'+budget.projectorCost.toLocaleString()+'. Screen, mounting and warping are separate.'))):'Room constraints must be valid before a projector arrangement can be shown.';
  if(s.manualLayout)$('guided-budget-result').textContent='Budget not verified after manual projector changes. Review the current models and supply costs.';
  $('guided-result-metrics').replaceChildren();
  for(const [label,value] of [['Pilot-visible image reached',pct(metrics.pilotCoverage)],['Pilot-visible image in full shadow',pct(metrics.shadowFraction)],['Whole screen reached',pct(metrics.coverage)],['Lens height',best?(new Set(s.projectors.map(p=>p.position[1])).size===1?formatLength(s.projectors[0].position[1],getUnit()):'Mixed heights'):'—']]){const box=document.createElement('div'),strong=document.createElement('strong'),caption=document.createElement('span');strong.textContent=value;caption.textContent=label;box.append(strong,caption);$('guided-result-metrics').append(box);}
  $('guided-screen-change').textContent=summary.screenChange||'Your screen dimensions and cockpit position are retained.';
  const model=best?getProfiles().find(m=>m.id===s.projectors[0]?.modelId):null;
  const throws=best?s.projectors.map(p=>p.throwRatio).filter(finite):[];
  const currentThrow=throws.length?Math.min(...throws):null;
  const targetThrow=finite(summary.requiredThrowRatio)?summary.requiredThrowRatio:(finite(currentThrow)&&((metrics.shadowFraction??0)>.005)?Math.max(.2,currentThrow*.85):currentThrow);
  const brightness=model?.brightness?.lumens;
  const spec=[];
  if(best)spec.push('<div><strong>'+summary.count+'</strong><span>matched projectors</span></div>');
  if(finite(targetThrow))spec.push('<div><strong>'+targetThrow.toFixed(2)+(finite(currentThrow)&&targetThrow<currentThrow-.01?' or lower':'')+'</strong><span>indicative target throw ratio</span></div>');
  if(finite(brightness))spec.push('<div><strong>'+Math.round(brightness).toLocaleString()+' lm</strong><span>example class brightness</span></div>');
  if(best)spec.push('<div><strong>'+formatLength(s.projectors[0].position[1],getUnit())+'</strong><span>calculated lens height</span></div>');
  $('guided-required-spec').innerHTML=spec.join('')||'<p class="led-help">Correct the room or screen inputs to calculate the projector specification.</p>';
  const remedies=[];
  if(!best){remedies.push(...(summary.issues||[]));if(summary.priceExcluded)remedies.push('The known projector costs exceed your budget or selected price band. Increase that allowance or choose another model.');if(!summary.eligible)remedies.push('Select a projector with documented ceiling orientation, throw range, image aspect and optical offset.');if(!summary.issues?.length&&!summary.priceExcluded)remedies.push('No tested ceiling layout clears the room and cockpit with the current lens. Review the ceiling height, cockpit position or projector choice, then calculate again.');}
  else if((metrics.pilotCoverage??0)<.98||!summary.metrics.overlapEveryRow)remedies.push('The current result contains visible gaps, shadow or blend compromises. Try the calculated changes below and keep the version you prefer.');
  if(best&&(metrics.shadowFraction??0)>.005)remedies.push('Move the cockpit farther from the screen or test a shorter-throw projector. A shorter throw lets the projector bank sit closer to the screen and can reduce cockpit shadow.');
  if(best&&(metrics.coverage??0)<.98)remedies.push('Coverage is incomplete. A larger screen can sometimes improve projector clearance; a different throw range may also improve coverage without moving the cockpit.');
  if(best&&finite(summary.requiredThrowRatio)&&finite(currentThrow)&&summary.requiredThrowRatio<currentThrow-.01)remedies.push('To target near-zero pilot-visible shadow, test a projector with a throw ratio around '+summary.requiredThrowRatio.toFixed(2)+' or shorter. Use Add your own projector to test a model you find online.');
  if(best&&metrics.visibleSamples===0)remedies.push('No sampled screen was visible from the configured eyepoints. Review the pilot eye positions before using coverage figures.');
  if(best&&prefs().band!=='any'&&budget.unitPrice===null)remedies.push('The per-projector price band cannot be confirmed because this model has no selling price.');
  if(best&&summary.provisional)remedies.push('This projector profile is provisional; its documented offset, focus and chassis mounting datums need confirmation.');
  $('guided-remedies').replaceChildren(...[...new Set(remedies)].map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
  $('guided-optimise-screen').hidden=prefs().allowScreenResize===true||best&&metrics.pilotCoverage>=.98&&summary.metrics.overlapEveryRow;
  $('guided-mounting').hidden=!best||s.layoutDirty;
  $('guided-mounting-rows').innerHTML=best?s.projectors.map(channel=>'<tr><th>'+esc(channel.id)+'</th><td>'+esc(formatLength(channel.position[0]+s.room.width/2,getUnit()))+'</td><td>'+esc(formatLength(channel.position[2]+s.room.depth/2,getUnit()))+'</td><td>'+esc(formatLength(channel.position[1],getUnit()))+'</td><td>'+channel.yaw.toFixed(1)+'° / '+channel.pitch.toFixed(1)+'°</td></tr>').join(''):'';
 }
 async function calculate(){
  if(busy||!getLayer())return;
  const s=getState(),p=prefs();if(!$('guided-mount-drop').reportValidity())return;
  busy=true;s.manualLayout=false;liveMetrics=null;const initial={diameter:s.diameter,viewableHeight:s.viewableHeight,simulatorZ:s.simulatorZ};
  const controls=Array.from(document.querySelectorAll('#projection-app input,#projection-app select,#projection-app button')).map(e=>[e,e.disabled]);controls.forEach(([e])=>e.disabled=true);
  const cover=document.createElement('div');cover.className='projection-planning-busy';cover.textContent='Finding the best achievable layout…';$('led-canvas').append(cover);render();
  try{
   const models=p.mode==='fixed'?getProfiles().filter(m=>m.id===p.modelId):getProfiles();
   const answer=await findLayout({state:{...s},models,catalogue:getCatalogue(),preferences:{...p,supply:s.supplyStatus},contextFor:state=>getLayer().planningContext(state),eyesFor,onProgress:info=>{$('guided-progress').textContent=info.stage+' · '+info.examined.toLocaleString()+' arrangements tested';}});
   const best=answer.best;
   if(best){s.diameter=best.state.diameter;s.viewableHeight=best.state.viewableHeight;s.simulatorZ=best.state.simulatorZ;s.projectors=best.projectors;s.projectorCount=best.projectors.length;s.selectedProjector='P1';s.projectors.forEach(c=>c.supplyStatus=s.supplyStatus==='customer'?'customer':'simworx');s.layoutReady=true;s.layoutDirty=false;s.manualLayout=false;
    const changes=[];
    if(initial.diameter!==s.diameter||initial.viewableHeight!==s.viewableHeight)changes.push('Screen adjusted from '+formatLength(initial.diameter,getUnit())+' diameter × '+formatLength(initial.viewableHeight,getUnit())+' high to '+formatLength(s.diameter,getUnit())+' × '+formatLength(s.viewableHeight,getUnit())+'.');
    if(initial.simulatorZ!==s.simulatorZ)changes.push('Cockpit moved '+formatLength(Math.abs(s.simulatorZ-initial.simulatorZ),getUnit())+' '+(s.simulatorZ>initial.simulatorZ?'back':'forward')+' to improve the result.');
    s.layoutSummary={found:true,modelName:best.model.displayName||best.model.model,count:s.projectors.length,metrics:best.metrics,budget:best.budget,examined:answer.examined,eligible:answer.eligible,provisional:best.model.fullVerificationAllowed!==true,requiredThrowRatio:answer.requiredThrowRatio??null,fallbackUsed:answer.fallbackUsed===true,objective:answer.objective||p.objective||'current',screenChange:changes.join(' '),issues:answer.issues||[],priceExcluded:answer.priceExcluded};
   }else{s.layoutReady=false;s.layoutDirty=false;s.layoutSummary={found:false,examined:answer.examined,eligible:answer.eligible,issues:answer.issues,priceExcluded:answer.priceExcluded};}
   $('guided-progress').textContent=answer.examined.toLocaleString()+' arrangements tested. '+(best?'The best achievable arrangement is shown. Adjust the cockpit, screen or projector and compare the result.':'Correct the physical room/screen inputs and calculate again.');
  }catch(error){s.layoutReady=false;s.layoutDirty=false;s.layoutSummary={found:false,issues:['The layout search could not complete: '+error.message],eligible:1};$('guided-progress').textContent='Review your inputs and try again.';}
  finally{cover.remove();controls.forEach(([e,disabled])=>e.disabled=disabled);busy=false;s.layoutFingerprint=fingerprint();s.layoutBaseFingerprint=baseFingerprint();render();update({fine:true});}
 }
 function onResult(result){if(busy||!getState().layoutReady)return;const s=getState(),visible=evaluatePilotCoverage(s,result,eyesFor(s),getLayer().testObstruction);liveMetrics={...s.layoutSummary?.metrics,...visible,coverage:result.stats?.coverage,boundaryGaps:result.stats?.boundaryGaps};renderResult();}
 function preferencesChanged(){const p=prefs();p.budget=$('guided-budget').value===''?null:Number($('guided-budget').value);p.mode=$('guided-mode').value;p.modelId=$('guided-model').value;p.count=$('guided-count').value;p.band=$('guided-band').value;p.mountDrop=Number($('guided-mount-drop').value);p.allowScreenResize=$('guided-resize').checked;changed();render();}
 function screenCostFor(s){const area=(s.diameter/2)*(s.horizontalFov*Math.PI/180)*s.viewableHeight,c=getCatalogue().commercial;const base=area*Number(c.fabrication?.screenSystemPerM2Eur||0),extra=Number(c.enclosures?.[s.enclosure]?.fixedEur||0),included=(c.mountingKit?.includedIn||[]).includes(s.enclosure),kit=s.mountingKit&&!included?Number(c.mountingKit?.priceEur||0):0;return base+extra+kit;}
 function updateBudgetBreakdown(){const s=getState(),p=prefs(),total=Number($('guided-total-budget')?.value||p.totalBudget||0),screen=screenCostFor(s),remaining=Math.max(0,total-screen),box=$('guided-budget-breakdown');if(box)box.innerHTML='<div><span>Current screen configuration</span><strong>€'+screen.toLocaleString(undefined,{maximumFractionDigits:0})+'</strong></div><div><span>Remaining for projectors</span><strong>€'+remaining.toLocaleString(undefined,{maximumFractionDigits:0})+'</strong></div>';}
 function runObjective(objective){const p=prefs();p.objective=objective;if(objective==='projector'){p.mode='recommend';p.allowScreenResize=false;}if(objective==='room'){p.mode='recommend';}if(objective==='budget'){p.mode='recommend';const dialog=$('guided-budget-dialog');if(dialog){$('guided-total-budget').value=p.totalBudget||'';updateBudgetBreakdown();dialog.showModal();return;}}document.querySelectorAll('[data-guided-objective]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.guidedObjective===objective)));const note=$('guided-objective-note');if(note)note.textContent=objective==='room'?'Room fit may make small screen and cockpit-position adjustments to improve the physical result.':objective==='projector'?'Your screen and cockpit are locked; only projector class and placement are optimised.':'Budget mode may trade screen size, cockpit position and projector class to improve the result within the total screen + projector budget.';render();calculate();}
 function printMounting(){const s=getState();if(!s.layoutReady||s.layoutDirty)return;const target=$('projection-print-document');target.innerHTML='<h1>Simworx · Projector mounting proposal</h1><p>Sampled geometric planning result. Confirm projector chassis datums, focus, brackets and structural fixing before installation.</p><h2>Room &amp; screen</h2><p>Room '+esc(formatLength(s.room.width,getUnit()))+' wide × '+esc(formatLength(s.room.depth,getUnit()))+' deep × '+esc(formatLength(s.room.height,getUnit()))+' high. Screen diameter '+esc(formatLength(s.diameter,getUnit()))+', arc '+s.horizontalFov+'°, height '+esc(formatLength(s.viewableHeight,getUnit()))+'.</p><p>'+esc($('guided-result-summary').textContent)+'</p><p>'+esc($('guided-budget-result').textContent)+'</p><h2>Lens-centre mounting coordinates</h2><p>Distances from the left wall, front wall and floor. Yaw 0° faces the front wall; positive yaw turns left. Positive pitch aims the lens upwards. All projectors are ceiling inverted.</p><table><thead>'+document.querySelector('#guided-mounting thead').innerHTML+'</thead><tbody>'+$('guided-mounting-rows').innerHTML+'</tbody></table><h2>Mounting views</h2><div class="print-views">'+(getViewer()?.captureViews()||[]).map(v=>'<figure><img src="'+v.data+'" alt="'+esc(v.caption)+'"><figcaption>'+esc(v.caption)+'</figcaption></figure>').join('')+'</div><p>Lens centres are planning points. Body origin, ventilation, mounting structure and site measurements require confirmation.</p>';window.print();}
 for(const e of document.querySelectorAll('[data-guided-go]'))e.addEventListener('click',()=>go(Number(e.dataset.guidedGo)));
 $('guided-back').addEventListener('click',()=>go(getState().guidedStep-1));$('guided-next').addEventListener('click',()=>go(getState().guidedStep+1));$('guided-calculate').addEventListener('click',()=>{prefs().objective='current';document.querySelectorAll('[data-guided-objective]').forEach(b=>b.setAttribute('aria-pressed','false'));calculate();});$('guided-recalculate')?.addEventListener('click',calculate);$('guided-centre-cockpit').addEventListener('click',centre);$('guided-print-mounting').addEventListener('click',printMounting);
 for(const id of ['guided-budget','guided-mode','guided-model','guided-count','guided-band','guided-mount-drop','guided-resize'])$(id).addEventListener('change',preferencesChanged);
 for(const button of document.querySelectorAll('[data-guided-objective]')){button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>runObjective(button.dataset.guidedObjective));}
 $('guided-total-budget')?.addEventListener('input',updateBudgetBreakdown);
 $('guided-budget-run')?.addEventListener('click',()=>{const input=$('guided-total-budget');if(!input?.reportValidity())return;const total=Number(input.value);if(!(total>0))return;prefs().totalBudget=total;prefs().objective='budget';document.querySelectorAll('[data-guided-objective]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.guidedObjective==='budget')));$('guided-budget-dialog')?.close();$('guided-objective-note').textContent='Budget mode is balancing the screen and projector set inside a €'+total.toLocaleString()+' total screen + projector budget.';render();calculate();});

 $('guided-optimise-screen').addEventListener('click',()=>{prefs().allowScreenResize=true;$('guided-resize').checked=true;calculate();});
 $('guided-manual').addEventListener('toggle',()=>{getState().manualPlacement=$('guided-manual').open;getLayer()?.select(getState().selectedProjector,false);});
 $('guided-test-cockpit-back').addEventListener('click',()=>{const s=getState();s.simulatorZ=Math.min(4,(s.simulatorZ||0)+.25);s.layoutDirty=true;update();calculate();});
 $('guided-test-screen-larger').addEventListener('click',()=>{const s=getState();s.diameter=Math.min(12,(s.diameter||4.5)+.3);s.layoutDirty=true;update();calculate();});
 $('guided-pilot-view').addEventListener('click',()=>{const box=$('led-pilot-view');if(box&&!box.checked){box.click();}document.getElementById('led-preview')?.scrollIntoView({block:'start',behavior:'smooth'});});
 return {restore(){const s=getState();s.layoutPreferences=normalisePreferences(s.layoutPreferences,s.projectors[0]?.modelId);s.layoutSummary=null;s.layoutDirty=true;s.manualPlacement=false;s.guidedStep=3;render();},start(){const s=getState();s.guidedStep=1;s.room.enabled=true;s.layoutReady=false;s.manualPlacement=false;s.layoutPreferences=normalisePreferences(s.layoutPreferences,s.projectors[0]?.modelId);render();},render,changed,onResult,calculate,go,isBusy:()=>busy,printMounting};
}
