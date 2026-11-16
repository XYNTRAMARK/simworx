/* External subcontractor/production handoff timeline.
   All events are locally recorded by a user; the tool cannot verify fault or causes. */
const createId=p=>p+'-'+Math.random().toString(36).slice(2,12);
const stamp=()=>new Date().toISOString();
const required=(v,kind)=>{const s=String(v||'').trim();if(!s||s.length>180)throw Error(kind+' is required (max 180 characters)');return s;};
export const validISODate=x=>!x||(/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x);
const date=v=>{const x=String(v||'').trim();if(!validISODate(x))throw Error('Enter a valid YYYY-MM-DD date');return x;};
export const daysBetween=(a,b)=>{if(!a||!b)return null;return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000)};
const nowDate=()=>stamp().slice(0,10);
function audit(s,routeId,stageId,event,detail='',old={},next={}){
 s.externalWorkEvents.unshift({id:createId('ev'),routeId,stageId:event==='Route created'?null:stageId,
  event,detail:String(detail||'').slice(0,1200),previous:old,next,at:stamp(),recordedBy:'Sim-Worx Demo'});
}
export function ensureExternalWork(s){s.externalWorkRoutes??=[];s.externalWorkEvents??=[];return s}
const getProject=(s,id)=>{
 const p=s.projects?.find(x=>x.id===id&&!x.archivedAt);if(!p)throw Error('Project not found');return p;
};
export const activeRoutes=(s,projectId)=>{ensureExternalWork(s);return s.externalWorkRoutes.filter(x=>!x.archivedAt&&(!projectId||x.projectId===projectId))};
const getRoute=(s,id)=>{ensureExternalWork(s);const v=s.externalWorkRoutes.find(x=>x.id===id&&!x.archivedAt);if(!v)throw Error('External work package unavailable');return v};
const getStage=(r,id)=>{const v=r.stages.find(x=>x.id===id&&!x.archivedAt);if(!v)throw Error('Stage not found');return v;};
export const activeStages=route=>route.stages.filter(x=>!x.archivedAt).sort((a,b)=>a.order-b.order);
export function createExternalRoute(s,{projectId,title,partId,assemblyId,quantity,requiredBy,notes}){
 ensureExternalWork(s);getProject(s,projectId);
 if(partId&&!s.parts.some(x=>x.id===partId&&!x.archivedAt))throw Error('Part not found');
 if(assemblyId&&!s.assemblies?.some(x=>x.id===assemblyId&&x.projectId===projectId&&!x.archivedAt))throw Error('Assembly must belong to the selected project');
 const qty=Number(quantity||1);if(!Number.isSafeInteger(qty)||qty<1)throw Error('Quantity must be a positive whole number');
 const item={id:createId('work'),projectId,title:required(title,'Work package title'),partId:partId||null,
   assemblyId:assemblyId||null,quantity:qty,requiredBy:date(requiredBy),notes:String(notes||'').slice(0,1000),
   stages:[],createdAt:stamp()};
 s.externalWorkRoutes.push(item);audit(s,item.id,null,'Route created',item.title);
 return item;
}
export function addExternalStage(s,{routeId,name,type,company,plannedStart,promisedFinish,notes}){
 const r=getRoute(s,routeId);
 const role=type==='Internal'?'Internal':'External';
 const supplier=required(company|| (role==='Internal'?'Sim-Worx':''),'Company or responsible team');
 const start=date(plannedStart),finish=date(promisedFinish);
 if(start&&finish&&finish<start)throw Error('Expected return cannot precede planned start');
 const stages=activeStages(r);
 const stage={id:createId('stage'),name:required(name,'Stage name'),type:role,company:supplier,
   order:stages.length?Math.max(...stages.map(x=>x.order))+1:1,plannedStart:start,promisedFinish:finish,
   sentAt:'',returnedAt:'',acceptedAt:'',status:'Planned',notes:String(notes||'').slice(0,1000),
   delayReason:'',createdAt:stamp()};
 r.stages.push(stage);
 audit(s,r.id,stage.id,'Stage created',stage.name,{},{name:stage.name,type:stage.type,company:stage.company,plannedStart:start,promisedFinish:finish});
 return stage;
}
export function updateExternalStage(s,{routeId,stageId,name,type,company,plannedStart,promisedFinish,notes,delayReason}){
 const r=getRoute(s,routeId),st=getStage(r,stageId),old={...st};
 const role=type==='Internal'?'Internal':'External',start=date(plannedStart),finish=date(promisedFinish);
 if(start&&finish&&finish<start)throw Error('Expected finish before planned start');
 const next={name:required(name,'Stage name'),type:role,company:required(company||'Sim-Worx','Company or team'),
   plannedStart:start,promisedFinish:finish,notes:String(notes||'').slice(0,1000),
   delayReason:String(delayReason||'').slice(0,600)};
 Object.assign(st,next);
 audit(s,r.id,st.id,'Stage details updated','Schedule and/or responsibility edited',
  Object.fromEntries(Object.keys(next).map(k=>[k,old[k]])),next);
 return st;
}
export function recordExternalHandoff(s,{routeId,stageId,action,onDate,notes}){
 const route=getRoute(s,routeId),st=getStage(route,stageId),when=date(onDate)||nowDate();
 const comment=String(notes||'').trim().slice(0,1200),prior={status:st.status,sentAt:st.sentAt,returnedAt:st.returnedAt,acceptedAt:st.acceptedAt};
 if(!['send','return','accept','hold','resume'].includes(action))throw Error('Invalid external handoff action');
 if(action==='send'){
  if(st.status!=='Planned')throw Error('Stage must be planned before dispatch');
  const stages=activeStages(route),idx=stages.findIndex(x=>x.id===st.id);
  if(idx>0&&stages[idx-1].status!=='Accepted')throw Error('The previous handoff must be accepted first');
  st.sentAt=when;st.status='With supplier';
 }else if(action==='return'){
  if(st.status!=='With supplier'&&st.status!=='On hold')throw Error('Stage is not currently with supplier');
  if(st.sentAt&&when<st.sentAt)throw Error('Return date precedes dispatch');
  st.returnedAt=when;st.status='Returned · inspect';
 }else if(action==='accept'){
  if(st.status!=='Returned · inspect')throw Error('Inspect received work before accepting it');
  if(st.returnedAt&&when<st.returnedAt)throw Error('Acceptance date precedes receipt');
  st.acceptedAt=when;st.status='Accepted';
 }else if(action==='hold'){
  if(st.status!=='With supplier')throw Error('Only work currently with supplier can be placed on hold');
  if(!comment)throw Error('Record a factual hold note');st.status='On hold';
 }else if(action==='resume'){
  if(st.status!=='On hold')throw Error('Stage must be on hold first');
  st.status='With supplier';
 }
 audit(s,route.id,st.id,{send:'Sent to company',return:'Returned to Sim-Worx',accept:'Inspected and accepted',
  hold:'Placed on hold',resume:'Hold cleared'}[action],comment,prior,
  {status:st.status,sentAt:st.sentAt,returnedAt:st.returnedAt,acceptedAt:st.acceptedAt,date:when});
 return st;
}
export function archiveExternalRoute(s,routeId){
 const r=getRoute(s,routeId);r.archivedAt=stamp();
 audit(s,r.id,null,'Work package archived','Historical events remain preserved');return r;
}
export function externalStageTiming(stage,today=nowDate()){
 const end=stage.returnedAt||((stage.status==='With supplier'||stage.status==='On hold')?today:'');
 const elapsed=stage.sentAt&&end?Math.max(0,daysBetween(stage.sentAt,end)):null;
 const overdue=stage.promisedFinish&&(stage.returnedAt||['With supplier','On hold'].includes(stage.status))
   ?Math.max(0,daysBetween(stage.promisedFinish,stage.returnedAt||today)):0;
 return {elapsedDays:elapsed,overdueDays:overdue,finishedLate:!!(stage.returnedAt&&overdue>0),
   activeOverdue:!!(!stage.returnedAt&&['With supplier','On hold'].includes(stage.status)&&overdue>0),
   missingPromise:!stage.promisedFinish};
}
export function externalRouteSummary(s,projectId,today=nowDate()){
 const routes=activeRoutes(s,projectId),all=routes.flatMap(activeStages);
 const late=all.map(st=>({...st,timing:externalStageTiming(st,today)})).filter(x=>x.timing.overdueDays>0);
 return {routes:routes.length,stages:all.length,atSuppliers:all.filter(x=>['With supplier','On hold'].includes(x.status)).length,
  waitingInspection:all.filter(x=>x.status==='Returned · inspect').length,late,
  completedRoutes:routes.filter(r=>activeStages(r).length&&activeStages(r).every(x=>x.status==='Accepted')).length};
}
export function externalWorkTimeline(s,routeId,today=nowDate()){
 const route=getRoute(s,routeId);
 return {route,stages:activeStages(route).map(st=>({...st,timing:externalStageTiming(st,today)})),
  events:s.externalWorkEvents.filter(e=>e.routeId===routeId).sort((a,b)=>a.at.localeCompare(b.at))};
}
export function exportExternalHistoryCSV(s,projectId,today=nowDate()){
 const header=['Project','Work package','Stage','Responsible company','Stage type','Status','Planned start','Promised finish','Sent to company','Returned to Sim-Worx','Inspected/accepted','Days at stage','Days after promised finish','Delay reason (staff entry)','Notes'];
 const cells=[header];
 for(const route of activeRoutes(s,projectId))
 for(const st of activeStages(route)){
  const t=externalStageTiming(st,today);
  cells.push([projectId,route.title,st.name,st.company,st.type,st.status,st.plannedStart,st.promisedFinish,
  st.sentAt,st.returnedAt,st.acceptedAt,t.elapsedDays??'',t.overdueDays||0,st.delayReason||'',st.notes||'']);
 }
 return cells.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
}
