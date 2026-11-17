/* V0.4.9: single project purchasing desk; projects are the only primary entry.
   No supplier PO, stock movement, payment or approval is inferred from planning. */
import {projectBuyingSnapshot} from './project-control-v046.mjs';
import {renderRequirementOperation} from './procurement-ui-v047.mjs';
import {procurementState,specStatus} from './procurement-workflow-v047.mjs';
import {approvalStatus,fulfilmentOptions,sourceStatuses} from './procurement-control-v049.mjs';
import {flaggedUnspecifiedPurchases} from './workplan-v050.mjs';
import {renderMaterialEvidence,helpTip,helpTopics} from './work-evidence-ui-v051.mjs';
const e=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[ch]));
const option=(rows,value)=>rows.map(([v,t])=>'<option value="'+e(v)+'" '+(v===value?'selected':'')+'>'+e(t)+'</option>').join('');
const label=(name,control)=>'<label class="v49-field"><span>'+e(name)+'</span>'+control+'</label>';
const inp=(name,value='',type='text',attrs='')=>'<input name="'+e(name)+'" value="'+e(value)+'" type="'+type+'" '+attrs+'>';
const btn=(action,id,description,cls='')=>'<button type="button" class="btn small '+cls+'" data-action="'+action+'" data-id="'+e(id)+'">'+e(description)+'</button>';
const badge=(text,tone='neutral')=>'<span class="v49-pill '+tone+'">'+e(text)+'</span>';
const live=x=>x&&!x.archivedAt;
const money=(n,c='EUR')=>new Intl.NumberFormat('en-GB',{style:'currency',currency:c,maximumFractionDigits:2}).format(Number(n)||0);
const stateTone=status=>status.includes('blocked')||status.includes('required')||status.includes('mismatch')||status.includes('unmapped')?'warn':status.includes('authorization recorded')?'ok':'neutral';
function requirementEditor(r){
 const o=r.occ,source=r.source||{},plan=r.plan||{};
 return '<form data-form="v46-buy-plan" class="v49-form">'+inp('occurrenceId',o.id,'hidden')+
 label('Purchasing responsibility','<select name="responsibility">'+option([['Unverified','Owner to confirm'],['Sim-Worx','Sim-Worx buys'],['Customer-direct','Customer pays / supplies'],['Subcontractor','Subcontractor'] ],r.responsibility)+'</select>')+
 label('Supplier / website name',inp('supplier',source.supplier||'','text','maxlength="160"'))+
 label('Exact vendor model / SKU',inp('vendorSku',source.vendorSku||'','text','maxlength="120"'))+
 label('Supplier quote number',inp('quoteRef',source.quoteRef||'','text','maxlength="120"'))+
 label('Product website (HTTPS)',inp('productUrl',source.productUrl||'','url','maxlength="2048" placeholder="https://..."'))+
 label('Needed by',inp('requiredBy',plan.requiredBy||'','date'))+
 label('Supplier lead time · days (0 = unknown)',inp('leadDays',plan.leadDays||0,'number','min="0" max="3650" step="1"'))+
 label('Planning buffer · days',inp('bufferDays',plan.bufferDays||0,'number','min="0" max="3650" step="1"'))+
 label('Sourcing evidence and supplier notes',inp('sourceNotes',source.notes||'','text','maxlength="800"'))+
 label('Internal purchasing notes',inp('note',plan.purchaseNote||'','text','maxlength="800"'))+
 inp('linkedTaskId',o.linkedTaskId||plan.linkedTaskId||'','hidden')+
 '<div class="v49-form-actions"><button class="btn small primary" type="submit">Save sourcing (not an order)</button>'+btn('v46-cancel-buy-edit',o.id,'Cancel')+'</div></form>';
}
function sourceEditor(r){
 const o=r.occ,t=o.sourceTrace||{};
 return '<form data-form="v49-trace" class="v49-form">'+inp('occurrenceId',o.id,'hidden')+
 label('Controlling document / drawing',inp('document',t.document||'','text','required minlength="4" maxlength="160" placeholder="Document name, not a file upload"'))+
 label('Exact clause, section or drawing',inp('section',t.section||'','text','required minlength="2" maxlength="160"'))+
 label('Document revision / date',inp('revision',t.revision||'','text','required minlength="2" maxlength="90"'))+
 label('Contractual status','<select name="requirementStatus">'+option(sourceStatuses,t.requirementStatus||'pending')+'</select>')+
 label('Who must fulfil the item?','<select name="fulfilment">'+option(fulfilmentOptions,t.fulfilment||'unresolved')+'</select>')+
 label('Scope boundary / unresolved questions','<textarea name="notes" rows="2" maxlength="1200">'+e(t.notes||'')+'</textarea>')+
 '<div class="v49-form-actions"><button class="btn small primary" type="submit">Save controlled source revision</button>'+btn('v49-source-toggle',o.id,'Cancel')+'</div></form>';
}
function approvalEditor(r,app){
 const o=r.occ,a=app.authorisation||{},source=r.source||{};
 const disabled=app.status!=='Owner authorization required';
 if(disabled)return '<p class="v49-hint">The owner approval step is locked: '+e(app.status)+'. Correct source, technical review, department assignment and internal budget before recording authorization.</p>';
 return '<form data-form="v49-approval" class="v49-form">'+inp('occurrenceId',o.id,'hidden')+
 label('Selected supplier (must match sourcing)',inp('supplier',source.supplier||'','text','required maxlength="160"'))+
 label('Manufacturer + exact model under review',inp('manufacturerModel',o.specReview?.proposedSpecification?.slice(0,100)||'','text','required minlength="4" maxlength="300"'))+
 label('Vendor model/SKU',inp('vendorSku',source.vendorSku||'','text','required maxlength="120"'))+
 label('Real supplier quote reference',inp('quoteRef',source.quoteRef||'','text','required maxlength="160"'))+
 label('Maximum authorized quantity',inp('maxQuantity','1','number','required min="1" step="1"'))+
 label('Maximum unit price',inp('maxUnitPrice','','number','required min="0" max="100000000" step="0.01"'))+
 label('Order currency','<select name="currency" data-v49-approval-currency>'+option([['EUR','EUR'],['USD','USD'],['GBP','GBP'],['CAD','CAD']],'EUR')+'</select>')+
 label('EUR per 1 currency unit (EUR=1)',inp('eurRate','1','number','required min="0.000001" step="any"'))+
 label('Tax assumption (%)',inp('taxRate','0','number','required min="0" max="100" step="0.01"'))+
 label('Owner recording approval',inp('reviewer','','text','required minlength="3" maxlength="160"'))+
 label('Actual owner authorization reference',inp('approvalRef','','text','required minlength="5" maxlength="200"'))+
 label('Quotation and price evidence ref',inp('evidenceRef','','text','required minlength="4" maxlength="300"'))+
 '<p class="v49-hint">This creates an owner-entered, dated purchasing authorization tied to this exact contract specification, quote, supplier, quantity, currency and budget envelope. It does not generate, email or place a PO. Record only an authorization you genuinely issued.</p>'+
 '<div class="v49-form-actions"><button type="submit" class="btn small primary">Record factual owner authorization</button></div></form>';
}
function workLinks(s,r){
 const t=s.tasks?.find(x=>live(x)&&x.id===(r.occ.linkedTaskId||r.plan.linkedTaskId));
 const section=s.sections?.find(x=>live(x)&&x.id===(t?.sectionId||r.assembly.sectionId));
 return '<div class="v49-source-meta"><div><span>Work package</span><b>'+e(section?.name||'Not linked')+'</b></div>'+
 '<div><span>Job / sub-job</span><b>'+e(t?.title||t?.name||'Not linked')+'</b>'+(t?.id?btn('v50-open-job-from-buying',t.id,'Open job'):'')+'</div>'+
 '<div><span>Department</span><b>'+e(r.occ.departmentOwner||'Unassigned')+'</b></div>'+
 '<div><span>Responsible</span><b>'+e(r.occ.responsiblePerson||'Unassigned')+'</b></div></div>';
}
function details(s,ui,r){
 const o=r.occ,trace=o.sourceTrace||{},wf=procurementState(s,o.id),ops=renderRequirementOperation(s,ui,o.id);
 const app=approvalStatus(s,o.id),source=String(ui.v49SourceEdit||'')===o.id,edit=ui.v46EditOccurrence===o.id;
 const options=s.purchaseAuthorisations?.filter(a=>a.occurrenceId===o.id);
 const history=options?.length?'<details><summary>Authorizations ('+options.length+') &amp; history</summary>'+options.map(a=>
  '<p>'+e(a.recordedAt||'')+' · '+e(a.approvalRef)+' · '+money(a.maxQuantity*a.maxUnitPrice,a.currency)+
  ' · '+(a.revokedAt?badge('Revoked','warn'):badge('Owner-entered','neutral'))+
  (!a.revokedAt?btn('v49-revoke-authorization',a.id,'Revoke unused balance'):'')+'</p>').join('')+'</details>':'';
 const linked=wf.linked.map(x=>'<div class="v49-linked"><b>'+e(x.order.code)+'</b><span>'+e(x.order.supplier)+' · '+e(x.line.quantity)+' ordered, '+e(x.line.received||0)+' accepted, '+e(x.line.closedQuantity||0)+' closed</span>'+
 btn('v41-order-open',x.order.id,'Open order')+'</div>').join('');
 return '<div class="v49-details"><header><small>ENGINEERING REQUIREMENT '+e(o.id)+'</small><h3>'+e(r.part.name||r.part.code||'Unnamed requirement')+'</h3><div class="v49-chips">'+
 badge(r.make?'MAKE':r.responsibility==='Sim-Worx'?'SIM-WORX BUY':r.responsibility==='Customer-direct'?'BUYER-DIRECT':r.responsibility==='Subcontractor'?'SUBCONTRACT':'RESPONSIBILITY OPEN')+
 badge(wf.status,stateTone(wf.status.toLowerCase()))+'</div></header>'+
 workLinks(s,r)+
 '<div class="v49-stage"><div class="v49-stage-heading"><b>1 · Contract &amp; technical requirement '+helpTip(helpTopics.spec)+'</b>'+btn('v49-source-toggle',o.id,source?'Close editor':trace.document?'Revise source':'Map source')+'</div>'+
 '<p><strong>Controlled source:</strong> '+e(trace.document||'Not recorded')+' · '+e(trace.section||'Clause missing')+' · '+e(trace.revision||'Revision missing')+'</p>'+
 '<p><strong>Scope:</strong> '+e(sourceStatuses.find(x=>x[0]===trace.requirementStatus)?.[1]||'Unverified')+' · '+e(fulfilmentOptions.find(x=>x[0]===trace.fulfilment)?.[1]||'Unresolved')+'</p>'+
 '<p><strong>Specification:</strong> '+e(r.part.notes||'No part-specific technical notes recorded — consult original contract')+'</p>'+
 '<p><strong>Engineering notes:</strong> '+e(o.notes||'No detailed line specification recorded')+'</p>'+
 (source?sourceEditor(r):'')+'</div>'+
 '<div class="v49-stage"><div class="v49-stage-heading"><b>2 · Sourcing and evidence</b>'+btn('v46-edit-buy',o.id,edit?'Close editor':'Edit supplier & plan')+'</div>'+
 '<p><strong>Supplier:</strong> '+e(r.source.supplier||'Not selected')+' · <strong>Model:</strong> '+e(r.source.vendorSku||'Not identified')+'</p>'+
 '<p><strong>Quote:</strong> '+e(r.source.quoteRef||'Not recorded')+' · <strong>Need by:</strong> '+e(r.plan.requiredBy||'Not scheduled')+'</p>'+
 (r.source.productUrl?.startsWith('https://')?'<a class="v49-link" href="'+e(r.source.productUrl)+'" target="_blank" rel="noopener noreferrer">View manufacturer/supplier listing</a>':'<p class="v49-hint">No verified product URL on file</p>')+
 (edit?requirementEditor(r):'')+'</div>'+
 '<div class="v49-stage"><div class="v49-stage-heading"><b>3 · Independent technical review '+helpTip(helpTopics.inspection)+'</b>'+badge(specStatus(s,o.id).status,stateTone(specStatus(s,o.id).status.toLowerCase()))+'</div>'+
 '<p>Record exact manufacturer/model, dimensional and functional comparison, revision, reviewer and actual supporting evidence.</p>'+
 ops.actions+
 (ops.panels?'<table class="v49-embedded"><tbody>'+ops.panels+'</tbody></table>':'')+'</div>'+
 '<div class="v49-stage"><div class="v49-stage-heading"><b>4 · Owner-controlled spending authority</b>'+badge(app.status,stateTone(app.status.toLowerCase()))+'</div>'+
 '<p>Department allocation does not approve the supplier, quotation or purchase. Customer contract price and Buyer-paid components are not internal budget.</p>'+
 (app.authorisation?'<p class="v49-approval"><strong>Approved local record:</strong> '+e(app.authorisation.approvalRef)+
 ' · '+e(app.authorisation.maxQuantity)+' authorized / '+e(app.remaining)+' unused · max '+
 money(app.authorisation.maxUnitPrice,app.authorisation.currency)+' each</p>':'')+
 approvalEditor(r,app)+history+'</div>'+
 '<div class="v49-stage"><div class="v49-stage-heading"><b>5 · Supplier order, delivery &amp; QA '+helpTip(helpTopics.proof)+'</b>'+badge(wf.status,stateTone(wf.status.toLowerCase()))+'</div>'+
 '<p>'+e(wf.pending)+' open units across linked actual orders · '+e(wf.received)+' accepted units. Physical arrival is not stock receipt until QA acceptance.</p>'+
 (app.approved&&r.coverage.toSource>0?btn('v46-prepare-po',o.id,'Prepare approved PO','primary'):'<p class="v49-hint">Purchase order requires a current technical match, an owner authorization, approved budget and an uncovered requirement.</p>')+
 linked+
 (wf.rejected.length?'<p class="v49-warning">'+e(wf.rejected.length)+' rejected arrivals — replacement/return action required</p>':'')+
 '</div>'+renderMaterialEvidence(s,ui,o)+'</div>';
}
export function renderProcurementWorkbench(s,ui,projectId){
 const snapshot=projectBuyingSnapshot(s,projectId),rows=snapshot.rows,query=String(ui.v46BuyingQuery||'').trim().toLowerCase(),mode=ui.v46BuyingMode||'Buy';
 const shown=rows.filter(r=>(mode==='All'||mode==='Buy'&&!r.make||mode==='Make'&&r.make||
 mode==='Review'&&(!r.occ.sourceTrace||r.missingInputs.length||(!r.make&&approvalStatus(s,r.occ.id).status!=='Owner authorization recorded'))||
 mode==='Internal'&&!r.make&&r.responsibility==='Sim-Worx'||mode==='Customer'&&!r.make&&r.responsibility==='Customer-direct'||
 mode==='Covered'&&!r.make&&r.coverage.toSource===0)&&
 (!query||[r.part.name,r.part.code,r.assembly.name,r.source.supplier,r.source.vendorSku,r.occ.departmentOwner,r.occ.responsiblePerson].some(v=>String(v||'').toLowerCase().includes(query))));
 const outstanding=rows.filter(r=>!r.make&&r.coverage.toSource>0),holds=outstanding.filter(r=>approvalStatus(s,r.occ.id).status!=='Owner authorization recorded');
 const awaiting=(s.procurementArrivals||[]).filter(a=>a.status==='Awaiting inspection'&&snapshot.orders.some(o=>o.items?.some(i=>i.id===a.lineId)));
 const unconverted=flaggedUnspecifiedPurchases(s,projectId);
 const selected=shown.find(r=>r.occ.id===ui.v49SelectedOccurrence)||shown[0];
 return '<section class="v49-desk">'+
 '<div class="v49-banner"><div><small>PROJECT PURCHASING · V0.5.1</small><h3>Source, approve, order and inspect in one place</h3>'+
 '<p>Choose a requirement on the left, then follow its five-stage record on the right. No planning action sends an order, records an invoice or books stock.</p></div>'+
 '<div class="v49-banner-tools">'+btn('project-tab','team','Department budgets')+btn('project-tab','work','Work packages')+
 btn('project-tab','assembly','Add engineering requirement')+'</div></div>'+
 '<div class="v49-kpis">'+
 [['Requirements',rows.length],['Needs purchasing decision',holds.length],['Jobs needing item details',unconverted.length],['Actual supplier orders',snapshot.orders.length]].map(([k,v])=>
 '<div class="v49-kpi"><small>'+e(k)+'</small><strong>'+e(v)+'</strong></div>').join('')+'</div>'+
 (unconverted.length?'<section class="v50-procurement-queue"><div><b>'+unconverted.length+' work-plan buying action(s) need specific material details</b>'+
  '<p>These are job instructions, not orderable parts. Open the originating job, enter the exact item, quantity and specification, then review the same requirement here.</p></div>'+
  '<div class="v50-procurement-actions">'+unconverted.map(t=>btn('v50-open-job-from-buying',t.id,'Complete: '+t.title)).join('')+'</div></section>':'')+
 '<div class="v49-toolbar"><label>Search engineering requirements<input type="search" data-filter="v46-buy-query" value="'+e(ui.v46BuyingQuery||'')+'" placeholder="Part, model, work package, department…"></label>'+
 '<label>View<select data-filter="v46-buy-mode">'+option([['Buy','External purchases'],['Review','Needs my attention'],['Internal','Sim-Worx buying'],['Customer','Buyer-direct'],['Make','Manufacture in-house'],['Covered','Covered / ordered'],['All','Every requirement']],mode)+'</select></label></div>'+
 '<div class="v49-layout"><div class="v49-req-list" role="list" aria-label="Project engineering requirements">'+
 (shown.map(r=>{const selectedFlag=r.occ.id===selected?.occ.id,wf=procurementState(s,r.occ.id),approval=approvalStatus(s,r.occ.id);
 return '<button type="button" class="v49-req '+(selectedFlag?'active':'')+'" data-action="v49-select-requirement" data-id="'+e(r.occ.id)+'" aria-pressed="'+selectedFlag+'">'+
 '<span class="v49-req-top"><b>'+e(r.part.code||'Uncoded')+'</b>'+badge(r.make?'MAKE':r.responsibility==='Customer-direct'?'BUYER':r.responsibility==='Sim-Worx'?'SWX BUY':'REVIEW')+'</span>'+
 '<strong>'+e(r.part.name||'Unnamed part')+'</strong><small>'+e(r.assembly.name||'No assembly')+' · Qty '+e(r.occ.quantity)+'</small>'+
 '<span class="v49-req-bottom">'+badge(wf.status,stateTone(wf.status.toLowerCase()))+'<small>'+e(approval.status)+'</small></span></button>'}).join('')||'<div class="v49-nothing">No material requirements match. Open Assemblies to define the engineering BOM, or change the filter.</div>')+
 '</div><div class="v49-main">'+(selected?details(s,ui,selected):'<p>Select a requirement to see its controlled sourcing record.</p>')+'</div></div>'+
 '</section>';
}
