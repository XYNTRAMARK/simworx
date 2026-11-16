import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../src/demo-data.mjs';
import {ensureMaterials,createPurchaseOrder,receivePurchaseLine} from '../src/materials-v041.mjs';
import {ensureProgress,projectSteps,progressSnapshot,saveProgressStep,generateProgressSteps,
 importProgressSteps,distributeProgressWeights,updateStepCompletion,archiveProgressStep} from '../src/progress-v043.mjs';
import {ensureExternalWork,createExternalRoute,addExternalStage,recordExternalHandoff,
 updateExternalStage,externalRouteSummary,externalWorkTimeline,externalStageTiming,exportExternalHistoryCSV} from '../src/external-work-v043.mjs';
import {procurementPlan,procurementAlerts,saveRequirementPlan,materialPlanDates} from '../src/procurement-planning-v043.mjs';
import {clientProjection} from '../src/model.mjs';

const make=()=>{const s=seed();ensureMaterials(s);ensureProgress(s);ensureExternalWork(s);return s};

test('old demo records migrate without deleting projects, tasks, inventory or orders',()=>{
 const s=seed(),before={projects:s.projects.length,tasks:s.tasks.length,orders:s.orders.length,parts:s.parts.length};
 ensureMaterials(s);ensureProgress(s);ensureExternalWork(s);
 assert.equal(s.projects.length,before.projects);assert.equal(s.tasks.length,before.tasks);
 assert.equal(s.orders.length,before.orders);assert.equal(s.parts.length,before.parts);
});
test('manual progress does not imply completion from existing tasks',()=>{
 const s=make(),pr=progressSnapshot(s,'p1');assert.equal(pr.configured,false);assert.equal(pr.earned,0);
 assert.equal(pr.unassigned,100);
});
test('staff can create 10 bespoke steps, distribute weights and mark 2 done',()=>{
 const s=make();generateProgressSteps(s,{projectId:'p1',count:10,prefix:'Workshop task'});
 let rows=projectSteps(s,'p1');assert.equal(rows.length,10);
 let sum=distributeProgressWeights(s,'p1');assert.equal(sum.weightTotal,100);
 updateStepCompletion(s,{projectId:'p1',stepId:rows[0].id,completion:100});
 updateStepCompletion(s,{projectId:'p1',stepId:rows[1].id,completion:100});
 sum=progressSnapshot(s,'p1');assert.equal(sum.earned,20);assert.equal(sum.completed,2);
});
test('progress supports 1000 equal-weighted steps and fractional completion',()=>{
 const s=make();generateProgressSteps(s,{projectId:'p1',count:1000});
 distributeProgressWeights(s,'p1');
 const rows=projectSteps(s,'p1');assert.equal(rows.length,1000);assert.equal(rows[0].weightBp,10);
 updateStepCompletion(s,{projectId:'p1',stepId:rows[0].id,completion:50});
 assert.equal(progressSnapshot(s,'p1').earned,.05);
 assert.throws(()=>generateProgressSteps(s,{projectId:'p1',count:1}),/1,000/);
});
test('custom manually assigned weights cannot exceed 100% or affect other projects',()=>{
 const s=make();saveProgressStep(s,{projectId:'p1',title:'Design',weight:35,completion:100});
 saveProgressStep(s,{projectId:'p1',title:'Build',weight:65,completion:50});
 assert.equal(progressSnapshot(s,'p1').earned,67.5);
 assert.equal(progressSnapshot(s,'p2').earned,0);
 assert.throws(()=>saveProgressStep(s,{projectId:'p1',title:'Overweight',weight:1,completion:0}),/100%/);
});
test('import, remove and restore progress steps preserves historic user choices',()=>{
 const s=make();const created=importProgressSteps(s,{projectId:'p1',lines:'Design | 40 | 100\nBuild | 30 | 50\nTest | 30 | 0'});
 assert.equal(progressSnapshot(s,'p1').earned,55);
 archiveProgressStep(s,{projectId:'p1',stepId:created[0].id});
 assert.equal(projectSteps(s,'p1').length,2);
 archiveProgressStep(s,{projectId:'p1',stepId:created[0].id,restore:true});
 assert.equal(progressSnapshot(s,'p1').earned,55);
});
test('procurement order-by date subtracts lead time plus buffer accurately',()=>{
 const s=make(),o=s.assemblyBOM.find(o=>o.projectId==='p1'&&!o.archivedAt);
 saveRequirementPlan(s,{occurrenceId:o.id,requiredBy:'2027-02-20',leadDays:20,bufferDays:5,note:'Powder coat must return'});
 const d=materialPlanDates(o);
 assert.equal(d.orderBy,'2027-01-26');
 assert.equal(procurementPlan(s,'p1','2027-01-27').find(x=>x.occurrenceId===o.id).dueDays,-1);
});
test('procurement highlights overdue and due-this-week buying decisions, rejects invalid dates',()=>{
 const s=make(),occ=s.assemblyBOM.filter(x=>x.projectId==='p1'&&!x.archivedAt).slice(0,2);
 // Make these genuinely unfulfilled requirements: a fully covered part should not trigger an order alert.
 for(const x of occ){const part=s.parts.find(p=>p.id===x.partId);part.onHand=0;part.reserved=0;}
 saveRequirementPlan(s,{occurrenceId:occ[0].id,requiredBy:'2027-01-20',leadDays:20,bufferDays:0});
 saveRequirementPlan(s,{occurrenceId:occ[1].id,requiredBy:'2027-01-12',leadDays:1,bufferDays:1});
 const a=procurementAlerts(s,'p1','2027-01-10');
 assert(a.overdue.length>=1||a.thisWeek.length>=1);
 assert.throws(()=>saveRequirementPlan(s,{occurrenceId:occ[0].id,requiredBy:'2027-02-30',leadDays:10,bufferDays:2}),/date/);
});
test('external laser-inspection-powder coat chain records every handoff with suppliers',()=>{
 const s=make(),r=createExternalRoute(s,{projectId:'p1',title:'Cockpit panels',quantity:1,requiredBy:'2027-03-10'});
 const laser=addExternalStage(s,{routeId:r.id,name:'Laser cutting',type:'External',company:'Laser workshop',plannedStart:'2027-01-01',promisedFinish:'2027-01-10'});
 const inspection=addExternalStage(s,{routeId:r.id,name:'Incoming inspection',type:'Internal',company:'Sim-Worx',plannedStart:'2027-01-11',promisedFinish:'2027-01-13'});
 const powder=addExternalStage(s,{routeId:r.id,name:'Powder coat',type:'External',company:'Coating partner',plannedStart:'2027-01-14',promisedFinish:'2027-01-22'});
 assert.equal(r.stages.length,3);
 assert.throws(()=>recordExternalHandoff(s,{routeId:r.id,stageId:powder.id,action:'send',onDate:'2027-01-14'}),/previous handoff/);
 recordExternalHandoff(s,{routeId:r.id,stageId:laser.id,action:'send',onDate:'2027-01-02',notes:'Collected by courier'});
 recordExternalHandoff(s,{routeId:r.id,stageId:laser.id,action:'return',onDate:'2027-02-09',notes:'Delivery note ref'});
 recordExternalHandoff(s,{routeId:r.id,stageId:laser.id,action:'accept',onDate:'2027-02-10',notes:'Checked dimensions',reviewer:'Workshop QA',evidenceRef:'QC-PANELS-001'});
 assert.equal(externalStageTiming(laser,'2027-02-10').elapsedDays,38);
 assert.equal(externalStageTiming(laser,'2027-02-10').overdueDays,30);
 assert.equal(laser.status,'Accepted');
 recordExternalHandoff(s,{routeId:r.id,stageId:inspection.id,action:'send',onDate:'2027-02-10'});
 assert.equal(inspection.status,'With supplier');
 assert.equal(externalRouteSummary(s,'p1','2027-02-18').atSuppliers,1);
 assert.equal(r.stages[2].company,'Coating partner');
});
test('external hold and return cannot falsely mark stages accepted or erase events',()=>{
 const s=make(),r=createExternalRoute(s,{projectId:'p1',title:'Composite tub',quantity:1});
 const stage=addExternalStage(s,{routeId:r.id,name:'Fiberglass layup',company:'Composite supplier',promisedFinish:'2027-04-01'});
 assert.throws(()=>recordExternalHandoff(s,{routeId:r.id,stageId:stage.id,action:'accept',onDate:'2027-04-01'}),/Inspect/);
 recordExternalHandoff(s,{routeId:r.id,stageId:stage.id,action:'send',onDate:'2027-03-25'});
 assert.throws(()=>recordExternalHandoff(s,{routeId:r.id,stageId:stage.id,action:'hold',onDate:'2027-03-26'}),/note/);
 recordExternalHandoff(s,{routeId:r.id,stageId:stage.id,action:'hold',onDate:'2027-03-26',notes:'Waiting for resin approval'});
 recordExternalHandoff(s,{routeId:r.id,stageId:stage.id,action:'return',onDate:'2027-04-21'});
 assert.equal(stage.status,'Returned · inspect');
 assert.equal(externalStageTiming(stage).overdueDays,20);
 const csv=exportExternalHistoryCSV(s,'p1','2027-04-23');
 assert(csv.includes('20')&&csv.includes('Composite supplier'));
 assert(externalWorkTimeline(s,r.id).events.length>=5);
});
test('supplier promised-date edits append audit history instead of erasing past promise',()=>{
 const s=make(),r=createExternalRoute(s,{projectId:'p1',title:'Frames',quantity:1});
 const st=addExternalStage(s,{routeId:r.id,name:'Cutting',company:'Laser 1',promisedFinish:'2027-03-01'});
 updateExternalStage(s,{routeId:r.id,stageId:st.id,name:'Cutting',type:'External',company:'Laser 1',
  plannedStart:'2027-02-01',promisedFinish:'2027-03-20',delayReason:'Supplier revised delivery date'});
 const x=s.externalWorkEvents.find(e=>e.event==='Stage details updated');
 assert.equal(x.previous.promisedFinish,'2027-03-01');
 assert.equal(x.next.promisedFinish,'2027-03-20');
});
test('client projection contains no internal supplier-delay log or private purchasing plan',()=>{
 const s=make(),r=createExternalRoute(s,{projectId:'p1',title:'PRIVATE-COMPOSITE-WORK',quantity:1});
 addExternalStage(s,{routeId:r.id,name:'Private coat',company:'PRIVATE-COAT-SUPPLIER',promisedFinish:'2027-04-01'});
 const occ=s.assemblyBOM.find(o=>o.projectId==='p1'&&!o.archivedAt);
 saveRequirementPlan(s,{occurrenceId:occ.id,requiredBy:'2027-04-21',leadDays:45,bufferDays:7,note:'SECRET-LEAD-NOTE'});
 const payload=JSON.stringify(clientProjection(s,'noah','p1'));
 for(const str of ['PRIVATE-COMPOSITE-WORK','PRIVATE-COAT-SUPPLIER','SECRET-LEAD-NOTE','externalWorkEvents'])assert.equal(payload.includes(str),false);
});
test('supplier records, manually weighted progress and material dates survive full backup',()=>{
 const s=make(),r=createExternalRoute(s,{projectId:'p1',title:'Save this trail'});
 addExternalStage(s,{routeId:r.id,name:'Laser',company:'Vendor',promisedFinish:'2027-06-01'});
 saveProgressStep(s,{projectId:'p1',title:'Engineering',weight:40,completion:25});
 const occ=s.assemblyBOM.find(o=>o.projectId==='p1'&&!o.archivedAt);
 saveRequirementPlan(s,{occurrenceId:occ.id,requiredBy:'2027-06-20',leadDays:30,bufferDays:5});
 const back=JSON.parse(JSON.stringify(s));
 assert.equal(back.externalWorkEvents.length,s.externalWorkEvents.length);
 assert.equal(back.projectProgressSteps.length,1);
 assert.equal(back.assemblyBOM.find(x=>x.id===occ.id).purchasePlan.requiredBy,'2027-06-20');
});

