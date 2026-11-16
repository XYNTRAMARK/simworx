/* V0.4.1 purchasing/stock/project-materials user interface.
   Every operation changes shared browser-local Project Hub records, not external systems. */
import {ensureMaterials,available,outstanding,purchaseStatus,createPurchaseOrder,addPurchaseLine,
receivePurchaseLine,returnPurchaseReceipt,reserveProjectStock,issueProjectStock,releaseProjectStock,consumeIssuedStock,
reservationRemaining,materialReadinessV041,assemblyAllocationReadiness,saveOrderShipment,
addOrderAttachment,removeOrderAttachment,createWorkspaceBackup,parseWorkspaceBackup} from './materials-v041.mjs';
import {activeAssemblies,saveOccurrence,assemblyRollup} from './manufacturing.mjs';

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
   const orderBtn=btn('Order shortage','v41-order-prefill','data-project="'+h(projectId)+'" data-part="'+h(r.partId)+'" data-qty="'+Math.max(1,r.toSource||r.toAllocate)+'"','small');
   return '<tr><td><strong>'+h(r.part.code)+'</strong><small>'+h(r.part.name)+'</small></td>'+
    '<td>'+fmt(r.required)+'</td><td>'+fmt(r.reserved)+'</td><td>'+fmt(r.issued)+'</td>'+
    '<td><b>'+fmt(free)+'</b><small>'+fmt(others)+' reserved elsewhere'+(estimateLeft(s,r.part)?' · '+fmt(estimateLeft(s,r.part))+' legacy/unassigned':'')+'</small></td>'+
    '<td>'+fmt(r.incoming)+'</td><td>'+badge(r.toSource?fmt(r.toSource)+' to order':r.toAllocate?'Allocation needed':'Allocated',r.toSource?'danger':r.toAllocate?'warn':'good')+'</td>'+
    '<td>'+allocation+orderBtn+'</td></tr>';
 }).join('');
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
 return '<div class="v41"><div class="v41-intro"><div><h2>Project procurement & materials</h2><p>Assembly BOM → shared workshop inventory → reservations → purchasing → receipts → workshop issue.</p></div>'+badge('V0.4.1 local demo')+'</div>'+
  '<div class="v41-kpis"><div><b>'+rows.length+'</b><span>Required part SKUs</span></div><div><b>'+shortage.length+'</b><span>Materials still to source</span></div><div><b>'+orders.length+'</b><span>Purchase orders for project</span></div><div><b>'+res.filter(x=>reservationRemaining(x)>0).length+'</b><span>Active allocations</span></div></div>'+
  panel('Add required materials',assemblies.length?form:'<p class="v41-notice">Create a project assembly in Assembly control before adding required materials.</p>','Adds an editable E-BOM occurrence to the selected project assembly. Shared part master is unchanged.')+
  panel('Stock check & order requirements','<div class="v41-scroll"><table class="v41-table"><thead><tr><th>Part</th><th>BOM need</th><th>Reserved here</th><th>Issued here</th><th>Available / other projects</th><th>On order</th><th>To source</th><th>Allocate / order</th></tr></thead><tbody>'+rowsHTML+'</tbody></table></div><p class="v41-caption">Available means on-hand less ALL project and legacy reservations. Goods merely ordered are never counted in on-hand stock. BOM requirements from nested assemblies are rolled up.</p>')+
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
   label('Assembly',pick('poAssembly',asmOptions(s,projectId),seed.assemblyId||''))+
   label('ETA',input('poEta',seed.eta||'','date'))+
   btn('Remove line','v41-remove-po-line','','small danger')+'</div>';
}
export function renderOrderComposer(s,ui,projectId){
 const p=s.projects.find(p=>p.id===projectId&&!p.archivedAt);
 if(!p)return '<p>Select a project before making an order.</p>';
 const pref=ui.materialPrefill||{};
 return panel('New purchase order · '+p.code,
 '<form data-form="v41-po" class="v41-order-form"><input type="hidden" name="projectId" value="'+h(projectId)+'">'+
 '<div class="v41-fields">'+label('Supplier',input('supplier','','text','required'))+
 label('Currency',pick('currency',[['EUR','EUR'],['GBP','GBP'],['USD','USD'],['CAD','CAD']],'EUR'))+
 label('Tax assumption (%)',input('taxRate',0,'number','min="0" max="100" step="0.01" required'))+'</div>'+
 '<div id="v41-order-lines">'+orderLineEditor(s,projectId,pref)+'</div>'+
 '<div class="v41-actions">'+btn('+ Another line','v41-add-po-line','data-project="'+h(projectId)+'"','small')+
 '<button type="submit" class="btn primary">Create purchase order</button>'+btn('Cancel','v41-order-cancel','','small')+'</div>'+
 '</form><p class="v41-caption">Amounts are internal demonstration values. Order lines are attributed to the project and optional assembly; receipt is separately recorded after delivery.</p>');
}
function orderRegister(s,ui,projectId='all'){
 const list=activeOrders(s).filter(o=>projectId==='all'||o.projectId===projectId);
 return panel('Purchase order register','<div class="v41-scroll"><table class="v41-table"><thead><tr><th>Order</th><th>Supplier</th><th>Project</th><th>Lines</th><th>Order value</th><th>Delivery</th><th>Tracking / evidence</th><th></th></tr></thead><tbody>'+
 (list.map(o=>{
  const p=s.projects.find(p=>p.id===o.projectId);
  const received=o.items.reduce((n,l)=>n+Number(l.received||0),0),completed=o.items.filter(l=>outstanding(l)===0).length;
  return '<tr><td><strong>'+h(o.code)+'</strong><small>'+date(o.date)+'</small></td><td>'+h(o.supplier)+'</td><td>'+h(p?.code)+'</td>'+
    '<td>'+o.items.length+'</td><td>'+cost(orderTotal(o),o.currency||'EUR')+'</td>'+
    '<td>'+badge(purchaseStatus(o),purchaseStatus(o)==='Received'?'good':received?'warn':'')+'<small>'+completed+'/'+o.items.length+' lines fully received</small></td>'+
    '<td>'+h(o.shipment?.carrier||'Carrier not set')+'<small>'+h(o.shipment?.trackingCode||'No tracking code')+' · '+(o.attachments?.length||0)+' file(s)</small></td>'+
    '<td>'+btn('Manage','v41-order-open','data-id="'+h(o.id)+'"','small primary')+'</td></tr>';
 }).join('')||'<tr><td colspan="8">No purchase orders for this selection.</td></tr>')+'</tbody></table></div>');
}
function orderDetailIfSelected(s,ui,projectId='all'){
 const o=s.orders.find(o=>!o.archivedAt&&o.id===ui.materialPO);
 return o&&(projectId==='all'||o.projectId===projectId)?renderOrderDetail(s,o):'';
}
function renderOrderDetail(s,o){
 const p=s.projects.find(p=>p.id===o.projectId);
 const sh=o.shipment||{};
 const lineRows=o.items.map(l=>{
  const p=s.parts.find(p=>p.id===l.partId);
  const left=outstanding(l);
  return '<tr><td><b>'+h(p?.code)+'</b><small>'+h(p?.name)+'</small></td>'+
   '<td>'+fmt(l.quantity)+'</td><td>'+fmt(l.received||0)+'</td><td>'+badge(left?fmt(left)+' backordered':'Complete',left?'warn':'good')+'</td>'+
   '<td>'+cost(l.unitCost,o.currency||'EUR')+'</td><td>'+date(l.eta)+'</td>'+
   '<td>'+(left?'<form class="v41-table-form" data-form="v41-receive">'+
    '<input type="hidden" name="orderId" value="'+h(o.id)+'"><input type="hidden" name="lineId" value="'+h(l.id)+'">'+
    input('quantity',left,'number','min="1" max="'+left+'" required aria-label="Goods received quantity"')+
    '<button class="btn primary small">Receive</button></form>':'Received in full')+'</td></tr>';
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
 '<div class="v41-scroll"><table class="v41-table"><thead><tr><th>Part</th><th>Ordered</th><th>Received</th><th>Backorder</th><th>Unit cost</th><th>ETA</th><th>Record receipt</th></tr></thead><tbody>'+lineRows+'</tbody></table></div>'+
 '<p class="v41-caption">Partial receipts immediately increase on-hand workshop inventory; future deliveries do not. Supplier returns decrease received and reopen backorders.</p>'+
 (receiptRows?'<h4>Goods receipts & returns</h4><div class="v41-scroll"><table class="v41-table"><thead><tr><th>Date</th><th>Part</th><th>Received</th><th>Returned</th><th>Action</th></tr></thead><tbody>'+receiptRows+'</tbody></table></div>':'<p class="v41-muted">No newly recorded goods receipts on this order.</p>')+
 '<h4>Shipment & tracking</h4>'+shipForm+'<h4>Receipt / proof of order / invoice documents</h4>'+
 '<p class="v41-caption">Local-only: max 4 files per PO, 800 KB each (PDF, JPG, PNG or WebP). Saved with browser data and included in JSON backup. Never uploaded to GitHub or any server.</p>'+
 '<label class="v41-upload">Attach order confirmation, receipt or invoice <input type="file" data-v41-proof="'+h(o.id)+'" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"></label>'+
 (attachments||'<p class="v41-muted">No proof documents attached.</p>'));
}
export function renderPurchasingV041(s,ui){
 ensureMaterials(s);
 const chosen=ui.procurementProject||'all';
 const projectId=chosen==='all'?(ui.materialOrderProject||proj(s)[0]?.id):chosen;
 return '<div class="v41"><div class="v41-intro"><div><h2>Purchasing & order tracking</h2><p>Multi-line orders · partial deliveries · supplier returns · shipment tracking · local proof documents.</p></div>'+badge('Demo data · Internal only')+'</div>'+
 '<div class="v41-toolbar">'+label('Filter by project',pick('procurementProject',[['all','All projects'],...projectOptions(s)],chosen,'data-filter="v41-project"'))+
 btn('+ Purchase order','v41-order-new','data-project="'+h(projectId||'')+'"','primary')+'</div>'+
 (ui.materialOrderEditor?renderOrderComposer(s,ui,projectId):'')+
 orderRegister(s,ui,chosen)+orderDetailIfSelected(s,ui,chosen)+'</div>';
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
    '<td>'+btn('Move stock','stock-modal','data-id="'+h(p.id)+'"','small')+'</td></tr>';
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
 if(action==='v41-order-open'){ui.materialPO=el.dataset.id;ui.materialOrderEditor=false;}
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
 if(type==='v41-requirement'){
   saveOccurrence(s,{assemblyId:v('assemblyId'),partId:v('partId'),quantity:v('quantity'),position:v('position'),makeBuy:'Buy'});
 }
 else if(type==='v41-reserve'){
   reserveProjectStock(s,{projectId:v('projectId'),assemblyId:v('assemblyId'),partId:v('partId'),quantity:v('quantity')});
 }
 else if(type==='v41-po'){
   const projectId=v('projectId'),parts=fd.getAll('poPart').map(String),quantities=fd.getAll('poQty').map(String),
    costs=fd.getAll('poCost').map(String),assemblies=fd.getAll('poAssembly').map(String),etas=fd.getAll('poEta').map(String);
   if(!parts.length||!parts.every((_,i)=>quantities[i]!==undefined&&costs[i]!==undefined))throw Error('Please complete every order line');
   const order=createPurchaseOrder(s,{projectId,supplier:v('supplier'),currency:v('currency'),taxRate:v('taxRate'),
     items:parts.map((partId,i)=>({partId,quantity:quantities[i],unitCost:costs[i],assemblyId:assemblies[i],eta:etas[i]}))});
   ui.materialPO=order.id;ui.materialOrderEditor=false;ui.materialPrefill=null;
 }
 else if(type==='v41-receive')receivePurchaseLine(s,{orderId:v('orderId'),lineId:v('lineId'),quantity:v('quantity')});
 else if(type==='v41-return')returnPurchaseReceipt(s,{receiptId:v('receiptId'),quantity:v('quantity')});
 else if(type==='v41-tracking')saveOrderShipment(s,{orderId:v('orderId'),carrier:v('carrier'),trackingCode:v('trackingCode'),trackingUrl:v('trackingUrl'),eta:v('eta'),note:v('note')});
 else if(type==='v41-issue')issueProjectStock(s,{reservationId:v('reservationId'),quantity:v('quantity')});
 else if(type==='v41-consume')consumeIssuedStock(s,{reservationId:v('reservationId'),quantity:v('quantity')});
 else throw Error('Unrecognized procurement form '+type);
 return true;
}
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
