/* Sim-Worx Project Hub V0.5.0 - synthetic work-plan/source integration tests.
   From project-hub/: node --test tests/workplan-v050.test.mjs
   Never contains, accesses or imports confidential customer project data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyWorkspace} from '../src/clean-data-v043.mjs';
import {saveProject,saveSection,setTaskStatus,saveTask} from '../src/model.mjs';
import {saveWorkPlanJob,saveJobRequirement,jobRequirements,linkExistingRequirement,archiveJobRequirement,
 flaggedUnspecifiedPurchases,workHierarchy} from '../src/workplan-v050.mjs';
import {renderWorkPlanV050} from '../src/workplan-ui-v050.mjs';
import {renderProcurementWorkbench} from '../src/procurement-workbench-v049.mjs';
import {createWorkspaceBackup,parseWorkspaceBackup} from '../src/materials-v041.mjs';

function setup(){
 const s=emptyWorkspace();s.organizations.push({id:'synthetic-customer',code:'SYN',name:'Fictional customer'});
 const project=saveProject(s,{orgId:'synthetic-customer',name:'Synthetic simulator',template:'Blank project (manual work packages)',
  status:'Design',phase:'Engineering',due:'',budget:0,contract:0,lead:'',description:''});
 const section=saveSection(s,{projectId:project.id,name:'Electrical & avionics',weight:0});
 return {s,project,section};
}
function job(s,p,section,name,parentId='',extras={}){
 return saveWorkPlanJob(s,{projectId:p.id,sectionId:section.id,title:name,parentId,
  description:name+' detailed instructions',department:'IT',assignee:'Owner-assigned engineer',
  priority:'Normal',status:'Backlog',...extras});
}
test('blank projects and manually created work packages have no automatic fictional tasks',()=>{
 const {s,project,section}=setup();
 assert.equal(s.tasks.length,0);assert.equal(s.sections.length,1);
 assert.equal(s.sections[0].name,'Electrical & avionics');
 const page=renderWorkPlanV050(s,{v50Search:'',v50Status:'All'},project.id);
 assert.match(page,/Add work package|Electrical &amp; avionics/);
 assert.match(page,/v50-add-job/);
});
test('job hierarchy supports four or more levels and all depth positions are visible',()=>{
 const {s,project,section}=setup();
 let parent=null;const created=[];
 for(let i=1;i<=7;i++){
  const t=job(s,project,section,'Level '+i,parent?.id||'');
  created.push(t);parent=t;
 }
 const tree=workHierarchy(s,project.id,section.id);
 assert.equal(tree.length,7);
 assert.equal(tree[6].depth,6);assert.equal(tree[6].wbs,'1.1.1.1.1.1.1');
 const html=renderWorkPlanV050(s,{v50Status:'All',v50Search:'',v50SelectedTask:parent.id},project.id);
 assert.match(html,/1\.1\.1\.1\.1\.1\.1/);
 assert.match(html,/v50-add-child/);
 assert.match(html,/Level 7/);
 assert.throws(()=>saveTask(s,{...created[0],parentId:created[6].id}),/Circular/);
});
test('owner can type purchasing instructions on job; purchasing sees unmet action without inventing materials or orders',()=>{
 const {s,project,section}=setup();
 const parent=job(s,project,section,'Install avionics');
 const child=job(s,project,section,'Source approved module',parent.id,
  {needsPurchasing:true,purchaseNeedNotes:'Get documented pinout before choosing vendor'});
 assert.equal(flaggedUnspecifiedPurchases(s,project.id).length,1);
 assert.equal(s.orders.length,0);assert.equal(s.assemblyBOM.length,0);
 assert.match(renderProcurementWorkbench(s,{v46BuyingMode:'All'},project.id),/work-plan buying action/);
 const html=renderWorkPlanV050(s,{v50SelectedTask:child.id,v50Status:'All'},project.id);
 assert.match(html,/Get documented pinout/);
 assert.match(html,/v50-material-add/);
});
test('job-linked buying item reuses the one engineering occurrence across work plan and purchasing',()=>{
 const {s,project,section}=setup();
 const t=job(s,project,section,'Procure equipment','',{needsPurchasing:true});
 const occ=saveJobRequirement(s,{projectId:project.id,taskId:t.id,
  name:'Synthetic display',quantity:2,unit:'ea',specification:'24V interface, drawing pending',kind:'buy'});
 assert.equal(s.parts.length,1);assert.equal(s.assemblyBOM.length,1);
 assert.equal(occ.linkedTaskId,t.id);assert.equal(occ.purchaseSource.responsibility,'Sim-Worx');
 assert.equal(s.orders.length,0);assert.equal(s.parts[0].onHand,0);
 assert.equal(flaggedUnspecifiedPurchases(s,project.id).length,0);
 assert.match(renderWorkPlanV050(s,{v50SelectedTask:t.id},project.id),/Synthetic display/);
 assert.match(renderProcurementWorkbench(s,{v46BuyingMode:'All',v49SelectedOccurrence:occ.id},project.id),/Synthetic display/);
 const linked=linkExistingRequirement(s,{projectId:project.id,taskId:t.id,occurrenceId:occ.id});
 assert.equal(linked.id,occ.id);assert.equal(s.assemblyBOM.length,1);
});
test('many components in one job, manufacturing and customer supply tracked without supplier PO',()=>{
 const {s,project,section}=setup(),t=job(s,project,section,'Build cockpit');
 const buy=saveJobRequirement(s,{projectId:project.id,taskId:t.id,name:'Audio connector',quantity:10,kind:'buy'});
 const make=saveJobRequirement(s,{projectId:project.id,taskId:t.id,name:'Bracket',quantity:4,kind:'make'});
 const customer=saveJobRequirement(s,{projectId:project.id,taskId:t.id,name:'Customer computer',quantity:1,kind:'customer'});
 assert.equal(jobRequirements(s,t.id).length,3);
 assert.equal(make.makeBuy,'Make');assert.equal(customer.purchaseSource.responsibility,'Customer-direct');
 assert.equal(buy.purchaseSource.responsibility,'Sim-Worx');assert.equal(s.orders.length,0);
});
test('controlled material changes preserve revision history; existing PO links cannot be rewritten or archived',()=>{
 const {s,project,section}=setup(),t=job(s,project,section,'Install sensors');
 const o=saveJobRequirement(s,{projectId:project.id,taskId:t.id,name:'Sensor',quantity:1,kind:'buy'});
 saveJobRequirement(s,{id:o.id,projectId:project.id,taskId:t.id,name:'Sensor revised',quantity:2,
   specification:'New controlled tolerance required',kind:'buy'});
 assert.equal(o.workplanHistory.length,1);assert.equal(o.quantity,2);
 s.orders.push({id:'synthetic-po',projectId:project.id,supplier:'TEST VENDOR',items:[{
   id:'synthetic-po-line',sourceOccurrenceId:o.id,partId:o.partId,quantity:1,unitCost:1,received:0,closedQuantity:0}]});
 assert.throws(()=>saveJobRequirement(s,{id:o.id,projectId:project.id,taskId:t.id,name:'Incorrect model',quantity:3,kind:'buy'}),/supplier PO/);
 assert.throws(()=>archiveJobRequirement(s,{occurrenceId:o.id}),/supplier PO/);
 assert.equal(o.quantity,2);
});
test('parent cannot be marked Done while its child is still open',()=>{
 const {s,project,section}=setup(),p=job(s,project,section,'Parent');
 const c=job(s,project,section,'Child',p.id);
 assert.throws(()=>setTaskStatus(s,p.id,'Done'),/child jobs/);
 setTaskStatus(s,c.id,'Done');setTaskStatus(s,p.id,'Done');
 assert.equal(p.status,'Done');
});
test('backup preserves job hierarchy, source trace and material references',()=>{
 const {s,project,section}=setup(),p=job(s,project,section,'Parent'),child=job(s,project,section,'Child',p.id,{needsPurchasing:true});
 const o=saveJobRequirement(s,{projectId:project.id,taskId:child.id,name:'Test part',quantity:1,kind:'buy'});
 const backup=parseWorkspaceBackup(createWorkspaceBackup(s));
 assert.equal(backup.tasks.find(t=>t.id===child.id).parentId,p.id);
 assert.equal(backup.assemblyBOM.find(x=>x.id===o.id).linkedTaskId,child.id);
 assert.equal(backup.parts.length,1);assert.equal(backup.orders.length,0);
});
test('new controls have real click and submit handlers (no decorative buttons)',()=>{
 const app=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
 for(const action of ['v50-create-section','v50-add-job','v50-add-child','v50-edit-job','v50-select-job',
  'v50-material-add','v50-open-purchasing','v50-open-job-from-buying','v50-archive-material']){
   assert.ok(app.includes("case '"+action+"'"),'Missing handler for '+action);
 }
 for(const form of ['v50-section','v50-job','v50-material','v50-link-existing'])assert.ok(app.includes("if(type==='"+form+"')"),'Missing form '+form);
 assert.match(app,/renderWorkPlanV050\(data,ui,p\.id\)/);
});
