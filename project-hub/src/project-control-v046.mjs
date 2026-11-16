/* V0.4.6 — project-first workspace, work plan, and buying decision review.
   Views are projections of existing staff records. No actual orders, approvals,
   supplier confirmations, financials, stock or contract dates are fabricated. */
import {materialReadinessV041,purchaseStatus} from './materials-v041.mjs';
import {materialPlanDates,saveRequirementPlan} from './procurement-planning-v043.mjs';
import {progressSnapshot} from './progress-v043.mjs';
import {externalRouteSummary} from './external-work-v043.mjs';
import {saveRequirementSource,sourceInput} from './procurement-sourcing-v046.mjs';

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const live=x=>x&&!x.archivedAt;
const button=(title,tab,extra='')=>'<button type="button" class="btn small" data-action="project-tab" data-id="'+esc(tab)+'" '+extra+'>'+esc(title)+'</button>';
const num=v=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:0}).format(Number(v)||0);
const date=s=>s?esc(s):'<span class="v46-missing">Not planned</span>';
const goodStatus=st=>st==='Done'?'good':st==='Blocked'?'danger':st==='In progress'||st==='Inspection'?'caution':'muted';
const pill=(text,tone='muted')=>'<span class="v46-pill '+tone+'">'+esc(text)+'</span>';
const missingOwner=s=>!String(s||'').trim()||/^(unassigned|tbc|tbd|unknown)$/i.test(String(s).trim());
const knownSupplier=s=>!missingOwner(s)&&!/to confirm|not confirmed|awaiting supplier|supplier tbc/i.test(String(s));
const intro=(title,subtitle)=>'<div class="v46-intro"><div><h3>'+esc(title)+'</h3><p>'+esc(subtitle)+'</p></div></div>';

export function projectWorkSnapshot(s,projectId){
 const project=s.projects?.find(x=>live(x)&&x.id===projectId);
 if(!project)throw Error('Project not found');
 const jobs=(s.tasks||[]).filter(t=>live(t)&&t.projectId===projectId);
 const sections=(s.sections||[]).filter(t=>live(t)&&t.projectId===projectId);
 const done=jobs.filter(t=>t.status==='Done').length,blocked=jobs.filter(t=>t.status==='Blocked').length;
 const unassigned=jobs.filter(t=>missingOwner(t.assignee)).length;
 const withoutDates=jobs.filter(t=>!t.start||!t.due).length;
 return {project,jobs,sections,done,blocked,unassigned,withoutDates,remaining:jobs.length-done,
  inProgress:jobs.filter(t=>t.status==='In progress').length};
}

