/* Engineering owner sets need-by dates; the buyer sees consolidated project deadlines. */
import {procurementPlan,procurementAlerts,saveRequirementPlan} from './procurement-planning-v043.mjs';
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;','"':'&#39;'}[c]));
export function renderProjectMaterialPlanner(s,projectId){
 const rows=procurementPlan(s,projectId),stats=procurementAlerts(s,projectId);
 const tasks=s.tasks.filter(t=>t.projectId===projectId&&!t.archivedAt);
 const taskOptions=[['','Not linked to a job'],...tasks.map(t=>[t.id,t.title])];
 const formRows=rows.map(r=>{
  const occ=s.assemblyBOM.find(x=>x.id===r.occurrenceId);
  const selector='<select name="linkedTaskId" aria-label="Linked project job">'+taskOptions.map(([v,t])=>
    '<option value="'+h(v)+'" '+(r.linkedTaskId===v?'selected':'')+'>'+h(t)+'</option>').join('')+'</select>';
  return '<tr><td><b>'+h(r.partCode)+'</b><small>'+h(r.partName)+'</small></td>'+
   '<td><form data-form="v43-material-plan" class="v43-planning-form" id="v43-plan-'+h(r.occurrenceId)+'">'+
   '<input type="hidden" name="occurrenceId" value="'+h(r.occurrenceId)+'">'+
   '<input name="requiredBy" value="'+h(r.requiredBy)+'" type="date" aria-label="Material required date"></form></td>'+
   '<td><input form="v43-plan-'+h(r.occurrenceId)+'" type="number" step="1" min="0" max="3650" name="leadDays" value="'+r.leadDays+'" aria-label="Supplier lead days"></td>'+
   '<td><input form="v43-plan-'+h(r.occurrenceId)+'" type="number" step="1" min="0" max="3650" name="bufferDays" value="'+r.bufferDays+'" aria-label="Safety buffer days"></td>'+
   '<td><b>'+h(r.orderBy||'Not scheduled')+'</b></td>'+
   '<td><span class="v43-timing '+h(r.severity)+'">'+h(r.status)+'</span></td>'+
   '<td>'+selector.replace('<select ','<select form="v43-plan-'+h(r.occurrenceId)+'" ')+
   '<input form="v43-plan-'+h(r.occurrenceId)+'" type="text" maxlength="800" name="note" aria-label="Purchasing note" value="'+h(r.purchaseNote)+'" placeholder="Notes"></td>'+
   '<td><button form="v43-plan-'+h(r.occurrenceId)+'" type="submit" class="btn small primary">Save</button></td></tr>';
 }).join('');
 return '<div class="v43-planning"><div class="v43-focus-heading"><div><h3>Plan purchasing before parts are needed</h3>'+
  '<p>Set when the material must arrive, supplier lead time and a safety buffer. We calculate the latest order date.</p></div></div>'+
  '<div><button type="button" class="btn small" data-action="v44-export-buying-schedule" data-project="'+h(projectId)+'">Export buying schedule CSV</button></div>'+ 
  '<div class="v43-planning-kpis">'+
  '<div><b>'+stats.overdue.length+'</b><span>Order deadlines passed</span></div>'+
  '<div><b>'+stats.thisWeek.length+'</b><span>Order within 7 days</span></div>'+
  '<div><b>'+stats.missingDate.length+'</b><span>Need a required-by date</span></div></div>'+
  '<div class="v43-scroll"><table class="v43-table"><thead><tr><th>Material</th><th>Required by</th><th>Lead (days)</th><th>Buffer (days)</th>'+
  '<th>Order no later than</th><th>Planning status</th><th>Linked job / notes</th><th></th></tr></thead><tbody>'+
  (formRows||'<tr><td colspan="8">Create assembly material requirements above to schedule orders.</td></tr>')+
  '</tbody></table></div>'+
  '<p class="v43-note">Lead times and buffers use calendar days. A zero-day lead time is a planning placeholder until independently confirmed; exported schedules flag these for review. Changing a project Gantt task does not silently change a material date; link the task for traceability and update the dates explicitly. Dates only signal a need to order; they do not place an order or modify stock.</p></div>';
}
export function handleMaterialPlanningForm(s,form){
 const f=new FormData(form),v=k=>String(f.get(k)||'').trim();
 return saveRequirementPlan(s,{occurrenceId:v('occurrenceId'),requiredBy:v('requiredBy'),leadDays:v('leadDays'),
  bufferDays:v('bufferDays'),linkedTaskId:v('linkedTaskId'),note:v('note')});
}
