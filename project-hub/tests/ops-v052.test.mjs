/* V0.5.2 synthetic offline procurement & evidence regressions.
 * Run: node --test tests/ops-v052.test.mjs
 * No actual contracts, suppliers, receipts, photos or customer data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurchaseOrder,addPurchaseLine,createWorkspaceBackup,parseWorkspaceBackup} from '../src/materials-v041.mjs';
import {recordAcknowledgement,recordSupplierInvoice,invoiceMatch,recordSupplierPayment,paymentBalance,recordNCR,closeNCR,saveJobAssurance,attentionItems,enableControlledPurchasing} from '../src/ops-v052.mjs';
import {attachWorkEvidence,archiveWorkEvidence,validateWorkEvidence,setEvidenceCustomerPreview,customerEvidenceProjection} from '../src/work-evidence-v051.mjs';
import {renderAttention,renderOperations,renderJobAssurance} from '../src/ops-ui-v052.mjs';

function fixture(){
 return {version:1,settings:{theme:'light'},organizations:[],projects:[{id:'p',code:'TST',name:'Fictional project',budget:1200}],
 sections:[{id:'section',projectId:'p',name:'Panel'}],
 tasks:[{id:'job',projectId:'p',sectionId:'section',title:'Fictional panel',assignee:'Unassigned',status:'Backlog',needsPurchasing:true}],
 parts:[{id:'part',code:'PART-01',name:'Fictional actuator',onHand:0,reserved:0}],bom:[],audit:[],movements:[],
 assemblies:[],assemblyBOM:[{id:'occ',projectId:'p',linkedTaskId:'job',partId:'part',quantity:3,makeBuy:'Buy',purchaseSource:{responsibility:'Sim-Worx'}}],
 orders:[{id:'po',projectId:'p',code:'PO-TEST',supplier:'Imaginary Vendor',currency:'EUR',taxRate:21,
 items:[{id:'line',sourceOccurrenceId:'occ',partId:'part',quantity:3,unitCost:40,received:0,closedQuantity:0,eta:'2025-01-01'}]}],
 stockReservations:[],procurementReceipts:[],workEvidence:[],customerShareRules:[{projectId:'p',sectionId:'section',visible:true}]};
}
const invoice=(s,ref='INV-TEST-1',qty=1,price=40)=>recordSupplierInvoice(s,{orderId:'po',lineId:'line',invoiceRef:ref,quantity:qty,unitPrice:price,taxRate:21,currency:'EUR',evidenceRef:'DOC-TEST-1',actor:'Test Owner'});
const payment=(s,i,ref='PAY-TEST-1',amount=10)=>recordSupplierPayment(s,{invoiceId:i.id,amount,reference:ref,actor:'Test Owner'});
const photo='data:image/png;base64,iVBORw0KGgo=';
const upload=(s,extra={})=>attachWorkEvidence(s,{projectId:'p',taskId:'job',occurrenceId:'occ',kind:'Photo / screenshot',title:'Synthetic redacted image',filename:'synthetic.png',mime:'image/png',dataUrl:photo,...extra});

test('new supplier POs and additions on unreviewed blank projects are blocked; historic orders remain untouched',()=>{
 const s=fixture(),previous=JSON.stringify(s.orders);
 assert.throws(()=>createPurchaseOrder(s,{projectId:'p',supplier:'Test',items:[{}]}),/BLOCKED/);
 assert.throws(()=>addPurchaseLine(s,'po',{}),/blocked/);
 assert.equal(JSON.stringify(s.orders),previous);
});
test('strict project purchasing activation is a deliberate, auditable step, not automatic approval',()=>{
 const s=fixture();enableControlledPurchasing(s,{projectId:'p',reviewer:'Test Owner',reviewReference:'MIGRATION-SYN-1'});
 assert.equal(s.projects[0].specGateRequired,true);
 assert.equal(s.orders.length,1);
 assert.equal(s.purchaseAuthorisations?.length??0,0);
 assert.throws(()=>enableControlledPurchasing(s,{projectId:'p',reviewer:'Test Owner',reviewReference:'MIGRATION-SYN-2'}),/already/);
});
test('supplier acknowledgement is separate and requires a real original PO',()=>{
 const s=fixture();
 assert.throws(()=>recordAcknowledgement(s,{orderId:'absent',reference:'ACK-TEST-1',actor:'Test Owner'}),/not found/);
 recordAcknowledgement(s,{orderId:'po',reference:'ACK-TEST-1',actor:'Test Owner'});
 assert.throws(()=>recordAcknowledgement(s,{orderId:'po',reference:'ACK-TEST-1',actor:'Test Owner'}),/already/);
 assert.equal(s.procurementReceipts.length,0);
});
test('invoice without QA accepted goods is unmatched and cannot record payment',()=>{
 const s=fixture(),i=invoice(s);
 assert.equal(invoiceMatch(s,i).matched,false);
 assert.throws(()=>payment(s,i),/not three-way matched/);
 assert.equal(s.parts[0].onHand,0);
 assert.equal(s.supplierPayments.length,0);
});
test('partial receipts and supplier price mismatch are caught by independent three-way comparison',()=>{
 const s=fixture();s.procurementReceipts.push({orderId:'po',lineId:'line',quantity:2,returned:1});
 const i=invoice(s,'INV-TEST-2',2);
 assert.equal(invoiceMatch(s,i).matched,false);
 assert.match(invoiceMatch(s,i).reasons.join(';'),/QA-accepted/);
 const s2=fixture();s2.procurementReceipts.push({orderId:'po',lineId:'line',quantity:2,returned:0});
 const high=invoice(s2,'INV-TEST-3',1,41);assert.equal(invoiceMatch(s2,high).matched,false);
});
test('approved quantity/payment amounts are recorded manually without stock or PO movements',()=>{
 const s=fixture();s.procurementReceipts.push({orderId:'po',lineId:'line',quantity:1,returned:0});
 const i=invoice(s);assert.equal(invoiceMatch(s,i).matched,true);
 payment(s,i,'PAY-TEST-1',20);
 assert.equal(paymentBalance(s,i.id).remaining,28.4);
 assert.throws(()=>payment(s,i,'PAY-TEST-2',30),/exceeds/);
 assert.throws(()=>payment(s,i,'PAY-TEST-1',1),/Duplicate/);
 assert.equal(s.parts[0].onHand,0);
 assert.equal(s.orders.length,1);
});
test('NCR requires genuine retest evidence and blocks further payment records while open',()=>{
 const s=fixture();s.procurementReceipts.push({orderId:'po',lineId:'line',quantity:1,returned:0});
 const i=invoice(s),n=recordNCR(s,{projectId:'p',taskId:'job',orderId:'po',lineId:'line',finding:'Fictional dimension outside tolerance',correctiveAction:'Inspect replacement component',owner:'Test QA Owner',evidenceRef:'QA-TEST-1'});
 assert.throws(()=>payment(s,i),/NCR/);
 assert.throws(()=>closeNCR(s,{ncrId:n.id,actionTaken:'done',retestEvidence:'ok',reviewer:'Test QA'}),/requires/);
 closeNCR(s,{ncrId:n.id,actionTaken:'Verified compliant replacement',retestEvidence:'RETEST-REF-1',reviewer:'Test QA'});
 payment(s,i);
 assert.equal(n.status,'Closed');
});
test('job acceptance and revision history do not fabricate actual work or completion',()=>{
 const s=fixture();saveJobAssurance(s,{taskId:'job',criteria:'Measure actuator alignment',estimatedHours:8,reviewer:'Test Engineer'});
 saveJobAssurance(s,{taskId:'job',criteria:'Measure alignment and verify travel',estimatedHours:8,actualHours:0,reviewer:'Test Engineer'});
 assert.equal(s.tasks[0].jobAssuranceHistory.length,1);
 assert.equal(s.tasks[0].status,'Backlog');
 assert.match(renderJobAssurance(s,s.tasks[0]),/readiness snapshot/i);
});
test('owner attention queue links real records and HTML forms to original sources',()=>{
 const s=fixture(),queue=attentionItems(s,'p');
 assert.ok(queue.some(x=>x.type==='Purchasing gate'));
 assert.ok(queue.some(x=>x.type==='Buy flag'&&x.id==='job'));
 assert.ok(queue.some(x=>x.type==='Supplier confirmation'));
 assert.match(renderAttention(s,{},'p'),/v52-enable-gate/);
 assert.match(renderOperations(s,{},'p'),/v52-invoice/);
});
test('PO invoice/order confirmation evidence must belong to the same PO line and is retained',()=>{
 const s=fixture();
 assert.throws(()=>upload(s,{kind:'Supplier order confirmation'}),/previously recorded actual supplier PO line/);
 const evidence=upload(s,{kind:'Supplier order confirmation',orderId:'po',lineId:'line'});
 assert.throws(()=>archiveWorkEvidence(s,evidence.id),/historical evidence/);
 assert.equal(s.workEvidence.length,1);
 assert.throws(()=>upload(s,{kind:'Supplier order confirmation',orderId:'po',lineId:'invalid'}),/PO line/);
});
test('customer preview defaults private, invalidates after technical revision and supports revocation',()=>{
 const s=fixture(),e=upload(s);
 assert.equal(customerEvidenceProjection(s,'p').length,0);
 setEvidenceCustomerPreview(s,{evidenceId:e.id,visible:true,reviewer:'Test Engineer',caption:'Reviewed mock-up photo',redactionConfirmed:true});
 assert.equal(customerEvidenceProjection(s,'p').length,1);
 s.tasks[0].jobAssurance={technicalRevision:'DRAWING-B2'};
 assert.equal(customerEvidenceProjection(s,'p').length,0);
 setEvidenceCustomerPreview(s,{evidenceId:e.id,visible:false});
 assert.equal(customerEvidenceProjection(s,'p').length,0);
});
test('backup refuses invalid/cross-project evidence, and detects byte-level checksum changes',()=>{
 const s=fixture();upload(s);
 assert.equal(parseWorkspaceBackup(createWorkspaceBackup(s)).workEvidence.length,1);
 s.workEvidence[0].dataUrl='data:image/png;base64,iVBORw0KGgoA';
 assert.throws(()=>validateWorkEvidence(s),/checksum/);
 s.workEvidence[0].dataUrl=photo;s.workEvidence[0].projectId='not-p';
 assert.throws(()=>parseWorkspaceBackup(JSON.stringify({format:'simworx-project-hub-backup',schema:1,state:s})),/Evidence/);
});

test('backup rejects orphaned or impossible manually recorded supplier financial events',()=>{
 const s=fixture();s.procurementReceipts.push({orderId:'po',lineId:'line',quantity:1,returned:0});
 const inv=invoice(s,'INV-TEST-LEDGER');payment(s,inv,'PAY-TEST-LEDGER',20);
 assert.equal(parseWorkspaceBackup(createWorkspaceBackup(s)).supplierPayments.length,1);
 s.supplierPayments[0].amount=999;
 assert.throws(()=>parseWorkspaceBackup(JSON.stringify({format:'simworx-project-hub-backup',schema:1,state:s})),/exceed/);
 s.supplierPayments[0].amount=20;s.supplierPayments[0].lineId='not-line';
 assert.throws(()=>parseWorkspaceBackup(JSON.stringify({format:'simworx-project-hub-backup',schema:1,state:s})),/payment/);
});
test('historical supplier invoice record retains source linkage after job quality status changes',()=>{
 const s=fixture();s.procurementReceipts.push({orderId:'po',lineId:'line',quantity:1,returned:0});
 const inv=invoice(s,'INV-TEST-HISTORY');const state=JSON.stringify(s.orders[0]);
 assert.equal(invoiceMatch(s,inv).matched,true);
 s.qualityNCRs=[{id:'ncr-test',projectId:'p',taskId:'job',orderId:'po',lineId:'line',finding:'test',correctiveAction:'test',owner:'test',status:'Open'}];
 assert.equal(parseWorkspaceBackup(createWorkspaceBackup(s)).supplierInvoices.length,1);
 assert.equal(JSON.stringify(s.orders[0]),state);
});
