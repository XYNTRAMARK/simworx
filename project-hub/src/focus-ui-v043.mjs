/* Single-project daily control dashboard. Internal only. */
import {progressSnapshot} from './progress-v043.mjs';
import {procurementAlerts} from './procurement-planning-v043.mjs';
import {materialReadinessV041,purchaseStatus,outstanding} from './materials-v041.mjs';
import {externalRouteSummary,activeRoutes,activeStages,externalStageTiming} from './external-work-v043.mjs';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;','"':'&#39;'}[c]));
const btn=(label,tab,cls='')=>'<button class="btn '+cls+'" type="button" data-action="project-tab" data-id="'+tab+'">'+escape(label)+'</button>';
const num=s=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(Number(s)||0);
const status=(title,kind)=>'<span class="v43-status '+kind+'">'+escape(title)+'</span>';
export function renderProjectFocus(s,ui,projectId){
 const p=s.projects.find(x=>x.id===projectId&&!x.archivedAt);if(!p)return '<p>Project not found.</p>';
 const prog=progressSnapshot(s,projectId),planning=procurementAlerts(s,projectId);
 const materials=materialReadinessV041(s,projectId);
 const ext=externalRouteSummary(s,projectId),routes=activeRoutes(s,projectId);
 const orders=s.orders.filter(o=>!o.archivedAt&&o.projectId===projectId);
 const actionable=materials.map(row=>{
  const pending=orders.filter(o=>o.items.some(l=>l.partId===row.partId&&outstanding(l)>0));
  const dispatch=pending.some(o=>purchaseStatus(o)==='Out for delivery');
  const stage=row.toSource>0?['Needs ordering','red']:
   row.incoming>0?[dispatch?'Out for delivery':'Ordered','amber']:
   row.toAllocate<=0?['Allocated','green']:row.freeStock>=row.toAllocate?['In workshop stock','green']:['Covered / pending allocation','amber'];
  return {...row,stage};
 });
 const materialsHTML=actionable.slice(0,20).map(x=>'<tr><td><b>'+escape(x.part.code)+'</b><small>'+escape(x.part.name)+'</small></td>'+
  '<td>'+num(x.required)+'</td><td>'+num(x.toSource)+'</td><td>'+status(x.stage[0],x.stage[1])+'</td></tr>').join('');
 const ordersHTML=orders.slice(0,10).map(o=>{
  const phase=purchaseStatus(o),color=phase==='Received'?'green':phase==='Part received'||phase==='Out for delivery'?'amber':'amber';
  return '<tr><td>'+escape(o.code)+'</td><td>'+escape(o.supplier)+'</td><td>'+status(phase==='Received'?'Delivered':phase,color)+'</td></tr>';
 }).join('');
 const waits=routes.flatMap(route=>activeStages(route).filter(x=>['With supplier','On hold','Returned · inspect'].includes(x.status))
  .map(stage=>({route,stage,timing:externalStageTiming(stage)})));
 const supplierHTML=waits.slice(0,10).map(({route,stage,timing})=>
  '<tr><td><b>'+escape(route.title)+'</b></td><td>'+escape(stage.company)+'</td>'+
  '<td>'+escape(stage.name)+'</td><td>'+escape(stage.promisedFinish||'No date')+'</td>'+
  '<td>'+status(timing.activeOverdue?timing.overdueDays+' days late':stage.status,timing.activeOverdue?'red':'amber')+'</td></tr>').join('');
 const top='<div class="v43-home-grid">'+
  '<div class="v43-home-card v43-home-progress"><div class="v43-home-card-title">MANUAL PROJECT COMPLETION</div>'+
  '<div class="v43-home-value">'+num(prog.earned)+'%</div>'+
  '<div class="v43-progress-track"><span style="width:'+prog.earned+'%"></span></div>'+
  '<p>'+prog.completed+' of '+prog.count+' steps complete'+(prog.fullyWeighted?'':' · '+num(prog.unassigned)+'% weight unallocated')+'</p>'+
  btn('Edit progress steps','progress','small primary')+'</div>'+
  '<div class="v43-home-card"><div class="v43-home-card-title">MATERIALS NEEDING PURCHASE</div>'+
  '<div class="v43-home-value">'+materials.filter(x=>x.toSource>0).length+'</div>'+
  '<p>'+planning.overdue.length+' order deadlines passed · '+planning.thisWeek.length+' due within 7 days</p>'+
  btn('Manage material dates','procurement','small primary')+'</div>'+
  '<div class="v43-home-card"><div class="v43-home-card-title">WITH EXTERNAL COMPANIES</div>'+
  '<div class="v43-home-value">'+ext.atSuppliers+'</div>'+
  '<p>'+ext.late.length+' external stages have recorded delays · '+ext.waitingInspection+' to inspect</p>'+
  btn('See supplier handoffs','external','small primary')+'</div></div>';
 return '<div class="v43-project-focus"><div class="v43-focus-heading"><div><h2>'+escape(p.name)+' · Project control</h2>'+
  '<p>Your working dashboard for procurement, delivery dates, manual completion and suppliers.</p></div></div>'+top+
  '<div class="v43-focus-section"><div class="v43-focus-heading"><div><h3>Project purchase list</h3><p>One consolidated view by part, across the whole project.</p></div>'+
  btn('Manage orders & stock','procurement','small')+'</div>'+
  '<div class="v43-scroll"><table class="v43-table"><thead><tr><th>Material</th><th>Needed</th><th>Still to order</th><th>Supply status</th></tr></thead><tbody>'+
  (materialsHTML||'<tr><td colspan="4">No material requirements yet.</td></tr>')+'</tbody></table></div></div>'+
  '<div class="v43-focus-section"><div class="v43-focus-heading"><div><h3>Outstanding and recent purchase orders</h3></div>'+
  '<button class="btn small" type="button" data-action="v43-purchasing">Open project purchasing</button>'+'</div>'+
  '<div class="v43-scroll"><table class="v43-table"><thead><tr><th>Order</th><th>Supplier</th><th>Status</th></tr></thead><tbody>'+
  (ordersHTML||'<tr><td colspan="3">No purchase orders for this project.</td></tr>')+'</tbody></table></div></div>'+
  '<div class="v43-focus-section"><div class="v43-focus-heading"><div><h3>Currently with external companies</h3></div>'+
  btn('Manage external work','external','small')+'</div>'+
  '<div class="v43-scroll"><table class="v43-table"><thead><tr><th>Work package</th><th>Company</th><th>Stage</th><th>Promised back</th><th>Status</th></tr></thead><tbody>'+
  (supplierHTML||'<tr><td colspan="5">No active external stages yet. Add one in External work.</td></tr>')+'</tbody></table></div></div>'+
  '<p class="v43-footnote">Data here are staff-entered internal project records. No automatic customer updates are published. Supplier delay claims require supporting evidence and review.</p></div>';
}
