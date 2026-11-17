/* V0.5.2 — deliberately manual owner-only operations view, no network, no bank activity. */
import {attentionItems,invoiceMatch,paymentBalance,recordedAcceptedQuantity} from './ops-v052.mjs';
import {contractControlled} from './procurement-workflow-v047.mjs';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'" :'&#39;'}[c]));
const money=(v,c='EUR')=>new Intl.NumberFormat('en-GB',{style:'currency',currency:c,maximumFractionDigits:2}).format(Number(v)||0);
const btn=(label,action,id='',extras='')=>'<button type="button" class="btn small '+extras+'" data-action="'+e(action)+'" data-id="'+e(id)+'">'+e(label)+'</button>';
const hidden=(n,v)=>'<input type="hidden" name="'+e(n)+'" value="'+e(v)+'">';
const field=(title,n,value='',type='text',attrs='')=>'<label class="v52-field"><span>'+e(title)+'</span><input name="'+e(n)+'" type="'+type+'" value="'+e(value)+'" '+attrs+'></label>';
const option=(rows,selected='')=>rows.map(([id,name])=>'<option value="'+e(id)+'" '+(String(id)===String(selected)?'selected':'')+'>'+e(name)+'</option>').join('');
const form=(type,title,fields)=>'<form class="v52-form" data-form="'+e(type)+'"><h4>'+e(title)+'</h4>'+fields+'<button class="btn small primary">Record manually</button></form>';
export function renderAttention(s,ui,projectId){
 const p=s.projects.find(x=>x.id===projectId),list=attentionItems(s,projectId);
 const counts=[[1,'Urgent'],[2,'Follow-up']].map(([n,name])=>[name,list.filter(x=>x.priority===n).length]);
 const gate=!contractControlled(s,projectId)?'<section class="v52-warning"><h4>New supplier orders are blocked for this project</h4>'+
 '<p>To start genuine purchasing: first review any old PO history, confirm a private internal spend budget, map exact engineering requirements and enable the strict owner-approved purchase workflow. This action does NOT approve a PO, old orders or any supplier payment.</p>'+
 '<form data-form="v52-enable-gate" class="v52-form">'+hidden('projectId',projectId)+
 field('Owner / reviewer','reviewer','','text','required minlength="3" maxlength="120"')+
 field('Migration review reference','reviewReference','','text','required minlength="8" maxlength="240"')+
 '<label class="v52-ack"><input type="checkbox" name="reviewConfirmed" required> I reviewed the project and historic purchase records. I understand each future PO still needs a separate exact technical review, approved quote, budget and owner authorization.</label>'+
 '<button class="btn small primary">Enable strict controls for future orders</button></form></section>':'';
 return '<section class="v52-page"><header><small>OWNER TRIAGE · V0.5.2</small><h3>Needs my attention</h3>'+
 '<p>Derived from the same jobs, engineering materials, supplier POs, inspections and manual invoice records. Resolving an alert means updating its source, not duplicating it here.</p></header>'+
 '<div class="v52-stat">'+counts.map(([name,count])=>'<div><small>'+e(name)+'</small><strong>'+count+'</strong></div>').join('')+
 '<div><small>Open items</small><strong>'+list.length+'</strong></div></div>'+
 gate+
 '<div class="v52-queue">'+(list.length?list.map(x=>'<article class="v52-item '+(x.priority===1?'v52-urgent':'')+'">'+
 '<div><small>'+e(x.type)+' · '+(x.priority===1?'Priority':'Review')+'</small><b>'+e(x.title)+'</b><p>'+e(x.detail)+'</p></div>'+
 btn('Open source','v52-open-source',x.id,'') .replace('data-id="'+e(x.id)+'"','data-id="'+e(x.id)+'" data-tab="'+e(x.tab)+'"')+
 '</article>').join(''):'<p>No current attention rules are triggered. This is not proof of readiness; verify engineering and purchases before work.</p>')+'</div></section>';
}
export function renderOperations(s,ui,projectId){
 const orders=(s.orders||[]).filter(x=>!x.archivedAt&&x.projectId===projectId);
 const selected=orders.find(x=>x.id===ui.v52SelectedOrder)||orders[0];
 const invoices=(s.supplierInvoices||[]).filter(i=>i.projectId===projectId);
 const ncrs=(s.qualityNCRs||[]).filter(n=>n.projectId===projectId);
 const jobs=(s.tasks||[]).filter(t=>!t.archivedAt&&t.projectId===projectId);
 const orderSelector='<label>Recorded purchase order<select data-filter="v52-order">'+option(orders.map(x=>[x.id,x.code+' · '+x.supplier]),selected?.id||'')+'</select></label>';
 const ack=selected?form('v52-ack','1 · Record separate supplier acknowledgement',
  hidden('orderId',selected.id)+field('Actual supplier confirmation reference','reference','','text','required minlength="4"')+
  field('Recorded by','actor','','text','required minlength="3"')+field('Notes (optional)','notes','')):'';
 const invoice=selected?form('v52-invoice','2 · Register a factual supplier invoice (per PO line)',
  '<p>Invoice is never created from a photo. Record the actual document number and independently compare accepted quantities and price. Unmatched invoices stay exceptions and cannot be marked paid.</p>'+
  hidden('orderId',selected.id)+'<label>PO line<select name="lineId" required>'+
  option(selected.items.map(l=>[l.id,l.id+' · '+(s.parts.find(p=>p.id===l.partId)?.name||'Part')+' · PO qty '+l.quantity+' / QA net '+recordedAcceptedQuantity(s,selected.id,l.id)]))+'</select></label>'+
  field('Supplier invoice number','invoiceRef','','text','required minlength="4"')+
  field('Invoice quantity (whole units)','quantity','1','number','required min="1" step="1"')+
  field('Invoice unit price (excl. tax)','unitPrice','','number','required min="0" max="1000000000" step="0.01"')+
  field('Actual tax rate (%)','taxRate',selected.taxRate||0,'number','required min="0" max="100" step="0.01"')+
  hidden('currency',selected.currency)+field('Evidence / document reference','evidenceRef','','text','required minlength="4"')+
  field('Recorded by','actor','','text','required minlength="3"')):'';
 const payments=invoices.map(i=>{const m=invoiceMatch(s,i),b=paymentBalance(s,i.id);
  return '<article class="v52-invoice"><div><b>'+e(i.invoiceRef)+'</b> · '+e(i.supplier)+
   '<small>'+e(i.quantity)+' × '+money(i.unitPrice,i.currency)+' · PO '+e(s.orders.find(o=>o.id===i.orderId)?.code||'?')+'</small>'+
   '<p class="'+(m.matched?'v52-good':'v52-bad')+'">'+(m.matched?'3-way matched from recorded PO, QA receipts and invoice values':'UNMATCHED: '+e(m.reasons.join('; ')))+'</p>'+
   '<p>Manually recorded payment '+money(b.paid,i.currency)+' / '+money(b.due,i.currency)+' · balance '+money(b.remaining,i.currency)+'</p></div>'+
   (m.matched&&b.remaining>0?form('v52-payment','3 · Record an external payment already made',
     hidden('invoiceId',i.id)+field('Actual externally paid amount','amount',b.remaining,'number','required min="0.01" step="0.01"')+
     field('Bank/transfer reference','reference','','text','required minlength="5"')+
     field('Recorded by','actor','','text','required minlength="3"')):'<small>Payment recording disabled until fully matched, or the balance is settled.</small>')+
  '</article>'}).join('');
 const selectedNcr=ncrs.filter(x=>x.status==='Open').map(n=>'<article class="v52-invoice"><b>'+e(n.id)+' · '+e(n.finding)+'</b>'+
 '<p>Responsible: '+e(n.owner)+' · proposed action '+e(n.correctiveAction)+'</p>'+
 form('v52-close-ncr','Close only after actual corrective work and retest',hidden('ncrId',n.id)+
 field('Action actually completed','actionTaken','','text','required minlength="8"')+
 field('Retest evidence reference','retestEvidence','','text','required minlength="4"')+
 field('Closure reviewer','reviewer','','text','required minlength="3"'))+'</article>').join('');
 const quality=jobs.length?form('v52-ncr','4 · Open a nonconformance report (NCR)',
  '<label>Related engineering job<select name="taskId" required>'+option(jobs.map(j=>[j.id,j.title]))+'</select></label>'+
  hidden('projectId',projectId)+'<label>Optional related supplier order line<select name="orderLine"><option value="">Job / process NCR, not a supplier PO</option>'+
  orders.flatMap(o=>o.items.map(l=>[o.id+'|'+l.id,o.code+' · '+l.id])).map(([v,t])=>'<option value="'+e(v)+'">'+e(t)+'</option>').join('')+'</select></label>'+
  '<label class="v52-field"><span>What failed acceptance requirements?</span><textarea name="finding" required minlength="8" rows="3"></textarea></label>'+
  '<label class="v52-field"><span>Corrective action required</span><textarea name="correctiveAction" required minlength="8" rows="3"></textarea></label>'+
  field('Responsible corrective-action owner','owner','','text','required minlength="3"')+
  field('Actual evidence/reference','evidenceRef','','text','required minlength="4"')):'<p>Create an engineering job before raising a job NCR.</p>';
 return '<section class="v52-page"><header><small>SUPPLIER FINANCIAL + QUALITY RECORDS · V0.5.2</small><h3>Purchasing, receipts, invoice and payment are separate</h3>'+
 '<p>All entries are manually recorded observations. Nothing here places an order, contacts a supplier, verifies a bank payment or changes stock. Accepted receipt requires the existing Purchasing QA workflow.</p></header>'+
 (orders.length?'<div class="v52-select">'+orderSelector+'</div>':'<div class="v52-warning">No supplier orders recorded for this project. Begin in Work Plan → Purchasing after exact technical and owner approval.</div>')+
 (selected?'<div class="v52-stat"><div><small>PO</small><strong>'+e(selected.code)+'</strong></div>'+
 '<div><small>Supplier acknowledgements</small><strong>'+(s.supplierAcknowledgements||[]).filter(x=>x.orderId===selected.id).length+'</strong></div>'+
 '<div><small>QA-accepted units</small><strong>'+selected.items.reduce((n,l)=>n+recordedAcceptedQuantity(s,selected.id,l.id),0)+'</strong></div></div>':'')+
 '<div class="v52-grid">'+ack+invoice+'</div><h4>Invoice match &amp; manually recorded payment register</h4>'+
 (payments||'<p>Invoices are not inferred from receipt attachments. Record a real invoice above to see three-way exceptions and balance.</p>')+
 '<h4>Nonconformance and corrective actions</h4><div class="v52-grid">'+quality+
 '<section><h4>Open NCRs</h4>'+(selectedNcr||'<p>No manually recorded open NCRs. This does not replace physical inspection.</p>')+'</section></div>'+
 '<details><summary>Terminology and operating guidance</summary><p><b>PO</b> is an owner-authorized supplier order. <b>Supplier acknowledgement</b> is the separate confirmation a supplier actually accepted it. <b>QA receipt</b> is an inspection record of accepted physical goods. <b>Three-way match</b> checks PO quantity/price, net QA receipts, and invoice entries. <b>NCR</b> records an observed nonconformance and separately documents corrective action and retest. <b>Payment record</b> documents a transfer already executed outside this offline application. An upload is evidence, not a transaction.</p></details></section>';
}
export function renderJobAssurance(s,task){
 const a=task.jobAssurance||{};
 const blocker=a.blocker?' · blocker: '+e(a.blocker):'';
 const predecessors=(task.predecessors||[]).map(id=>s.tasks.find(t=>t.id===id)).filter(Boolean);
 const openDependencies=predecessors.filter(t=>t.status!=='Done');
 const materials=(s.assemblyBOM||[]).filter(o=>!o.archivedAt&&o.linkedTaskId===task.id);
 const readiness=materials.map(o=>{
  const orders=(s.orders||[]).filter(x=>!x.archivedAt&&x.projectId===task.projectId);
  let accepted=0,open=0;
  for(const po of orders)for(const l of po.items||[])if(l.sourceOccurrenceId===o.id){
   accepted+=recordedAcceptedQuantity(s,po.id,l.id);
   open+=Math.max(0,Number(l.quantity||0)-Number(l.received||0)-Number(l.closedQuantity||0));
  }
  const part=s.parts?.find(p=>p.id===o.partId);
  const label=part?.name||part?.code||o.id;
  const isMake=o.makeBuy==='Make'||o.workplanKind==='make';
  return '<li><b>'+e(label)+'</b> — '+(isMake?'Manufacture in-house; check linked production and final inspection':
   'Recorded supplier QA accepted '+e(accepted)+' / required '+e(o.quantity)+'; on order '+e(open))+'</li>';
 }).join('');
 const status='<div class="v52-readiness"><b>Linked readiness snapshot (read only)</b>'+
  '<p>Dependencies: '+(predecessors.length?e(predecessors.length-openDependencies.length)+' / '+e(predecessors.length)+' jobs marked Done'+(openDependencies.length?' — blocked by '+openDependencies.map(t=>e(t.title)).join(', '):''):'None recorded')+'</p>'+
  (materials.length?'<ul>'+readiness+'</ul>':'<p>No linked material requirements. Confirm whether materials are needed.</p>')+
  '<p>Only recorded, QA-accepted supplier quantities count as received here. Stock reservations, customer-supplied items and manufacturing readiness require their own checks; this is NOT an automatic authorization to start or complete work.</p></div>';
 return '<details class="v52-assurance"><summary>Acceptance criteria, material readiness &amp; hours '+(a.criteria?'(documented)':'(needs definition)')+'</summary>'+
 '<p>Define completion requirements before declaring Done. Dependencies are managed in the job editor. Materials on order are NOT QA accepted or ready for use. Recorded hours and blockers require real human input.</p>'+status+
 '<form data-form="v52-job-assurance" class="v52-form">'+hidden('taskId',task.id)+
 '<label class="v52-field"><span>Acceptance checklist (one test/requirement per line)</span><textarea name="criteria" rows="4" maxlength="2200" placeholder="Specific test, tolerance, evidence and acceptance owner…">'+e(a.criteria||'')+'</textarea></label>'+
 '<label class="v52-field"><span>Current blocker</span><textarea name="blocker" rows="2" maxlength="1000">'+e(a.blocker||'')+'</textarea></label>'+
 '<label class="v52-field"><span>Reason for any delay</span><textarea name="delayReason" rows="2" maxlength="1000">'+e(a.delayReason||'')+'</textarea></label>'+
 field('Estimated work hours','estimatedHours',a.estimatedHours??'','number','min="0" max="100000" step="0.25"')+
 field('Actual work hours','actualHours',a.actualHours??'','number','min="0" max="100000" step="0.25"')+
 field('Controlling drawing / technical revision','technicalRevision',a.technicalRevision||'','text','maxlength="160"')+
 field('Recorded by','reviewer',a.reviewer||'','text','required minlength="3"')+
 '<button class="btn small primary">Save job plan revision</button></form>'+
 (a.recordedAt?'<p>Last recorded '+e(a.recordedAt.slice(0,10))+' by '+e(a.reviewer)+blocker+'. Previous revisions: '+(task.jobAssuranceHistory||[]).length+'</p>':'')+'</details>';
}
