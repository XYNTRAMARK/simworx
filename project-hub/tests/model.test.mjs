import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../src/demo-data.mjs';
import {clientProjection,clientInvite,stockMove,receiveOrder,publishUpdate,decideApproval,taskProgress,availableStock} from '../src/model.mjs';

test('seeds a multi-customer demo with separated projects',()=>{
 const d=seed();assert.ok(d.organizations.length>=3);assert.ok(d.projects.every(p=>d.organizations.some(o=>o.id===p.orgId)));
});
test('customer projection restricts projects to the selected organisation',()=>{
 const d=seed();const pr=clientProjection(d,'noah','p2');
 assert.equal(pr.project.id,'p1');assert.ok(pr.projects.every(p=>p.id==='p1'));
 assert.equal(pr.updates.some(u=>u.title==='Control loading lead time review'),false);
 assert.deepEqual(Object.keys(pr.project).filter(k=>/budget|contract|committed|spent|cost|margin/.test(k)),[]);
 assert.equal(JSON.stringify(pr).includes('Detailed supplier quotation'),false);
 assert.equal(JSON.stringify(pr).includes('supplier delay'),false);
});
test('member scoped to one project does not see other projects',()=>{
 const d=seed();const n=clientProjection(d,'noah','p1','m1');assert.equal(n.projects.length,1);
 assert.equal(clientProjection(d,'jetpro','p2','m1').project,null);
});
test('client invitation disallows escalation and cross-organisation grants',()=>{
 const d=seed();const info={orgId:'noah',name:'Person A',email:'test@example.invalid',role:'System Owner',projectIds:['p1']};
 assert.throws(()=>clientInvite(d,info),/ceiling/);
 assert.throws(()=>clientInvite(d,{...info,role:'Client Viewer',projectIds:['p2']}),/outside/);
 clientInvite(d,{...info,role:'Client Viewer',projectIds:['p1']});
 assert.equal(d.members.filter(m=>m.email==='test@example.invalid').length,1);
 assert.throws(()=>clientInvite(d,{...info,role:'Client Viewer',projectIds:['p1']}),/already exists/);
});
test('stock movements cannot issue reserved or unavailable units',()=>{
 const d=seed();const p=d.parts[0],original=p.onHand;
 assert.equal(availableStock(p),106);
 assert.throws(()=>stockMove(d,{partId:p.id,quantity:107,type:'issue'}),/Insufficient/);
 assert.equal(p.onHand,original);
 assert.throws(()=>stockMove(d,{partId:p.id,quantity:-1,type:'receipt'}),/Quantity/);
 stockMove(d,{partId:p.id,quantity:4,type:'issue'});
 assert.equal(p.onHand,original-4);assert.equal(d.movements.length,3);
});
test('receiving a partially delivered order updates outstanding quantity only once',()=>{
 const d=seed();const order=d.orders.find(o=>o.id==='po2');const p=d.parts.find(p=>p.id==='part1');const original=p.onHand;
 receiveOrder(d,'po2');assert.equal(p.onHand,original+35);assert.equal(order.status,'Received');
 assert.throws(()=>receiveOrder(d,'po2'),/already fully received/);
});
test('publishing is an explicit step',()=>{
 const d=seed();const u=d.updates.find(u=>u.id==='u3');
 assert.equal(clientProjection(d,'noah','p1').updates.some(x=>x.id==='u3'),false);
 publishUpdate(d,'u3');
 assert.equal(clientProjection(d,'noah','p1').updates.some(x=>x.id==='u3'),true);
 assert.throws(()=>publishUpdate(d,'u3'),/Already/);
});
test('approval is single-decision, revision-linked',()=>{
 const d=seed();decideApproval(d,'a1','Approved','Test reviewer');
 assert.equal(d.approvals[0].revision,'Rev C');assert.equal(d.approvals[0].status,'Approved');
 assert.throws(()=>decideApproval(d,'a1','Rejected'),/not pending/);
});
test('job progress updates only the project containing the job',()=>{
 const d=seed();const before=taskProgress('p2',d.tasks);const p1=taskProgress('p1',d.tasks);
 d.tasks.find(t=>t.id==='t3').status='Done';
 assert.equal(taskProgress('p2',d.tasks),before);assert.ok(taskProgress('p1',d.tasks)>p1);
});