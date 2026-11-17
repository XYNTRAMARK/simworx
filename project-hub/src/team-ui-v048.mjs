/* V0.4.8 project workspace views. The only active operator is the owner. */
import {departmentOverview,teamDepartments,customerPreviewProjection,ensureTeamWorkspace} from './team-workspace-v048.mjs';
import {renderApprovedCustomerEvidence,helpTip,helpTopics} from './work-evidence-ui-v051.mjs';
const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const money=n=>'€'+new Intl.NumberFormat('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);
const live=x=>x&&!x.archivedAt;
const options=(rows,value)=>rows.map(([v,label])=>'<option value="'+e(v)+'" '+(v===value?'selected':'')+'>'+e(label)+'</option>').join('');
const shortcut=(title,tab)=>'<button type="button" class="btn small" data-action="project-tab" data-id="'+e(tab)+'">'+e(title)+'</button>';
export function renderProjectTeam(s,ui,projectId){
 const o=departmentOverview(s,projectId),selected=ui.v48Dept||'All',allowed=teamDepartments;
 const budgetText=o.budget>0?money(o.budget):'Not approved';
 const allocation='<div class="v48-finance-strip"><div><small>Internal spending budget</small><b>'+budgetText+'</b></div>'+
  '<div><small>Assigned envelopes</small><b>'+money(o.totalAllocated)+'</b></div>'+
  '<div><small>Available for allocation</small><b>'+ (o.budget>0?money(o.unallocated):'No approved budget')+'</b></div></div>';
 const controls='<form class="v48-allocation-form" data-form="v48-budget-allocation">'+
  '<input type="hidden" name="projectId" value="'+e(projectId)+'"><input type="hidden" name="allocationId" value="'+e(ui.v48EditAllocation||'')+'">'+
  '<label>Department<select name="department" required>'+options(allowed.map(x=>[x,x]),ui.v48AllocationDepartment||'IT')+'</select></label>'+
  '<label>Responsible person<input name="assignee" maxlength="160" required placeholder="e.g. IT technician" value="'+e(ui.v48AllocationPerson||'')+'"></label>'+
  '<label>Authorised envelope (€) '+helpTip(helpTopics.budget)+'<input name="amount" type="number" min="0.01" max="1000000000" step="0.01" required value="'+e(ui.v48AllocationAmount||'')+'" placeholder="20000.00"></label>'+
  '<label>Internal note<input name="note" maxlength="800" value="'+e(ui.v48AllocationNote||'')+'" placeholder="Purpose, limits, approval reference"></label>'+
  '<button type="submit" class="btn primary small">'+(ui.v48EditAllocation?'Save revised envelope':'Assign budget')+'</button>'+
  (ui.v48EditAllocation?'<button type="button" data-action="v48-clear-allocation" class="btn small">Cancel edit</button>':'')+
  '</form>';
 const rows=o.rows.filter(x=>selected==='All'||x.department===selected).map(row=>{
  const allocations=o.allocations.filter(a=>a.department===row.department);
  const uncertain=row.unknownCurrency>0?'<small>'+row.unknownCurrency+' PO lines need EUR exchange rates</small>':'';
  return '<tr><td><strong>'+e(row.department)+'</strong><small>'+row.tasks+' tasks · '+row.requirements+' material lines</small></td>'+
   '<td>'+allocations.map(a=>'<div class="v48-assignee">'+e(a.assignee)+' · '+money(a.amount)+' <button type="button" class="btn small" data-action="v48-edit-allocation" data-id="'+e(a.id)+'">Edit</button></div>').join('')+
    (!allocations.length?'<small>No spending authority assigned</small>':'')+'</td>'+
   '<td>'+money(row.allocated)+'</td><td>'+money(row.committed)+'</td><td>'+money(row.received)+'</td>'+
   '<td><b>'+money(row.remaining)+'</b>'+uncertain+'</td></tr>';
 }).join('');
 const matching=(s.assemblyBOM||[]).filter(x=>live(x)&&x.projectId===projectId).filter(x=>selected==='All'||x.departmentOwner===selected);
 const parts=new Map((s.parts||[]).map(x=>[x.id,x])),assemblyMap=new Map((s.assemblies||[]).map(x=>[x.id,x]));
 const tasks=(s.tasks||[]).filter(x=>live(x)&&x.projectId===projectId);
 const materialRows=matching.map(r=>{
  const part=parts.get(r.partId)||{},task=tasks.find(x=>x.id===r.linkedTaskId);
  return '<tr><td><b>'+e(part.code||'Uncoded')+'</b><small>'+e(part.name||'Unnamed')+'</small></td>'+
  '<td>'+e(assemblyMap.get(r.assemblyId)?.name||'Unassigned assembly')+'</td>'+
  '<td>'+e(r.departmentOwner||'Not assigned')+'</td><td>'+e(r.responsiblePerson||'Not assigned')+'</td>'+
  '<td>'+e(task?.title||'No job linked')+'</td>'+
  '<td><button class="btn small" data-action="v48-edit-material" data-id="'+e(r.id)+'">Assign / link</button></td></tr>';
 }).join('');
 const rec=s.assemblyBOM?.find(x=>x.id===ui.v48EditMaterial&&live(x)&&x.projectId===projectId);
 const editor=rec?'<form class="v48-material-editor" data-form="v48-material-assignment">'+
  '<input type="hidden" name="projectId" value="'+e(projectId)+'"><input type="hidden" name="occurrenceId" value="'+e(rec.id)+'">'+
  '<label>Responsible department<select name="department"><option value="">Not assigned</option>'+
  options(allowed.map(x=>[x,x]),rec.departmentOwner||'')+'</select></label>'+
  '<label>Responsible employee / role<input name="owner" maxlength="160" value="'+e(rec.responsiblePerson||'')+'" placeholder="e.g. Electrical engineer"></label>'+
  '<label>Related work item<select name="taskId"><option value="">No linked job</option>'+
  options(tasks.filter(t=>!rec.departmentOwner||t.department===rec.departmentOwner).map(t=>[t.id,t.title]),rec.linkedTaskId||'')+'</select></label>'+
  '<button class="btn small primary" type="submit">Save departmental responsibility</button>'+
  '<button class="btn small" type="button" data-action="v48-cancel-material">Cancel</button></form>':'';
 return '<section class="v48-workspace"><div class="v48-intro"><h3>People, departments and spending envelopes</h3>'+
  '<p>You are the only operator for now. Assign departmental responsibilities and internal spending limits in one project, without activating employee accounts or giving anyone access to the private contract.</p></div>'+
  allocation+'<div class="v48-warning"><b>Safety:</b> These are owner-managed departmental allocations, not employee purchasing authority or signed approvals. Contract-controlled supplier POs must also pass the recorded owner authorization and departmental envelope gates in Purchasing. Only verified internal purchasing budgets may be allocated; contract revenue is not a spending budget. Actual order figures require linked material requirements and confirmed FX rates for foreign-currency orders.</div>'+
  '<div class="v48-panel"><div class="v48-panel-header"><h4>Assign an internal budget to a department</h4>'+shortcut('Project budget','budget')+'</div>'+
  (o.budget>0?controls:'<p>No internal purchasing budget has been verified yet. Set it in the Project budget tab before assigning any envelope.</p>')+'</div>'+
  '<div class="v48-panel"><div class="v48-panel-header"><h4>Department budget and workload</h4><label>Filter department <select data-filter="v48-dept">'+options([['All','All departments'],...allowed.map(x=>[x,x])],selected)+'</select></label></div>'+
  '<div class="v46-scroll"><table class="v46-table"><thead><tr><th>Department</th><th>Assigned staff</th><th>Allowance</th><th>Open POs (€)</th><th>Received goods (€)</th><th>Allowance left</th></tr></thead>'+
  '<tbody>'+(rows||'<tr><td colspan="6">No departmental activity or allocations yet.</td></tr>')+'</tbody></table></div></div>'+
  '<div class="v48-panel"><div class="v48-panel-header"><h4>Material purchasing responsibilities</h4>'+shortcut('Full buying review','buying')+'</div>'+
  '<p>Assign each engineering material to a department, employee/role and optional parent job. The assignment is used to organise the team view and attribute actual purchase orders.</p>'+
  editor+'<div class="v46-scroll"><table class="v46-table"><thead><tr><th>Material</th><th>Assembly</th><th>Department</th><th>Person</th><th>Work item</th><th>Edit</th></tr></thead>'+
  '<tbody>'+(materialRows||'<tr><td colspan="6">No material lines for this selection.</td></tr>')+'</tbody></table></div></div>'+
  '<div class="v48-panel"><div class="v48-panel-header"><h4>Future employee access</h4></div>'+
  '<p><strong>Not enabled.</strong> A future staff login can show assignments and a department-specific shopping list. Today, all work is edited by the owner and stored in private local JSON. The staff PIN is not an employee identity or permission system.</p></div></section>';
}
export function renderProjectEvidence(s,ui,projectId){
 ensureTeamWorkspace(s);
 const sections=(s.sections||[]).filter(x=>live(x)&&x.projectId===projectId),tasks=(s.tasks||[]).filter(x=>live(x)&&x.projectId===projectId);
 const filter=ui.v48EvidenceSection||'All';
 const attachments=s.projectEvidence.filter(x=>live(x)&&x.projectId===projectId&&(filter==='All'||x.sectionId===filter));
 const photos=attachments.map(p=>'<div class="v48-photo"><img src="'+e(p.dataUrl)+'" alt="'+e(p.title)+'" loading="lazy">'+
  '<div><b>'+e(p.title)+'</b><small>'+e(p.filename)+'</small><small>'+e(sections.find(x=>x.id===p.sectionId)?.name||'Whole project')+
  (p.taskId?' · '+e(tasks.find(x=>x.id===p.taskId)?.title||'Task'):'')+'</small>'+
  '<button type="button" class="btn small" data-action="v48-archive-photo" data-id="'+e(p.id)+'">Archive photo</button></div></div>').join('');
 return '<section class="v48-evidence"><div class="v48-intro"><h3>Project photos and evidence</h3>'+
 '<p>Attach images to a work package or a particular job. Files stay inside your private browser workspace and JSON backup; they are not uploaded online or visible to customers.</p></div>'+
 '<form class="v48-evidence-form v48-panel" data-form="v48-photo"><input type="hidden" name="projectId" value="'+e(projectId)+'">'+
 '<label>Photo title<input required maxlength="180" name="title" placeholder="e.g. Avionics rack wiring before close-up"></label>'+
 '<label>Work package<select name="sectionId" data-filter="v48-photo-section"><option value="">Whole project</option>'+
 options(sections.map(x=>[x.id,x.name]),ui.v48PhotoSection||'')+'</select></label>'+
 '<label>Specific task<select name="taskId"><option value="">No particular task</option>'+
 options(tasks.filter(x=>!ui.v48PhotoSection||x.sectionId===ui.v48PhotoSection).map(x=>[x.id,x.title]),'')+'</select></label>'+
 '<label>JPEG / PNG / WebP photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/*" required></label>'+
 '<button class="btn primary small" type="submit">Add photo to private project</button>'+
 '<p class="v48-form-note">Photos are compressed to a small JPEG before being embedded in your JSON backup. Maximum 30 per project; keep your original high-resolution photos separately. No external hosting or automatic customer sharing.</p></form>'+
 '<div class="v48-panel"><div class="v48-panel-header"><h4>Stored photos ('+attachments.length+')</h4>'+
 '<label>Work package<select data-filter="v48-evidence-section">'+options([['All','All packages'],...sections.map(x=>[x.id,x.name])],filter)+'</select></label></div>'+
 '<div class="v48-photo-grid">'+(photos||'<p>No photos attached to this section yet.</p>')+'</div></div></section>';
}
export function renderCustomerPreview(s,ui,projectId){
 const view=customerPreviewProjection(s,projectId),sections=(s.sections||[]).filter(x=>live(x)&&x.projectId===projectId);
 return '<section class="v48-preview"><div class="v48-intro"><h3>Future customer progress view — owner preview only</h3>'+
 '<p>This is a preview of an explicit section allowlist, not a login page or published customer portal. No staff names, supplier orders, budget, photos, contract documents or private project records are included.</p></div>'+
 '<div class="v48-warning"><strong>Customer access remains disabled.</strong> Production publication needs real server-side authentication, permissions, revocation, audit logs and secure private storage. This offline version cannot enforce those guarantees.</div>'+
 '<div class="v48-panel"><h4>Choose eligible progress sections '+helpTip(helpTopics.customer)+'</h4>'+
 sections.map(sec=>{const rule=s.customerShareRules?.find(x=>x.projectId===projectId&&x.sectionId===sec.id);
 return '<form class="v48-share-row" data-form="v48-customer-rule">'+
 '<input type="hidden" name="projectId" value="'+e(projectId)+'"><input type="hidden" name="sectionId" value="'+e(sec.id)+'">'+
 '<label><input type="checkbox" name="visible" '+(rule?.visible?'checked':'')+'> May appear in a future customer preview</label>'+
 '<b>'+e(sec.name)+'</b>'+
 '<label>Public-safe description<input name="summary" maxlength="500" value="'+e(rule?.summary||'')+'" placeholder="Short verified, customer-safe description"></label>'+
 '<button type="submit" class="btn small">Save rule</button></form>';
 }).join('')+'</div>'+
 '<div class="v48-panel"><h4>What a customer could eventually see</h4>'+
 '<h3>'+e(view.projectName)+'</h3>'+
 (view.sections.map(sec=>'<div class="v48-preview-row"><h4>'+e(sec.title)+'</h4><p>'+e(sec.summary)+'</p><small>'+e(sec.status)+'</small></div>').join('')||'<p>No customer-visible sections selected. Everything remains private.</p>')+
 '</div>'+renderApprovedCustomerEvidence(s,projectId)+'</section>';
}
