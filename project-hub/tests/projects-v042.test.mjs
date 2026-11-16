import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../src/demo-data.mjs';
import {ensureMaterials,createPurchaseOrder,purchaseStatus,setPurchaseDispatch,receivePurchaseLine} from '../src/materials-v041.mjs';
import {projectBudgetSnapshot,updateProjectBudget,setPurchaseExchangeRate} from '../src/projects-v042.mjs';
import {saveOccurrence,archiveManufacturing} from '../src/manufacturing.mjs';
import {clientProjection} from '../src/model.mjs';

const make=()=>{const state=seed();ensureMaterials(state);return state};
test('budget data follows selected project and preserves other projects',()=>{
 const s=make(),before=s.projects[1].budget;
 const r=updateProjectBudget(s,{projectId:'p1',budget:300000,spent:50000,committed:10000});
 assert.equal(r.budget,300000);assert.equal(r.forecast,60000);assert.equal(r.headroom,240000);
 assert.equal(s.projects[1].budget,before);
});
test('budget rejects bad values without mutating old financial fields',()=>{
 const s=make(),p=s.projects[0],prev=[p.budget,p.spent,p.committed];
 assert.throws(()=>updateProjectBudget(s,{projectId:'p1',budget:-1,spent:5,committed:2}),/Budget/);
 assert.throws(()=>updateProjectBudget(s,{projectId:'p1',budget:200,spent:'infinity',committed:3}),/Recorded costs/);
 assert.deepEqual([p.budget,p.spent,p.committed],prev);
});
test('existing legacy PO is not added again to manually imported commitments',()=>{
 const s=make(),before=projectBudgetSnapshot(s,'p1');
 assert.equal(before.poOpen,0);assert.equal(before.poReceived,0);
 assert.equal(before.forecast,s.projects[0].spent+s.projects[0].committed);
});
test('new multi-line EUR PO adds cost to forecast once, receipts shift commitment to actual',()=>{
 const s=make(),before=projectBudgetSnapshot(s,'p1');
 const o=createPurchaseOrder(s,{projectId:'p1',supplier:'Demo Supplies',currency:'EUR',items:[
 {partId:'part1',quantity:5,unitCost:10},{partId:'part4',quantity:2,unitCost:20}]});
 let report=projectBudgetSnapshot(s,'p1');
 assert.equal(report.forecast,before.forecast+90);
 assert.equal(report.poOpen,90);assert.equal(report.poReceived,0);
 receivePurchaseLine(s,{orderId:o.id,lineId:o.items[0].id,quantity:2});
 report=projectBudgetSnapshot(s,'p1');
 assert.equal(report.forecast,before.forecast+90);
 assert.equal(report.poOpen,70);assert.equal(report.poReceived,20);
});
test('V0.4.1 style orders with pol-line ids remain counted in budget',()=>{
 const s=make(),o=createPurchaseOrder(s,{projectId:'p1',supplier:'Example',items:[{partId:'part4',quantity:1,unitCost:16}]});
 delete o.origin;assert.equal(projectBudgetSnapshot(s,'p1').poOpen,16);
});
test('non-EUR POs cannot give false budget headroom without a currency conversion rate',()=>{
 const s=make();const o=createPurchaseOrder(s,{projectId:'p1',supplier:'Canadian Supplier',currency:'CAD',
 items:[{partId:'part1',quantity:10,unitCost:12}]});
 let b=projectBudgetSnapshot(s,'p1');
 assert.equal(b.unconverted.length,1);assert.equal(b.poOpen,0);
 setPurchaseExchangeRate(s,{orderId:o.id,eurExchangeRate:.67});
 b=projectBudgetSnapshot(s,'p1');
 assert.equal(b.unconverted.length,0);assert.equal(b.poOpen,80.4);
});
test('delivery stage defaults to Ordered, changing to Out for delivery does not receive stock',()=>{
 const s=make(),o=createPurchaseOrder(s,{projectId:'p1',supplier:'Order',items:[{partId:'part1',quantity:8,unitCost:2}]});
 const stock=s.parts.find(p=>p.id==='part1').onHand;
 assert.equal(purchaseStatus(o),'Ordered');
 setPurchaseDispatch(s,{orderId:o.id,stage:'Out for delivery'});
 assert.equal(purchaseStatus(o),'Out for delivery');
 assert.equal(s.parts.find(p=>p.id==='part1').onHand,stock);
 setPurchaseDispatch(s,{orderId:o.id,stage:'Ordered'});
 assert.equal(purchaseStatus(o),'Ordered');
});
test('receipt status takes priority over manual delivery stage, fully received cannot be changed backwards',()=>{
 const s=make(),o=createPurchaseOrder(s,{projectId:'p1',supplier:'Order',items:[{partId:'part1',quantity:3,unitCost:2}]});
 setPurchaseDispatch(s,{orderId:o.id,stage:'Out for delivery'});
 receivePurchaseLine(s,{orderId:o.id,lineId:o.items[0].id,quantity:1});
 assert.equal(purchaseStatus(o),'Part received');
 receivePurchaseLine(s,{orderId:o.id,lineId:o.items[0].id,quantity:2});
 assert.equal(purchaseStatus(o),'Received');
 assert.throws(()=>setPurchaseDispatch(s,{orderId:o.id,stage:'Ordered'}),/Received order/);
});
test('staff cannot falsify received state or bypass the physical stock receipt',()=>{
 const s=make(),o=createPurchaseOrder(s,{projectId:'p1',supplier:'Order',items:[{partId:'part1',quantity:2,unitCost:2}]});
 assert.throws(()=>setPurchaseDispatch(s,{orderId:o.id,stage:'Received'}),/Choose/);
 assert.equal(purchaseStatus(o),'Ordered');
});
test('budget overrun triggers when forecast exceeds allocated allowance',()=>{
 const s=make();
 updateProjectBudget(s,{projectId:'p1',budget:1000,spent:1400,committed:100});
 const b=projectBudgetSnapshot(s,'p1');
 assert.equal(b.overBudget,true);assert.equal(b.headroom,-500);
});
test('editing a project BOM occurrence changes just that occurrence identity',()=>{
 const s=make(),a=s.assemblies.find(a=>a.projectId==='p1');
 const initial=s.assemblyBOM.filter(x=>x.assemblyId===a.id&&x.partId==='part1').length;
 const occ=saveOccurrence(s,{assemblyId:a.id,partId:'part1',quantity:1,position:'P-1'});
 saveOccurrence(s,{id:occ.id,assemblyId:a.id,partId:'part4',quantity:5,position:'P-1'});
 assert.equal(occ.partId,'part4');assert.equal(occ.quantity,5);
 assert.equal(s.parts.find(p=>p.id==='part1').code,'SW-AL-100');
 assert.equal(s.assemblyBOM.filter(x=>x.assemblyId===a.id&&x.partId==='part1').length,initial);
});
test('removing material preserves released history and allows restoring the occurrence',()=>{
 const s=make(),a=s.assemblies.find(a=>a.projectId==='p1');
 const occ=saveOccurrence(s,{assemblyId:a.id,partId:'part4',quantity:3,position:'KEEP'});
 archiveManufacturing(s,'occurrence',occ.id);
 assert(occ.archivedAt);
 archiveManufacturing(s,'occurrence',occ.id,true);
 assert.equal(occ.archivedAt,undefined);
});
test('financial and delivery details do not appear in the customer data projection',()=>{
 const s=make(),o=createPurchaseOrder(s,{projectId:'p1',supplier:'Highly Private Supplier',items:[{partId:'part1',quantity:2,unitCost:1337}]});
 setPurchaseDispatch(s,{orderId:o.id,stage:'Out for delivery'});
 updateProjectBudget(s,{projectId:'p1',budget:99999,spent:12345,committed:6789});
 const payload=JSON.stringify(clientProjection(s,'noah','p1'));
 for(const privateField of ['Highly Private Supplier','99999','12345','6789','Out for delivery','1337'])
  assert.equal(payload.includes(privateField),false,privateField+' exposed to customer');
});
