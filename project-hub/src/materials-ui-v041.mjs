/* V0.4.1 purchasing/stock/project-materials user interface.
   Every operation changes shared browser-local Project Hub records, not external systems. */
import {ensureMaterials,available,outstanding,purchaseStatus,createPurchaseOrder,addPurchaseLine,
receivePurchaseLine,returnPurchaseReceipt,reserveProjectStock,issueProjectStock,releaseProjectStock,consumeIssuedStock,
reservationRemaining,materialReadinessV041,assemblyAllocationReadiness,saveOrderShipment,setPurchaseDispatch,
addOrderAttachment,removeOrderAttachment,createWorkspaceBackup,parseWorkspaceBackup} from './materials-v041.mjs';
import {activeAssemblies,saveOccurrence,archiveManufacturing,assemblyRollup} from './manufacturing.mjs';
import {procurementPlan} from './procurement-planning-v043.mjs';
import {renderProjectMaterialPlanner} from './planning-ui-v043.mjs';
import {savePart} from './model.mjs';
import {renderProjectBuyingReview,projectBuyingSnapshot} from './project-control-v046.mjs';
import {updatePurchaseLineRecord,safeProductURL} from './procurement-sourcing-v046.mjs';
import {contractControlled,specStatus} from './procurement-workflow-v047.mjs';

const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'" :'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(Number(n)||0);
const date=x=>x?String(x).slice(0,10):'Not set';
const btn=(label,action,attrs='',cls='')=>'<button type="button" class="btn '+cls+'" data-action="'+h(action)+'" '+attrs+'>'+label+'</button>';
const pick=(name,options,current='',extra='')=>'<select name="'+h(name)+'" '+extra+'>'+options.map(([v,label])=>'<option value="'+h(v)+'" '+(String(v)===String(current)?'selected':'')+'>'+h(label)+'</option>').join('')+'</select>';
const input=(name,value='',type='text',extra='')=>'<input name="'+h(name)+'" type="'+type+'" value="'+h(value)+'" '+extra+'>';
const label=(title,control)=>'<label class="v41-field"><span>'+h(title)+'</span>'+control+'</label>';
const panel=(title,body,sub='')=>'<div class="v41-panel"><div class="v41-panel-heading"><h3>'+h(title)+'</h3>'+(sub?'<p>'+h(sub)+'</p>':'')+'</div>'+body+'</div>';
const badge=(t,kind='')=>'<span class="v41-pill '+kind+'">'+h(t)+'</span>';
const activeOrders=s=>s.orders.filter(o=>!o.archivedAt);
const proj=s=>s.projects.filter(p=>!p.archivedAt);
const asm=(s,pid)=>activeAssemblies(s,pid);
const sku=s=>s.parts.filter(p=>!p.archivedAt).map(p=>[p.id,p.code+' · '+p.name]);
const asmOptions=(s,pid)=>[['','No specific assembly'],...asm(s,pid).map(a=>[a.id,a.name])];
const projectOptions=s=>proj(s).map(p=>[p.id,p.code+' · '+p.name]);
const cost=(amount,currency)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'EUR',maximumFractionDigits:2}).format(Number(amount)||0);
const orderTotal=o=>(o.items||[]).reduce((n,l)=>n+Number(l.quantity)*Number(l.unitCost||0),0);
const reservedBy=(s,partId,projectId)=>s.stockReservations.filter(r=>r.partId===partId&&r.projectId===projectId).reduce((n,r)=>n+reservationRemaining(r),0);
const tracked=(s,partId)=>s.stockReservations.filter(r=>r.partId===partId).reduce((n,r)=>n+reservationRemaining(r),0);
const estimateLeft=(s,p)=>Math.max(0,Number(p.reserved||0)-tracked(s,p.id));

