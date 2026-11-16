import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,saveTask} from '../src/model.mjs';
import {ensureMaterials} from '../src/materials-v041.mjs';
import {ensureTeamWorkspace,saveDepartmentAllocation,allocateRequirement,attachEvidence,archiveEvidence,
 setCustomerShareRule,customerPreviewProjection,departmentOverview} from '../src/team-workspace-v048.mjs';
import {renderProjectTeam,renderProjectEvidence,renderCustomerPreview} from '../src/team-ui-v048.mjs';
import {renderProjectWorkPlan} from '../src/project-control-v046.mjs';
import {renderPurchasingV041} from '../src/materials-ui-v041.mjs';

function fixture(){
 const s=emptyWorkspace();s.projects.push({id:'test-project',name:'Synthetic workshop rig',code:'TST',budget:25000,status:'Planning'});
 s.sections.push({id:'test-sec',projectId:'test-project',name:'Electrical integration'});
 s.tasks.push({id:'test-parent',projectId:'test-project',sectionId:'test-sec',title:'Build electrical panel',
  department:'IT',assignee:'Unassigned',priority:'Normal',status:'Backlog',start:'',due:''});
 s.parts.push({id:'test-part',code:'TEST-01',name:'Synthetic power module',onHand:0,reserved:0,unit:'ea',min:0});
 s.assemblies.push({id:'test-assembly',projectId:'test-project',name:'Test rack',buildQty:1,perParentQty:1});
 s.assemblyBOM.push({id:'test-occ',projectId:'test-project',assemblyId:'test-assembly',partId:'test-part',makeBuy:'Buy',quantity:1});
 ensureMaterials(s);ensureTeamWorkspace(s);return s;
}
test('sub-jobs retain editable description, belong to correct work package and display within parent',()=>{
 const s=fixture(),row=saveTask(s,{projectId:'test-project',sectionId:'test-sec',title:'Connect synthetic loom',
  description:'Test the technical wiring and label the connector',department:'IT',assignee:'Tech A',priority:'Normal',
  status:'Backlog',parentId:'test-parent',start:'',due:'',predecessors:[]});
 assert.equal(row.parentId,'test-parent');assert.match(row.description,/connector/);
 const html=renderProjectWorkPlan(s,{},'test-project');
 assert.match(html,/SUB-JOB/);assert.match(html,/Connect synthetic loom/);
 assert.match(html,/v48-add-section-job/);assert.match(html,/technical wiring/);
});
test('department allocations are bounded by approved internal project budget',()=>{
 const s=fixture();
 saveDepartmentAllocation(s,{projectId:'test-project',department:'IT',assignee:'Tech A',amount:20000});
 assert.equal(departmentOverview(s,'test-project').totalAllocated,20000);
 assert.throws(()=>saveDepartmentAllocation(s,{projectId:'test-project',department:'Workshop',assignee:'Worker B',amount:7000}),/exceed/);
});
test('per-material assignment links a department, a person and a task from one project',()=>{
 const s=fixture();
 allocateRequirement(s,{projectId:'test-project',occurrenceId:'test-occ',department:'IT',owner:'Tech A',taskId:'test-parent'});
 assert.equal(s.assemblyBOM[0].departmentOwner,'IT');
 assert.equal(s.assemblyBOM[0].linkedTaskId,'test-parent');
 assert.match(renderProjectTeam(s,{},'test-project'),/Tech A/);
 assert.throws(()=>allocateRequirement(s,{projectId:'test-project',occurrenceId:'test-occ',department:'Quality',taskId:'test-parent'}),/must agree/);
});
test('private photo attaches to work package and can be archived',()=>{
 const s=fixture();
 const row=attachEvidence(s,{projectId:'test-project',sectionId:'test-sec',taskId:'test-parent',title:'Synthetic rack photo',
  filename:'test.png',kind:'Photo',dataUrl:'data:image/png;base64,aGVsbG8='});
 assert.equal(row.visibility,'internal');assert.match(renderProjectEvidence(s,{},'test-project'),/Synthetic rack photo/);
 archiveEvidence(s,row.id);assert.doesNotMatch(renderProjectEvidence(s,{},'test-project'),/Synthetic rack photo/);
});
test('no customer data is published; customer preview is allowlisted local-only',()=>{
 const s=fixture();
 assert.equal(customerPreviewProjection(s,'test-project').sections.length,0);
 setCustomerShareRule(s,{projectId:'test-project',sectionId:'test-sec',visible:true,summary:'Selected safe programme heading'});
 const preview=customerPreviewProjection(s,'test-project');
 assert.equal(preview.sections.length,1);
 assert.doesNotMatch(JSON.stringify(preview),/test-part|Tech A|budget|supplier/i);
 assert.match(renderCustomerPreview(s,{},'test-project'),/Customer access remains disabled/);
});
test('project purchasing renders complete sourcing and PO workflow without navigating away',()=>{
 const s=fixture();
 const html=renderPurchasingV041(s,{procurementProject:'test-project',v46BuyingMode:'Buy'},'test-project');
 assert.match(html,/TEST-01/);
 assert.match(html,/Actual supplier orders/);
 assert.match(html,/Materials to source/);
 assert.doesNotMatch(html,/ACTIVE PURCHASING PROJECT/);
});
