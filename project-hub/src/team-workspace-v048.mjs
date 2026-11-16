/* V0.4.8: owner-managed departmental planning. No user authentication or remote access.
   All records are private local workspace data (never repository seed data). */
const live=x=>x&&!x.archivedAt;
const now=()=>new Date().toISOString();
const uid=p=>p+'-'+Math.random().toString(36).slice(2,12);
const name=(v,label,max=160)=>{const s=String(v??'').trim();if(!s||s.length>max)throw Error(label+' is required (max '+max+' characters)');return s;};
const euros=(v,label)=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e9||Math.abs(n*100-Math.round(n*100))>1e-6)throw Error(label+' must be a positive EUR amount with at most two decimals');return Math.round(n*100)/100;};
const departments=['Office','Workshop','Purchasing','Quality','IT','Engineering','Electronics','Visual Systems','Mechanical'];
export const teamDepartments=departments;
export function ensureTeamWorkspace(s){
 s.departmentAllocations??=[];s.projectEvidence??=[];s.customerShareRules??=[];
 return s;
}
const project=(s,id)=>{const p=s.projects?.find(p=>live(p)&&p.id===id);if(!p)throw Error('Project not found');return p;};
const audit=(s,action,detail)=>{s.audit??=[];s.audit.unshift({id:uid('audit'),actor:'Owner (local)',action,detail,at:now()});};
export function departmentOverview(s,projectId){
 ensureTeamWorkspace(s);const p=project(s,projectId);
 const orders=(s.orders||[]).filter(o=>live(o)&&o.projectId===projectId);
 const allocations=s.departmentAllocations.filter(x=>live(x)&&x.projectId===projectId);
 const requirements=(s.assemblyBOM||[]).filter(x=>live(x)&&x.projectId===projectId);
 const totals=new Map();
 for(const line of allocations){const k=line.department;const r=totals.get(k)||{department:k,allocated:0,committed:0,received:0,unknownCurrency:0,requirements:0,tasks:0,owners:new Set()};r.allocated+=Number(line.amount)||0;r.owners.add(line.assignee);totals.set(k,r);}
 for(const t of s.tasks||[]){if(live(t)&&t.projectId===projectId){const k=t.department||'Unassigned';const r=totals.get(k)||{department:k,allocated:0,committed:0,received:0,unknownCurrency:0,requirements:0,tasks:0,owners:new Set()};r.tasks++;totals.set(k,r);}}
 const byId=new Map(requirements.map(r=>[r.id,r]));
 for(const r of requirements){const k=r.departmentOwner||'Unassigned';const row=totals.get(k)||{department:k,allocated:0,committed:0,received:0,unknownCurrency:0,requirements:0,tasks:0,owners:new Set()};row.requirements++;totals.set(k,row);}
 for(const o of orders){
  const rate=(o.currency||'EUR')==='EUR'?1:Number(o.eurExchangeRate||0);
  for(const l of o.items||[]){
   const dept=byId.get(l.sourceOccurrenceId)?.departmentOwner||'Unassigned';
   const row=totals.get(dept)||{department:dept,allocated:0,committed:0,received:0,unknownCurrency:0,requirements:0,tasks:0,owners:new Set()};
   if(!Number.isFinite(rate)||rate<=0){row.unknownCurrency++;totals.set(dept,row);continue;}
   const cost=(Number(l.unitCost)||0)*rate;
   row.received+=Math.round((Number(l.received)||0)*cost*100)/100;
   row.committed+=Math.round(Math.max(0,Number(l.quantity||0)-Number(l.received||0)-Number(l.closedQuantity||0))*cost*100)/100;
   totals.set(dept,row);
  }
 }
 const rows=[...totals.values()].map(x=>({...x,allocated:Math.round(x.allocated*100)/100,committed:Math.round(x.committed*100)/100,
  received:Math.round(x.received*100)/100,owners:[...x.owners],remaining:Math.round((x.allocated-x.committed-x.received)*100)/100})).sort((a,b)=>a.department.localeCompare(b.department));
 const totalAllocated=Math.round(allocations.reduce((a,b)=>a+Number(b.amount||0),0)*100)/100;
 return {project:p,rows,allocations,requirements,totalAllocated,unallocated:Math.round((Number(p.budget||0)-totalAllocated)*100)/100,
  budget:Math.round(Number(p.budget||0)*100)/100};
}
export function saveDepartmentAllocation(s,{projectId,department,assignee,amount,note='',id=null}){
 ensureTeamWorkspace(s);project(s,projectId);
 if(!departments.includes(department))throw Error('Choose an approved department');
 const owner=name(assignee,'Responsible staff member'),value=euros(amount,'Allocation');
 if(value<=0)throw Error('Allocation must be greater than zero');
 const p=project(s,projectId),budget=Number(p.budget||0);
 if(!budget)throw Error('Set a verified INTERNAL purchasing budget on the project first. Customer contract revenue is not the spending budget');
 const existing=id?s.departmentAllocations.find(x=>live(x)&&x.id===id):null;
 if(id&&!existing)throw Error('Allocation not found');
 if(existing&&existing.projectId!==projectId)throw Error('Cannot move allocation between projects');
 const all=s.departmentAllocations.filter(x=>live(x)&&x.projectId===projectId&&x.id!==id);
 if(all.some(x=>x.department===department&&x.assignee.toLowerCase()===owner.toLowerCase()))
  throw Error('An allocation already exists for that department and staff member — edit the existing one');
 const used=all.reduce((n,x)=>n+Number(x.amount||0),0);
 if(used+value>budget+1e-6)throw Error('Department allocations exceed the recorded internal project budget');
 const record=existing||{id:uid('allocation'),projectId,createdAt:now()};
 Object.assign(record,{department,assignee:owner,amount:value,note:String(note||'').trim().slice(0,800),updatedAt:now()});
 if(!existing)s.departmentAllocations.push(record);
 audit(s,existing?'Department allocation edited':'Department allocation created',p.code+' / '+department+' / '+owner+' / EUR '+value);
 return record;
}
export function allocateRequirement(s,{projectId,occurrenceId,department,taskId='',owner=''}){
 ensureTeamWorkspace(s);project(s,projectId);
 const r=s.assemblyBOM?.find(x=>live(x)&&x.id===occurrenceId&&x.projectId===projectId);if(!r)throw Error('Material requirement not found');
 if(department&& !departments.includes(department))throw Error('Invalid department');
 const task=taskId?s.tasks?.find(t=>live(t)&&t.id===taskId&&t.projectId===projectId):null;
 if(taskId&&!task)throw Error('Linked task must belong to this project');
 if(task&&department&&task.department!==department)throw Error('Task and purchasing department must agree');
 r.departmentOwner=department||null;r.responsiblePerson=String(owner||'').trim().slice(0,160);
 r.linkedTaskId=taskId||null;
 audit(s,'Material responsibility assigned',r.id+' / '+(department||'Unassigned')+' / '+(r.responsiblePerson||'No person'));
 return r;
}
export function attachEvidence(s,{projectId,sectionId='',taskId='',title,kind='Photo',dataUrl,filename}){
 ensureTeamWorkspace(s);project(s,projectId);
 if(sectionId&&!s.sections?.some(x=>live(x)&&x.id===sectionId&&x.projectId===projectId))throw Error('Section does not belong to this project');
 const task=taskId?s.tasks?.find(t=>live(t)&&t.id===taskId&&t.projectId===projectId):null;
 if(taskId&&!task)throw Error('Task not in this project');
 if(task&&sectionId&&task.sectionId!==sectionId)throw Error('Task is not in selected section');
 if(!['Photo','Evidence'].includes(kind))throw Error('Invalid evidence type');
 const label=name(title,'Photo / evidence title',180),file=name(filename,'File name',180);
 if(!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl||''))throw Error('Only encoded JPEG/PNG/WebP photos are supported');
 if(dataUrl.length>400000)throw Error('Photo exceeds 300 KB after compression; use a smaller picture');
 if(s.projectEvidence.filter(x=>live(x)&&x.projectId===projectId).length>=30)throw Error('Limit of 30 embedded photos per project; archive older evidence first');
 const row={id:uid('evidence'),projectId,sectionId:sectionId||null,taskId:taskId||null,title:label,kind,
  filename:file,dataUrl,visibility:'internal',recordedAt:now()};
 s.projectEvidence.push(row);audit(s,'Private project evidence added',label+' / '+file);return row;
}
export function archiveEvidence(s,id){ensureTeamWorkspace(s);const row=s.projectEvidence.find(x=>live(x)&&x.id===id);if(!row)throw Error('Evidence not found');row.archivedAt=now();audit(s,'Project evidence archived',row.filename);return row;}
export function setCustomerShareRule(s,{projectId,sectionId,visible,summary=''}){
 ensureTeamWorkspace(s);project(s,projectId);
 if(!s.sections?.some(x=>live(x)&&x.id===sectionId&&x.projectId===projectId))throw Error('Project section missing');
 const row=s.customerShareRules.find(x=>x.projectId===projectId&&x.sectionId===sectionId);
 const target=row||{id:uid('share-rule'),projectId,sectionId,createdAt:now()};
 target.visible=Boolean(visible);target.summary=String(summary||'').slice(0,500);target.updatedAt=now();
 if(!row)s.customerShareRules.push(target);
 audit(s,'Customer preview allowlist edited',sectionId+' / '+(visible?'Allowed in local preview':'Hidden from local preview'));
 return target;
}
export function customerPreviewProjection(s,projectId){
 ensureTeamWorkspace(s);const p=project(s,projectId);
 const allowed=new Map(s.customerShareRules.filter(r=>r.projectId===projectId&&r.visible).map(x=>[x.sectionId,x]));
 return {projectName:p.name,sections:(s.sections||[]).filter(x=>live(x)&&x.projectId===projectId&&allowed.has(x.id))
  .map(sec=>({title:sec.name,summary:allowed.get(sec.id).summary||'',status:'Progress details withheld until owner publishes a verified update'}))};
}