export function projectBuyingSnapshot(s,projectId){
 const project=s.projects?.find(x=>live(x)&&x.id===projectId);
 if(!project)throw Error('Project not found');
 const requirements=(s.assemblyBOM||[]).filter(r=>live(r)&&r.projectId===projectId);
 const parts=new Map((s.parts||[]).filter(live).map(p=>[p.id,p]));
 const assemblies=new Map((s.assemblies||[]).filter(live).map(a=>[a.id,a]));
 const byPart=new Map(materialReadinessV041(s,projectId).map(x=>[x.partId,x]));
 const orders=(s.orders||[]).filter(o=>live(o)&&o.projectId===projectId);
 const rows=requirements.map(occ=>{
  const part=parts.get(occ.partId)||{},assembly=assemblies.get(occ.assemblyId)||{};
  const coverage=byPart.get(occ.partId)||{required:0,toSource:0,incoming:0,freeStock:0,reserved:0,issued:0};
  const plan=materialPlanDates(occ);
  const make=String(occ.makeBuy||'Buy').toLowerCase()==='make';
  const source=occ.purchaseSource||{};
  const supplierKnown=knownSupplier(source.supplier||part.supplier);
  const missingDate=!plan.requiredBy,missingLead=!plan.leadDays;
  const missingInputs=[missingDate?'need-by date':null,missingLead?'confirmed lead time':null,
    !supplierKnown&&!make?'supplier':null].filter(Boolean);
  let stage='Review needed',tone='caution',next='Verify the requirement and request an RFQ';
  if(make){stage='Make in-house';tone='muted';next='Schedule workshop fabrication and release drawings';}
  else if(coverage.toSource>0&&coverage.incoming>0){stage='Part-covered by PO';tone='caution';next='Review remaining uncovered quantity and confirmed delivery';}
  else if(coverage.toSource===0&&coverage.incoming>0){stage='Ordered / awaiting receipt';tone='good';next='Track supplier delivery, then record actual receipt';}
  else if(coverage.toSource===0&&coverage.freeStock>0){stage='Workshop stock available';tone='good';next='Verify stock and allocate it to this project';}
  else if(coverage.toSource===0){stage='Covered / verify allocation';tone='good';next='Check reservations, issued stock and PO documents';}
  else if(missingInputs.length){stage='Needs sourcing review';tone='caution';next='Confirm '+missingInputs.join(', ')+' before proposing a PO';}
  else {stage='RFQ / approval required';tone='caution';next='Verify quotation, purchase authority and order terms';}
  return {occ,part,assembly,coverage,plan,source,make,supplierKnown,missingDate,missingLead,missingInputs,stage,tone,next};
 });
 const buy=rows.filter(r=>!r.make),manufacture=rows.filter(r=>r.make);
 return {project,rows,buy,manufacture,orders,
  unplannedBuy:buy.filter(r=>r.missingInputs.length&&r.coverage.toSource>0),
  coveredBuy:buy.filter(r=>r.coverage.toSource===0),
  unconfirmedLead:buy.filter(r=>r.missingLead),
  missingDates:buy.filter(r=>r.missingDate),
  confirmedPOs:orders.length};
}

