/* V0.5.1 synthetic job/subjob purchasing evidence and local customer preview tests.
 * Run: node --test tests/work-evidence-v051.test.mjs
 * NO customer contract data, photographs, prices or private attachments in this test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from '../src/clean-data-v043.mjs';
import {saveProject,saveSection} from '../src/model.mjs';
import {saveWorkPlanJob,saveJobRequirement} from '../src/workplan-v050.mjs';
import {ensureWorkEvidence,attachWorkEvidence,evidenceForJob,evidenceForOccurrence,setEvidenceCustomerPreview,
 customerEvidenceProjection,archiveWorkEvidence} from '../src/work-evidence-v051.mjs';
import {setCustomerShareRule} from '../src/team-workspace-v048.mjs';
import {renderWorkPlanV050} from '../src/workplan-ui-v050.mjs';
import {renderProcurementWorkbench} from '../src/procurement-workbench-v049.mjs';
import {renderCustomerPreview} from '../src/team-ui-v048.mjs';
import {createWorkspaceBackup,parseWorkspaceBackup} from '../src/materials-v041.mjs';

function setup(){
 const s=emptyWorkspace();ensureWorkEvidence(s);
 s.organizations.push({id:'fictional',code:'FIC',name:'Imaginary client'});
 const p=saveProject(s,{orgId:'fictional',name:'Fictional panel',template:'Blank project (manual work packages)',budget:0,contract:0});
 const section=saveSection(s,{projectId:p.id,name:'Cockpit mock-up',weight:0});
 const parent=saveWorkPlanJob(s,{projectId:p.id,sectionId:section.id,title:'MIP',department:'Workshop',description:'Build panel'});
 const child=saveWorkPlanJob(s,{projectId:p.id,sectionId:section.id,parentId:parent.id,title:'G1000 units',department:'IT',needsPurchasing:true});
 const grandchild=saveWorkPlanJob(s,{projectId:p.id,sectionId:section.id,parentId:child.id,title:'Order G1000',department:'Purchasing',needsPurchasing:true});
 const material=saveJobRequirement(s,{projectId:p.id,taskId:grandchild.id,name:'Synthetic G1000 unit',kind:'buy',quantity:2,specification:'Unapproved training-only description'});
 return {s,p,section,parent,child,grandchild,material};
}
const photo='data:image/jpeg;base64,/9j/';
const pdf='data:application/pdf;base64,JVBERi0=';
const upload=(f,extra={})=>attachWorkEvidence(f.s,{projectId:f.p.id,taskId:f.grandchild.id,occurrenceId:f.material.id,
 kind:'Photo / screenshot',title:'Fictional connector photo',filename:'fake.jpg',mime:'image/jpeg',dataUrl:photo,...extra});

test('the editor opens under the exact clicked parent and highlights a Details button when information exists',()=>{
 const f=setup();const state={v50JobEditor:{projectId:f.p.id,sectionId:f.section.id,parentId:f.child.id,id:null},v50Status:'All'};
 const html=renderWorkPlanV050(f.s,state,f.p.id);
 const parentRow=html.indexOf('data-v51-job-row="'+f.child.id+'"'),childForm=html.indexOf('class="v51-inline-editor"',parentRow);
 assert.ok(parentRow>=0&&childForm>parentRow);
 assert.match(html.slice(childForm,childForm+4200),/CREATING CHILD UNDER:/);
 assert.match(html.slice(childForm,childForm+4200),/MIP/);
 assert.match(html.slice(childForm,childForm+4200),/G1000 units/);
 assert.match(html,/v51-details-ready/);
 assert.match(html,/name="parentId" value="'+f.child.id+'"/);
});
test('planning flag and photo do not create actual order or stock',()=>{
 const f=setup();
 const evidence=upload(f);
 assert.equal(f.s.orders.length,0);
 assert.equal(f.s.parts[0].onHand,0);
 assert.equal(evidence.customerApproval,null);
 assert.equal(evidenceForJob(f.s,f.grandchild.id).length,1);
 assert.equal(evidenceForOccurrence(f.s,f.material.id).length,1);
 assert.match(renderProcurementWorkbench(f.s,{v46BuyingMode:'All',v49SelectedOccurrence:f.material.id},f.p.id),/Fictional connector photo/);
});
test('supplier order confirmation and receipt cannot be claimed without an actual matching PO line',()=>{
 const f=setup();
 assert.throws(()=>upload(f,{kind:'Supplier order confirmation'}),/previously recorded actual supplier PO line/);
 assert.throws(()=>upload(f,{kind:'Receipt \/ supplier invoice'}),/previously recorded actual supplier PO line/);
 f.s.orders.push({id:'actual-test-PO',code:'TST-PO',projectId:f.p.id,supplier:'Fictional supplier',
  currency:'EUR',items:[{id:'actual-line',partId:f.material.partId,sourceOccurrenceId:f.material.id,quantity:2,received:0,unitCost:1}]});
 const file=upload(f,{kind:'Supplier order confirmation',orderId:'actual-test-PO',lineId:'actual-line'});
 assert.equal(file.orderId,'actual-test-PO');assert.equal(f.s.orders.length,1);
 assert.equal(f.s.orders[0].items[0].received,0);
 assert.throws(()=>upload(f,{kind:'Supplier order confirmation',orderId:'actual-test-PO',lineId:'not-a-line'}),/PO line/);
});
test('customer preview is double opt-in, requires manual redaction, excludes original PDFs and revokes safely',()=>{
 const f=setup(),photoEvidence=upload(f);
 assert.equal(customerEvidenceProjection(f.s,f.p.id).length,0);
 assert.throws(()=>setEvidenceCustomerPreview(f.s,{evidenceId:photoEvidence.id,visible:true,
  reviewer:'Owner Tester',caption:'Source component shown',redactionConfirmed:true}),/First allow/);
 setCustomerShareRule(f.s,{projectId:f.p.id,sectionId:f.section.id,visible:true,summary:'Approved generic update'});
 assert.throws(()=>setEvidenceCustomerPreview(f.s,{evidenceId:photoEvidence.id,visible:true,
  reviewer:'Owner Tester',caption:'Source component shown',redactionConfirmed:false}),/Confirm/);
 setEvidenceCustomerPreview(f.s,{evidenceId:photoEvidence.id,visible:true,
  reviewer:'Owner Tester',caption:'Redacted component image',redactionConfirmed:true});
 const projected=customerEvidenceProjection(f.s,f.p.id);
 assert.equal(projected.length,1);
 assert.doesNotMatch(JSON.stringify(projected),/Fictional supplier|actual-test-PO|Unapproved training-only/);
 assert.match(renderCustomerPreview(f.s,{},f.p.id),/Redacted component image/);
 const file=upload(f,{kind:'Other',title:'Private PDF',mime:'application/pdf',filename:'proof.pdf',dataUrl:pdf});
 assert.throws(()=>setEvidenceCustomerPreview(f.s,{evidenceId:file.id,visible:true,
  reviewer:'Owner Tester',caption:'Document image',redactionConfirmed:true}),/PDFs/);
 setEvidenceCustomerPreview(f.s,{evidenceId:photoEvidence.id,visible:false});
 assert.equal(customerEvidenceProjection(f.s,f.p.id).length,0);
});
test('backup/restore preserves private job photos and explicit owner preview flags',()=>{
 const f=setup(),row=upload(f);
 setCustomerShareRule(f.s,{projectId:f.p.id,sectionId:f.section.id,visible:true,summary:'Safe update'});
 setEvidenceCustomerPreview(f.s,{evidenceId:row.id,visible:true,reviewer:'Owner',caption:'Safe image',redactionConfirmed:true});
 const restored=parseWorkspaceBackup(createWorkspaceBackup(f.s));
 assert.equal(restored.workEvidence.length,1);
 assert.equal(restored.workEvidence[0].taskId,f.grandchild.id);
 assert.equal(customerEvidenceProjection(restored,f.p.id).length,1);
 archiveWorkEvidence(restored,row.id);
 assert.equal(customerEvidenceProjection(restored,f.p.id).length,0);
 assert.ok(restored.workEvidence[0].archivedAt);
});
test('cross-project and wrong job attachments are prevented, including mistaken PO association',()=>{
 const f=setup();
 const other=saveWorkPlanJob(f.s,{projectId:f.p.id,sectionId:f.section.id,title:'Unrelated job',department:'Workshop'});
 assert.throws(()=>attachWorkEvidence(f.s,{projectId:f.p.id,taskId:other.id,occurrenceId:f.material.id,
  kind:'Photo / screenshot',title:'Wrong assignment',filename:'x.jpg',mime:'image/jpeg',dataUrl:photo}),/exact job/);
 assert.throws(()=>upload(f,{mime:'text/html',dataUrl:'data:text/html;base64,PGgxPg=='}),/Only JPG/);
});
