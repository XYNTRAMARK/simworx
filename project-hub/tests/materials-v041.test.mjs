import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../src/demo-data.mjs';
import {clientProjection,updateTaskPlan} from '../src/model.mjs';
import {saveOccurrence} from '../src/manufacturing.mjs';
import {
 ensureMaterials,available,outstanding,purchaseStatus,createPurchaseOrder,addPurchaseLine,
 receivePurchaseLine,returnPurchaseReceipt,reserveProjectStock,releaseProjectStock,
 issueProjectStock,consumeIssuedStock,reservationRemaining,materialReadinessV041,
 assemblyAllocationReadiness,auditMaterials,saveOrderShipment,addOrderAttachment,removeOrderAttachment,
 createWorkspaceBackup,parseWorkspaceBackup
} from '../src/materials-v041.mjs';
const make=()=>{const s=seed();ensureMaterials(s);return s};
const order=(s)=>createPurchaseOrder(s,{projectId:'p1',supplier:'Example Supplier',currency:'GBP',taxRate:20,items:[
 {partId:'part1',quantity:10,unitCost:6.4,assemblyId:'asm-v03-s1',eta:'2027-01-09'},
 {partId:'part4',quantity:4,unitCost:1.8,assemblyId:'asm-v03-s1'}
]});
test('migration adds line IDs without rewriting existing project data',()=>{
 const s=seed(),old=JSON.stringify({tasks:s.tasks,bom:s.bom,projects:s.projects});
 ensureMaterials(s);const saved=s.orders.map(o=>o.items.map(l=>l.id));
 ensureMaterials(s);assert.deepEqual(s.orders.map(o=>o.items.map(l=>l.id)),saved);
 assert.equal(JSON.stringify({tasks:s.tasks,bom:s.bom,projects:s.projects}),old);
});
test('purchase orders accept two lines, supplier and currency, but no bad quantities',()=>{
 const s=make(),o=order(s);assert.equal(o.items.length,2);
 assert.equal(o.currency,'GBP');assert.equal(o.taxRate,20);
 assert.throws(()=>createPurchaseOrder(s,{projectId:'p1',supplier:'X',items:[{partId:'part1',quantity:-2}]}),/positive/);
 assert.throws(()=>createPurchaseOrder(s,{projectId:'p2',supplier:'X',items:[{partId:'part1',assemblyId:'asm-v03-s1',quantity:1}]}),/belong/);
});
test('add a line to an existing V0.3 purchase order',()=>{
 const s=make(),o=s.orders.find(o=>o.id==='po1');
 addPurchaseLine(s,o.id,{partId:'part4',quantity:3,unitCost:5});
 assert.equal(o.items.length,2);assert.equal(outstanding(o.items[1]),3);
});
test('partial delivery across two lines reconciles and never books a backorder into stock',()=>{
 const s=make(),o=order(s),p=s.parts.find(p=>p.id==='part1'),base=p.onHand;
 receivePurchaseLine(s,{orderId:o.id,lineId:o.items[0].id,quantity:3});
 assert.equal(p.onHand,base+3);assert.equal(outstanding(o.items[0]),7);
 assert.equal(purchaseStatus(o),'Part received');assert.equal(s.procurementReceipts.length,1);
 receivePurchaseLine(s,{orderId:o.id,lineId:o.items[1].id,quantity:4});
 assert.equal(outstanding(o.items[1]),0);
 assert.throws(()=>receivePurchaseLine(s,{orderId:o.id,lineId:o.items[0].id,quantity:8}),/Over-receipt/);
 assert.equal(p.onHand,base+3);
 receivePurchaseLine(s,{orderId:o.id,lineId:o.items[0].id,quantity:7});
 assert.equal(purchaseStatus(o),'Received');
});
test('returns can reopen supplier backorders but cannot return reserved stock',()=>{
 const s=make(),o=order(s),r=receivePurchaseLine(s,{orderId:o.id,lineId:o.items[0].id,quantity:3});
 returnPurchaseReceipt(s,{receiptId:r.id,quantity:1});
 assert.equal(outstanding(o.items[0]),8);
 assert.throws(()=>returnPurchaseReceipt(s,{receiptId:r.id,quantity:3}),/more than/);
});
test('new reservations do not steal from legacy or another project',()=>{
 const s=make(),p=s.parts.find(p=>p.id==='part1'),start=available(p);
 const r=reserveProjectStock(s,{projectId:'p1',assemblyId:'asm-v03-s1',partId:p.id,quantity:4});
 assert.equal(available(p),start-4);assert.equal(reservationRemaining(r),4);
 assert.throws(()=>reserveProjectStock(s,{projectId:'p2',partId:p.id,quantity:available(p)+1}),/Insufficient/);
 assert.throws(()=>reserveProjectStock(s,{projectId:'p2',assemblyId:'asm-v03-s1',partId:p.id,quantity:1}),/does not belong/);
 releaseProjectStock(s,{reservationId:r.id,quantity:2});
 assert.equal(reservationRemaining(r),2);assert.equal(available(p),start-2);
});
test('reserved issue and consumption conserve physical on-hand inventory',()=>{
 const s=make(),p=s.parts.find(p=>p.id==='part1');
 const r=reserveProjectStock(s,{projectId:'p1',partId:p.id,quantity:3}),before=p.onHand;
 issueProjectStock(s,{reservationId:r.id,quantity:2});assert.equal(p.onHand,before-2);
 assert.equal(reservationRemaining(r),1);const after=p.onHand;
 consumeIssuedStock(s,{reservationId:r.id,quantity:2});
 assert.equal(p.onHand,after);assert.equal(r.consumed,2);
 assert.throws(()=>consumeIssuedStock(s,{reservationId:r.id,quantity:1}),/more than/);
 assert.throws(()=>issueProjectStock(s,{reservationId:r.id,quantity:2}),/more than/);
 assert.equal(auditMaterials(s),true);
});
test('assembly BOM and project readiness count repeating parts correctly',()=>{
 const s=make();
 saveOccurrence(s,{assemblyId:'asm-v03-s1',partId:'part4',quantity:3,position:'B-4'});
 const rows=materialReadinessV041(s,'p1');
 const part4=rows.find(r=>r.partId==='part4');
 assert(part4.required>=27);assert(part4.toSource>=0);
 const a=assemblyAllocationReadiness(s,'asm-v03-s1');
 assert(a.some(r=>r.partId==='part4'));
});
test('shipment carrier, tracking number, ETA and URL persist',()=>{
 const s=make(),o=order(s);
 saveOrderShipment(s,{orderId:o.id,carrier:'Demo Logistics',trackingCode:'AWB-123',trackingUrl:'https://example.com/track/123',eta:'2027-01-11',note:'Deliver to workshop'});
 assert.equal(o.shipment.carrier,'Demo Logistics');assert.equal(o.shipment.trackingCode,'AWB-123');
 assert.throws(()=>saveOrderShipment(s,{orderId:o.id,trackingUrl:'javascript:alert(1)'}),/https/);
});
test('proof-of-order PDF is kept in browser state, constrained and removable',()=>{
 const s=make(),o=order(s),file={orderId:o.id,name:'confirmation.pdf',mime:'application/pdf',size:6,dataUrl:'data:application/pdf;base64,JVBERi0x'};
 const p=addOrderAttachment(s,file);
 assert.equal(o.attachments[0].dataUrl,file.dataUrl);
 assert.throws(()=>addOrderAttachment(s,{...file,mime:'text/html'}),/PDF/);
 assert.throws(()=>addOrderAttachment(s,{...file,size:800001}),/800 KB/);
 removeOrderAttachment(s,{orderId:o.id,attachmentId:p.id});assert.equal(o.attachments.length,0);
});
test('complete backup restores orders, proof, tracking and reservations without dropping V0.3 scheduling',()=>{
 const s=make(),o=order(s);
 addOrderAttachment(s,{orderId:o.id,name:'receipt.pdf',mime:'application/pdf',size:6,dataUrl:'data:application/pdf;base64,JVBERi0x'});
 saveOrderShipment(s,{orderId:o.id,carrier:'Test',trackingCode:'XY123'});
 reserveProjectStock(s,{projectId:'p1',assemblyId:'asm-v03-s1',partId:'part1',quantity:2});
 const backup=createWorkspaceBackup(s),restored=parseWorkspaceBackup(backup);
 assert.equal(restored.tasks.length,s.tasks.length);
 assert.deepEqual(restored.projects.map(x=>x.baseline),s.projects.map(x=>x.baseline));
 assert.equal(restored.orders.find(x=>x.id===o.id).attachments.length,1);
 assert.equal(restored.orders.find(x=>x.id===o.id).shipment.trackingCode,'XY123');
 assert.equal(restored.stockReservations.length,s.stockReservations.length);
 assert.throws(()=>parseWorkspaceBackup('{"format":"junk"}'),/not a supported/i);
});
test('customer projection excludes purchasing, tracking, proof files, stock and internal pricing',()=>{
 const s=make(),o=order(s);
 addOrderAttachment(s,{orderId:o.id,name:'supplier-private.pdf',mime:'application/pdf',size:6,dataUrl:'data:application/pdf;base64,JVBERi0x'});
 saveOrderShipment(s,{orderId:o.id,trackingCode:'SECRET-TRACK'});
 const proj=JSON.stringify(clientProjection(s,'noah','p1'));
 for(const word of ['SECRET-TRACK','supplier-private.pdf','JVBERi0x','stockReservations','unitCost','taxRate','procurementReceipts'])
 assert.equal(proj.includes(word),false,'Customer leaked '+word);
});
test('materials audit rejects impossible negative and reserved-over-hand states',()=>{
 const s=make(),p=s.parts[0],old=p.reserved;
 p.reserved=p.onHand+1;assert.throws(()=>auditMaterials(s),/Invalid on-hand/);p.reserved=old;
 assert.equal(auditMaterials(s),true);
});