export function renderProjectFocus(s,ui,projectId){
 const work=projectWorkSnapshot(s,projectId),buying=projectBuyingSnapshot(s,projectId);
 const progress=progressSnapshot(s,projectId),external=externalRouteSummary(s,projectId);
 const progressLabel=progress.weightTotal>0?num(progress.earned)+'% recorded':'Not weighted';
 const progressNote=progress.weightTotal>0?'Manual completion, not independently verified':'Progress headings exist but no weights have been confirmed';
 const summary='<div class="v46-metrics">'+
  '<button type="button" data-action="project-tab" data-id="work" class="v46-metric"><small>WORK PLAN</small><strong>'+num(work.jobs.length)+'</strong><span>'+num(work.remaining)+' not done · '+num(work.withoutDates)+' not fully scheduled</span></button>'+
  '<button type="button" data-action="project-tab" data-id="buying" class="v46-metric"><small>BUYING CANDIDATES</small><strong>'+num(buying.buy.length)+'</strong><span>'+num(buying.manufacture.length)+' make in-house · '+num(buying.unplannedBuy.length)+' need sourcing details</span></button>'+
  '<button type="button" data-action="v43-purchasing" class="v46-metric"><small>ACTUAL PURCHASE ORDERS</small><strong>'+num(buying.confirmedPOs)+'</strong><span>Only orders entered by staff</span></button>'+
  '<button type="button" data-action="project-tab" data-id="progress" class="v46-metric"><small>PROJECT PROGRESS</small><strong class="v46-text-value">'+esc(progressLabel)+'</strong><span>'+esc(progressNote)+'</span></button></div>';
 const process='<div class="v46-process">'+
  '<div><span>01</span><b>Plan the work</b><p>See '+num(work.jobs.length)+' tasks organised by work package. Assign people, dependencies and real dates.</p>'+button('Open work plan','work')+'</div>'+
  '<div><span>02</span><b>Review what to source</b><p>Separate '+num(buying.buy.length)+' proposed buy requirements from '+num(buying.manufacture.length)+' in-house make requirements.</p>'+button('Open buying review','buying')+'</div>'+
  '<div><span>03</span><b>Track actual orders</b><p>Only record a purchase after it has really been placed. Receipt is a separate step.</p>'+button('Open orders & stock','procurement')+'</div>'+
  '<div><span>04</span><b>Inspect and deliver</b><p>Track suppliers, acceptance evidence, project schedule and completion without claiming unverified work.</p>'+button('Supplier QA','external')+'</div></div>';
 const next=work.jobs.filter(t=>t.status==='Blocked'||t.status==='In progress'||t.status==='Ready').slice(0,8);
 const important=next.length?next:work.jobs.slice(0,8);
 const wrows=important.map(t=>'<tr><td><b>'+esc(t.title)+'</b></td><td>'+esc(work.sections.find(x=>x.id===t.sectionId)?.name||'Uncategorised')+'</td>'+
  '<td>'+pill(t.status,goodStatus(t.status))+'</td><td>'+esc(missingOwner(t.assignee)?'Unassigned':t.assignee)+'</td>'+
  '<td>'+date(t.due)+'</td><td><button type="button" data-action="edit-task" data-id="'+esc(t.id)+'" class="btn small">Edit task</button></td></tr>').join('');
 const pending='<div class="v46-panel"><div class="v46-panel-heading"><div><h4>Work that needs organising</h4>'+
  '<p>'+num(work.unassigned)+' unassigned · '+num(work.withoutDates)+' without a complete schedule · '+num(work.blocked)+' blocked</p></div>'+button('See all '+work.jobs.length+' tasks','work')+'</div>'+
  '<div class="v46-scroll"><table class="v46-table"><thead><tr><th>Work item</th><th>Work package</th><th>Status</th><th>Owner</th><th>Due</th><th>Action</th></tr></thead>'+
  '<tbody>'+(wrows||'<tr><td colspan="6">No tasks yet. Add the first work item to start planning.</td></tr>')+'</tbody></table></div></div>';
 const warning='<p class="v46-info"><strong>What do I need to order?</strong> The '+num(buying.buy.length)+' buy candidates are an engineering requirements list — <em>not</em> authorised purchases. Confirm scope, supplier, price/quote, lead time, required date and approval before recording a real supplier order. Internal make items are separate. '+num(buying.confirmedPOs)+' supplier purchase orders are currently recorded.</p>';
 const footer='<div class="v46-mini-links">'+button('Schedule / Gantt','schedule')+button('Manual progress','progress')+
  button('Assemblies & engineering','assembly')+button('Budget','budget')+button('Contract scope','contract')+
  (external.waitingInspection?'<span>'+num(external.waitingInspection)+' supplier returns await inspection</span>':'')+'</div>';
 return '<div class="v46-control">'+intro('Project command centre','Start here: work, purchasing decisions, real orders and evidence — in that order.')+
  summary+process+warning+pending+footer+'</div>';
}

