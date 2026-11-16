import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from '../src/clean-data-v043.mjs';
import {ensureMaterials,createPurchaseOrder,closePurchaseBalance,receivePurchaseLine,outstanding,materialReadinessV041,createWorkspaceBackup,parseWorkspaceBackup} from '../src/materials-v041.mjs';
import {saveRequirementSource,updatePurchaseLineRecord} from '../src/procurement-sourcing-v046.mjs';
import {contractControlled,reviewRequirementSpec,specStatus,recordArrival,rejectArrival,procurementState} from '../src/procurement-workflow-v047.mjs';
import {renderProjectWorkPlan,renderProjectBuyingReview} from '../src/project-control-v046.mjs';

function fixture(){
 const s=emptyWorkspace();s.dataProvenance={type:'contract-initialization'};
 s.projects.push({id:'p',code:'P',name:'Fictional test',status:'Planning'});
 s.sections.push({id:'sec',projectId:'p',name:'Electrical design'});
 s.tasks.push({id:'t',projectId:'p',sectionId:'sec',title:'Assemble test device',status:'Backlog',department:'Workshop',assignee:'Unassigned',start:'',due:''});
 s.parts.push({id:'part',code:'SYN-48',name:'Test 48V 20A supply',notes:'Fictional baseline: voltage 48 V, 20 A',unit:'ea',onHand:0,reserved:0,min:0});
 s.assemblies.push({id:'asm',projectId:'p',name:'Power',parentId:null,buildQty:1,perParentQty:1});
 s.assemblyBOM.push({id:'occ',projectId:'p',assemblyId:'asm',partId:'part',quantity:2,makeBuy:'Buy',notes:'Fictional section 13 technical specification'});
 return ensureMaterials(s);
}
const source={occurrenceId:'occ',responsibility:'Sim-Worx',supplier:'Fictional vendor',
 productUrl:'https://example.com/48v',vendorSku:'SYN-48',quoteRef:'QUOTE-1'};
const line={partId:'part',sourceOccurrenceId:'occ',quantity:2,unitCost:15,productUrl:source.productUrl,vendorSku:source.vendorSku,quoteRef:source.quoteRef};
const po=s=>createPurchaseOrder(s,{projectId:'p',supplier:source.supplier,items:[line]});
const approve=s=>reviewRequirementSpec(s,{occurrenceId:'occ',decision:'Matches contract',
 proposedSpecification:'Synthetic voltage regulated power supply 48V 20A revision A',
 reviewer:'QA test',evidenceRef:'TEST-SPEC-1',notes:'Confirmed rating, form factor and fictional evidence'});
test('section colours and sourcing stage controls are rendered',()=>{
 const s=fixture();
 assert.match(renderProjectWorkPlan(s,{},'p'),/v47-color-0/);
 assert.match(renderProjectBuyingReview(s,{},'p'),/v47-buy-step/);
 assert.match(renderProjectBuyingReview(s,{},'p'),/data-v47-drop-stage/);
});
test('contract PO blocked until verified, duplicate purchase blocked',()=>{
 const s=fixture();assert.equal(contractControlled(s,'p'),true);
 assert.throws(()=>po(s),/responsibility|specification/i);
 saveRequirementSource(s,source);assert.throws(()=>po(s),/specification|blocked/i);
 approve(s);const order=po(s);
 assert.equal(order.items[0].specificationEvidence.evidenceRef,'TEST-SPEC-1');
 assert.throws(()=>po(s),/uncovered engineering requirement/);
 assert.equal(s.parts[0].onHand,0);
});
test('wrong delivery leaves usable stock unchanged, replacement requires new check',()=>{
 const s=fixture();saveRequirementSource(s,source);approve(s);const first=po(s);
 assert.throws(()=>receivePurchaseLine(s,{orderId:first.id,lineId:first.items[0].id,quantity:2}),/arrival/);
 const a=recordArrival(s,{orderId:first.id,lineId:first.items[0].id,quantity:2,deliveryRef:'FICT-DELIVERY'});
 assert.equal(s.parts[0].onHand,0);
 rejectArrival(s,{arrivalId:a.id,reviewer:'QA test',evidenceRef:'QA-REF-1',reason:'Wrong supplied specification and voltage rating'});
 assert.equal(s.parts[0].onHand,0);
 assert.equal(s.assemblyBOM[0].sourcingStage,'Replacement requested');
 closePurchaseBalance(s,{orderId:first.id,lineId:first.items[0].id,reason:'Confirmed cancellation of outstanding shipment',evidenceRef:'FICT-CANCEL'});
 assert.equal(outstanding(first.items[0]),0);
 assert.equal(materialReadinessV041(s,'p')[0].toSource,2);
 saveRequirementSource(s,{...source,productUrl:'https://example.com/replacement',vendorSku:'SYN-48B'});
 assert.equal(specStatus(s,'occ').status,'Stale');
 assert.throws(()=>createPurchaseOrder(s,{projectId:'p',supplier:source.supplier,items:[{...line,productUrl:'https://example.com/replacement',vendorSku:'SYN-48B'}]}),/blocked|specification/i);
});
test('accepted arrival is the only event increasing stock and survives backup',()=>{
 const s=fixture();saveRequirementSource(s,source);approve(s);const order=po(s);
 const a=recordArrival(s,{orderId:order.id,lineId:order.items[0].id,quantity:2,deliveryRef:'FICT-DELIVERY'});
 receivePurchaseLine(s,{orderId:order.id,lineId:order.items[0].id,quantity:2,arrivalId:a.id,reviewer:'QA test',evidenceRef:'QA-OK-1'});
 assert.equal(s.parts[0].onHand,2);assert.equal(a.status,'Accepted');
 assert.match(procurementState(s,'occ').status,/Received/);
 const restored=parseWorkspaceBackup(createWorkspaceBackup(s));
 assert.equal(restored.procurementArrivals.length,1);
 assert.equal(restored.assemblyBOM[0].specReview.evidenceRef,'TEST-SPEC-1');
});
test('changed product on active PO requires new contract check',()=>{
 const s=fixture();saveRequirementSource(s,source);approve(s);const order=po(s),item=order.items[0];
 saveRequirementSource(s,{...source,vendorSku:'SYN-48X'});
 assert.throws(()=>updatePurchaseLineRecord(s,{orderId:order.id,lineId:item.id,quantity:2,unitCost:15,
  productUrl:source.productUrl,vendorSku:'SYN-48X',quoteRef:'QUOTE-1',reason:'Fictional supplier substitution'}),/blocked|specification/i);
 assert.equal(item.vendorSku,'SYN-48');
});
