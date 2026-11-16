/* V0.4.7 visible specification, sourcing stage and delivery inspection controls.
 Private contract reference text is read from the owner’s local imported project only. */
import {procurementState,requirementBaseline,specStatus} from './procurement-workflow-v047.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[c]));
const btn=(action,id,label)=>'<button type="button" class="btn small" data-action="'+esc(action)+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
const select=(name,items,selected)=>'<select name="'+name+'">'+items.map(([v,l])=>'<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select>';
const field=(label,name,value='',extra='')=>'<label>'+esc(label)+'<input name="'+name+'" value="'+esc(value)+'" '+extra+'></label>';
export function renderPlanningDropzones(){
 return '<div class="v47-drag-lanes" role="group" aria-label="Move sourcing requirements between planning stages">'+
 [['Research','Research'],['RFQ requested','Request quote'],['Quote received','Quote received'],
 ['Change requested','Change required'],['Replacement requested','Replacement needed']].map(([v,l])=>
 '<div class="v47-drop-stage" data-v47-drop-stage="'+esc(v)+'" tabindex="0">'+esc(l)+'</div>').join('')+
 '<span class="v47-drag-help">Drag a requirement to a planning lane, or use its Action menu. Dragging never creates an order or marks goods received.</span></div>';
}
export function renderRequirementOperation(s,ui,occurrenceId){
 const b=requirementBaseline(s,occurrenceId),wf=procurementState(s,occurrenceId);
 const review=specStatus(s,occurrenceId),occ=b.occ,source=occ.purchaseSource||{};
 const ref=esc(occurrenceId);
 const inspecting=ui.v47ArrivalOccurrence===occurrenceId,reviewing=ui.v47SpecOccurrence===occurrenceId;
 const options=[
  ['','Select action…'],['Research','Return to research'],['RFQ requested','Mark RFQ requested'],
  ['Quote received','Record quote received'],['On hold','Place on hold'],
  ['Change requested','Wrong model / change required'],
  ['Replacement requested','Request replacement or reorder'],
  ['Ordered','Record an actual supplier order'],['Out for delivery','Record dispatch / in transit'],
  ['Arrived','Record delivery arrival'],['Received','Inspect / accept / reject delivery']
 ];
 const status='<span class="v47-operational-status">'+esc(wf.status)+'</span>'+
  '<small>Technical check: '+esc(review.status)+'</small>'+
  (wf.linked.length?'<small>POs: '+wf.linked.map(x=>esc(x.order.code)).join(', ')+'</small>':'');
 const actions='<div class="v47-ops">'+
  btn('v47-spec-open',occurrenceId,reviewing?'Close spec check':'Check contract spec')+
  (wf.linked.length?btn('v47-arrival-open',occurrenceId,inspecting?'Close arrivals':'Delivery / inspection'):'')+
  '<label>Update stage'+select('notused',options,'').replace('<select','<select data-filter="v47-buy-step" data-id="'+ref+'"')+'</label></div>';
 let specPanel='';
 if(reviewing){
  const spec=occ.specReview||{};
  specPanel='<tr class="v47-spec-review-row"><td colspan="8"><section class="v47-review-panel">'+
  '<h4>Check the supplier model against the contract and approved drawings</h4>'+
  '<p>This information is the local contract-derived reference, not an automatic machine comparison. Verify the exact performance, dimensions, capacity, hardware variant and source revision yourself before approving a purchase.</p>'+
  '<div class="v47-baseline"><div><b>Expected part</b><p>'+esc(b.label)+'</p><small>'+esc(b.partCode)+'</small></div>'+
  '<div><b>Contract hardware reference</b><p>'+esc(b.notes||'No part-specific notes recorded; inspect the controlled Annex')+'</p></div>'+
  '<div><b>Engineering requirement</b><p>'+esc(b.requirementNotes||'No detailed requirement recorded; review the controlled source')+'</p></div></div>'+
  '<form data-form="v47-spec-review" class="v46-inline-form">'+
  '<input type="hidden" name="occurrenceId" value="'+ref+'">'+
  '<label>Decision'+select('decision',[['','Select inspection result'],['Matches contract','Matches specification'],['Deviation proposed','Different specification — hold'],['Does not comply','Wrong specification — reject']],spec.decision||'')+'</label>'+
  '<label class="v46-note-wide">Proposed model and exact supplier specification<textarea name="proposedSpecification" rows="3" maxlength="1500" required placeholder="Manufacturer, model, dimensions, power, software capability, version and key technical specifications">'+esc(spec.proposedSpecification||'')+'</textarea></label>'+
  field('Reviewer','reviewer',spec.reviewer||'','required minlength="3" maxlength="160"')+
  field('Evidence reference','evidenceRef',spec.evidenceRef||'','required minlength="4" maxlength="240" placeholder="Drawing revision, Annex clause, supplier datasheet"')+
  '<label class="v46-note-wide">What was checked?<textarea name="notes" rows="2" maxlength="1200" required>'+esc(spec.notes||'')+'</textarea></label>'+
  '<button type="submit" class="btn small primary">Record specification check</button>'+
  btn('v47-spec-close',occurrenceId,'Close')+'</form>'+
  '<p class="v47-safety-caption">A match is a staff-recorded decision, not an independently authenticated customer sign-off. Source or requirement changes invalidate the check. Proposed deviations cannot be ordered without an approved contract change and re-verification.</p>'+
  (occ.specReviewHistory?.length?'<details><summary>Previous technical reviews ('+occ.specReviewHistory.length+')</summary>'+
    occ.specReviewHistory.slice(-10).reverse().map(x=>'<p>'+esc(x.checkedAt)+' · '+esc(x.decision)+' · '+esc(x.reviewer)+' / '+esc(x.evidenceRef)+'</p>').join('')+'</details>':'')+
  '</section></td></tr>';
 }
 let arrivals='';
 if(inspecting){
  const openLines=wf.linked.filter(x=>Number(x.line.quantity||0)-Number(x.line.received||0)-Number(x.line.closedQuantity||0)>0);
  const orderOptions=openLines.map(x=>[x.order.id+'|'+x.line.id,x.order.code+' · '+x.order.supplier]);
  arrivals='<tr class="v47-arrival-row"><td colspan="8"><section class="v47-review-panel">'+
  '<h4>Goods arrival and receiving quality check</h4>'+
  '<p>An arrival awaiting inspection does not add usable stock. Accept it only after physical checks, or reject it and document the wrong specification or damage.</p>'+
  (orderOptions.length?'<form data-form="v47-record-arrival" class="v46-inline-form">'+
   '<input type="hidden" name="occurrenceId" value="'+ref+'">'+
   '<label>Actual supplier order line'+select('orderLine',orderOptions,orderOptions[0][0])+'</label>'+
   field('Physical quantity arrived','quantity','1','required type="number" min="1" step="1"')+
   field('Delivery note / courier reference','deliveryRef','','required minlength="3" maxlength="200"')+
   '<button type="submit" class="btn small">Record physical arrival</button></form>':
   '<p>No unreceived, open order quantities remain; inspect recorded receipts or amend the actual PO balance.</p>')+
   wf.waiting.map(a=>'<div class="v47-arrival-item"><strong>'+esc(a.quantity)+' unit(s) · '+esc(a.deliveryRef)+'</strong>'+
    '<form data-form="v47-inspect-arrival" class="v46-inline-form">'+
    '<input type="hidden" name="arrivalId" value="'+esc(a.id)+'">'+
    '<label>Result'+select('decision',[['accept','Accept into stock'],['reject','Reject / request correct replacement']],'accept')+'</label>'+
    field('Inspector','reviewer','','required minlength="3" maxlength="160"')+
    field('Inspection report reference','evidenceRef','','required minlength="4" maxlength="240"')+
    field('Findings / mismatch details','notes','','maxlength="800" placeholder="Mandatory when rejecting"')+
    '<button type="submit" class="btn small primary">Record inspection</button></form></div>').join('')+
   (wf.rejected.length?'<div class="v47-warning">'+wf.rejected.length+' delivery rejection(s) recorded. No rejected arrival was added to stock. Request corrected goods or a confirmed new PO as appropriate.</div>':'')+
   btn('v47-arrival-close',occurrenceId,'Close arrivals')+'</section></td></tr>';
 }
 return {status,actions,panels:specPanel+arrivals,stage:wf.status,specStatus:review.status};
}
