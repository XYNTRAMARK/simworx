import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../src/demo-data.mjs';
import {saveOrganization,saveProject,saveSection,saveTask,savePart,saveBomLine,archiveRecord,restoreRecord,clientProjection,setTaskStatus,taskProgress} from '../src/model.mjs';

test('customer create, edit, duplicate protection and archive restrictions',()=>{
 const d=seed();
 const org=saveOrganization(d,{name:'Flight College',code:'FC',contact:'Spain',accent:'#556677'});
 assert.equal(org.name,'Flight College');
 saveOrganization(d,{id:org.id,name:'Flight College Europe',code:'FCE',contact:'Spain',accent:'#112233'});
 assert.equal(d.organizations.find(o=>o.id===org.id).name,'Flight College Europe');
 assert.throws(()=>saveOrganization(d,{name:'Other',code:'NOAH'}),/already exists/);
 const p=saveProject(d,{name:'Test trainer',orgId:org.id,budget:200,contract:300});
 assert.throws(()=>archiveRecord(d,'organizations',org.id),/projects/);
 archiveRecord(d,'projects',p.id);archiveRecord(d,'organizations',org.id);
 assert.equal(clientProjection(d,org.id,p.id),null);
 assert.throws(()=>restoreRecord(d,'projects',p.id),/parent customer/);
 restoreRecord(d,'organizations',org.id);restoreRecord(d,'projects',p.id);
 assert.equal(clientProjection(d,org.id,p.id).project.id,p.id);
});
test('editing a project cannot migrate it to another customer',()=>{
 const d=seed();
 const p=d.projects[0];
 assert.throws(()=>saveProject(d,{...p,orgId:'jetpro'}),/not permitted/);
 assert.equal(p.orgId,'noah');
 saveProject(d,{...p,name:'Renamed NOAH',orgId:'noah'});
 assert.equal(d.projects[0].name,'Renamed NOAH');
 assert.throws(()=>saveProject(d,{...p,budget:-12}),/Budget/);
});
test('sections cannot be archived before child jobs',()=>{
 const d=seed();
 assert.throws(()=>archiveRecord(d,'sections','s1'),/Archive jobs/);
 const s=saveSection(d,{projectId:'p1',name:'Custom engineering',weight:10});
 saveSection(d,{id:s.id,projectId:'p1',name:'Detailed design',weight:20});
 archiveRecord(d,'sections',s.id);
 assert.equal(d.sections.find(x=>x.id===s.id).archivedAt!==undefined,true);
 restoreRecord(d,'sections',s.id);
});
test('nested work breakdown is preserved and prevents parent cycles',()=>{
 const d=seed();
 const t=saveTask(d,{projectId:'p1',sectionId:'s1',title:'Parent job',department:'Office',priority:'High',status:'Ready'});
 const child=saveTask(d,{projectId:'p1',sectionId:'s1',title:'Subjob',department:'Workshop',priority:'Normal',parentId:t.id,blockedBy:'t2'});
 assert.equal(child.parentId,t.id);
 assert.throws(()=>saveTask(d,{...t,parentId:child.id}),/Circular/);
 assert.throws(()=>archiveRecord(d,'tasks',t.id),/dependent/);
 saveTask(d,{...child,blockedBy:'t6',status:'Blocked'});
 assert.throws(()=>setTaskStatus(d,child.id,'Done'),/predecessor/i);
 setTaskStatus(d,'t6','Done');setTaskStatus(d,child.id,'Done');
 assert.equal(d.tasks.find(x=>x.id===child.id).status,'Done');
 archiveRecord(d,'tasks',child.id);archiveRecord(d,'tasks',t.id);
});
test('BOM lines can be edited but cannot be reduced below reserved or issued',()=>{
 const d=seed();
 const part=savePart(d,{code:'NEW-88',name:'Test mount',unit:'ea',min:2,cost:25,location:'B1'});
 const b=saveBomLine(d,{projectId:'p1',partId:part.id,required:10});
 saveBomLine(d,{...b,required:12});
 assert.equal(b.required,12);
 assert.throws(()=>saveBomLine(d,{projectId:'p1',partId:part.id,required:3}),/already/);
 b.reserved=7;
 assert.throws(()=>saveBomLine(d,{...b,required:4}),/reserved/);
 assert.throws(()=>archiveRecord(d,'bom',b.id),/reserved/);
 b.reserved=0;archiveRecord(d,'bom',b.id);
 archiveRecord(d,'parts',part.id);restoreRecord(d,'parts',part.id);restoreRecord(d,'bom',b.id);
});
test('stock parts with quantity or purchase orders cannot be archived',()=>{
 const d=seed();assert.throws(()=>archiveRecord(d,'parts','part1'),/stock|referenced/);
 assert.throws(()=>archiveRecord(d,'orders','po2'),/received stock/);
});
test('archived records disappear from customer projection and progress',()=>{
 const d=seed();const initial=taskProgress('p1',d.tasks);
 archiveRecord(d,'documents','d1');
 assert.equal(clientProjection(d,'noah','p1').documents.some(x=>x.id==='d1'),false);
 const t=d.tasks.find(x=>x.id==='t6');
 archiveRecord(d,'tasks',t.id);
 assert.notEqual(taskProgress('p1',d.tasks),initial);
});
