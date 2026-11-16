/* Project Hub V0.4.1 — browser-only purchasing, stock and backups.
   This is NOT a multi-user inventory database or financial/accounting system. */
import {ensureManufacturing,activeAssemblies,assemblyRollup} from './manufacturing.mjs';
import {safeProductURL} from './procurement-sourcing-v046.mjs';
import {assertContractPOGate,contractControlled,acceptArrivalRecord} from './procurement-workflow-v047.mjs';
const uid = prefix => prefix+'-'+Math.random().toString(36).slice(2,11);
const timestamp = () => new Date().toISOString();
const live = x => x && !x.archivedAt;
const integer = (value,label) => {
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<=0)throw Error(label+' must be a positive whole number');
  return n;
};
const amount = (v,label) => {
  const n=Number(v);
  if(!Number.isFinite(n)||n<0)throw Error(label+' must be zero or greater');
  return n;
};
const required = (value,label) => {
  const s=String(value??'').trim();
  if(!s)throw Error(label+' is required');
  return s;
};
const note = (s,action,detail) => {
  s.audit??=[];
  s.audit.unshift({id:uid('audit'),action,detail,actor:'Internal staff',at:timestamp()});
};
const recordMovement = (s,partId,type,quantity,projectId,ref='') => {
  s.movements??=[];
  s.movements.unshift({id:uid('mv'),partId,type,quantity,projectId,reference:ref,actor:'Workshop stores',date:timestamp()});
};
const partById = (s,partId) => {
  const p=s.parts?.find(p=>live(p)&&p.id===partId);
  if(!p)throw Error('Part master not found');
  return p;
};
const projectById = (s,projectId) => {
  const p=s.projects?.find(p=>live(p)&&p.id===projectId);
  if(!p)throw Error('Project unavailable');
  return p;
};
const assemblyForProject=(s,id,projectId)=>{
  if(!id)return null;
  const a=s.assemblies.find(a=>live(a)&&a.id===id&&a.projectId===projectId);
  if(!a)throw Error('Assembly does not belong to this project');
  return a;
};
export function ensureMaterials(s){
  ensureManufacturing(s);
  s.stockReservations??=[];
  s.procurementReceipts??=[];
  s.procurementReturns??=[];
  s.procurementArrivals??=[];
  s.orders??=[];
  s.movements??=[];
  for(const o of s.orders){
    o.items??=[];
    o.items.forEach((line,i)=>{if(!line.id)line.id='legacy-line-'+o.id+'-'+i;});
  }
  s.materialsSchemaVersion=1;
  return s;
}
export const available = part => Math.max(0,Number(part.onHand||0)-Number(part.reserved||0));
export const outstanding = line => Math.max(0,Number(line.quantity||0)-Number(line.received||0)-Number(line.closedQuantity||0));
export const purchaseStatus = order => {
  if(!order.items?.length)return 'Draft';
  const all=order.items.every(l=>outstanding(l)===0);
  if(all){
   if(order.items.every(l=>Number(l.received||0)===Number(l.quantity||0)))return 'Received';
   if(order.items.every(l=>!Number(l.received||0)))return 'Closed';
   return 'Part received · closed';
  }
  if(order.items.some(l=>Number(l.received||0)>0))return 'Part received';
  return order.dispatchState==='Out for delivery'?'Out for delivery':'Ordered';
};
/* Procurement stages do not affect stock. Only validated goods receipt changes on-hand. */
export function setPurchaseDispatch(state,{orderId,stage}){
  ensureMaterials(state);
  const o=state.orders.find(x=>live(x)&&x.id===orderId);
  if(!o)throw Error('Purchase order unavailable');
  if(!['Ordered','Out for delivery'].includes(stage))throw Error('Choose Ordered or Out for delivery');
  if(['Received','Closed','Part received · closed'].includes(purchaseStatus(o)))throw Error('Closed or fully received order cannot be changed to an earlier delivery stage');
  o.dispatchState=stage;
  o.status=purchaseStatus(o);
  note(state,'Order delivery stage updated',o.code+' / '+stage);
  return o;
}
function normalizedLine(s,projectId,input,supplier){
  const part=partById(s,input.partId);
  assemblyForProject(s,input.assemblyId,projectId);
  const quantity=integer(input.quantity,'Order quantity');
  const unitCost=amount(input.unitCost??0,'Unit cost');
  const eta=String(input.eta||'').trim();
  if(eta&&(!/^\d{4}-\d{2}-\d{2}$/.test(eta)||new Date(eta+'T12:00:00Z').toISOString().slice(0,10)!==eta))throw Error('ETA must be a valid ISO date');
  const sourceOccurrenceId=String(input.sourceOccurrenceId||'').trim();
  if(sourceOccurrenceId&&!s.assemblyBOM?.some(x=>x.id===sourceOccurrenceId&&!x.archivedAt&&x.projectId===projectId&&x.partId===part.id))
    throw Error('Purchase source must match a live requirement for this project and part');
  const verified=assertContractPOGate(s,projectId,input,supplier);
  const vendorSku=String(input.vendorSku||'').trim(),quoteRef=String(input.quoteRef||'').trim(),notes=String(input.notes||'').trim();
  if(vendorSku.length>120||quoteRef.length>120||notes.length>800)throw Error('Supplier code, quote reference or purchase note too long');
  return {id:uid('pol'),partId:part.id,assemblyId:input.assemblyId||null,quantity,received:0,unitCost,eta,
    sourceOccurrenceId:sourceOccurrenceId||null,productUrl:safeProductURL(input.productUrl||''),vendorSku,quoteRef,notes,
    specificationEvidence:verified||null,closedQuantity:0};
}
export function createPurchaseOrder(s,input){
  ensureMaterials(s);
  const project=projectById(s,input.projectId);
  const supplier=required(input.supplier,'Supplier');
  const currency=input.currency||'EUR';
  if(!['EUR','GBP','USD','CAD'].includes(currency))throw Error('Unsupported currency');
  const taxRate=amount(input.taxRate??0,'Tax percentage');
  if(taxRate>100)throw Error('Tax percentage cannot exceed 100');
  if(!Array.isArray(input.items)||!input.items.length)throw Error('A purchase order needs at least one line');
  const items=input.items.map(x=>normalizedLine(s,project.id,x,supplier)); // Validate all before mutation
  const code='PO-'+new Date().getFullYear()+'-'+String(s.orders.length+1).padStart(4,'0');
  const order={id:uid('po'),code,projectId:project.id,supplier,currency,taxRate,
    date:timestamp().slice(0,10),status:'Ordered',dispatchState:'Ordered',origin:'v042',items};
  s.orders.unshift(order);
  note(s,'Purchase order created',code+' / '+items.length+' lines');
  return order;
}
export function addPurchaseLine(s,orderId,line){
  ensureMaterials(s);
  const o=s.orders.find(x=>live(x)&&x.id===orderId);
  if(!o)throw Error('Purchase order unavailable');
  const row=normalizedLine(s,o.projectId,line,o.supplier);
  o.items.push(row);o.status=purchaseStatus(o);
  note(s,'Purchase order line added',o.code);
  return row;
}
function orderAndLine(s,orderId,lineId){
  const o=s.orders.find(x=>live(x)&&x.id===orderId);
  if(!o)throw Error('Purchase order unavailable');
  const line=o.items.find(x=>x.id===lineId);
  if(!line)throw Error('Purchase order line not found');
  return {o,line};
}
export function receivePurchaseLine(s,{orderId,lineId,quantity,arrivalId='',reviewer='',evidenceRef=''}){
  ensureMaterials(s);
  const {o,line}=orderAndLine(s,orderId,lineId);
  const q=integer(quantity,'Receipt quantity'),remaining=outstanding(line);
  if(q>remaining)throw Error('Over-receipt prevented: only '+remaining+' outstanding');
  let arrival=null;
  if(arrivalId||contractControlled(s,o.projectId)){
   arrival=s.procurementArrivals.find(a=>a.id===arrivalId&&a.orderId===orderId&&a.lineId===lineId);
   if(!arrival||arrival.status!=='Awaiting inspection'||arrival.quantity!==q)
    throw Error('Stock receipt requires a matching arrival awaiting inspection');
   if(String(reviewer||'').trim().length<3||String(evidenceRef||'').trim().length<4)
    throw Error('Inspector and acceptance evidence reference are required before goods enter stock');
  }
  const part=partById(s,line.partId);
  if(!Number.isSafeInteger(Number(part.onHand)+q))throw Error('Stock quantity exceeds supported limit');
  line.received=Number(line.received||0)+q;
  part.onHand=Number(part.onHand)+q;
  o.status=purchaseStatus(o);
  const receipt={id:uid('rcpt'),orderId:o.id,lineId:line.id,partId:part.id,projectId:o.projectId,
    assemblyId:line.assemblyId||null,quantity:q,returned:0,date:timestamp()};
  s.procurementReceipts.unshift(receipt);
  if(arrival)acceptArrivalRecord(s,{arrivalId:arrival.id,reviewer,evidenceRef,receiptId:receipt.id});
  recordMovement(s,part.id,'po-receipt',q,o.projectId,o.code);
  note(s,'Partial goods receipt',o.code+': '+q+' × '+part.code);
  return receipt;
}
export function closePurchaseBalance(s,{orderId,lineId,reason,evidenceRef}){
 ensureMaterials(s);
 const {o,line}=orderAndLine(s,orderId,lineId);
 const open=outstanding(line);
 if(!open)throw Error('This order line has no remaining balance');
 const noteText=required(reason,'Supplier cancellation/change reason');
 const proof=required(evidenceRef,'Supplier confirmation reference');
 if(noteText.length<8||proof.length<4)throw Error('Give the confirmed reason and reference before closing the outstanding balance');
 line.balanceHistory??=[];
 line.balanceHistory.push({at:timestamp(),action:'Close outstanding',quantity:open,reason:noteText,evidenceRef:proof});
 line.closedQuantity=Number(line.closedQuantity||0)+open;
 o.status=purchaseStatus(o);
 note(s,'Outstanding order balance closed',o.code+' / '+open+' units / '+proof);
 return line;
}
export function reopenPurchaseBalance(s,{orderId,lineId,reason,evidenceRef}){
 ensureMaterials(s);
 const {o,line}=orderAndLine(s,orderId,lineId);
 const n=Number(line.closedQuantity||0);
 if(!n)throw Error('No closed order quantity exists');
 const noteText=required(reason,'Supplier reinstatement reason');
 const proof=required(evidenceRef,'Supplier confirmation reference');
 if(noteText.length<8||proof.length<4)throw Error('Give the reinstatement reason and supplier reference');
 line.balanceHistory??=[];
 line.balanceHistory.push({at:timestamp(),action:'Reopen outstanding',quantity:n,reason:noteText,evidenceRef:proof});
 line.closedQuantity=0;
 o.status=purchaseStatus(o);
 note(s,'Outstanding order balance reopened',o.code+' / '+n+' units / '+proof);
 return line;
}

