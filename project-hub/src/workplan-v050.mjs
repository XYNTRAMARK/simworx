/* V0.5.0 — work plan is the project operating source. Existing local JSON schema retained.
   Job links and engineering requirements are planning records, NOT supplier orders or approvals.
   This module contains NO private contract data. */
import {saveTask,savePart,uid} from './model.mjs';
import {ensureManufacturing,saveAssembly,saveOccurrence} from './manufacturing.mjs';
import {ensureMaterials} from './materials-v041.mjs';
const live=x=>x&&!x.archivedAt;
const stamp=()=>new Date().toISOString();
const name=(x,label,max=160)=>{const v=String(x??'').trim();if(!v||v.length>max)throw Error(label+' is required (max '+max+' characters)');return v};
const num=(x,label)=>{const v=Number(x);if(!Number.isSafeInteger(v)||v<=0||v>10000000)throw Error(label+' must be a positive whole number');return v};
const audit=(s,action,detail)=>{s.audit??=[];s.audit.unshift({id:uid('audit'),at:stamp(),actor:'Owner (local)',action,detail})};
const findProject=(s,id)=>{const p=s.projects?.find(x=>live(x)&&x.id===id);if(!p)throw Error('Project does not exist');return p};
const findTask=(s,id)=>{const t=s.tasks?.find(x=>live(x)&&x.id===id);if(!t)throw Error('Job missing or archived');return t};
const findOccurrence=(s,id)=>{const o=s.assemblyBOM?.find(x=>live(x)&&x.id===id);if(!o)throw Error('Material requirement missing or archived');return o};
export const materialKinds=[['buy','Sim-Worx to purchase'],['make','Sim-Worx to manufacture'],
 ['customer','Customer-supplied equipment'],['subcontract','Subcontractor supply'],['unresolved','Responsibility to be confirmed']];
