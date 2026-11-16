/* V0.4.9 synthetic procurement regression: no real project/customer data.
   Run from project-hub/: node --test tests/procurement-v049.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from '../src/clean-data-v043.mjs';
import {ensureMaterials,createPurchaseOrder,createWorkspaceBackup,parseWorkspaceBackup,receivePurchaseLine,returnPurchaseReceipt} from '../src/materials-v041.mjs';
import {saveRequirementTrace,recordOwnerAuthorisation,approvalStatus,revokeOwnerAuthorisation} from '../src/procurement-control-v049.mjs';
import {saveRequirementSource} from '../src/procurement-sourcing-v046.mjs';
import {reviewRequirementSpec,recordArrival,rejectArrival,specStatus} from '../src/procurement-workflow-v047.mjs';
import {saveDepartmentAllocation,allocateRequirement} from '../src/team-workspace-v048.mjs';
import {renderProcurementWorkbench} from '../src/procurement-workbench-v049.mjs';

function fixture({budget=1200,envelope=1000,qty=3}={}){
 const s=emptyWorkspace();
 s.projects=[{id:'p',code:'TEST',name:'Synthetic test project',budget,specGateRequired:true}];
 s.assemblies=[{id:'a',projectId:'p',code:'ASSY',name:'Synthetic panel',perParentQty:1,buildQty:1}];
 s.parts=[{id:'part',code:'ITEM',name:'Fictional controller',notes:'12 V interface',unit:'pcs',onHand:0,reserved:0}];
 s.assemblyBOM=[{id:'occ',projectId:'p',assemblyId:'a',partId:'part',quantity:qty,makeBuy:'Buy',notes:'No unapproved substitution'}];
 ensureMaterials(s);
 saveRequirementTrace(s,{occurrenceId:'occ',document:'Approved synthetic drawing',section:'1.2',revision:'A0',requirementStatus:'binding',fulfilment:'simworx-buy'});
 saveRequirementSource(s,{occurrenceId:'occ',responsibility:'Sim-Worx',supplier:'Fictional Vendor',vendorSku:'MODEL-123',quoteRef:'QT-1234'});
 reviewRequirementSpec(s,{occurrenceId:'occ',decision:'Matches contract',proposedSpecification:'Fictional Vendor MODEL-123 verified 12V',reviewer:'Test Engineer',evidenceRef:'DRAWING-A0',notes:'Detailed comparison performed for this synthetic record'});
 if(envelope>0)saveDepartmentAllocation(s,{projectId:'p',department:'IT',assignee:'Test Engineer',amount:envelope});
 allocateRequirement(s,{projectId:'p',occurrenceId:'occ',department:'IT',owner:'Test Engineer'});
 return s;
}
const approve=(s,{quantity=2,price=200,reference='AUTH-TEST-1',model='MODEL-123',tax=0}={})=>recordOwnerAuthorisation(s,{
 occurrenceId:'occ',supplier:'Fictional Vendor',manufacturerModel:model,vendorSku:'MODEL-123',quoteRef:'QT-1234',
 maxQuantity:quantity,maxUnitPrice:price,currency:'EUR',eurRate:1,taxRate:tax,reviewer:'Synthetic Owner',
 approvalRef:reference,evidenceRef:'QUOTE-1234-EVIDENCE'
});
const orderArgs=({quantity=2,price=200,taxRate=0}={})=>({
 projectId:'p',supplier:'Fictional Vendor',currency:'EUR',taxRate,
 items:[{partId:'part',sourceOccurrenceId:'occ',quantity,unitCost:price,vendorSku:'MODEL-123',quoteRef:'QT-1234'}]
});
test('contract-controlled order is blocked before any owner authorization',()=>{
 const s=fixture();assert.throws(()=>createPurchaseOrder(s,orderArgs()),/Owner authorization required/);
 assert.equal(s.orders.length,0);
});
test('source status, responsibility and unreviewed models cannot authorize orders',()=>{
 const s=fixture();assert.throws(()=>approve(s,{model:'UNREVIEWED-99'}),/must appear in the engineering/);
 saveRequirementTrace(s,{occurrenceId:'occ',document:'Approved synthetic drawing',section:'1.2',revision:'B0',requirementStatus:'provisional',fulfilment:'simworx-buy'});
 assert.throws(()=>approve(s),/Scope not released/);
 assert.equal(specStatus(s,'occ').approved,false);
});
test('budget, department envelope and tax are hard gates before owner approval',()=>{
 assert.throws(()=>approve(fixture({budget:300,envelope:200})),/budget would be exceeded|envelope would be exceeded/);
 assert.throws(()=>approve(fixture({budget:1200,envelope:300})),/envelope would be exceeded/);
 const s=fixture();approve(s,{tax:21});
 assert.throws(()=>createPurchaseOrder(s,orderArgs()),/tax differs/);
});
test('purchase order requires exact approved supplier/model/quote/quantity and cost',()=>{
 const s=fixture();approve(s);
 assert.throws(()=>createPurchaseOrder(s,orderArgs({price:300})),/unit cost exceeds/);
 const po=createPurchaseOrder(s,orderArgs());
 assert.equal(po.items[0].recordedApprovalRef,'AUTH-TEST-1');
 assert.throws(()=>createPurchaseOrder(s,orderArgs()),/uncovered engineering requirement|over-quantity/);
 assert.equal(s.orders.length,1);
});
test('arrival and wrong-item rejection do not add stock; partial QA acceptance does',()=>{
 const s=fixture();approve(s);const po=createPurchaseOrder(s,orderArgs()),line=po.items[0];
 const wrong=recordArrival(s,{orderId:po.id,lineId:line.id,quantity:1,deliveryRef:'DEL-1'});
 assert.equal(s.parts[0].onHand,0);
 rejectArrival(s,{arrivalId:wrong.id,reviewer:'Test Inspector',reason:'Wrong model received',evidenceRef:'QA-REJECT'});
 assert.equal(s.parts[0].onHand,0);
 const accepted=recordArrival(s,{orderId:po.id,lineId:line.id,quantity:1,deliveryRef:'DEL-2'});
 assert.throws(()=>receivePurchaseLine(s,{orderId:po.id,lineId:line.id,quantity:1,arrivalId:accepted.id}),/Inspector and acceptance evidence/);
 const receipt=receivePurchaseLine(s,{orderId:po.id,lineId:line.id,quantity:1,arrivalId:accepted.id,reviewer:'Test Inspector',evidenceRef:'QA-ACCEPT'});
 assert.equal(s.parts[0].onHand,1);assert.equal(line.received,1);
 returnPurchaseReceipt(s,{receiptId:receipt.id,quantity:1});assert.equal(s.parts[0].onHand,0);
});
test('revoking unused authorization prevents a new PO; previous approvals remain in history',()=>{
 const s=fixture();const a=approve(s);
 revokeOwnerAuthorisation(s,{authorizationId:a.id,reason:'Manufacturer changed quoted product'});
 assert.throws(()=>createPurchaseOrder(s,orderArgs()),/Owner authorization required/);
 assert.ok(s.purchaseAuthorisations[0].revokedAt);
});
test('private workspace backup roundtrip, isolated project filter and five-step desk',()=>{
 const s=fixture();approve(s);createPurchaseOrder(s,orderArgs());
 const copy=parseWorkspaceBackup(createWorkspaceBackup(s));
 assert.equal(copy.orders.length,1);
 assert.equal(copy.purchaseAuthorisations.length,1);
 const html=renderProcurementWorkbench(copy,{v46BuyingMode:'All',v46BuyingQuery:'',v49SelectedOccurrence:'occ'},'p');
 assert.match(html,/Owner-controlled spending authority/);
 assert.match(html,/Supplier order, delivery &amp; QA/);
 assert.match(html,/Synthetic test project|Fictional controller/);
});
