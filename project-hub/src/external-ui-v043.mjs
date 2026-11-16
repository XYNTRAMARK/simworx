/* External supplier chain workspace: internal records, no customer auto-publication. */
import {ensureExternalWork,activeRoutes,activeStages,createExternalRoute,addExternalStage,
 updateExternalStage,recordExternalHandoff,archiveExternalRoute,externalRouteSummary,
 externalWorkTimeline,exportExternalHistoryCSV} from './external-work-v043.mjs';
const e=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;','"':'&#39;'}[ch]));
const input=(name,v='',type='text',extra='')=>'<input name="'+e(name)+'" type="'+type+'" value="'+e(v)+'" '+extra+'>';
const sel=(name,rows,value='',extra='')=>'<select name="'+e(name)+'" '+extra+'>'+rows.map(([v,t])=>
 '<option value="'+e(v)+'" '+(v===value?'selected':'')+'>'+e(t)+'</option>').join('')+'</select>';
const field=(name,element)=>'<label class="v43-field"><span>'+e(name)+'</span>'+element+'</label>';
const button=(name,action,attrs='',klass='small')=>'<button type="button" class="btn '+klass+'" data-action="'+e(action)+'" '+attrs+'>'+e(name)+'</button>';
const fmt=d=>d||'Not recorded';
const stageStatus=st=>{
 if(st.status==='Accepted')return 'green';
 if(st.status==='Returned · inspect')return 'amber';
 if(st.status==='On hold')return 'red';
 if(st.status==='With supplier')return 'amber';return 'neutral';
};
function stageEditor(r,st){
 return '<form data-form="v43-external-edit" class="v43-ext-form">'+
 '<input type="hidden" name="routeId" value="'+e(r.id)+'"><input type="hidden" name="stageId" value="'+e(st.id)+'">'+
 field('Stage name',input('name',st.name,'text','required'))+
 field('Type',sel('type',[['External','External company'],['Internal','Our workshop']],st.type))+
 field('Company / responsible team',input('company',st.company,'text','required'))+
 field('Planned start',input('plannedStart',st.plannedStart,'date'))+
 field('Promised finish',input('promisedFinish',st.promisedFinish,'date'))+
 field('Delay reason (staff note)',input('delayReason',st.delayReason||''))+
 field('Additional notes',input('notes',st.notes||''))+
 '<button class="btn primary" type="submit">Save stage details</button></form>';
}
export function renderExternalWork(s,ui,projectId){
 ensureExternalWork(s);
 const p=s.projects.find(x=>x.id===projectId&&!x.archivedAt);
 if(!p)return '<p>Project missing</p>';
 const routes=activeRoutes(s,projectId);
 const summary=externalRouteSummary(s,projectId);
 const selected=routes.find(x=>x.id===ui.externalRouteId)||routes[0];if(selected)ui.externalRouteId=selected.id;
 const routePicker=selected?'<div class="v43-ext-selector">'+field('Work package',sel('routeId',routes.map(x=>[x.id,x.title]),selected.id,
 'data-filter="v43-route" aria-label="Work package"'))+
 '<p>Follow an item from laser cutting, through workshop inspection, to powder coat or composites, and back.</p></div>':'';
 const newRoute='<details class="v43-ext-creator"><summary>+ New external-work package</summary>'+
 '<form data-form="v43-external-new" class="v43-ext-form"><input type="hidden" name="projectId" value="'+e(projectId)+'">'+
 field('Package name',input('title','','text','required placeholder="Sheet-metal cockpit panels"'))+
 field('Part (optional)',sel('partId',[['','No part association'],...s.parts.filter(x=>!x.archivedAt).map(x=>[x.id,x.code+' · '+x.name])]))+
 field('Quantity',input('quantity',1,'number','min="1" step="1" required'))+
 field('Final required-by date',input('requiredBy','','date'))+
 field('Notes',input('notes',''))+
 '<button type="submit" class="btn primary">Create package</button></form></details>';
 let content='';
 if(selected){
  const timeline=externalWorkTimeline(s,selected.id),stages=timeline.stages;
  const stageRows=stages.map((st,i)=>{
   const timing=st.timing,late=timing.overdueDays>0;
   const actions=st.status==='Planned'?button('Send out','v43-external-action','data-route="'+e(selected.id)+'" data-stage="'+e(st.id)+'" data-step="send"','small primary'):
    st.status==='With supplier'?button('Returned','v43-external-action','data-route="'+e(selected.id)+'" data-stage="'+e(st.id)+'" data-step="return"','small primary')+
     button('Put on hold','v43-external-action','data-route="'+e(selected.id)+'" data-stage="'+e(st.id)+'" data-step="hold"'):
    st.status==='On hold'?button('Returned','v43-external-action','data-route="'+e(selected.id)+'" data-stage="'+e(st.id)+'" data-step="return"')+
     button('Resume','v43-external-action','data-route="'+e(selected.id)+'" data-stage="'+e(st.id)+'" data-step="resume"'):
    st.status==='Returned · inspect'?button('Accept after inspection','v43-external-action','data-route="'+e(selected.id)+'" data-stage="'+e(st.id)+'" data-step="accept"','small primary'):'';
   return '<div class="v43-ext-stage">'+
    '<div class="v43-ext-stage-header"><b>'+(i+1)+'. '+e(st.name)+'</b><span class="v43-ext-status '+stageStatus(st)+'">'+e(st.status)+'</span>'+
    (late?'<span class="v43-ext-late">+'+timing.overdueDays+' days late</span>':'')+'</div>'+
    '<div class="v43-ext-facts"><span><small>Responsible</small>'+e(st.company)+'</span>'+
    '<span><small>Promised finish</small>'+fmt(st.promisedFinish)+'</span>'+
    '<span><small>Sent</small>'+fmt(st.sentAt)+'</span>'+
    '<span><small>Returned</small>'+fmt(st.returnedAt)+'</span>'+
    '<span><small>Days with supplier</small>'+(timing.elapsedDays??'—')+'</span></div>'+
    (st.delayReason?'<p class="v43-ext-reason"><b>Recorded delay note:</b> '+e(st.delayReason)+'</p>':'')+
    '<div class="v43-ext-actions">'+actions+
    button(ui.externalEditStage===st.id?'Close edit':'Edit stage','v43-external-edit','data-stage="'+e(st.id)+'"')+'</div>'+
    (ui.externalEditStage===st.id?stageEditor(selected,st):'')+'</div>';
  }).join('');
  const history=timeline.events.slice().reverse().map(x=>'<tr><td>'+e(x.at.replace('T',' ').slice(0,19))+
   '</td><td>'+e(x.event)+'</td><td>'+e(x.detail||'—')+'</td></tr>').join('');
  const next=stages.length?stages.at(-1):null;
  const allowNext=!next||next.status==='Accepted';
  const addStage=allowNext?'<details class="v43-ext-creator"><summary>+ Add next workshop / supplier stage</summary>'+
    '<form data-form="v43-external-stage" class="v43-ext-form"><input type="hidden" name="routeId" value="'+e(selected.id)+'">'+
    field('Stage',input('name','','text','required placeholder="Laser cutting / powder coating / inspection"'))+
    field('Type',sel('type',[['External','External supplier'],['Internal','Sim-Worx inspection']],'External'))+
    field('Company',input('company','','text','required placeholder="External supplier name"'))+
    field('Planned start',input('plannedStart','','date'))+
    field('Promised finish',input('promisedFinish','','date'))+
    field('Notes',input('notes',''))+
    '<button class="btn primary" type="submit">Add stage</button></form></details>':
    '<p class="v43-ext-note">Complete and accept the last stage before appending the next stage.</p>';
  content='<div class="v43-ext-project"><div class="v43-ext-header"><div><h3>'+e(selected.title)+'</h3>'+
    '<p>'+e(selected.notes||'Internal work package')+' · Needed by '+fmt(selected.requiredBy)+'</p></div>'+
    '<div>'+button('Export delays CSV','v43-external-export','data-project="'+e(projectId)+'"')+
    button('Archive package','v43-external-archive','data-route="'+e(selected.id)+'"','small danger')+'</div></div>'+
    '<div class="v43-ext-stages">'+(stageRows||'<p>Start by adding a supplier or internal stage.</p>')+'</div>'+addStage+
    '<details class="v43-ext-history"><summary>Recorded handoff history ('+timeline.events.length+')</summary>'+
    '<div class="v43-scroll"><table class="v43-table"><thead><tr><th>Recorded at</th><th>Event</th><th>Notes</th></tr></thead><tbody>'+history+'</tbody></table></div></details></div>';
 }
 return '<div class="v43-ext"><div class="v43-focus-heading"><div><h2>External work & supplier delays</h2>'+
  '<p>Record each handoff from supplier to Sim-Worx and onward—actual and promised dates stay in the history.</p></div>'+
  '<span class="v43-ext-status">Internal records only</span></div>'+
  '<div class="v43-ext-kpis"><div><b>'+summary.routes+'</b><small>Active packages</small></div>'+
  '<div><b>'+summary.atSuppliers+'</b><small>With external companies</small></div>'+
  '<div><b>'+summary.waitingInspection+'</b><small>Back for inspection</small></div>'+
  '<div><b>'+summary.late.length+'</b><small>Stages with recorded delay</small></div></div>'+
  routePicker+newRoute+content+
  '<p class="v43-ext-note">Each event stores when staff recorded it and the date they entered. Overdue days compare the supplier’s promised date with the recorded return date or today. These are user-maintained records, not independent verification of supplier fault; review evidence before publishing any client-facing explanation.</p></div>';
}
export function handleExternalForm(s,ui,form){
 const f=new FormData(form),v=k=>String(f.get(k)||'').trim();
 switch(form.dataset.form){
  case 'v43-external-new':{const r=createExternalRoute(s,{projectId:v('projectId'),title:v('title'),partId:v('partId'),quantity:v('quantity'),requiredBy:v('requiredBy'),notes:v('notes')});ui.externalRouteId=r.id;return r;}
  case 'v43-external-stage':return addExternalStage(s,{routeId:v('routeId'),name:v('name'),type:v('type'),company:v('company'),plannedStart:v('plannedStart'),promisedFinish:v('promisedFinish'),notes:v('notes')});
  case 'v43-external-edit':{const st=updateExternalStage(s,{routeId:v('routeId'),stageId:v('stageId'),name:v('name'),type:v('type'),company:v('company'),plannedStart:v('plannedStart'),promisedFinish:v('promisedFinish'),delayReason:v('delayReason'),notes:v('notes')});ui.externalEditStage=null;return st;}
  default:throw Error('Unknown external-work form');
 }
}
export function handleExternalAction(s,ui,el,confirmFn=()=>true){
 const d=el.dataset;
 switch(d.action){
  case 'v43-external-edit':ui.externalEditStage=ui.externalEditStage===d.stage?null:d.stage;return 'ui';
  case 'v43-external-archive':if(confirmFn('Archive this work package? Events remain in local records.')){archiveExternalRoute(s,d.route);ui.externalRouteId=null;}return 'ui';
  case 'v43-external-export':return {download:exportExternalHistoryCSV(s,d.project||ui.project),name:'SimWorx-External-Work-'+(d.project||ui.project)+'.csv'};
  case 'v43-external-action':{
   const label={send:'Send to company',return:'Record return',accept:'Record inspection acceptance',
    hold:'Place work on hold',resume:'Resume supplier work'}[d.step];
   if(!label)throw Error('Unknown handoff action');
   const notes=prompt(label+' — factual notes (optional except for hold):','');
   if(notes===null)return 'ui';
   if(d.step==='hold'&&!notes.trim())throw Error('A hold reason is required');
   const today=new Date().toISOString().slice(0,10);
   const date=prompt('Event date (YYYY-MM-DD); recorded at current time:',today);
   if(date===null)return 'ui';
   return recordExternalHandoff(s,{routeId:d.route,stageId:d.stage,action:d.step,onDate:date,notes});
  }
  default:throw Error('Unknown external work action');
 }
}
