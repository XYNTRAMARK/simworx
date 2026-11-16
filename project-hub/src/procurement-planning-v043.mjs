/* Procurement date planner for assembly E-BOM requirements. Local browser simulation. */
import {materialReadinessV041} from './materials-v041.mjs';
const goodDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const validDate=(v,label)=>{const s=String(v||'').trim();if(s&&!goodDate(s))throw Error(label+' must be YYYY-MM-DD');return s};
const nonnegative=(v,label)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>3650)throw Error(label+' must be 0–3650 days');return n};
export const addDays=(date,days)=>{if(!goodDate(date))throw Error('Invalid plan date');return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10)};
export const daysUntil=(date,today)=>Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/86400000);
export function saveRequirementPlan(s,{occurrenceId,requiredBy,leadDays,bufferDays,linkedTaskId,note}){
 const occ=s.assemblyBOM?.find(x=>x.id===occurrenceId&&!x.archivedAt);
 if(!occ)throw Error('Material requirement not found');
 const projectId=occ.projectId;
 if(linkedTaskId&&!s.tasks.some(t=>t.id===linkedTaskId&&t.projectId===projectId&&!t.archivedAt))throw Error('Linked job must belong to this project');
 const plan={requiredBy:validDate(requiredBy,'Required-by date'),leadDays:nonnegative(leadDays,'Supplier lead time'),
  bufferDays:nonnegative(bufferDays,'Safety buffer'),linkedTaskId:linkedTaskId||null,
  purchaseNote:String(note||'').trim().slice(0,800)};
 occ.purchasePlan=plan;
 s.audit??=[];
 s.audit.unshift({id:'audit-'+Math.random().toString(36).slice(2,9),action:'Material order plan changed',
  detail:occ.id+' / required '+(plan.requiredBy||'unscheduled'),actor:'Sim-Worx Demo',at:new Date().toISOString()});
 return plan;
}
export function materialPlanDates(occ){
 const plan=occ.purchasePlan||{},need=plan.requiredBy||'';
 return {requiredBy:need,leadDays:plan.leadDays||0,bufferDays:plan.bufferDays||0,
   orderBy:need?addDays(need,-(Number(plan.leadDays||0)+Number(plan.bufferDays||0))):'',
   linkedTaskId:plan.linkedTaskId||null,purchaseNote:plan.purchaseNote||''};
}
export function procurementPlan(s,projectId,today=new Date().toISOString().slice(0,10)){
 const need=materialReadinessV041(s,projectId),lookup=new Map(need.map(x=>[x.partId,x]));
 const occurrences=(s.assemblyBOM||[]).filter(x=>x.projectId===projectId&&!x.archivedAt);
 return occurrences.map(x=>{
  const part=s.parts.find(p=>p.id===x.partId),dates=materialPlanDates(x),quantity=lookup.get(x.partId);
  const toSource=quantity?.toSource||0,unresolved=quantity?.toAllocate||0;
  const due=dates.orderBy?daysUntil(dates.orderBy,today):null;
  const toBuy=toSource>0,needsAttention=unresolved>0;
  const status=!dates.orderBy?'Unscheduled':!toBuy&&!needsAttention?'Stock allocated':
    !toBuy?'Covered: reserve/receive':due<0?'Order overdue':due<=7?'Order this week':'Order planned';
  const severity=!dates.orderBy?'neutral':toBuy&&due<0?'danger':toBuy&&due<=7?'warning':toBuy?'neutral':'success';
  return {occurrenceId:x.id,partId:x.partId,partName:part?.name||'',partCode:part?.code||'',quantity:x.quantity,
    projectId,assemblyId:x.assemblyId,...dates,toSource,unresolved,dueDays:due,status,severity};
 }).sort((a,b)=>(a.orderBy||'9999').localeCompare(b.orderBy||'9999')||a.partCode.localeCompare(b.partCode));
}
export function procurementAlerts(s,projectId,today=new Date().toISOString().slice(0,10)){
 const rows=procurementPlan(s,projectId,today);
 return {rows,overdue:rows.filter(x=>x.severity==='danger'),thisWeek:rows.filter(x=>x.severity==='warning'),
  missingDate:rows.filter(x=>!x.requiredBy),unresolved:rows.filter(x=>x.toSource>0)};
}

/* Read-only buying schedule handoff; never creates a PO, changes stock, or fills unknowns. */
export function exportProcurementReviewCSV(s,projectId,today=new Date().toISOString().slice(0,10)){
 const project=s.projects?.find(p=>p.id===projectId&&!p.archivedAt);
 if(!project)throw Error('Project not found');
 const rows=procurementPlan(s,projectId,today);
 const header=['Occurrence ID','Part code','Part / package','Quantity','Required by','Supplier lead days (0 may mean unconfirmed)',
 'Buffer days','Order by (calculated)','Planning status','Supplier name (staff master)',
 'Lead time unconfirmed','Linked job ID','Internal purchase note'];
 const cells=[header,...rows.map(r=>{
  const p=s.parts.find(x=>x.id===r.partId)||{};
  return [r.occurrenceId,r.partCode,r.partName,r.quantity,r.requiredBy,r.leadDays,r.bufferDays,
   r.orderBy,r.status,p.supplier||'',r.leadDays===0?'REVIEW':'',r.linkedTaskId||'',r.purchaseNote||''];
 })];
 const csv=v=>{
  let x=String(v??'');
  // Spreadsheet formula injection protection for staff-entered names and notes.
  if(/^\s*[=+@-]/.test(x)&&!/^\d{4}-\d{2}-\d{2}$/.test(x))x="'"+x;
  return '"'+x.replace(/"/g,'""')+'"';
 };
 return cells.map(row=>row.map(csv).join(',')).join('\r\n');
}