export const deptOptions=['Office','Workshop','Purchasing','Quality','IT','Engineering','Electronics','Visual Systems','Mechanical'];
export function saveWorkPlanJob(s,{id=null,projectId,sectionId,parentId='',title,description='',department='Workshop',assignee='Unassigned',
 priority='Normal',status='Backlog',start='',due='',predecessors=[],needsPurchasing=false,purchaseNeedNotes=''}){
 findProject(s,projectId);
 const old=id?findTask(s,id):null;
 if(old&&old.projectId!==projectId)throw Error('Cannot move jobs between projects');
 if(parentId){
  const parent=findTask(s,parentId);
  if(parent.projectId!==projectId||parent.sectionId!==sectionId)throw Error('Parent job must be in the same project and work package');
 }
 if(!deptOptions.includes(department))throw Error('Choose a valid department');
 const notes=String(purchaseNeedNotes||'').trim();
 if(notes.length>1200)throw Error('Purchase-need explanation must be 1200 characters or less');
 const job=saveTask(s,{id,projectId,sectionId,parentId,title,description,department,assignee,priority,status,start,due,predecessors});
 job.needsPurchasing=Boolean(needsPurchasing);
 job.purchaseNeedNotes=notes;
 job.updatedAt=stamp();
 audit(s,old?'Work plan job edited':'Work plan job created',job.title+' / '+(job.parentId?'nested under '+job.parentId:'top-level'));
 return job;
}
function ownedAssembly(s,task){
 ensureManufacturing(s);
 const ref='workplan-section:'+task.sectionId;
 let a=(s.assemblies||[]).find(a=>live(a)&&a.projectId===task.projectId&&a.workplanRef===ref);
 if(a)return a;
 const sec=s.sections.find(x=>live(x)&&x.id===task.sectionId);
 if(!sec)throw Error('Work package not found');
 const code='WPLAN-'+uid('A').replace(/[^A-Za-z0-9]/g,'').slice(-10).toUpperCase();
 a=saveAssembly(s,{projectId:task.projectId,sectionId:sec.id,name:'Work plan materials · '+sec.name,
  code,perParentQty:1,buildQty:1,status:'Design',owner:'Unassigned'});
 a.workplanRef=ref;
 return a;
}
function kind(v){if(!materialKinds.some(x=>x[0]===v))throw Error('Select whether the item is bought, made, customer-supplied or subcontracted');return v}
function links(s,occurrenceId){
 return (s.orders||[]).filter(live).flatMap(o=>(o.items||[]).filter(i=>i.sourceOccurrenceId===occurrenceId)
  .map(line=>({order:o,line})));
}
export function saveJobRequirement(s,{id=null,projectId,taskId,name:label,code='',quantity,unit='ea',
 specification='',kind:fulfilment='buy'}){
 findProject(s,projectId);
 const task=findTask(s,taskId);
 if(task.projectId!==projectId)throw Error('Job is not in selected project');
 const title=name(label,'Material description',220),q=num(quantity,'Required quantity'),
  u=name(unit,'Unit of measure',24),type=kind(fulfilment),spec=String(specification||'').trim();
 if(spec.length>4000)throw Error('Technical specification must be 4000 characters or less');
 const rawCode=String(code||'').trim().toUpperCase();
 if(rawCode.length>100)throw Error('Internal part code must be 100 characters or less');
 // A named internal part code is an identity only, NEVER manufacturer confirmation.
 let occ,part;
 if(id){
  occ=findOccurrence(s,id);
  if(occ.projectId!==projectId||!occ.workplanCreated)throw Error('Only a work plan created requirement can be edited here; use the controlled engineering form for other requirements');
  if(occ.linkedTaskId!==taskId)throw Error('Cannot reparent a material requirement without explicit reassignment');
  if(links(s,id).length)throw Error('This requirement is linked to an actual supplier PO. Preserve its order history and use formal revisions in Purchasing; do not overwrite it from Work Plan.');
  part=s.parts.find(p=>live(p)&&p.id===occ.partId);
  if(!part)throw Error('Part master for requirement is missing');
  if((s.assemblyBOM||[]).filter(x=>live(x)&&x.partId===part.id).length>1)throw Error('Shared part cannot be modified from the work plan. Use Part Master instead.');
  const nextCode=rawCode||part.code;
  if(s.parts.some(p=>live(p)&&p.id!==part.id&&p.code.toUpperCase()===nextCode))throw Error('Internal part code already exists');
  const prior={at:stamp(),name:part.name,code:part.code,unit:part.unit,quantity:occ.quantity,
   specification:occ.notes,kind:occ.workplanKind};
  occ.workplanHistory??=[];occ.workplanHistory.push(prior);
  // Preserve source evidence; changed specification makes technical review fingerprint stale.
  Object.assign(part,{name:title,code:nextCode,unit:u,notes:spec});
  saveOccurrence(s,{id:occ.id,assemblyId:occ.assemblyId,partId:part.id,quantity:q,
   notes:spec,position:occ.position||'',makeBuy:type==='make'?'Make':'Buy'});
 }else{
  ensureMaterials(s);
  const generated='WP-'+uid('item').replace(/[^A-Za-z0-9]/g,'').slice(-11).toUpperCase();
  const actualCode=rawCode||generated;
  if(s.parts.some(p=>live(p)&&p.code.toUpperCase()===actualCode))throw Error('Internal part code already exists');
  const a=ownedAssembly(s,task);
  part=savePart(s,{code:actualCode,name:title,unit:u,supplier:'',location:'',min:0,cost:0});
  part.notes=spec;part.workplanCreated=true;
  occ=saveOccurrence(s,{assemblyId:a.id,partId:part.id,quantity:q,makeBuy:type==='make'?'Make':'Buy',
    position:'',notes:spec});
  occ.workplanCreated=true;
  occ.createdAt=stamp();
 }
 occ.workplanKind=type;
 occ.linkedTaskId=task.id;
 occ.departmentOwner=task.department;
 occ.responsiblePerson=task.assignee==='Unassigned'?'':task.assignee;
 // Label as a proposed responsibility, not a binding contractual release.
 const responsibility=type==='buy'?'Sim-Worx':type==='customer'?'Customer-direct':type==='subcontract'?'Subcontractor':'Unverified';
 if(occ.purchaseSource?.responsibility!==responsibility){
  if(occ.purchaseSource){occ.purchaseSourceHistory??=[];occ.purchaseSourceHistory.push({...occ.purchaseSource})}
  occ.purchaseSource={...(occ.purchaseSource||{}),responsibility,updatedAt:stamp()};
 }
 occ.updatedAt=stamp();
 audit(s,id?'Work plan requirement revised':'Work plan requirement created',
   task.title+' / '+part.code+' / '+q+' '+u+' / '+type+' / PLANNED ONLY');
 return occ;
}
export function linkExistingRequirement(s,{projectId,taskId,occurrenceId}){
 const job=findTask(s,taskId),occ=findOccurrence(s,occurrenceId);
 if(job.projectId!==projectId||occ.projectId!==projectId)throw Error('Cross-project material links are forbidden');
 if(occ.linkedTaskId&&occ.linkedTaskId!==taskId)
  throw Error('This requirement is already linked to another job; use the responsibility reassignment controls rather than duplicating it');
 occ.linkedTaskId=job.id;
 if(!occ.departmentOwner)occ.departmentOwner=job.department;
 if(!occ.responsiblePerson&&job.assignee!=='Unassigned')occ.responsiblePerson=job.assignee;
 audit(s,'Existing engineering requirement linked to job',job.title+' / '+occ.id+' — no duplicate created');
 return occ;
}
export function archiveJobRequirement(s,{occurrenceId}){
 const occ=findOccurrence(s,occurrenceId);
 if(!occ.workplanCreated)throw Error('Only work-plan-created draft requirements can be archived from here');
 if(links(s,occ.id).length)throw Error('Cannot archive material linked to an actual supplier PO. Preserve the contract and purchasing audit trail.');
 occ.archivedAt=stamp();audit(s,'Work plan draft requirement archived',occ.id);
 return occ;
}
export function jobRequirements(s,taskId){
 return (s.assemblyBOM||[]).filter(x=>live(x)&&x.linkedTaskId===taskId);
}
export function flaggedUnspecifiedPurchases(s,projectId){
 return (s.tasks||[]).filter(t=>live(t)&&t.projectId===projectId&&t.needsPurchasing
  &&!(s.assemblyBOM||[]).some(o=>live(o)&&o.linkedTaskId===t.id&&o.makeBuy!=='Make'&&o.purchaseSource?.responsibility==='Sim-Worx'));
}
export function workHierarchy(s,projectId,sectionId){
 const tasks=(s.tasks||[]).filter(t=>live(t)&&t.projectId===projectId&&t.sectionId===sectionId),byParent=new Map(),known=new Set(tasks.map(t=>t.id));
 for(const task of tasks){const parent=known.has(task.parentId)?task.parentId:null;const group=byParent.get(parent)||[];group.push(task);byParent.set(parent,group)}
 const out=[],visited=new Set(),walk=(parent,trail,depth)=>{
  (byParent.get(parent)||[]).forEach((task,index)=>{
   if(visited.has(task.id))return;
   visited.add(task.id);
   const wbs=trail?trail+'.'+(index+1):String(index+1);
   out.push({task,depth,wbs});
   walk(task.id,wbs,depth+1);
  });
 };
 walk(null,'',0);
 // Include pre-existing orphan/cyclic legacy rows as visible review candidates, never silently drop.
 tasks.filter(t=>!visited.has(t.id)).forEach((task,index)=>out.push({task,depth:0,wbs:'CHECK-'+(index+1)}));
 return out;
}
