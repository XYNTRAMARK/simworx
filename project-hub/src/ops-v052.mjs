/* V0.5.2 — explicit offline operational records. All data stays in private local workspace.
 * None of these entries proves a transaction independently or executes a payment/order. */
import {approvalStatus} from './procurement-control-v049.mjs';
import {contractControlled} from './procurement-workflow-v047.mjs';
import {flaggedUnspecifiedPurchases,jobRequirements} from './workplan-v050.mjs';
const live=x=>x&&!x.archivedAt;
const now=()=>new Date().toISOString();
const uid=p=>p+'-'+Math.random().toString(36).slice(2,12);
const str=(x,label,min=3,max=300)=>{const v=String(x??'').trim();if(v.length<min||v.length>max)throw Error(label+' requires '+min+'–'+max+' characters');return v;};
const qty=(v,label)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>10000000)throw Error(label+' must be a positive whole number');return n;};
const euros=(v,label,allowZero=false)=>{const n=Number(v);if(!Number.isFinite(n)||(allowZero?n<0:n<=0)||n>1e9||Math.abs(n*100-Math.round(n*100))>.00001)throw Error(label+' needs a valid amount with at most two decimals');return Math.round(n*100)/100;};
const audit=(s,action,detail)=>{s.audit??=[];s.audit.unshift({id:uid('audit'),at:now(),actor:'Owner (offline self-entry)',action,detail})};
export function ensureOps(s){s.supplierAcknowledgements??=[];s.supplierInvoices??=[];s.supplierPayments??=[];s.qualityNCRs??=[];return s;}
function order(s,id){const o=s.orders?.find(x=>live(x)&&x.id===id);if(!o)throw Error('Recorded supplier PO not found');return o;}
function orderLine(s,orderId,lineId){const o=order(s,orderId),line=o.items?.find(x=>x.id===lineId);if(!line)throw Error('Supplier PO line not found');return {o,line};}
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
export function recordAcknowledgement(s,{orderId,reference,actor,notes=''}) {
 ensureOps(s);const o=order(s,orderId),ref=str(reference,'Supplier confirmation reference',4,180),who=str(actor,'Person recording confirmation',3,120);
 if(s.supplierAcknowledgements.some(x=>x.orderId===o.id&&x.reference.toLowerCase()===ref.toLowerCase()))throw Error('Confirmation reference already recorded on this PO');
 const a={id:uid('ack'),projectId:o.projectId,orderId:o.id,reference:ref,actor:who,notes:String(notes||'').trim().slice(0,1000),recordedAt:now(),nature:'Manual confirmation reference, not supplier-verified'};
 s.supplierAcknowledgements.push(a);audit(s,'Supplier acknowledgement recorded',o.code+' / '+ref);return a;
}
export function recordedAcceptedQuantity(s,orderId,lineId){
 return Math.max(0,(s.procurementReceipts||[]).filter(r=>r.orderId===orderId&&r.lineId===lineId)
  .reduce((n,r)=>n+Number(r.quantity||0)-Number(r.returned||0),0));
}
export function invoiceMatch(s,invoice){
 const o=s.orders?.find(x=>x.id===invoice.orderId),line=o?.items?.find(x=>x.id===invoice.lineId);
 if(!o||!line)return {matched:false,reasons:['Original PO line missing']};
 const accepted=recordedAcceptedQuantity(s,o.id,line.id);
 const invoices=(s.supplierInvoices||[]).filter(x=>x.id!==invoice.id&&x.orderId===o.id&&x.lineId===line.id);
 const already=invoices.reduce((n,x)=>n+Number(x.quantity||0),0);
 const reasons=[];
 if(accepted<already+Number(invoice.quantity||0))reasons.push('Invoiced quantity exceeds QA-accepted net goods');
 if(Number(invoice.unitPrice)>Number(line.unitCost)+0.00001)reasons.push('Supplier invoice unit price exceeds recorded PO');
 if(invoice.currency!==o.currency)reasons.push('Invoice currency differs from PO');
 if(Number(invoice.taxRate)!==Number(o.taxRate||0))reasons.push('Invoice tax assumption differs from PO');
 if(Number(invoice.quantity)>Number(line.quantity))reasons.push('Invoiced quantity exceeds ordered quantity');
 return {matched:reasons.length===0,reasons,accepted,already,orderQuantity:Number(line.quantity),poUnitPrice:Number(line.unitCost||0)};
}
export function recordSupplierInvoice(s,{orderId,lineId,invoiceRef,quantity,unitPrice,taxRate,currency,evidenceRef,actor}){
 ensureOps(s);const {o,line}=orderLine(s,orderId,lineId);
 const ref=str(invoiceRef,'Actual supplier invoice number',4,160),who=str(actor,'Person recording invoice',3,120);
 const original=String(currency||o.currency);
 if(s.supplierInvoices.some(x=>x.projectId===o.projectId&&x.supplier===o.supplier&&x.invoiceRef.toLowerCase()===ref.toLowerCase()))
  throw Error('Duplicate supplier invoice number. One invoice reference per recorded line is supported; do not split an invoice across records');
 const invoice={id:uid('invoice'),projectId:o.projectId,supplier:o.supplier,orderId:o.id,lineId:line.id,
  invoiceRef:ref,quantity:qty(quantity,'Invoice quantity'),unitPrice:euros(unitPrice,'Invoice unit price',true),
  taxRate:euros(taxRate??o.taxRate??0,'Invoice tax percentage',true),currency:original,
  evidenceRef:str(evidenceRef,'Actual supplier invoice/evidence reference',4,240),actor:who,recordedAt:now(),
  nature:'Owner-entered supplier invoice register; not posted accounting or proof of payment'};
 if(invoice.taxRate>100)throw Error('Invoice tax percentage exceeds 100%');
 if(!['EUR','GBP','USD','CAD'].includes(original))throw Error('Unsupported invoice currency');
 // Exception invoices may be recorded, never silently marked matched or paid.
 s.supplierInvoices.push(invoice);
 audit(s,'Supplier invoice manually recorded',o.code+' / '+ref+' / '+(invoiceMatch(s,invoice).matched?'matching candidate':'UNMATCHED EXCEPTION'));
 return invoice;
}
export function paymentBalance(s,invoiceId){
 ensureOps(s);const inv=s.supplierInvoices.find(x=>x.id===invoiceId);
 if(!inv)throw Error('Supplier invoice not found');
 const due=round(inv.quantity*inv.unitPrice*(1+inv.taxRate/100));
 const paid=round(s.supplierPayments.filter(x=>x.invoiceId===invoiceId).reduce((n,x)=>n+x.amount,0));
 return {invoice:inv,due,paid,remaining:round(due-paid)};
}
export function recordSupplierPayment(s,{invoiceId,amount,reference,actor}){
 const {invoice,remaining}=paymentBalance(s,invoiceId);
 if(!invoiceMatch(s,invoice).matched)throw Error('Payment record blocked: PO, QA receipt and invoice are not three-way matched');
 if((s.qualityNCRs||[]).some(n=>n.projectId===invoice.projectId&&n.orderId===invoice.orderId&&n.lineId===invoice.lineId&&n.status==='Open'))
  throw Error('Payment record blocked while a linked NCR remains open');
 const value=euros(amount,'Recorded payment amount');
 if(value>remaining+.00001)throw Error('Payment exceeds remaining invoiced balance');
 const ref=str(reference,'Bank/transfer payment reference',5,180),who=str(actor,'Person recording payment',3,120);
 if(s.supplierPayments.some(p=>p.projectId===invoice.projectId&&p.reference.toLowerCase()===ref.toLowerCase()))
  throw Error('Duplicate payment reference');
 const p={id:uid('pay'),invoiceId,orderId:invoice.orderId,lineId:invoice.lineId,projectId:invoice.projectId,
  amount:value,currency:invoice.currency,reference:ref,actor:who,recordedAt:now(),
  nature:'Manually recorded external payment; never initiates bank transfer'};
 s.supplierPayments.push(p);audit(s,'External payment manually recorded',invoice.invoiceRef+' / '+ref);
 return p;
}
export function recordNCR(s,{projectId,taskId,orderId='',lineId='',finding,correctiveAction,owner,evidenceRef}){
 ensureOps(s);
 const t=s.tasks?.find(x=>live(x)&&x.id===taskId&&x.projectId===projectId);if(!t)throw Error('NCR needs a job within the selected project');
 if(orderId){const {o}=orderLine(s,orderId,lineId);if(o.projectId!==projectId)throw Error('NCR PO belongs to another project');}
 else if(lineId)throw Error('NCR line requires a recorded PO');
 const n={id:uid('ncr'),projectId,taskId,orderId:orderId||null,lineId:lineId||null,
  finding:str(finding,'Nonconformance finding',8,1500),correctiveAction:str(correctiveAction,'Proposed corrective action',8,1500),
  owner:str(owner,'Responsible corrective-action owner',3,120),evidenceRef:str(evidenceRef,'Observed evidence reference',4,240),
  status:'Open',createdAt:now(),closure:null};
 s.qualityNCRs.push(n);audit(s,'NCR opened',n.id+' / '+t.title);return n;
}
export function closeNCR(s,{ncrId,retestEvidence,reviewer,actionTaken}){
 ensureOps(s);const n=s.qualityNCRs.find(x=>x.id===ncrId&&x.status==='Open');
 if(!n)throw Error('Open NCR not found');
 n.closure={at:now(),retestEvidence:str(retestEvidence,'Actual retest/inspection evidence',4,240),
  reviewer:str(reviewer,'Person recording closure',3,120),actionTaken:str(actionTaken,'Corrective action completed',8,1500)};
 n.status='Closed';audit(s,'NCR manually closed after recorded retest',n.id+' / '+n.closure.reviewer);return n;
}
export function saveJobAssurance(s,{taskId,criteria='',blocker='',delayReason='',estimatedHours='',actualHours='',technicalRevision='',reviewer}){
 const t=s.tasks?.find(x=>live(x)&&x.id===taskId);if(!t)throw Error('Active job not found');
 const who=str(reviewer,'Person recording job plan',3,120);
 const hours=(v,label)=>{if(v===''||v===null||v===undefined)return null;const n=Number(v);if(!Number.isFinite(n)||n<0||n>100000||Math.abs(n*4-Math.round(n*4))>.000001)throw Error(label+' must be in quarter-hour increments');return n};
 const next={criteria:String(criteria||'').trim().slice(0,2200),blocker:String(blocker||'').trim().slice(0,1000),
  delayReason:String(delayReason||'').trim().slice(0,1000),estimatedHours:hours(estimatedHours,'Estimated hours'),
  actualHours:hours(actualHours,'Actual hours'),technicalRevision:String(technicalRevision||'').trim().slice(0,160),
  reviewer:who,recordedAt:now()};
 if(t.jobAssurance){t.jobAssuranceHistory??=[];t.jobAssuranceHistory.push({...t.jobAssurance})}
 t.jobAssurance=next;audit(s,'Job quality and readiness plan revised',t.id+' / '+who);return next;
}
export function attentionItems(s,projectId,today=new Date().toISOString().slice(0,10)){
 ensureOps(s);
 const items=[],push=(priority,type,title,detail,tab,id='')=>items.push({priority,type,title,detail,tab,id});
 const tasks=(s.tasks||[]).filter(t=>live(t)&&t.projectId===projectId);
 for(const t of tasks){
  if(t.status==='Done'||t.status==='Cancelled')continue;
  if(!t.assignee||t.assignee==='Unassigned')push(2,'Job owner',t.title,'Assign a responsible person','work',t.id);
  if(t.due&&t.due<today)push(1,'Overdue job',t.title,'Due '+t.due+'; record the reason for delay','work',t.id);
  if(t.status==='Blocked'&&!t.jobAssurance?.blocker)push(1,'Blocked job',t.title,'State the blocker and proposed resolution','work',t.id);
  if(t.status==='Inspection'&&!t.jobAssurance?.criteria)push(2,'Acceptance criteria',t.title,'Define what passing inspection means','work',t.id);
 }
 for(const t of flaggedUnspecifiedPurchases(s,projectId))push(1,'Buy flag',t.title,'Add exact item, specification and quantity; no order exists','work',t.id);
 for(const o of (s.assemblyBOM||[]).filter(x=>live(x)&&x.projectId===projectId&&x.makeBuy!=='Make'&&x.purchaseSource?.responsibility==='Sim-Worx')){
  try{
   const approval=approvalStatus(s,o.id);
   if(!approval.approved)push(2,'PO hold','Requirement '+o.id,approval.status,'procurement',o.id);
  }catch{push(1,'Source integrity','Requirement '+o.id,'Cannot resolve approval/source','procurement',o.id);}
 }
 const project=s.projects?.find(p=>p.id===projectId);
 if(project&&!contractControlled(s,projectId))push(1,'Purchasing gate',project.name,'New POs BLOCKED: explicitly enable controlled purchasing after migration review','attention');
 for(const o of (s.orders||[]).filter(x=>live(x)&&x.projectId===projectId)){
  const ack=s.supplierAcknowledgements.some(x=>x.orderId===o.id);
  if(!ack)push(2,'Supplier confirmation',o.code,'No separately recorded supplier acknowledgement','operations',o.id);
  for(const l of (o.items||[])){
   const open=Number(l.quantity||0)-Number(l.received||0)-Number(l.closedQuantity||0);
   if(open>0&&l.eta&&l.eta<today)push(1,'Delayed delivery',o.code,'Line '+l.id+' overdue since '+l.eta,'operations',o.id);
   if(recordedAcceptedQuantity(s,o.id,l.id)>0&&!(s.supplierInvoices||[]).some(i=>i.lineId===l.id&&i.orderId===o.id))
     push(2,'Invoice missing',o.code,'Accepted line '+l.id+' has no recorded supplier invoice','operations',o.id);
  }
 }
 for(const a of (s.procurementArrivals||[]).filter(x=>x.status==='Awaiting inspection')){
  const o=s.orders?.find(x=>x.id===a.orderId&&x.projectId===projectId);if(o)push(1,'Awaiting QA',o.code,'Arrival '+a.id+' not inspected','procurement',a.lineId);
 }
 for(const n of s.qualityNCRs.filter(x=>x.projectId===projectId&&x.status==='Open'))
  push(1,'Open NCR',n.id,n.finding,'operations',n.orderId||n.taskId);
 for(const invoice of s.supplierInvoices.filter(x=>x.projectId===projectId)){
  const match=invoiceMatch(s,invoice);
  if(!match.matched)push(1,'Three-way mismatch',invoice.invoiceRef,match.reasons.join('; '),'operations',invoice.orderId);
  else if(paymentBalance(s,invoice.id).remaining>0)push(2,'Unpaid invoice record',invoice.invoiceRef,'External payment not fully recorded — not an instruction to pay','operations',invoice.orderId);
 }
 items.sort((a,b)=>a.priority-b.priority||a.type.localeCompare(b.type)||a.title.localeCompare(b.title));
 return items;
}

export function enableControlledPurchasing(s,{projectId,reviewer,reviewReference}){
 ensureOps(s);
 const p=s.projects?.find(x=>live(x)&&x.id===projectId);
 if(!p)throw Error('Active project not found');
 if(contractControlled(s,projectId))throw Error('Project already has controlled purchasing');
 const who=str(reviewer,'Owner activating strict purchase control',3,120);
 const ref=str(reviewReference,'Purchasing migration/review reference',8,240);
 // Past orders are preserved without reclassifying them as approved or authorizing edits.
 p.specGateRequired=true;
 p.purchaseGateActivation={at:now(),reviewer:who,reviewReference:ref,
   note:'Historical orders NOT retroactively approved; all NEW orders require exact source, technical and owner approval'};
 audit(s,'Strict future purchasing gate activated',p.id+' / '+ref+' / existing PO history unaffected');
 return p;
}
