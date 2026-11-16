import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from '../src/clean-data-v043.mjs';
import {ensureMaterials,createPurchaseOrder,createWorkspaceBackup,parseWorkspaceBackup} from '../src/materials-v041.mjs';
import {projectWorkSnapshot,projectBuyingSnapshot,renderProjectFocus,renderProjectWorkPlan,renderProjectBuyingReview} from '../src/project-control-v046.mjs';
import {safeProductURL,saveRequirementSource,updatePurchaseLineRecord} from '../src/procurement-sourcing-v046.mjs';
import {renderPurchasingV041} from '../src/materials-ui-v041.mjs';

function fixture(){
 const s=emptyWorkspace();
 s.projects.push({id:'test-proj',code:'TEST',name:'Synthetic Testing',status:'Planning',due:''});
 s.sections.push({id:'test-sec',projectId:'test-proj',name:'Workshop assembly'});
 s.tasks.push({id:'test-task',projectId:'test-proj',sectionId:'test-sec',title:'Wire synthetic controls',status:'Backlog',
   assignee:'',department:'Workshop',start:'',due:''});
 s.parts.push({id:'test-part',code:'SYN-001',name:'Dummy cable',unit:'pcs',min:0,onHand:0,reserved:0});
 s.assemblies.push({id:'test-asm',projectId:'test-proj',name:'Synthetic panel',parentId:null,buildQty:1,perParentQty:1});
 s.assemblyBOM.push({id:'test-occ',projectId:'test-proj',assemblyId:'test-asm',partId:'test-part',quantity:2,position:'A',makeBuy:'Buy'});
 ensureMaterials(s);
 return s;
}

test('work plan and overview expose all project jobs without inventing completion',()=>{
 const s=fixture(),work=projectWorkSnapshot(s,'test-proj'),ui={};
 assert.equal(work.jobs.length,1);
 assert.equal(work.unassigned,1);
 assert.equal(work.withoutDates,1);
 assert.match(renderProjectWorkPlan(s,ui,'test-proj'),/Wire synthetic controls/);
 assert.match(renderProjectFocus(s,ui,'test-proj'),/Plan the work/);
 assert.equal(s.tasks[0].status,'Backlog');
});

test('purchasing requires an explicit owner and leaves actual POs untouched',()=>{
 const s=fixture(),before=s.orders.length;
 const snapshot=projectBuyingSnapshot(s,'test-proj');
 assert.equal(snapshot.buy.length,1);
 assert.equal(snapshot.ownerUnverified.length,1);
 assert.equal(snapshot.confirmedPOs,0);
 const html=renderPurchasingV041(s,{procurementProject:'test-proj',v46BuyingMode:'Buy'});
 assert.match(html,/ACTIVE PURCHASING PROJECT/);
 assert.match(html,/Switch project/);
 assert.match(html,/data-action="v46-edit-buy"/);
 assert.doesNotMatch(renderProjectBuyingReview(s,{},'test-proj'),/data-action="v46-prepare-po"/);
 assert.equal(s.orders.length,before);
});

test('source URL and supplier revisions survive backup without creating orders',()=>{
 const s=fixture();
 assert.equal(safeProductURL('https://example.com/component'),'https://example.com/component');
 for(const raw of ['javascript:alert(1)','http://example.com','https://user:secret@example.com'])
   assert.throws(()=>safeProductURL(raw),/HTTPS/);
 saveRequirementSource(s,{occurrenceId:'test-occ',responsibility:'Customer-direct',
  supplier:'Synthetic Supplier',productUrl:'https://example.com/component',vendorSku:'SKU-7',quoteRef:'Q-1'});
 assert.equal(projectBuyingSnapshot(s,'test-proj').customerDirect.length,1);
 assert.doesNotMatch(renderProjectBuyingReview(s,{},'test-proj'),/data-action="v46-prepare-po"/);
 saveRequirementSource(s,{occurrenceId:'test-occ',responsibility:'Sim-Worx',
  supplier:'New Supplier',productUrl:'https://example.com/new',vendorSku:'SKU-8',quoteRef:'Q-2'});
 assert.equal(s.assemblyBOM[0].purchaseSourceHistory.length,1);
 const restored=parseWorkspaceBackup(createWorkspaceBackup(s));
 assert.equal(restored.assemblyBOM[0].purchaseSource.vendorSku,'SKU-8');
 assert.equal(restored.assemblyBOM[0].purchaseSourceHistory[0].responsibility,'Customer-direct');
 assert.equal(s.orders.length,0);
 assert.match(renderProjectBuyingReview(s,{},'test-proj'),/data-action="v46-prepare-po"/);
});

test('PO line snapshot preserves supplier website and quote without a phantom receipt',()=>{
 const s=fixture();
 const order=createPurchaseOrder(s,{projectId:'test-proj',supplier:'Synthetic Supplier',currency:'EUR',taxRate:0,items:[
  {partId:'test-part',quantity:2,unitCost:19.5,sourceOccurrenceId:'test-occ',
   productUrl:'https://example.com/component',vendorSku:'SKU-7',quoteRef:'Q-1'}]});
 assert.equal(s.procurementReceipts.length,0);
 assert.equal(s.parts[0].onHand,0);
 assert.equal(order.items[0].productUrl,'https://example.com/component');
 assert.equal(order.items[0].quoteRef,'Q-1');
 assert.throws(()=>createPurchaseOrder(s,{projectId:'test-proj',supplier:'Fake',items:[
   {partId:'test-part',quantity:1,unitCost:1,sourceOccurrenceId:'wrong-occ'}]}),/match a live requirement/);
 assert.equal(s.orders.length,1);
 const html=renderPurchasingV041(s,{procurementProject:'test-proj',materialPO:order.id,v46PurchaseLine:order.items[0].id});
 assert.match(html,/Product website/);
 assert.match(html,/Reason for amendment/);
 assert.match(html,/Shipment & tracking/);
});

test('amendment preserves revision history and prevents silent or received-price edits',()=>{
 const s=fixture();
 const order=createPurchaseOrder(s,{projectId:'test-proj',supplier:'Synthetic Supplier',items:[
  {partId:'test-part',quantity:2,unitCost:19.5}]});
 const line=order.items[0];
 assert.throws(()=>updatePurchaseLineRecord(s,{orderId:order.id,lineId:line.id,quantity:3,unitCost:20,reason:''}),/Explain/);
 updatePurchaseLineRecord(s,{orderId:order.id,lineId:line.id,quantity:3,unitCost:20,
  productUrl:'https://example.com/updated',vendorSku:'SKU-8',quoteRef:'Q-2',reason:'Supplier revised offer'});
 assert.equal(line.quantity,3);
 assert.equal(line.revisions.length,1);
 assert.equal(line.revisions[0].reason,'Supplier revised offer');
 line.received=1;
 assert.throws(()=>updatePurchaseLineRecord(s,{orderId:order.id,lineId:line.id,quantity:3,unitCost:21,
   productUrl:line.productUrl,vendorSku:line.vendorSku,quoteRef:line.quoteRef,reason:'Supplier changed price'}),/locked unit prices/);
 assert.equal(line.unitCost,20);
});
