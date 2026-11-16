import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from '../src/clean-data-v043.mjs';
import {ensureManufacturing} from '../src/manufacturing.mjs';
import {ensureMaterials,createWorkspaceBackup,parseWorkspaceBackup} from '../src/materials-v041.mjs';
import {ensureProgress} from '../src/progress-v043.mjs';
import {ensureExternalWork} from '../src/external-work-v043.mjs';
import {contractDatePlusMonths,setVerifiedContractEffectiveDate,updateContractMilestone,updateScopeReadiness} from '../src/contract-scope-v043.mjs';
import {createWorkspaceFileController} from '../src/workspace-file-v043.mjs';

const blank=()=>{const s=emptyWorkspace();ensureManufacturing(s);ensureMaterials(s);ensureProgress(s);ensureExternalWork(s);return s};
test('fresh workspace is empty, not old demo customers or projects',()=>{
 const s=blank();for(const key of ['projects','organizations','sections','tasks','parts','orders','assemblyBOM','projectProgressSteps','members','messages'])
  assert.equal(s[key].length,0,key+' should be empty');
});
test('empty workspace is fully backup-compatible',()=>{
 const s=blank(),text=createWorkspaceBackup(s),again=parseWorkspaceBackup(text);
 assert.equal(again.projects.length,0);assert.equal(again.version,1);
 assert.equal(again.settings.theme,'light');
});
test('contract metadata survives backup validation but has no mandatory public publication',()=>{
 const s=blank();s.organizations.push({id:'cust',name:'Customer',code:'C'});
 s.projects.push({id:'p',orgId:'cust',code:'P',name:'Project',budget:0,spent:0,committed:0,
   contractInfo:{effectiveDate:null,pricing:{simWorxEUR:15000}},due:''});
 s.readinessChecklist=[{id:'c1',text:'Verify commercial proposal',status:'Open'}];
 s.projectCommercialMilestones=[{id:'m1',projectId:'p',title:'FAT',status:'Not verified / not invoiced',simWorxEUR:5000}];
 const restored=parseWorkspaceBackup(createWorkspaceBackup(s));
 assert.equal(restored.projects[0].contractInfo.pricing.simWorxEUR,15000);
 assert.equal(restored.projectCommercialMilestones[0].status,'Not verified / not invoiced');
});
test('unknown effective date remains unknown; no default binding delivery date',()=>{
 const s=blank();s.projects.push({id:'p',code:'P',name:'Test',due:'',contractInfo:{effectiveDate:null}});
 assert.equal(s.projects[0].due,'');
 assert.throws(()=>setVerifiedContractEffectiveDate(s,{projectId:'p',effectiveDate:'2026-11-09',verified:false}),/Confirm/);
 assert.equal(s.projects[0].due,'');
});
test('entered verified signature date calculates 12-month date, preserving source history',()=>{
 const s=blank();s.projects.push({id:'p',code:'P',name:'Test',due:'',contractInfo:{}});
 setVerifiedContractEffectiveDate(s,{projectId:'p',effectiveDate:'2026-11-09',verified:true});
 assert.equal(s.projects[0].due,'2027-11-09');
 assert.equal(s.projects[0].contractInfo.effectiveDate,'2026-11-09');
 assert.equal(s.audit[0].action,'Contract date entered');
});
test('correct month-end 12-month calculation and reject imaginary date',()=>{
 assert.equal(contractDatePlusMonths('2028-02-29',12),'2029-02-28');
 assert.throws(()=>contractDatePlusMonths('2026-02-30'),/valid/);
});
test('reviewed commercial milestone and obligation have private audit trail',()=>{
 const s=blank();s.projects.push({id:'p',name:'Test',code:'P'});
 s.projectCommercialMilestones=[{id:'m1',projectId:'p',title:'FAT',status:'Not verified / not invoiced'}];
 s.readinessChecklist=[{id:'c1',text:'Procurement evidence',status:'Open'}];
 updateContractMilestone(s,{projectId:'p',milestoneId:'m1',status:'Invoiced',notes:'invoice reference pending'});
 updateScopeReadiness(s,{checkId:'c1',status:'In progress',note:'Awaiting supplier'});
 assert.equal(s.audit.length,2);
 assert.equal(s.projectCommercialMilestones[0].status,'Invoiced');
});
test('local workspace file controller safely falls back if picker unavailable',()=>{
 const c=createWorkspaceFileController();
 assert.equal(c.supportsFiles(),false);
 assert.equal(c.status().connected,false);
});

test('read-back verification checks actual file bytes, not merely a saved status label',async()=>{
 const previous=globalThis.window;
 let stored='';
 const handle={
  queryPermission:async()=> 'granted',
  getFile:async()=>({size:stored.length,text:async()=>stored}),
  createWritable:async()=>({write:async blob=>{stored=await blob.text()},close:async()=>{},abort:async()=>{}})
 };
 try{
  globalThis.window={showSaveFilePicker:async()=>handle,showOpenFilePicker:async()=>[handle]};
  const c=createWorkspaceFileController();
  assert.equal(c.supportsFiles(),true);
  await c.createAndConnect('{"workspace":1}');
  assert.equal(c.status().connected,true);
  assert.equal((await c.verifyConnected('{"workspace":1}')).bytes,15);
  await assert.rejects(c.verifyConnected('{"workspace":2}'),/DO NOT match/);
  assert.equal(c.status().kind,'file-error');
  await c.scheduleSave('{"workspace":2}');
  await c.verifyConnected('{"workspace":2}');
  c.detach();
  assert.equal(c.status().connected,false);
  await assert.rejects(c.verifyConnected('{"workspace":2}'),/Link a workspace/);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
test('backup restore is deliberately detached from prior autosave file',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8');
 assert.match(app,/workspaceFile\.detach\(\); \/\/ A newly restored backup must NEVER overwrite/);
 assert.match(app,/workspaceFile\.verifyConnected\(createWorkspaceBackup\(data\)\)/);
});
