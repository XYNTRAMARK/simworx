/* V0.5.1 inline guidance, source-linked evidence and local customer preview controls. */
import {evidenceForJob,evidenceForOccurrence,evidenceKinds,customerEvidenceProjection} from './work-evidence-v051.mjs';
const e=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'" :'&#39;'}[ch]));
const live=x=>x&&!x.archivedAt;
const btn=(action,id,label,extra='')=>'<button type="button" class="btn small '+extra+'" data-action="'+e(action)+'" data-id="'+e(id)+'">'+e(label)+'</button>';
const option=(val,label,selected)=>'<option value="'+e(val)+'" '+(selected===val?'selected':'')+'>'+e(label)+'</option>';
export function helpTip(definition){
 const txt=e(definition);
 return '<span class="v51-help" tabindex="0" aria-label="Help: '+txt+'" title="'+txt+'"><span aria-hidden="true">?</span><span class="v51-tooltip" role="tooltip">'+txt+'</span></span>';
}
export const helpTopics={
 workpackage:'A work package is a major portion of a project, such as Cockpit, Electronics or Testing. It contains jobs and their sub-jobs.',
 job:'A job is a deliverable or task. Give it an action-oriented name and describe what Done means.',
 subjob:'A sub-job is a smaller step underneath the exact row you clicked. You can keep nesting, e.g. MIP → G1000 → Order display → Check receipt.',
 description:'Write practical instructions, specifications, what to produce and how success will be checked. This is your internal working brief.',
 owner:'The person responsible for completing or coordinating the work. Only you can assign people in this offline version.',
 dates:'Planning dates are estimates until you verify them against an approved schedule. These are not automatically contractual deadlines.',
 buyflag:'Flags work needing procurement attention. It creates an action queue entry, NOT an order or supplier commitment. Add the actual part and quantity separately.',
 requirement:'A material requirement specifies WHAT is needed and how many, whether manufactured, bought or customer-supplied. It does not authorize purchasing.',
 spec:'A controlled technical specification: required model/size/interface/performance, source clause and revision. Supplier descriptions do not automatically become contract requirements.',
 evidence:'Attach a photo, screenshot or small PDF to the exact job/material/real purchase-order line. Uploads remain private and are not independently verified.',
 purchaseOrder:'PO means Purchase Order: a genuine documented supplier order. A planning flag, quote or order-confirmation file must not generate a PO automatically.',
 proof:'A quote shows an offer; an order confirmation refers to a recorded PO; a receipt/invoice is not proof of payment; a delivery note is not QA acceptance.',
 customer:'This is an OWNER-ONLY PREVIEW. A work package must first be allowed, and each redacted image separately reviewed and approved. Staff/client access stays disabled.',
 inspection:'QA means Quality Assurance. Inspect physically received goods for correct model, quantity, damage and supporting evidence before accepting stock.',
 budget:'A departmental allowance is the maximum internal amount assigned to the owner for planned buying. It is NOT an approved quote or purchase; specific supplier orders require separate authorization.',
 rfq:'RFQ means Request for Quotation: asking suppliers for price and delivery details. The supplier quotation is an offer, not a placed order.',
 revision:'A revision identifies which approved drawing or technical requirement is current. A change to the source must trigger new engineering verification.',
 nonconformance:'A nonconformance (NCR) records a product that failed specification or quality inspection and needs corrective action.',
 status:'A status is the current work stage. Mark completed only after required child steps, checks and approvals are finished.'
};
function orderOptions(s,occ){
 if(!occ)return [];
 return (s.orders||[]).filter(live).flatMap(po=>(po.items||[]).filter(i=>i.sourceOccurrenceId===occ.id)
  .map(i=>({value:po.id+'|'+i.id,label:po.code+' · '+po.supplier+' · '+i.quantity+' units'})));
}
function uploader(s,task,occ){
 const pos=occ?s.parts.find(p=>p.id===occ.partId):null;
 const orders=orderOptions(s,occ),kind='Photo / screenshot';
 return '<form class="v51-upload" data-form="v51-evidence-add">'+
 '<input type="hidden" name="projectId" value="'+e(task.projectId)+'">'+
 '<input type="hidden" name="taskId" value="'+e(task.id)+'">'+
 '<input type="hidden" name="occurrenceId" value="'+e(occ?.id||'')+'">'+
 '<div class="v51-attach-title"><b>Attach '+e(occ?'evidence to '+(pos?.name||'this material'):'evidence to '+task.title)+'</b>'+helpTip(helpTopics.evidence)+'</div>'+
 '<label>Title<input name="title" required maxlength="180" placeholder="e.g. Supplier order confirmation, connector photograph"></label>'+
 '<label>Document category'+helpTip(helpTopics.proof)+'<select name="kind">'+evidenceKinds.map(([v,t])=>option(v,t,kind)).join('')+'</select></label>'+
 '<label>Associated real PO line (only if applicable)'+helpTip(helpTopics.purchaseOrder)+
 '<select name="orderLine">'+option('','No recorded supplier PO / job reference', '')+orders.map(row=>option(row.value,row.label,'')).join('')+'</select></label>'+
 '<label class="v51-wide">Notes / evidence reference<input name="notes" maxlength="1000" placeholder="Drawing number, source, order reference or what photograph shows"></label>'+
 '<label class="v51-wide">Private JPEG, PNG, WebP or small PDF<input name="file" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" required></label>'+
 '<p class="v51-info v51-wide">Images are compressed before saving. Small PDF files are embedded; keep the original on your PC. This is a local evidence attachment only — it never authorizes, creates or pays an order. The attachment counts toward the private workspace backup size limit.</p>'+
 '<div class="v51-wide"><button class="btn small primary" type="submit">Attach private evidence</button></div></form>';
}
function gallery(s,rows,ui){
 if(!rows.length)return '<p class="v51-info">No job-specific evidence attached yet. Supporting photos can show a purchaser the precise item required.</p>';
 return '<div class="v51-evidence-grid">'+rows.map(f=>{
  const share=f.customerApproval?.visible===true,preview=ui.v51ShareEditor===f.id;
  const isImg=f.mime?.startsWith('image/');
  const file=isImg?'<a href="'+e(f.dataUrl)+'" download="'+e(f.filename)+'" title="Open or save private image">'+
   '<img class="v51-evidence-image" src="'+e(f.dataUrl)+'" alt="'+e(f.title)+'" loading="lazy"></a>':
   '<a class="v51-pdf" href="'+e(f.dataUrl)+'" download="'+e(f.filename)+'">PDF · save private document</a>';
  const controls='<div class="v51-evidence-actions">'+(isImg?
    btn('v51-share-edit',f.id,preview?'Close review':share?'Review / revoke customer image':'Review customer preview'):'' )+
    btn('v51-archive-evidence',f.id,'Archive')+'</div>';
  const form=preview?'<form class="v51-share-form" data-form="v51-evidence-share">'+
   '<input type="hidden" name="evidenceId" value="'+e(f.id)+'">'+
   '<label>Reviewer<input name="reviewer" required maxlength="120" value="'+e(f.customerApproval?.reviewer||'')+'" placeholder="Your name / reviewer"></label>'+
   '<label>Customer-safe caption<input name="caption" required maxlength="400" value="'+e(f.customerApproval?.caption||'')+'" placeholder="e.g. Display module order confirmed"></label>'+
   '<label class="v51-check"><input type="checkbox" name="redactionConfirmed" required> I reviewed and redacted confidential supplier prices, account numbers, personal details and contract data.</label>'+
   '<p class="v51-info">This only marks the image for the owner’s LOCAL customer preview after the work package is separately allowed. No customer login, automatic publication or live portal is enabled.</p>'+
   '<button class="btn small primary" type="submit">Approve redacted image for local preview</button>'+
   (share?btn('v51-revoke-share',f.id,'Revoke visibility'):'')+'</form>':'';
  const context=f.orderId?' · linked to an actual supplier PO':f.occurrenceId?' · linked to material requirement':' · linked to job';
  return '<article class="v51-evidence-item">'+file+'<div class="v51-evidence-body"><b>'+e(f.title)+'</b>'+
   '<small>'+e(f.kind)+context+'</small><small>'+e(f.createdAt?.slice(0,10)||'Date not recorded')+' · owner uploaded, not independently verified</small>'+
   (f.notes?'<p>'+e(f.notes)+'</p>':'')+'<span class="v51-share-state '+(share?'reviewed':'')+'">'+(share?'Selected for local customer preview':'Private · not customer-visible')+'</span>'+
   controls+form+'</div></article>'
 }).join('')+'</div>';
}
export function renderJobEvidence(s,ui,task){
 const recent=evidenceForJob(s,task.id);
 const legacy=(s.projectEvidence||[]).filter(x=>live(x)&&x.taskId===task.id);
 const legacyHtml=legacy.length?'<details><summary>'+legacy.length+' photo(s) from existing project photo gallery</summary><div class="v51-evidence-grid">'+legacy.map(x=>
 '<div class="v51-evidence-item"><img class="v51-evidence-image" src="'+e(x.dataUrl)+'" alt="'+e(x.title)+'"><div class="v51-evidence-body"><b>'+e(x.title)+'</b><small>Legacy private project photo, not approved for customers</small></div></div>').join('')+'</div></details>':'';
 const selectedId=ui.v51EvidenceOccurrence;
 const occ=selectedId?s.assemblyBOM?.find(x=>live(x)&&x.id===selectedId&&x.linkedTaskId===task.id):null;
 const add=ui.v51EvidenceTask===task.id;
 return '<section class="v51-job-evidence"><div class="v51-evidence-heading"><div><h4>Photos, documents &amp; purchasing proof '+helpTip(helpTopics.evidence)+'</h4>'+
 '<p>Evidence travels with the linked job and material. Private by default; never treated as a verified order or a paid invoice.</p></div>'+
 btn('v51-add-job-evidence',task.id,add?'Close uploader':'+ Attach photo / proof','primary')+'</div>'+
 (add?uploader(s,task,occ):'')+
 gallery(s,recent,ui)+legacyHtml+'</section>';
}
export function renderMaterialEvidence(s,ui,occ){
 const job=s.tasks?.find(t=>live(t)&&t.id===occ.linkedTaskId&&t.projectId===occ.projectId);
 const evidence=evidenceForOccurrence(s,occ.id);
 const open=ui.v51EvidenceOccurrence===occ.id&&ui.v51EvidenceTask===job?.id;
 return '<section class="v51-material-evidence"><div class="v51-evidence-heading"><div><h4>Supplier images and purchasing evidence '+helpTip(helpTopics.proof)+'</h4>'+
 '<p>Supporting documents should be attached to this exact requirement and, for an actual confirmation or invoice, its recorded PO line.</p></div>'+
 (job?btn('v51-evidence-material',occ.id,open?'Close attachment':'+ Attach to this item','primary'):'<small>Link this requirement to a job in Work Plan to attach evidence.</small>')+'</div>'+
 (open&&job?uploader(s,job,occ):'')+
 gallery(s,evidence,ui)+'</section>';
}
export function renderApprovedCustomerEvidence(s,projectId){
 const list=customerEvidenceProjection(s,projectId);
 if(!list.length)return '<p>No redacted evidence individually approved for the owner-only customer preview. The work-package allowlist and each attachment both default to hidden.</p>';
 return '<section class="v51-customer-preview"><h4>Reviewed photos in LOCAL customer preview</h4>'+
 '<p class="v51-info">No real customer account can currently access these files. Only descriptions and selected images appear here; original order documents, notes and supplier details remain internal.</p>'+
 '<div class="v51-evidence-grid">'+list.map(x=>'<article class="v51-evidence-item"><img class="v51-evidence-image" src="'+e(x.image)+'" alt="'+e(x.caption)+'">'+
 '<div class="v51-evidence-body"><b>'+e(x.title)+'</b><p>'+e(x.caption)+'</p><small>Locally reviewed '+e(x.approvedAt?.slice(0,10)||'')+'</small></div></article>').join('')+
 '</div></section>';
}