export function returnPurchaseReceipt(s,{receiptId,quantity}){
  ensureMaterials(s);
  const receipt=s.procurementReceipts.find(x=>x.id===receiptId);
  if(!receipt)throw Error('Receipt unavailable');
  const {o,line}=orderAndLine(s,receipt.orderId,receipt.lineId);
  const q=integer(quantity,'Return quantity');
  if(q>receipt.quantity-receipt.returned)throw Error('Cannot return more than this receipt');
  const part=partById(s,receipt.partId);
  if(available(part)<q)throw Error('Cannot return stock already reserved or issued');
  part.onHand-=q;line.received-=q;receipt.returned+=q;
  o.status=purchaseStatus(o);
  s.procurementReturns.unshift({id:uid('ret'),receiptId:receipt.id,partId:part.id,quantity:q,projectId:o.projectId,date:timestamp()});
  recordMovement(s,part.id,'supplier-return',q,o.projectId,o.code);
  note(s,'Supplier return',o.code+': '+q+' × '+part.code);
  return receipt;
}


const trackingURL = raw => {
  const value=String(raw||'').trim();
  if(!value)return '';
  try {const u=new URL(value);if(u.protocol!=='https:')throw Error();return u.href;}
  catch {throw Error('Tracking URL must start with https://');}
};
const supportedMime = new Set(['application/pdf','image/jpeg','image/png','image/webp']);
export function saveOrderShipment(s,{orderId,carrier,trackingCode,trackingUrl,eta,note:deliveryNote}){
  ensureMaterials(s);
  const o=s.orders.find(o=>live(o)&&o.id===orderId);
  if(!o)throw Error('Purchase order unavailable');
  if(eta&&!/^\d{4}-\d{2}-\d{2}$/.test(eta))throw Error('Expected delivery must be YYYY-MM-DD');
  o.shipment={carrier:String(carrier||'').trim().slice(0,100),
    trackingCode:String(trackingCode||'').trim().slice(0,150),
    trackingUrl:trackingURL(trackingUrl),eta:String(eta||''),
    note:String(deliveryNote||'').trim().slice(0,500)};
  note(s,'Tracking details updated',o.code);
  return o;
}
export function addOrderAttachment(s,{orderId,name,mime,size,dataUrl}){
  ensureMaterials(s);
  const o=s.orders.find(o=>live(o)&&o.id===orderId);
  if(!o)throw Error('Purchase order unavailable');
  if(!supportedMime.has(mime))throw Error('Only PDF, JPEG, PNG or WebP proof files are supported');
  if(!Number.isSafeInteger(size)||size<=0||size>800000)throw Error('Proof file must be 800 KB or smaller');
  const prefix='data:'+mime+';base64,';
  if(!String(dataUrl||'').startsWith(prefix)||!new RegExp('^[A-Za-z0-9+/]*={0,2}$').test(dataUrl.slice(prefix.length)))
    throw Error('Invalid document file encoding');
  if(dataUrl.length-prefix.length!==Math.ceil(size/3)*4)throw Error('Document size does not match uploaded content');
  o.attachments??=[];
  if(o.attachments.length>=4)throw Error('Maximum four proof documents per order');
  const file={id:uid('proof'),name:required(name,'Filename').slice(0,150),mime,size,dataUrl,addedAt:timestamp()};
  o.attachments.push(file);
  note(s,'Proof-of-order attached',o.code+' / '+file.name);
  return file;
}
export function removeOrderAttachment(s,{orderId,attachmentId}){
  ensureMaterials(s);
  const o=s.orders.find(o=>live(o)&&o.id===orderId);
  if(!o)throw Error('Purchase order unavailable');
  const index=(o.attachments||[]).findIndex(f=>f.id===attachmentId);
  if(index<0)throw Error('Attachment not found');
  const [file]=o.attachments.splice(index,1);
  note(s,'Order document removed',o.code+' / '+file.name);
  return file;
}
export const reservationRemaining = r => Math.max(0,Number(r.quantity||0)-Number(r.issued||0)-Number(r.released||0));
export function reserveProjectStock(s,{projectId,assemblyId,partId,quantity}){
  ensureMaterials(s);
  const project=projectById(s,projectId),part=partById(s,partId);
  assemblyForProject(s,assemblyId,project.id);
  const q=integer(quantity,'Reservation quantity');
  if(available(part)<q)throw Error('Insufficient available stock: '+available(part)+' free');
  part.reserved=Number(part.reserved||0)+q;
  const reservation={id:uid('res'),projectId:project.id,assemblyId:assemblyId||null,partId:part.id,
    quantity:q,issued:0,released:0,createdAt:timestamp()};
  s.stockReservations.unshift(reservation);
  recordMovement(s,part.id,'reserve',q,project.id,reservation.id);
  note(s,'Stock reserved',q+' × '+part.code+' for '+project.code);
  return reservation;
}
export function releaseProjectStock(s,{reservationId,quantity}){
  ensureMaterials(s);
  const r=s.stockReservations.find(x=>x.id===reservationId);
  if(!r)throw Error('Reservation unavailable');
  const q=integer(quantity,'Release quantity'),remain=reservationRemaining(r);
  if(q>remain)throw Error('Cannot release more than reserved');
  const p=partById(s,r.partId);
  if(Number(p.reserved)<q)throw Error('Reservation ledger mismatch');
  p.reserved-=q;r.released+=q;
  recordMovement(s,p.id,'release-reservation',q,r.projectId,r.id);
  note(s,'Reservation released',q+' × '+p.code);
  return r;
}
export function issueProjectStock(s,{reservationId,quantity}){
  ensureMaterials(s);
  const r=s.stockReservations.find(x=>x.id===reservationId);
  if(!r)throw Error('Reservation unavailable');
  const q=integer(quantity,'Issue quantity'),remain=reservationRemaining(r);
  if(q>remain)throw Error('Cannot issue more than reserved');
  const p=partById(s,r.partId);
  if(Number(p.onHand)<q||Number(p.reserved)<q)throw Error('Insufficient reserved on-hand stock');
  p.onHand-=q;p.reserved-=q;r.issued+=q;
  recordMovement(s,p.id,'issue-reserved',q,r.projectId,r.id);
  note(s,'Stock issued to workshop',q+' × '+p.code);
  return r;
}
export function consumeIssuedStock(s,{reservationId,quantity}){
  ensureMaterials(s);
  const r=s.stockReservations.find(x=>x.id===reservationId);
  if(!r)throw Error('Reservation unavailable');
  const q=integer(quantity,'Consumption quantity');
  const unconsumed=Number(r.issued||0)-Number(r.consumed||0);
  if(q>unconsumed)throw Error('Cannot consume more than previously issued');
  r.consumed=Number(r.consumed||0)+q; // Already removed from on-hand at issue
  recordMovement(s,r.partId,'consume-issued',q,r.projectId,r.id);
  note(s,'Workshop material consumed',q+' × '+partById(s,r.partId).code);
  return r;
}
export function assemblyAllocationReadiness(s,assemblyId){
  ensureMaterials(s);
  const rollup=assemblyRollup(s,assemblyId);
  const included=new Set(rollup.assemblies.map(a=>a.assemblyId));
  return rollup.parts.map(line=>{
    const rs=s.stockReservations.filter(r=>included.has(r.assemblyId)&&r.partId===line.partId);
    const reserved=rs.reduce((v,r)=>v+reservationRemaining(r),0);
    const issued=rs.reduce((v,r)=>v+Number(r.issued||0),0);
    return {...line,reserved,issued,missing:Math.max(0,line.required-reserved-issued),
      ready:reserved+issued>=line.required};
  });
}
export function materialReadinessV041(s,projectId){
  ensureMaterials(s);
  projectById(s,projectId);
  const sums=new Map();
  for(const root of activeAssemblies(s,projectId).filter(a=>!a.parentId)){
    for(const line of assemblyRollup(s,root.id).parts){
      const row=sums.get(line.partId)||{partId:line.partId,required:0};
      row.required+=line.required;sums.set(line.partId,row);
    }
  }
  return [...sums.values()].map(row=>{
    const part=partById(s,row.partId);
    const rs=s.stockReservations.filter(r=>r.projectId===projectId&&r.partId===part.id);
    const reserved=rs.reduce((n,r)=>n+reservationRemaining(r),0);
    const issued=rs.reduce((n,r)=>n+Number(r.issued||0),0);
    const toAllocate=Math.max(0,row.required-reserved-issued);
    const incoming=s.orders.filter(o=>live(o)&&o.projectId===projectId)
      .reduce((n,o)=>n+o.items.filter(l=>l.partId===part.id).reduce((m,l)=>m+outstanding(l),0),0);
    return {...row,part,reserved,issued,toAllocate,incoming,freeStock:available(part),
      toSource:Math.max(0,toAllocate-available(part)-incoming),ready:toAllocate===0};
  }).sort((a,b)=>a.part.code.localeCompare(b.part.code));
}
export function auditMaterials(s){
  ensureMaterials(s);
  for(const p of s.parts){
    if(!Number.isSafeInteger(Number(p.onHand))||!Number.isSafeInteger(Number(p.reserved))||p.onHand<0||p.reserved<0||p.reserved>p.onHand)
      throw Error('Invalid on-hand/reserved quantities for '+p.code);
    const tracked=s.stockReservations.filter(r=>r.partId===p.id).reduce((n,r)=>n+reservationRemaining(r),0);
    if(tracked>p.reserved)throw Error('Unbalanced reservation ledger for '+p.code);
  }
  for(const o of s.orders)for(const l of o.items){
    if(!Number.isSafeInteger(Number(l.quantity))||l.quantity<=0||!Number.isSafeInteger(Number(l.received||0))||l.received<0||l.received>l.quantity)
      throw Error('Invalid PO quantity for '+o.code);
  }
  return true;
}
export function createWorkspaceBackup(s){
  auditMaterials(s);
  return JSON.stringify({format:'simworx-project-hub-backup',schema:1,application:'V0.4.6',createdAt:timestamp(),
    warning:'PRIVATE INTERNAL DATA. May contain customer contracts, costs, purchasing evidence, shipment details and attachments. Keep encrypted or access-controlled outside this application. Do not publish to GitHub.',state:s},null,2);
}
export function parseWorkspaceBackup(text){
  if(typeof text!=='string'||text.length>10_000_000)throw Error('Backup exceeds the 10 MB import limit');
  const decoded=JSON.parse(text,(key,value)=>{
    if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsafe backup key');
    return value;
  });
  if(decoded?.format!=='simworx-project-hub-backup'||decoded.schema!==1)throw Error('Not a supported Project Hub backup');
  const s=decoded.state;
  for(const key of ['organizations','projects','sections','tasks','parts','bom','orders','movements','audit'])
    if(!Array.isArray(s?.[key]))throw Error('Backup missing '+key);
  if(s.version!==1||!s.settings||!['light','dark'].includes(s.settings.theme))throw Error('Unsupported backup data format');
  ensureMaterials(s);
  auditMaterials(s);
  return s;
}