test('supplier QA is explicit and a failed inspection requires rework before downstream handoff',()=>{
 const s=make(),route=createExternalRoute(s,{projectId:'p1',title:'QA chain',quantity:1});
 const a=addExternalStage(s,{routeId:route.id,name:'Cut',type:'External',company:'Supplier',promisedFinish:'2027-01-05'});
 const b=addExternalStage(s,{routeId:route.id,name:'Coat',type:'External',company:'Supplier 2'});
 recordExternalHandoff(s,{routeId:route.id,stageId:a.id,action:'send',onDate:'2027-01-02'});
 recordExternalHandoff(s,{routeId:route.id,stageId:a.id,action:'return',onDate:'2027-01-04'});
 assert.throws(()=>recordExternalHandoff(s,{routeId:route.id,stageId:a.id,action:'accept',onDate:'2027-01-05',notes:'Looks fine'}),/QA reviewer/);
 assert.equal(a.status,'Returned · inspect');
 recordExternalHandoff(s,{routeId:route.id,stageId:a.id,action:'reject',onDate:'2027-01-05',notes:'Incorrect hole pitch',reviewer:'QA A',evidenceRef:'QC-17'});
 assert.equal(a.status,'Rework required');
 assert.throws(()=>recordExternalHandoff(s,{routeId:route.id,stageId:b.id,action:'send',onDate:'2027-01-05'}),/previous handoff/);
 recordExternalHandoff(s,{routeId:route.id,stageId:a.id,action:'resend',onDate:'2027-01-06',notes:'Return for redrilling'});
 recordExternalHandoff(s,{routeId:route.id,stageId:a.id,action:'return',onDate:'2027-01-08'});
 recordExternalHandoff(s,{routeId:route.id,stageId:a.id,action:'accept',onDate:'2027-01-09',notes:'Re-measured and accepted',reviewer:'QA B',evidenceRef:'QC-18'});
 assert.equal(a.inspections.length,2);
 assert.equal(a.inspections[0].decision,'Rejected');
 assert.equal(a.inspections[1].decision,'Accepted');
 assert.equal(a.status,'Accepted');
 recordExternalHandoff(s,{routeId:route.id,stageId:b.id,action:'send',onDate:'2027-01-09'});
 const csv=exportExternalHistoryCSV(s,'p1');
 assert(csv.includes('QC-18')&&csv.includes('QA B'));
 assert(externalWorkTimeline(s,route.id).events.some(e=>e.event==='Inspection rejected / rework required'));
});