export function renderProjectSupply(s,ui,projectId){
 ensureMaterials(s);
 const p=s.projects.find(p=>p.id===projectId);
 if(!p)return '<p>Project not found</p>';
 const rows=materialReadinessV041(s,projectId);
 const shortage=rows.filter(x=>x.toSource>0);
 const assemblies=asm(s,projectId);
 const orders=activeOrders(s).filter(o=>o.projectId===projectId);
 const form='<form data-form="v41-requirement" class="v41-inline-form">'+
   '<input type="hidden" name="projectId" value="'+h(projectId)+'">'+
   label('Assembly',pick('assemblyId',assemblies.map(a=>[a.id,a.name]),assemblies[0]?.id,'required'))+
   label('Stock part',pick('partId',sku(s),'','required'))+
   label('Quantity / assembly',input('quantity',1,'number','min="1" step="1" required'))+
   label('Position',input('position',''))+
   '<button type="submit" class="btn primary">Add required material</button></form>';
 const rowsHTML=rows.map(r=>{
   const others=s.stockReservations.filter(x=>x.partId===r.partId&&x.projectId!==projectId).reduce((n,x)=>n+reservationRemaining(x),0);
   const free=r.freeStock;
   const canReserve=free>0&&r.toAllocate>0;
   const choices=assemblies.filter(a=>assemblyRollup(s,a.id).parts.some(x=>x.partId===r.partId)).map(a=>[a.id,a.name]);
   const allocation=canReserve?'<form data-form="v41-reserve" class="v41-table-form"><input type="hidden" name="projectId" value="'+h(projectId)+'"><input type="hidden" name="partId" value="'+h(r.partId)+'">'+pick('assemblyId',choices.length?choices:assemblies.map(a=>[a.id,a.name]),choices[0]?.[0], 'aria-label="Assembly for reservation" required')+input('quantity',Math.min(free,r.toAllocate),'number','min="1" max="'+Math.min(free,r.toAllocate)+'" required aria-label="Quantity to reserve"')+'<button class="btn small primary">Reserve</button></form>':'<span class="v41-muted">Not available to reserve</span>';
   const relevantOrders=orders.filter(o=>o.items.some(l=>l.partId===r.partId&&outstanding(l)>0));
   const dispatch=relevantOrders.some(o=>purchaseStatus(o)==='Out for delivery');
   const partiallyReceived=relevantOrders.some(o=>purchaseStatus(o)==='Part received');
   const stage=r.toAllocate===0?'Allocated':r.incoming>0?(partiallyReceived?'Part received':dispatch?'Out for delivery':'Ordered'):
     r.toSource>0?'Needs ordering':'In stock · allocate';
   const orderBtn=btn('Order shortage','v41-order-prefill','data-project="'+h(projectId)+'" data-part="'+h(r.partId)+'" data-qty="'+Math.max(1,r.toSource||r.toAllocate)+'"','small');
   return '<tr><td><strong>'+h(r.part.code)+'</strong><small>'+h(r.part.name)+'</small></td>'+
    '<td>'+fmt(r.required)+'</td><td>'+fmt(r.reserved)+'</td><td>'+fmt(r.issued)+'</td>'+
    '<td><b>'+fmt(free)+'</b><small>'+fmt(others)+' reserved elsewhere'+(estimateLeft(s,r.part)?' · '+fmt(estimateLeft(s,r.part))+' legacy/unassigned':'')+'</small></td>'+
    '<td>'+fmt(r.incoming)+'</td><td>'+badge(stage,r.toSource?'danger':r.toAllocate?'warn':'good')+'<small>'+(r.toSource?fmt(r.toSource)+' still to order':'')+'</small></td>'+
    '<td>'+allocation+orderBtn+'</td></tr>';
 }).join('');

 const occurrences=s.assemblyBOM.filter(x=>x.projectId===projectId&&!x.archivedAt&&assemblies.some(a=>a.id===x.assemblyId));
 const requirementRows=occurrences.map(x=>{
   const p=s.parts.find(p=>p.id===x.partId),a=assemblies.find(a=>a.id===x.assemblyId);
   if(ui.materialEditOccurrence===x.id){
     return '<tr class="v42-edit-row"><td colspan="5"><form data-form="v42-material-edit" class="v42-material-form">'+
       '<input type="hidden" name="recordId" value="'+h(x.id)+'">'+
       label('Part identity',pick('partId',sku(s),x.partId,'required'))+
       label('Quantity',input('quantity',x.quantity,'number','min="1" step="1" required'))+
       label('Position / reference',input('position',x.position||''))+
       label('Make / buy',pick('makeBuy',[['Buy','Buy'],['Make','Make']],x.makeBuy||'Buy'))+
       '<div class="v41-actions"><button class="btn small primary" type="submit">Save change</button>'+
       btn('Cancel','v42-material-cancel','','small')+'</div></form></td></tr>';
   }
   return '<tr><td><b>'+h(p?.code||'Unknown')+'</b><small>'+h(p?.name||'Part missing')+'</small></td>'+
     '<td>'+h(a?.name||'Unknown assembly')+'</td><td>'+fmt(x.quantity)+'</td><td>'+h(x.position||'—')+'</td>'+
     '<td><div class="v41-actions">'+btn('Edit','v42-material-edit','data-id="'+h(x.id)+'"','small')+
     btn('Remove','v42-material-remove','data-id="'+h(x.id)+'"','small danger')+
     btn('Edit part master','v42-edit-master','data-id="'+h(x.partId)+'"','small')+'</div></td></tr>';
 }).join('');

 const quickForm=ui.showQuickPart?'<form class="v43-quick-part-form" data-form="v43-quick-part">'+
   '<input type="hidden" name="projectId" value="'+h(projectId)+'">'+
   label('Part/SKU number',input('code','','text','required maxlength="80" placeholder="SW-PAN-001"'))+
   label('Description',input('name','','text','required placeholder="Cut aluminium panel"'))+
   label('Unit',input('unit','ea','text','required'))+
   label('Preferred supplier',input('supplier',''))+
   label('Est. unit cost (€)',input('cost',0,'number','min="0" step="0.01" required'))+
   label('For project assembly',pick('assemblyId',assemblies.map(a=>[a.id,a.name]),assemblies[0]?.id,'required'))+
   label('Quantity required',input('quantity',1,'number','min="1" step="1" required'))+
   '<button class="btn primary" type="submit">Create and add to project</button>'+
   btn('Cancel','v43-quick-part-cancel','','small')+'</form>':'';
 const archivedReq=s.assemblyBOM.filter(x=>x.projectId===projectId&&x.archivedAt);
 const requirementsPanel=panel('Material requirements · add / edit / remove',
  '<div class="v41-toolbar">'+btn('+ New part identity','v42-new-part','','small primary')+quickForm+
  '<p class="v41-caption">Changing the selected part here affects only this requirement. Editing the master SKU affects every project using it.</p></div>'+
  (assemblies.length?form:'<p class="v41-notice">Create an assembly first in Assembly control.</p>')+
  '<div class="v41-scroll"><table class="v41-table"><thead><tr><th>Part identity</th><th>Assembly</th><th>Qty</th><th>Position</th><th>Controls</th></tr></thead><tbody>'+
  (requirementRows||'<tr><td colspan="5">No project material requirements yet.</td></tr>')+'</tbody></table></div>'+
  (archivedReq.length?'<details class="v42-archived"><summary>'+archivedReq.length+' removed material lines (restore)</summary>'+
    archivedReq.map(x=>'<div>'+h(s.parts.find(p=>p.id===x.partId)?.code||x.partId)+
      ' · '+h(x.position||'No position')+' '+btn('Restore','v42-material-restore','data-id="'+h(x.id)+'"','small')+'</div>').join('')+'</details>':''));

 const res=s.stockReservations.filter(r=>r.projectId===projectId);
 const reservationRows=res.map(r=>{
  const p=s.parts.find(p=>p.id===r.partId);
  const a=s.assemblies.find(a=>a.id===r.assemblyId);
  const remain=reservationRemaining(r);
  const issue=remain?'<form class="v41-table-form" data-form="v41-issue">'+
    '<input type="hidden" name="reservationId" value="'+h(r.id)+'">'+
    input('quantity',remain,'number','min="1" max="'+remain+'" required aria-label="Issue quantity"')+
    '<button class="btn small">Issue</button></form>':'';
  const release=remain?btn('Release '+remain,'v41-release','data-id="'+h(r.id)+'"','small'):'';
  const consume=Number(r.issued||0)-Number(r.consumed||0)>0?'<form class="v41-table-form" data-form="v41-consume">'+
    '<input type="hidden" name="reservationId" value="'+h(r.id)+'">'+
    input('quantity',Number(r.issued||0)-Number(r.consumed||0),'number','min="1" max="'+(Number(r.issued||0)-Number(r.consumed||0))+'" required aria-label="Consume quantity"')+
    '<button class="btn small">Consume</button></form>':'';
  return '<tr><td>'+h(p?.code)+'</td><td>'+h(a?.name||'Project allocation')+'</td><td>'+fmt(remain)+'</td><td>'+fmt(r.issued||0)+'</td><td>'+fmt(r.consumed||0)+'</td><td><div class="v41-actions">'+issue+release+consume+'</div></td></tr>';
 }).join('');
 return '<div class="v41"><div class="v41-intro"><div><h2>Project procurement & materials</h2><p>Assembly BOM → shared workshop inventory → reservations → purchasing → receipts → workshop issue.</p></div>'+badge('V0.4.8 · Local workspace')+'</div>'+
  '<div class="v41-kpis"><div><b>'+rows.length+'</b><span>Required part SKUs</span></div><div><b>'+shortage.length+'</b><span>Materials still to source</span></div><div><b>'+orders.length+'</b><span>Purchase orders for project</span></div><div><b>'+res.filter(x=>reservationRemaining(x)>0).length+'</b><span>Active allocations</span></div></div>'+
  requirementsPanel+
  renderProjectMaterialPlanner(s,projectId)+
  panel('Stock check & order requirements','<div class="v41-scroll"><table class="v41-table"><thead><tr><th>Part</th><th>BOM need</th><th>Reserved here</th><th>Issued here</th><th>Available / other projects</th><th>On order</th><th>Order stage / shortage</th><th>Allocate / order</th></tr></thead><tbody>'+rowsHTML+'</tbody></table></div><p class="v41-caption">Available means on-hand less ALL project and legacy reservations. Goods merely ordered are never counted in on-hand stock. BOM requirements from nested assemblies are rolled up.</p>')+
  panel('Project allocations & workshop issue','<div class="v41-scroll"><table class="v41-table"><thead><tr><th>Part</th><th>Assembly</th><th>Reserved</th><th>Issued</th><th>Consumed</th><th>Action</th></tr></thead><tbody>'+(reservationRows||'<tr><td colspan="6">No project-specific stock reservations yet.</td></tr>')+'</tbody></table></div>')+
  '<div class="v41-heading"><h3>Purchase orders linked to this project</h3>'+btn('+ Create purchase order','v41-order-new','data-project="'+h(projectId)+'"','small primary')+'</div>'+
  (ui.materialOrderEditor?renderOrderComposer(s,ui,projectId):'')+
  orderRegister(s,ui,projectId)+orderDetailIfSelected(s,ui,projectId)+'</div>';
}
function orderLineEditor(s,projectId,seed={},idx=0){
 return '<div class="v41-po-line" data-v41-po-line><b>Order line</b>'+
   label('Part',pick('poPart',sku(s),seed.partId||s.parts[0]?.id,'required'))+
   label('Qty',input('poQty',seed.quantity||1,'number','min="1" step="1" required'))+
   label('Cost each',input('poCost',seed.unitCost??0,'number','min="0" step="0.01" required'))+
   label('ETA',input('poEta',seed.eta||'','date'))+
   label('Product website (HTTPS)',input('poProductUrl',seed.productUrl||'','url','placeholder="https://..." maxlength="2048"'))+
   label('Vendor product code',input('poVendorSku',seed.vendorSku||'','text','maxlength="120"'))+
   label('Quote reference',input('poQuoteRef',seed.quoteRef||'','text','maxlength="120"'))+
   input('poSourceOcc',seed.sourceOccurrenceId||'','hidden')+
   btn('Remove line','v41-remove-po-line','','small danger')+'</div>';
}
export function renderOrderComposer(s,ui,projectId){
 const p=s.projects.find(p=>p.id===projectId&&!p.archivedAt);
 if(!p)return '<p>Select a project before making an order.</p>';
 const pref=ui.materialPrefill||{};
 if(contractControlled(s,projectId)&&(!pref.sourceOccurrenceId||!specStatus(s,pref.sourceOccurrenceId).approved))
  return panel('Contract-controlled purchase guard','<p class="v47-warning">Before placing a real purchase, open Buying review, confirm purchasing responsibility, record the proposed model and compare it with the controlled technical specification. The PO form only opens for a verified requirement.</p>');
 return panel('New purchase order · '+p.code,
 '<form data-form="v41-po" class="v41-order-form"><input type="hidden" name="projectId" value="'+h(projectId)+'">'+
 '<div class="v41-fields">'+label('Supplier',input('supplier',pref.supplier||'','text','required'))+
 label('Currency',pick('currency',[['EUR','EUR'],['GBP','GBP'],['USD','USD'],['CAD','CAD']],'EUR'))+
 label('Tax assumption (%)',input('taxRate',0,'number','min="0" max="100" step="0.01" required'))+'</div>'+
 '<div id="v41-order-lines">'+orderLineEditor(s,projectId,pref)+'</div>'+
 '<div class="v41-actions">'+btn('+ Another line','v41-add-po-line','data-project="'+h(projectId)+'"','small')+
 '<button type="submit" class="btn primary">Record actual supplier PO</button>'+btn('Cancel','v41-order-cancel','','small')+'</div>'+
 '</form><p class="v41-caption">Only record a supplier order when it is actually authorised and placed. The entered quantity, price, vendor code and product URL are saved in the PO history. Creating this record does not receive stock.</p>');
}
function orderRegister(s,ui,projectId='all'){
 const list=activeOrders(s).filter(o=>projectId==='all'||o.projectId===projectId);
 return panel('Purchase order register','<div class="v41-scroll"><table class="v41-table"><thead><tr><th>Order</th><th>Supplier</th><th>Project</th><th>Lines</th><th>Order value</th><th>Delivery</th><th>Tracking / evidence</th><th></th></tr></thead><tbody>'+
 (list.map(o=>{
  const p=s.projects.find(p=>p.id===o.projectId);
  const received=o.items.reduce((n,l)=>n+Number(l.received||0),0),completed=o.items.filter(l=>outstanding(l)===0).length;
  return '<tr><td><strong>'+h(o.code)+'</strong><small>'+date(o.date)+'</small></td><td>'+h(o.supplier)+'</td><td>'+h(p?.code)+'</td>'+
    '<td>'+o.items.length+'</td><td>'+cost(orderTotal(o),o.currency||'EUR')+'</td>'+
    '<td>'+badge(purchaseStatus(o),purchaseStatus(o)==='Received'?'good':purchaseStatus(o)==='Part received'?'warn':'')+
    '<small>'+completed+'/'+o.items.length+' lines fully received</small>'+
    (purchaseStatus(o)!=='Received'?'<select class="v42-status-select" data-v42-delivery="'+h(o.id)+'" aria-label="Update delivery stage">'+
    [['Ordered','Ordered'],['Out for delivery','Out for delivery']].map(([v,t])=>'<option value="'+v+'" '+((o.dispatchState||'Ordered')===v?'selected':'')+'>'+t+'</option>').join('')+'</select>':'')+'</td>'+
    '<td>'+h(o.shipment?.carrier||'Carrier not set')+'<small>'+h(o.shipment?.trackingCode||'No tracking code')+' · '+(o.attachments?.length||0)+' file(s)</small></td>'+
    '<td><div class="v41-actions">'+btn('Manage','v41-order-open','data-id="'+h(o.id)+'"','small primary')+btn('Archive','archive-record','data-kind="orders" data-id="'+h(o.id)+'"','small danger')+'</div></td></tr>';
 }).join('')||'<tr><td colspan="8">No purchase orders for this selection.</td></tr>')+'</tbody></table></div>');
}
function orderDetailIfSelected(s,ui,projectId='all'){
 const o=s.orders.find(o=>!o.archivedAt&&o.id===ui.materialPO);
 return o&&(projectId==='all'||o.projectId===projectId)?renderOrderDetail(s,ui,o):'';
}
function renderOrderDetail(s,ui,o){
 const p=s.projects.find(p=>p.id===o.projectId);
 const sh=o.shipment||{};
 const controlled=contractControlled(s,o.projectId);
 const lineRows=o.items.map(l=>{
  const p=s.parts.find(p=>p.id===l.partId);
  const left=outstanding(l);
  const editing=ui.v46PurchaseLine===l.id,balanceEditing=ui.v47BalanceLine===l.id;
  const isClosed=Number(l.closedQuantity||0)>0;
  const last=l.revisions||[];
  let url='';try{url=safeProductURL(l.productUrl||'');}catch{}
  const savedURL=url?'<a href="'+h(url)+'" target="_blank" rel="noopener noreferrer">Product website</a>':'<small>No website recorded</small>';
  const edits=editing?'<tr class="v46-editor-row"><td colspan="9"><form data-form="v46-po-line-update" class="v46-inline-form">'+
   input('orderId',o.id,'hidden')+input('lineId',l.id,'hidden')+
   label('Ordered quantity',input('quantity',l.quantity,'number','min="'+Math.max(1,Number(l.received||0))+'" step="1" required'))+
   label('Unit cost ('+o.currency+')',input('unitCost',l.unitCost,'number','min="0" step="0.01" required'))+
   label('Delivery ETA',input('eta',l.eta||'','date'))+
   label('Supplier product URL',input('productUrl',l.productUrl||'','url','maxlength="2048" placeholder="https://..."'))+
   label('Vendor part number',input('vendorSku',l.vendorSku||'','text','maxlength="120"'))+
   label('Supplier quote reference',input('quoteRef',l.quoteRef||'','text','maxlength="120"'))+
   label('PO line notes',input('notes',l.notes||'','text','maxlength="800"'))+
   label('Reason for amendment',input('reason','','text','minlength="5" maxlength="300" required placeholder="Supplier revised the delivery date..."'))+
   '<button class="btn small primary" type="submit">Save PO line amendment</button></form>'+
   '<p class="v46-small">Edits are recorded in the PO line history. Already-received quantity and its unit price cannot be rewritten here.</p></td></tr>':'';
  return '<tr><td><b>'+h(p?.code)+'</b><small>'+h(p?.name)+'</small>'+savedURL+
   (l.vendorSku?'<small>Vendor code: '+h(l.vendorSku)+'</small>':'')+
   (l.quoteRef?'<small>Quote ref: '+h(l.quoteRef)+'</small>':'')+'</td>'+
   '<td>'+fmt(l.quantity)+'</td><td>'+fmt(l.received||0)+'</td><td>'+badge(left?fmt(left)+' still open':isClosed?'Closed '+fmt(l.closedQuantity):'Complete',left?'warn':'good')+'</td>'+
   '<td>'+cost(l.unitCost,o.currency||'EUR')+'</td><td>'+date(l.eta)+'</td>'+
   '<td>'+(left&&!controlled?'<form class="v41-table-form" data-form="v41-receive">'+
    '<input type="hidden" name="orderId" value="'+h(o.id)+'"><input type="hidden" name="lineId" value="'+h(l.id)+'">'+
    input('quantity',left,'number','min="1" max="'+left+'" required aria-label="Goods received quantity"')+
    '<button class="btn primary small">Receive</button></form>':left&&controlled?
      (l.sourceOccurrenceId?btn('Arrival / QA','v47-arrival-open','data-id="'+h(l.sourceOccurrenceId)+'"','small'):
       '<small>Missing contract line reference</small>'):
      isClosed?'Balance closed':'Received in full')+'</td>'+
    '<td>'+btn(editing?'Close edit':'Edit line','v46-po-line-edit','data-id="'+h(l.id)+'"','small')+
     (left?btn('Close unreceived balance','v47-balance-close-open','data-id="'+h(l.id)+'"','small'):'')+
     (isClosed?btn('Reopen balance','v47-balance-reopen-open','data-id="'+h(l.id)+'"','small'):'')+
     (l.specificationEvidence?'<small>Spec evidence: '+h(l.specificationEvidence.evidenceRef)+'</small>':'')+
    (last.length?'<details><summary>'+last.length+' amendment(s)</summary>'+last.slice(-8).map(v=>'<p><b>'+h(v.reason)+'</b><small>'+h(v.at)+'</small></p>').join('')+'</details>':'')+
    '</td></tr>'+edits+
    (balanceEditing?'<tr class="v47-balance-row"><td colspan="9"><form data-form="v47-balance-change" class="v46-inline-form">'+
     input('orderId',o.id,'hidden')+input('lineId',l.id,'hidden')+input('mode',ui.v47BalanceMode||'close','hidden')+
     label('Supplier confirmation / cancellation reason',input('reason','','text','minlength="8" maxlength="600" required'))+
     label('Supplier confirmation reference',input('evidenceRef','','text','minlength="4" maxlength="240" required'))+
     '<button type="submit" class="btn small primary">'+((ui.v47BalanceMode||'close')==='close'?'Close remaining PO quantity':'Reopen remaining PO quantity')+'</button>'+ 
     '<p class="v47-safety-caption">This records a supplier-confirmed order amendment, not an automatic cancellation sent to the supplier. Received stock history stays unchanged.</p></form></td></tr>':'');
 }).join('');
 const receipts=s.procurementReceipts.filter(x=>x.orderId===o.id);
 const receiptRows=receipts.map(r=>{
  const p=s.parts.find(p=>p.id===r.partId),returnable=r.quantity-r.returned;
  return '<tr><td>'+date(r.date)+'</td><td>'+h(p?.code)+'</td><td>'+fmt(r.quantity)+'</td><td>'+fmt(r.returned)+'</td>'+
    '<td>'+(returnable?'<form data-form="v41-return" class="v41-table-form"><input type="hidden" name="receiptId" value="'+h(r.id)+'">'+
    input('quantity',returnable,'number','min="1" max="'+returnable+'" required aria-label="Supplier return quantity"')+
    '<button class="btn small">Return</button></form>':'—')+'</td></tr>';
 }).join('');
 const attachments=(o.attachments||[]).map(f=>'<div class="v41-proof"><div><strong>'+h(f.name)+'</strong><small>'+h(f.mime)+' · '+fmt(f.size/1024)+' KB · '+date(f.addedAt)+'</small></div>'+
  '<div class="v41-actions">'+btn('Download','v41-proof-download','data-order="'+h(o.id)+'" data-id="'+h(f.id)+'"','small')+
  btn('Remove','v41-proof-remove','data-order="'+h(o.id)+'" data-id="'+h(f.id)+'"','small danger')+'</div></div>').join('');
 const shipForm='<form data-form="v41-tracking"><input type="hidden" name="orderId" value="'+h(o.id)+'">'+
   '<div class="v41-fields">'+label('Carrier / courier',input('carrier',sh.carrier||''))+
   label('Tracking code / AWB',input('trackingCode',sh.trackingCode||''))+
   label('Tracking URL (https only)',input('trackingUrl',sh.trackingUrl||'','url'))+
   label('Expected delivery',input('eta',sh.eta||'','date'))+
   label('Shipping notes',input('note',sh.note||''))+
   '<button type="submit" class="btn primary">Save tracking</button></div></form>'+
   (sh.trackingUrl?'<p class="v41-caption"><a href="'+h(sh.trackingUrl)+'" target="_blank" rel="noopener noreferrer">View carrier tracking ↗</a> · Tracking reference: '+h(sh.trackingCode)+'</p>':'');
 return '<div class="v41-detail">'+panel('Purchase order · '+o.code,'<p class="v41-caption">'+h(o.supplier)+' · '+h(p?.code)+' · '+h(o.currency||'EUR')+' · '+h(o.taxRate??0)+'% VAT/tax assumption</p>'+
 '<div class="v41-scroll"><table class="v41-table"><thead><tr><th>Part</th><th>Ordered</th><th>Received</th><th>Backorder</th><th>Unit cost</th><th>ETA</th><th>Record receipt</th><th>Edit / history</th></tr></thead><tbody>'+lineRows+'</tbody></table></div>'+

 (controlled?'<p class="v47-warning">Contract-controlled project: add new requirements and check their specification before amending a real PO.</p>':'<form data-form="v41-add-po-line" class="v41-inline-form"><input type="hidden" name="orderId" value="'+h(o.id)+'">'+
 label('Add part',pick('partId',sku(s),'','required'))+
 label('Quantity',input('quantity',1,'number','min="1" required'))+
 label('Cost each',input('unitCost',0,'number','min="0" step="0.01" required'))+
 label('ETA',input('eta','','date'))+
 label('Product URL',input('productUrl','','url','maxlength="2048" placeholder="https://..."'))+
 label('Vendor code',input('vendorSku','','text','maxlength="120"'))+
 label('Quote ref',input('quoteRef','','text','maxlength="120"'))+
 '<button type="submit" class="btn small primary">Add PO line</button></form>')+

 '<p class="v41-caption">Partial receipts immediately increase on-hand workshop inventory; future deliveries do not. Supplier returns decrease received and reopen backorders.</p>'+
 (receiptRows?'<h4>Goods receipts & returns</h4><div class="v41-scroll"><table class="v41-table"><thead><tr><th>Date</th><th>Part</th><th>Received</th><th>Returned</th><th>Action</th></tr></thead><tbody>'+receiptRows+'</tbody></table></div>':'<p class="v41-muted">No newly recorded goods receipts on this order.</p>')+
 '<h4>Shipment & tracking</h4>'+shipForm+'<h4>Receipt / proof of order / invoice documents</h4>'+
 '<p class="v41-caption">Local-only: max 4 files per PO, 800 KB each (PDF, JPG, PNG or WebP). Saved with browser data and included in JSON backup. Never uploaded to GitHub or any server.</p>'+
 '<label class="v41-upload">Attach order confirmation, receipt or invoice <input type="file" data-v41-proof="'+h(o.id)+'" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"></label>'+
 (attachments||'<p class="v41-muted">No proof documents attached.</p>'));
}
/* Purchaser sees the project as a whole, not the engineering assembly breakdown. */
export function renderPurchasingV041(s,ui,forcedProjectId=null){
 ensureMaterials(s);
 const projects=proj(s),requested=forcedProjectId||ui.procurementProject;
 const projectId=projects.some(p=>p.id===requested)?requested:
   projects.some(p=>p.id===ui.project)?ui.project:projects[0]?.id;
 ui.procurementProject=projectId;
 const p=projects.find(x=>x.id===projectId);
 if(!p)return '<div class="v46-empty">Create a project in Projects before purchasing.</div>';
 const requirements=projectBuyingSnapshot(s,projectId),orders=activeOrders(s).filter(o=>o.projectId===projectId);
 const selected='<div class="v46-purchase-picker"><div><small>ACTIVE PURCHASING PROJECT</small>'+
  '<h2>'+h(p.name)+'</h2><p>'+h(p.code)+' · '+requirements.rows.length+' engineering material lines · '+
  orders.length+' actual purchase orders recorded</p></div>'+
  '<label>Switch project'+pick('procurementProject',projectOptions(s),projectId,
  'data-filter="v46-purchase-project" aria-label="Choose project for purchasing"')+'</label></div>';
 const projectCards=projects.length>1?'<div class="v46-project-cards">'+projects.map(x=>
  '<button type="button" data-action="v46-pick-purchase-project" data-id="'+h(x.id)+'" class="'+(x.id===projectId?'active':'')+'">'+
  '<small>'+h(x.code)+'</small><b>'+h(x.name)+'</b><span>'+s.tasks.filter(t=>!t.archivedAt&&t.projectId===x.id).length+
  ' work items</span></button>').join('')+'</div>':'';
 return '<div class="v41 v46-purchasing v48-project-purchasing">'+(forcedProjectId?'':selected+projectCards)+
  '<div class="v46-purchase-intro"><strong>Purchasing for '+h(p.name)+'</strong><span>1. Department requirement → 2. Supplier and specification check → 3. Approved PO → 4. Delivery and inspection</span>'+
  '<p>All proposed purchases are linked to this project. Save a source link or assign a buyer first; these actions do not create orders or change stock.</p></div>'+
  '<div class="v46-purchase-overview"><span>'+requirements.buy.length+' proposed BUY lines</span>'+
  '<span>'+requirements.manufacture.length+' MAKE requirements</span><span>'+requirements.unplannedBuy.length+' missing sourcing details</span>'+
  '<span>'+orders.length+' actual POs</span></div>'+
  (ui.materialOrderEditor?'<div class="v46-purchase-composer">'+renderOrderComposer(s,ui,projectId)+'</div>':'')+
  renderProjectBuyingReview(s,ui,projectId)+
  '<div class="v46-purchase-orders"><div class="v46-panel-heading"><div><h3>Actual supplier orders</h3>'+
  '<p>Separate from your planning list. Each recorded order can have its own website, supplier SKU and edited line history.</p></div>'+
  btn('+ Record actual purchase order','v41-order-new','data-project="'+h(projectId)+'"','small primary')+'</div>'+
  orderRegister(s,ui,projectId)+orderDetailIfSelected(s,ui,projectId)+'</div></div>';
}
export function renderInventoryV041(s,ui){
 ensureMaterials(s);
 const parts=s.parts.filter(p=>!p.archivedAt);
 const rows=parts.map(p=>{
   const used=tracked(s,p.id),legacy=Math.max(0,Number(p.reserved||0)-used);
   const assigned=s.stockReservations.filter(r=>r.partId===p.id&&reservationRemaining(r)>0)
     .map(r=>h(s.projects.find(p=>p.id===r.projectId)?.code||r.projectId)+' ('+fmt(reservationRemaining(r))+')').join(', ');
   return '<tr><td><b>'+h(p.code)+'</b><small>'+h(p.name)+'</small></td>'+
    '<td>'+h(p.location||'Not assigned')+'</td><td>'+fmt(p.onHand)+' '+h(p.unit)+'</td>'+
    '<td>'+fmt(p.reserved||0)+'</td><td><b>'+fmt(available(p))+'</b></td>'+
    '<td>'+fmt(legacy)+'</td><td>'+badge(available(p)<=Number(p.min||0)?'Reorder':'In stock',available(p)<=Number(p.min||0)?'warn':'good')+'</td>'+
    '<td><small>'+h(assigned||'No new project allocations')+'</small></td>'+
    '<td><div class="v41-actions">'+btn('Move','stock-modal','data-id="'+h(p.id)+'"','small')+btn('Edit','edit-part','data-id="'+h(p.id)+'"','small')+btn('Archive','archive-record','data-kind="parts" data-id="'+h(p.id)+'"','small danger')+'</div></td></tr>';
 }).join('');
 const moves=(s.movements||[]).slice(0,25).map(m=>'<tr><td>'+date(m.date)+'</td><td>'+h(s.parts.find(p=>p.id===m.partId)?.code||m.partId)+'</td><td>'+h(m.type)+'</td><td>'+fmt(m.quantity)+'</td><td>'+h(s.projects.find(p=>p.id===m.projectId)?.code||'—')+'</td></tr>').join('');
 return '<div class="v41"><div class="v41-intro"><div><h2>Workshop stock & allocations</h2><p>One shared part master and one inventory balance, visible to all internal project workspaces.</p></div>'+badge('Local simulation')+'</div>'+
 '<div class="v41-kpis"><div><b>'+parts.length+'</b><span>Active part numbers</span></div><div><b>'+parts.filter(p=>available(p)<=Number(p.min||0)).length+'</b><span>At/below reorder</span></div><div><b>'+parts.filter(p=>Number(p.reserved||0)>0).length+'</b><span>Parts with reservations</span></div><div><b>'+s.stockReservations.filter(r=>reservationRemaining(r)>0).length+'</b><span>Project allocations</span></div></div>'+
 panel('Workshop inventory register','<div class="v41-toolbar">'+btn('+ Stock part','add-part','','small primary')+btn('Record movement','stock-modal','','small')+'</div>'+
 '<div class="v41-scroll"><table class="v41-table"><thead><tr><th>Part / description</th><th>Bin</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Legacy reserved</th><th>Reorder</th><th>Allocated projects</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
 '<p class="v41-caption">Availability = on-hand − all reservations. Legacy V0.3 reservations are preserved and labelled separately until reconciled. Reservations in other projects are never offered as available stock.</p>')+
 panel('Stock movement ledger','<div class="v41-scroll"><table class="v41-table"><thead><tr><th>Date</th><th>Part</th><th>Type</th><th>Units</th><th>Project</th></tr></thead><tbody>'+moves+'</tbody></table></div>')+
 '</div>';
}
export function handleMaterialsAction(s,ui,el,confirmFn=()=>true){
 const action=el.dataset.action;
 ensureMaterials(s);
 if(action==='v42-new-part'){ui.showQuickPart=!ui.showQuickPart;}
 else if(action==='v43-quick-part-cancel'){ui.showQuickPart=false;}
 else if(action==='v42-material-edit'){ui.materialEditOccurrence=el.dataset.id;}
 else if(action==='v42-material-cancel'){ui.materialEditOccurrence=null;}
 else if(action==='v42-material-remove'){
  if(confirmFn('Remove this project requirement? It stays archived for restoration; historic released manufacturing snapshots are unchanged.')){
   archiveManufacturing(s,'occurrence',el.dataset.id);ui.materialEditOccurrence=null;
  }
 }
 else if(action==='v42-material-restore'){archiveManufacturing(s,'occurrence',el.dataset.id,true);}
 else if(action==='v41-order-open'){ui.materialPO=el.dataset.id;ui.materialOrderEditor=false;ui.v46PurchaseLine=null;}
 else if(action==='v46-po-line-edit'){ui.v46PurchaseLine=ui.v46PurchaseLine===el.dataset.id?null:el.dataset.id;}
 else if(action==='v47-balance-close-open'){ui.v47BalanceLine=el.dataset.id;ui.v47BalanceMode='close';}
 else if(action==='v47-balance-reopen-open'){ui.v47BalanceLine=el.dataset.id;ui.v47BalanceMode='reopen';}
 else if(action==='v41-order-new'){ui.materialOrderEditor=true;ui.materialPrefill=null;ui.materialOrderProject=el.dataset.project||ui.materialOrderProject;}
 else if(action==='v41-order-prefill'){ui.materialOrderEditor=true;ui.materialPrefill={partId:el.dataset.part,quantity:el.dataset.qty};ui.materialOrderProject=el.dataset.project;}
 else if(action==='v41-order-cancel'){ui.materialOrderEditor=false;ui.materialPrefill=null;}
 else if(action==='v41-add-po-line'){
  const holder=document.getElementById('v41-order-lines');
  const selector=document.querySelector('form[data-form="v41-po"] input[name="projectId"]');
  if(holder&&selector)holder.insertAdjacentHTML('beforeend',orderLineEditor(s,selector.value));
  return 'dom';
 }
 else if(action==='v41-remove-po-line'){
  const holder=el.closest('[data-v41-po-line]'),group=document.querySelectorAll('[data-v41-po-line]');
  if(group.length<=1)throw Error('A purchase order needs at least one line');
  holder?.remove();return 'dom';
 }
 else if(action==='v41-release'){
  const r=s.stockReservations.find(x=>x.id===el.dataset.id);
  if(!r)throw Error('Reservation unavailable');
  if(confirmFn('Release '+reservationRemaining(r)+' units back to available stock?'))
    releaseProjectStock(s,{reservationId:r.id,quantity:reservationRemaining(r)});
 }
 else if(action==='v41-proof-remove'){
  if(confirmFn('Remove this local proof document?'))removeOrderAttachment(s,{orderId:el.dataset.order,attachmentId:el.dataset.id});
 }
 else if(action==='v41-proof-download'){
  const f=s.orders.find(o=>o.id===el.dataset.order)?.attachments?.find(f=>f.id===el.dataset.id);
  if(!f)throw Error('Document not found');
  const base64=f.dataUrl.split(',')[1],binary=atob(base64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:f.mime}));
  const a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
  return 'dom';
 }
 else throw Error('Unknown materials action '+action);
 return true;
}
export function handleMaterialsSubmit(s,ui,form){
 ensureMaterials(s);
 const fd=new FormData(form);
 const v=n=>String(fd.get(n)||'').trim();
 const type=form.dataset.form;

 if(type==='v43-quick-part'){
   const projectId=v('projectId'),assemblyId=v('assemblyId'),qty=Number(v('quantity'));
   if(!s.assemblies.some(a=>a.id===assemblyId&&a.projectId===projectId&&!a.archivedAt))throw Error('Select an active assembly in this project');
   if(!Number.isSafeInteger(qty)||qty<=0)throw Error('Quantity must be a positive whole number');
   const part=savePart(s,{code:v('code'),name:v('name'),unit:v('unit'),supplier:v('supplier'),
     location:'',min:0,cost:v('cost')});
   try{saveOccurrence(s,{assemblyId,partId:part.id,quantity:qty,position:'',makeBuy:'Buy'});}
   catch(err){s.parts=s.parts.filter(p=>p.id!==part.id);throw err;}
   ui.showQuickPart=false;
 }
 else if(type==='v41-requirement'){
   saveOccurrence(s,{assemblyId:v('assemblyId'),partId:v('partId'),quantity:v('quantity'),position:v('position'),makeBuy:'Buy'});
 }
 else if(type==='v42-material-edit'){
   const occ=s.assemblyBOM.find(x=>x.id===v('recordId')&&!x.archivedAt);
   if(!occ)throw Error('Material requirement unavailable');
   saveOccurrence(s,{id:occ.id,assemblyId:occ.assemblyId,partId:v('partId'),quantity:v('quantity'),
      position:v('position'),makeBuy:v('makeBuy'),notes:occ.notes||''});
   ui.materialEditOccurrence=null;
 }
 else if(type==='v41-reserve'){
   reserveProjectStock(s,{projectId:v('projectId'),assemblyId:v('assemblyId'),partId:v('partId'),quantity:v('quantity')});
 }
 else if(type==='v41-po'){
   const projectId=v('projectId'),parts=fd.getAll('poPart').map(String),quantities=fd.getAll('poQty').map(String),
    costs=fd.getAll('poCost').map(String),assemblies=fd.getAll('poAssembly').map(String),etas=fd.getAll('poEta').map(String),
    links=fd.getAll('poProductUrl').map(String),vendorSkus=fd.getAll('poVendorSku').map(String),
    sourceOccurrences=fd.getAll('poSourceOcc').map(String),quotes=fd.getAll('poQuoteRef').map(String);
   if(!parts.length||!parts.every((_,i)=>quantities[i]!==undefined&&costs[i]!==undefined))throw Error('Please complete every order line');
   const order=createPurchaseOrder(s,{projectId,supplier:v('supplier'),currency:v('currency'),taxRate:v('taxRate'),
     items:parts.map((partId,i)=>({partId,quantity:quantities[i],unitCost:costs[i],assemblyId:assemblies[i],
       eta:etas[i],productUrl:links[i]||'',vendorSku:vendorSkus[i]||'',quoteRef:quotes[i]||'',sourceOccurrenceId:sourceOccurrences[i]||''}))});
   ui.materialPO=order.id;ui.materialOrderEditor=false;ui.materialPrefill=null;
 }
 else if(type==='v41-add-po-line')addPurchaseLine(s,v('orderId'),{partId:v('partId'),quantity:v('quantity'),
  unitCost:v('unitCost'),assemblyId:v('assemblyId'),eta:v('eta'),productUrl:v('productUrl'),vendorSku:v('vendorSku'),quoteRef:v('quoteRef')});
 else if(type==='v46-po-line-update'){
  updatePurchaseLineRecord(s,{orderId:v('orderId'),lineId:v('lineId'),quantity:v('quantity'),unitCost:v('unitCost'),
   eta:v('eta'),productUrl:v('productUrl'),vendorSku:v('vendorSku'),quoteRef:v('quoteRef'),notes:v('notes'),reason:v('reason')});
  ui.v46PurchaseLine=null;
 }
 else if(type==='v41-receive')receivePurchaseLine(s,{orderId:v('orderId'),lineId:v('lineId'),quantity:v('quantity')});
 else if(type==='v41-return')returnPurchaseReceipt(s,{receiptId:v('receiptId'),quantity:v('quantity')});
 else if(type==='v41-tracking')saveOrderShipment(s,{orderId:v('orderId'),carrier:v('carrier'),trackingCode:v('trackingCode'),trackingUrl:v('trackingUrl'),eta:v('eta'),note:v('note')});
 else if(type==='v41-issue')issueProjectStock(s,{reservationId:v('reservationId'),quantity:v('quantity')});
 else if(type==='v41-consume')consumeIssuedStock(s,{reservationId:v('reservationId'),quantity:v('quantity')});
 else throw Error('Unrecognized procurement form '+type);
 return true;
}
export function updateOrderStage(s,orderId,stage){return setPurchaseDispatch(s,{orderId,stage});}
export function handleMaterialsProof(s,el,onSaved,onError){
 const orderId=el.dataset.v41Proof,file=el.files?.[0];
 if(!orderId||!file)return;
 if(file.size>800000||file.size<=0)return onError('Proof document must be 800 KB or smaller');
 if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))return onError('Choose a PDF, JPG, PNG or WebP file');
 const reader=new FileReader();
 reader.onerror=()=>onError('Unable to read the document');
 reader.onload=()=>{
   try {addOrderAttachment(s,{orderId,name:file.name,mime:file.type,size:file.size,dataUrl:reader.result});onSaved();}
   catch(err){onError(err.message||'Document could not be attached');}
 };
 reader.readAsDataURL(file);
}