export function renderProjectWorkPlan(s,ui,projectId){
 const snap=projectWorkSnapshot(s,projectId);
 const query=String(ui.v46WorkQuery||'').trim().toLowerCase(),selectedStatus=String(ui.v46WorkStatus||'All');
 const selectedSection=String(ui.v46WorkSection||'All');
 const options=[['All','All statuses'],...['Backlog','Ready','In progress','Blocked','Inspection','Done','Cancelled'].map(x=>[x,x])];
 const select=(name,filter,opts,val)=>'<label class="v46-filter"><span>'+esc(name)+'</span><select data-filter="'+filter+'">'+opts.map(([v,n])=>
  '<option value="'+esc(v)+'" '+(val===v?'selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label>';
 const sections=[...snap.sections,{id:'__unsectioned',name:'Unassigned work package'}];
 const match=t=>(selectedStatus==='All'||t.status===selectedStatus)&&
  (selectedSection==='All'||(t.sectionId||'__unsectioned')===selectedSection)&&
  (!query||[t.title,t.department,t.assignee,t.notes].some(x=>String(x||'').toLowerCase().includes(query)));
 const row=t=>'<tr><td><b>'+esc(t.title)+'</b>'+
  (t.predecessors?.length?'<small>'+t.predecessors.length+' predecessor(s)</small>':'')+'</td>'+
  '<td>'+esc(t.department||'Not assigned')+'</td><td>'+esc(missingOwner(t.assignee)?'Unassigned':t.assignee)+'</td>'+
  '<td>'+pill(t.status,goodStatus(t.status))+'</td><td>'+date(t.start)+'</td><td>'+date(t.due)+'</td>'+
  '<td><button type="button" class="btn small" data-action="edit-task" data-id="'+esc(t.id)+'">Edit</button></td></tr>';
 const groups=sections.map(sec=>{
  const filtered=snap.jobs.filter(t=>(t.sectionId||'__unsectioned')===sec.id&&match(t));
  if(!filtered.length)return '';
  return '<details class="v46-work-group" open><summary><b>'+esc(sec.name)+'</b><span>'+filtered.length+' work item(s)</span></summary>'+
   '<div class="v46-scroll"><table class="v46-table"><thead><tr><th>Task / deliverable</th><th>Team</th><th>Owner</th><th>Status</th><th>Start</th><th>Due</th><th>Edit</th></tr></thead>'+
   '<tbody>'+filtered.map(row).join('')+'</tbody></table></div></details>';
 }).join('');
 const visible=snap.jobs.filter(match).length;
 return '<section class="v46-work">'+intro('Work plan · '+num(snap.jobs.length)+' tasks',
  'Organised under '+num(snap.sections.length)+' work packages. This is the project work breakdown, not the procurement list.')+
  '<div class="v46-metrics v46-metrics-compact">'+
  '<div class="v46-metric"><small>ALL TASKS</small><strong>'+num(snap.jobs.length)+'</strong><span>'+num(visible)+' shown with current filters</span></div>'+
  '<div class="v46-metric"><small>COMPLETE</small><strong>'+num(snap.done)+'</strong><span>Recorded as Done</span></div>'+
  '<div class="v46-metric"><small>UNASSIGNED</small><strong>'+num(snap.unassigned)+'</strong><span>Require a responsible person</span></div>'+
  '<div class="v46-metric"><small>NOT FULLY SCHEDULED</small><strong>'+num(snap.withoutDates)+'</strong><span>Need reviewed start/finish dates</span></div></div>'+
  '<div class="v46-controls"><label class="v46-filter v46-grow"><span>Find work</span>'+
  '<input type="search" value="'+esc(ui.v46WorkQuery||'')+'" data-filter="v46-work-query" placeholder="Search a task, owner, team or note…" aria-label="Search project tasks"></label>'+
  select('Status','v46-work-status',options,selectedStatus)+
  select('Work package','v46-work-section',[['All','All work packages'],...snap.sections.map(x=>[x.id,x.name])],selectedSection)+
  '<div class="v46-actions"><button type="button" data-action="open-task-modal" class="btn small primary">+ Add task</button>'+
  button('Open Gantt','schedule')+'</div></div>'+
  '<p class="v46-info"><strong>Start here:</strong> use Edit on a task to set its responsible team, status, start/finish and predecessor links. The Gantt uses those same records; we do not invent contractual dates or mark work complete automatically.</p>'+
  (groups||'<div class="v46-empty">No tasks match these filters. Clear the filters or add a new project task.</div>')+
  '<div class="v46-mini-links">'+button('Spreadsheet work register','register')+button('Work breakdown editor','structure')+
  button('Project progress steps','progress')+'</div></section>';
}

export function renderProjectBuyingReview(s,ui,projectId){
 const snap=projectBuyingSnapshot(s,projectId),mode=String(ui.v46BuyingMode||'Buy'),query=String(ui.v46BuyingQuery||'').trim().toLowerCase();
 const eligible=snap.rows.filter(r=>(mode==='All'||mode==='Buy'&&!r.make||mode==='Make'&&r.make||
  mode==='Review'&&!r.make&&r.coverage.toSource>0&&r.missingInputs.length>0||
  mode==='Covered'&&!r.make&&r.coverage.toSource===0)&&
  (!query||[r.part.code,r.part.name,r.assembly.name,r.source.supplier,r.source.vendorSku,r.part.supplier].some(x=>String(x||'').toLowerCase().includes(query))));
 const stateLine=r=>{
  const ref=esc(r.occ.id),current=ui.v46EditOccurrence===r.occ.id;
  const editor=current?'<tr class="v46-editor-row"><td colspan="8"><form data-form="v46-buy-plan" class="v46-inline-form">'+
   '<input type="hidden" name="occurrenceId" value="'+ref+'">'+
   '<label>Needed on site by<input type="date" name="requiredBy" value="'+esc(r.plan.requiredBy)+'"></label>'+
   '<label>Confirmed supplier lead time (days)<input type="number" name="leadDays" min="0" max="3650" step="1" value="'+esc(r.plan.leadDays)+'"></label>'+
   '<label>Planning buffer (days)<input type="number" name="bufferDays" min="0" max="3650" step="1" value="'+esc(r.plan.bufferDays)+'"></label>'+
   '<label class="v46-note-wide">Internal purchasing note<input type="text" maxlength="800" name="note" value="'+esc(r.plan.purchaseNote)+'"></label>'+
   '<label>Supplier / website name<input type="text" maxlength="160" name="supplier" value="'+esc(r.source.supplier||'')+'" placeholder="Supplier not yet confirmed"></label>'+
   '<label class="v46-note-wide">Product URL (HTTPS)<input type="url" maxlength="2048" name="productUrl" value="'+esc(r.source.productUrl||'')+'" placeholder="https://supplier.com/product/..."></label>'+
   '<label>Vendor catalogue code<input type="text" maxlength="120" name="vendorSku" value="'+esc(r.source.vendorSku||'')+'"></label>'+
   '<label>Quote reference<input type="text" maxlength="120" name="quoteRef" value="'+esc(r.source.quoteRef||'')+'"></label>'+
   '<label class="v46-note-wide">Sourcing notes<input type="text" maxlength="800" name="sourceNotes" value="'+esc(r.source.notes||'')+'"></label>'+
   '<input type="hidden" name="linkedTaskId" value="'+esc(r.plan.linkedTaskId||'')+'">'+
   '<button class="btn small primary" type="submit">Save planning and sourcing</button>'+
   '<button class="btn small" type="button" data-action="v46-cancel-buy-edit">Cancel</button></form>'+
   '<p class="v46-small">A calculated order-by date is a planning estimate, not a confirmed supplier quote or approval. Change linked task and part master in Detailed materials.</p></td></tr>':'';
  const warn=r.make?'In-house item':r.coverage.toSource===0?'Covered — verify':r.missingInputs.length?'Unconfirmed: '+r.missingInputs.join(', '):'Quote and approval unverified';
  const tr='<tr>'+
   '<td><strong>'+esc(r.part.code||'Uncoded part')+'</strong><small>'+esc(r.part.name||'Unnamed material')+'</small></td>'+
   '<td>'+esc(r.assembly.name||'Unassigned assembly')+'</td>'+
   '<td>'+num(r.occ.quantity)+'<small>per assembly</small></td>'+
   '<td>'+esc(r.make?'MAKE':'BUY')+'</td>'+
   '<td>'+num(r.coverage.toSource)+'<small>project-wide gap</small></td>'+
   '<td>'+pill(r.stage,r.tone)+'<small>'+esc(warn)+'</small>'+
   (r.source.productUrl?'<a href="'+esc(r.source.productUrl)+'" target="_blank" rel="noopener noreferrer" class="v46-source-link">Open product website</a>':'<small>Website not saved</small>')+
   (r.source.vendorSku?'<small>Vendor code: '+esc(r.source.vendorSku)+'</small>':'')+
   (r.source.supplier?'<small>Supplier: '+esc(r.source.supplier)+'</small>':'')+'</td>'+
   '<td>'+date(r.plan.requiredBy)+'<small>Order by: '+(r.plan.orderBy?esc(r.plan.orderBy):'not calculable')+'</small></td>'+
   '<td><button type="button" class="btn small" data-action="v46-edit-buy" data-id="'+ref+'">'+(current?'Close':'Edit line')+'</button></td></tr>';
  return tr+editor;
 };
 return '<section class="v46-buy">'+intro('Buying review · what might we need to source?',
  'Start with engineering requirements; validate each supplier, quotation, schedule and approval before creating any real purchase order.')+
  '<div class="v46-metrics v46-metrics-compact">'+
  '<div class="v46-metric"><small>PROPOSED BUY ITEMS</small><strong>'+num(snap.buy.length)+'</strong><span>Not automatically approved</span></div>'+
  '<div class="v46-metric"><small>MAKE IN WORKSHOP</small><strong>'+num(snap.manufacture.length)+'</strong><span>Not supplier purchases</span></div>'+
  '<div class="v46-metric"><small>MISSING SOURCING INPUTS</small><strong>'+num(snap.unplannedBuy.length)+'</strong><span>Check supplier, date and lead time</span></div>'+
  '<div class="v46-metric"><small>ACTUAL POS RECORDED</small><strong>'+num(snap.confirmedPOs)+'</strong><span>Placed orders only</span></div></div>'+
  '<div class="v46-steps"><span><b>1</b> Validate requirement</span><span><b>2</b> Obtain quotation</span>'+
  '<span><b>3</b> Authorise purchase</span><span><b>4</b> Record PO & receipt</span></div>'+
  '<p class="v46-info"><strong>Important:</strong> these are '+num(snap.rows.length)+' engineering requirement lines, <strong>not orders</strong>. A zero-day lead time means <strong>unconfirmed</strong>, not immediate delivery. The source records do not prove a supplier quote, approved spend or goods receipt. Use the detailed material and Purchasing workspaces only after verifying actual evidence.</p>'+
  '<div class="v46-controls"><label class="v46-filter v46-grow"><span>Find a part or assembly</span>'+
  '<input type="search" value="'+esc(ui.v46BuyingQuery||'')+'" data-filter="v46-buy-query" placeholder="Search material code, description, supplier…" aria-label="Search buying requirements"></label>'+
  '<label class="v46-filter"><span>Show</span><select data-filter="v46-buy-mode">'+
  [['Buy','To buy · review'],['Review','Missing sourcing details'],['Make','Make in-house'],['Covered','Already covered'],['All','All requirements']].map(([k,v])=>
  '<option value="'+k+'" '+(mode===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
  '<div class="v46-actions">'+button('Detailed materials & stock','procurement')+
  '<button type="button" class="btn small" data-action="v43-purchasing">Open purchasing</button></div></div>'+
  '<div class="v46-scroll"><table class="v46-table v46-buy-table"><thead><tr><th>Part / requirement</th><th>Assembly</th><th>Qty</th><th>Source</th>'+
  '<th>Gap*</th><th>Review status</th><th>Need-by / latest PO date</th><th>Action</th></tr></thead><tbody>'+
  (eligible.map(stateLine).join('')||'<tr><td colspan="8">No requirements match this filter.</td></tr>')+
  '</tbody></table></div>'+
  '<p class="v46-small">* Gap is aggregated for the same stock part across the entire project, including outstanding PO quantities. Repeated part identities therefore share the same project-wide gap and must not be added together. “Plan” only saves dates/assumptions; it does not place an order, approve a quote or change stock.</p>'+
  '<div class="v46-mini-links">'+button('Full material editor','procurement')+button('Schedule work','work')+
  button('External supplier handoffs','external')+'</div></section>';
}
export function saveBuyingReviewForm(s,form){
 const f=new FormData(form),value=key=>String(f.get(key)||'').trim();
 const source=sourceInput({supplier:value('supplier'),productUrl:value('productUrl'),vendorSku:value('vendorSku'),
  quoteRef:value('quoteRef'),notes:value('sourceNotes')});
 const plan=saveRequirementPlan(s,{occurrenceId:value('occurrenceId'),requiredBy:value('requiredBy'),
  leadDays:value('leadDays'),bufferDays:value('bufferDays'),linkedTaskId:value('linkedTaskId'),
  note:value('note')});
 saveRequirementSource(s,{occurrenceId:value('occurrenceId'),...source});
 return plan;
}
