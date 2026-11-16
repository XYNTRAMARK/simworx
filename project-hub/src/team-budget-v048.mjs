/* V0.4.8 project team, delegated purchasing envelopes, photo evidence and curated client projections.
 All entries belong to the offline local workspace. Profiles are NOT authenticated user accounts. */
export const DEPARTMENTS=['Office','Workshop','Purchasing','Quality','IT','Avionics','Electronics','Mechanical','Design','Integration','Software','Logistics'];
const live=x=>x&&!x.archivedAt;
const now=()=>new Date().toISOString();
const uid=p=>p+'-'+Math.random().toString(36).slice(2,11);
const name=(x,label,max=180)=>{const v=String(x??'').trim();if(!v||v.length>max)throw Error(label+' must be 1–'+max+' characters');return v;};
const amount=(x,label)=>{const n=Number(x);if(!Number.isFinite(n)||n<0||n>1e10||Math.abs(n*100-Math.round(n*100))>.000001)
 throw Error(label+' must be a positive or zero EUR amount with two decimal places');return Math.round(n*100)/100;};
const project=(s,id)=>{const p=s.projects?.find(p=>live(p)&&p.id===id);if(!p)throw Error('Project not found');return p;};
const writeAudit=(s,action,detail)=>{s.audit??=[];s.audit.unshift({id:uid('audit'),action,detail,actor:'Local owner / staff preview',at:now()});};
export function ensureTeam(s){
 s.staffProfiles??=[];
 s.departmentAllocations??=[];
 s.projectEvidence??=[];
 s.customerProgressSnapshots??=[];
 return s;
}
export function saveStaffProfile(s,{id='',name:person,department='IT',role='Staff',projectIds=[]}){
 ensureTeam(s);
 const label=name(person,'Staff name',120);
 if(!DEPARTMENTS.includes(department))throw Error('Unknown staff department');
 if(!['Staff','Manager','Purchasing','Quality'].includes(role))throw Error('Invalid staff role descriptor');
 if(!Array.isArray(projectIds)||!projectIds.every(x=>s.projects.some(p=>live(p)&&p.id===x)))
  throw Error('Staff project assignments must be existing projects');
 const ids=[...new Set(projectIds)];
 if(id){const existing=s.staffProfiles.find(x=>x.id===id&&live(x));if(!existing)throw Error('Staff profile not found');
 Object.assign(existing,{name:label,department,role,projectIds:ids,updatedAt:now()});
 writeAudit(s,'Staff profile updated',id);return existing;}
 const newEntry={id:uid('staff'),name:label,department,role,projectIds:ids,createdAt:now()};
 s.staffProfiles.push(newEntry);writeAudit(s,'Staff profile created',newEntry.id);return newEntry;
}
export function activeProjectStaff(s,projectId){ensureTeam(s);return s.staffProfiles.filter(u=>live(u)&&u.projectIds.includes(projectId));}
function spentFor(s,projectId,department){
 let actual=0,open=0,unknownCurrencies=[];
 for(const po of s.orders||[]){
  if(!live(po)||po.projectId!==projectId)continue;
  const rate=(po.currency||'EUR')==='EUR'?1:Number(po.eurExchangeRate||0);
  for(const l of po.items||[]){
   if(l.allocationDepartment!==department)continue;
   if(!Number.isFinite(rate)||rate<=0){unknownCurrencies.push(po.code||po.id);continue;}
   const qty=Number(l.quantity||0),received=Number(l.received||0),closed=Number(l.closedQuantity||0),unit=Number(l.unitCost||0);
   actual+=received*unit*rate;open+=Math.max(0,qty-received-closed)*unit*rate;
  }
 }
 return {actual:Math.round(actual*100)/100,open:Math.round(open*100)/100,unknownCurrencies:[...new Set(unknownCurrencies)]};
}
export function departmentBudgetSnapshot(s,projectId){
 ensureTeam(s);const p=project(s,projectId);
 const entries=s.departmentAllocations.filter(x=>x.projectId===projectId&&live(x));
 const rows=DEPARTMENTS.map(dep=>{
  const a=entries.find(e=>e.department===dep);
  const use=spentFor(s,projectId,dep);
  const allocated=Number(a?.amount||0);
  return {department:dep,allocated,actual:use.actual,committed:use.open,available:Math.round((allocated-use.actual-use.open)*100)/100,
   unknownCurrencies:use.unknownCurrencies,assignedTo:a?.leadStaffId||'',updatedAt:a?.updatedAt||'',note:a?.note||''};
 });
 const allocated=rows.reduce((n,r)=>n+r.allocated,0);
 const unassignedOrders=(s.orders||[]).filter(o=>live(o)&&o.projectId===projectId).flatMap(o=>
  (o.items||[]).filter(l=>!DEPARTMENTS.includes(l.allocationDepartment)).map(l=>({order:o.code||o.id,partId:l.partId})));
 return {projectId,projectBudget:Number(p.budget||0),allocated:Math.round(allocated*100)/100,
  unallocated:Math.round((Number(p.budget||0)-allocated)*100)/100,rows,unassignedOrders};
}
export function setDepartmentAllocation(s,{projectId,department,value,leadStaffId='',note=''}) {
 ensureTeam(s);project(s,projectId);
 if(!DEPARTMENTS.includes(department))throw Error('Choose an existing department');
 const budget=departmentBudgetSnapshot(s,projectId),newAmount=amount(value,'Department allocation');
 const other=budget.allocated-(budget.rows.find(r=>r.department===department)?.allocated||0);
 if(newAmount+other>budget.projectBudget+.001)
  throw Error('Department allocations exceed approved project purchasing budget. Set and approve the project budget first');
 const assigned=String(leadStaffId||'').trim();
 if(assigned){
  const staff=activeProjectStaff(s,projectId).find(x=>x.id===assigned&&x.department===department);
  if(!staff)throw Error('Department budget lead must be an active staff profile in that department');
 }
 const use=spentFor(s,projectId,department);
 if(use.unknownCurrencies.length)throw Error('Set the verified FX rates on existing department POs before changing the allocation');
 if(newAmount+.001<use.actual+use.open)
  throw Error('Cannot reduce allocation below recorded actuals and open commitments (€'+(use.actual+use.open).toFixed(2)+')');
 const text=String(note||'').trim();
 if(text.length>500)throw Error('Allocation note must be at most 500 characters');
 let row=s.departmentAllocations.find(x=>x.projectId===projectId&&x.department===department&&live(x));
 if(!row){row={id:uid('alloc'),projectId,department};s.departmentAllocations.push(row)}
 row.history??=[];
 if(row.updatedAt)row.history.push({at:row.updatedAt,amount:row.amount,leadStaffId:row.leadStaffId||'',note:row.note||''});
 Object.assign(row,{amount:newAmount,leadStaffId:assigned,note:text,updatedAt:now()});
 writeAudit(s,'Department spending envelope changed',projectId+' / '+department+' / EUR '+newAmount.toFixed(2));
 return departmentBudgetSnapshot(s,projectId);
}
export function assertProjectBudgetFloor(s,projectId,budget) {
 const snapshot=departmentBudgetSnapshot(s,projectId);
 if(amount(budget,'Project budget')+.001<snapshot.allocated)
  throw Error('Project budget cannot fall below its €'+snapshot.allocated.toFixed(2)+' departmental allocations. Amend allocations first');
 return true;
}
export function assignRequirement(s,{occurrenceId,department,buyerId='',taskId=''}) {
 ensureTeam(s);
 const occ=s.assemblyBOM?.find(x=>live(x)&&x.id===occurrenceId);
 if(!occ)throw Error('Live project material requirement not found');
 if(!DEPARTMENTS.includes(department))throw Error('Invalid department');
 const owner=String(buyerId||'').trim();
 if(owner&&!activeProjectStaff(s,occ.projectId).some(x=>x.id===owner&&x.department===department))
  throw Error('Buyer must be active project staff in the selected department');
 if(taskId){
  const task=s.tasks?.find(t=>live(t)&&t.id===taskId&&t.projectId===occ.projectId);
  if(!task)throw Error('Linked purchasing job must be in the same project');
 }
 const previous=occ.purchaseAssignment||{};
 const next={department,buyerId:owner,taskId:String(taskId||''),updatedAt:now()};
 if(previous.department===department&&(previous.buyerId||'')===owner&&(previous.taskId||'')===next.taskId)return occ;
 occ.purchaseAssignmentHistory??=[];if(previous.updatedAt)occ.purchaseAssignmentHistory.push({...previous});
 occ.purchaseAssignment=next;
 writeAudit(s,'Requirement assigned to department',occurrenceId+' / '+department+' / '+(owner||'No staff owner'));
 return occ;
}
export function assignTaskToStaff(s,{taskId,staffId}){
 ensureTeam(s);const task=s.tasks?.find(t=>live(t)&&t.id===taskId);
 if(!task)throw Error('Task unavailable');
 if(!staffId){task.assigneeStaffId='';task.assignee='Unassigned';writeAudit(s,'Task unassigned',taskId);return task}
 const staff=activeProjectStaff(s,task.projectId).find(x=>x.id===staffId);
 if(!staff)throw Error('Task assignee is not active in this project');
 task.assigneeStaffId=staff.id;task.assignee=staff.name;task.department=staff.department;
 writeAudit(s,'Task assigned to staff',taskId+' / '+staff.id);
 return task;
}
export function staffInbox(s,projectId,staffId){
 const staff=activeProjectStaff(s,projectId).find(x=>x.id===staffId);
 if(!staff)throw Error('Unknown project staff profile');
 const tasks=(s.tasks||[]).filter(t=>live(t)&&t.projectId===projectId&&
  (t.assigneeStaffId===staffId||(!t.assigneeStaffId&&t.assignee===staff.name)));
 const req=(s.assemblyBOM||[]).filter(o=>live(o)&&o.projectId===projectId&&o.purchaseAssignment?.buyerId===staffId);
 return {staff,tasks,requirements:req,budget:departmentBudgetSnapshot(s,projectId).rows.find(r=>r.department===staff.department)};
}
export function assertOrderAllocation(s,{projectId,supplier,currency='EUR',items=[]}){
 ensureTeam(s);project(s,projectId);
 if(currency!=='EUR')throw Error('Department purchasing currently requires EUR POs. Add reviewed exchange-rate workflow before foreign currency order recording');
 const budget=departmentBudgetSnapshot(s,projectId),newByDept=new Map(),snapshots=[];
 if(budget.projectBudget<=0)throw Error('Enter the approved internal project purchasing budget before placing an order');
 for(const line of items){
  const occ=s.assemblyBOM?.find(o=>live(o)&&o.id===line.sourceOccurrenceId&&o.projectId===projectId&&o.partId===line.partId);
  if(!occ)throw Error('Choose a contract requirement before recording spending');
  const assignment=occ.purchaseAssignment||{},department=assignment.department;
  if(!DEPARTMENTS.includes(department)||!assignment.buyerId)
   throw Error('Assign a purchasing department and named staff buyer for '+(occ.id||'this requirement'));
  const buyer=activeProjectStaff(s,projectId).find(st=>st.id===assignment.buyerId&&st.department===department);
  if(!buyer)throw Error('Assigned buyer profile is no longer active for this project');
  const cost=Number(line.unitCost||0)*Number(line.quantity||0);
  if(!Number.isFinite(cost)||cost<0)throw Error('Invalid PO line amount');
  newByDept.set(department,(newByDept.get(department)||0)+cost);
  snapshots.push({department,buyerId:buyer.id,taskId:assignment.taskId||'',amount:Math.round(cost*100)/100});
 }
 for(const [department,newCost] of newByDept){
  const row=budget.rows.find(r=>r.department===department);
  if(!row||row.allocated<=0)throw Error(department+' has no allocated purchasing envelope');
  if(row.unknownCurrencies.length)throw Error('Resolve unknown FX on '+department+' purchase commitments');
  if(newCost>row.available+.001)
   throw Error(department+' purchase exceeds remaining allocated budget (€'+row.available.toFixed(2)+' available)');
 }
 return snapshots;
}
const IMAGE_PREFIX='data:image/jpeg;base64,';
export function saveEvidencePhoto(s,{projectId,targetType,targetId,fileName,dataUrl,caption=''}) {
 ensureTeam(s);project(s,projectId);
 if(!['section','task'].includes(targetType))throw Error('Photo must be attached to a section or task');
 const list=targetType==='task'?s.tasks:s.sections;
 if(!list.some(r=>live(r)&&r.id===targetId&&r.projectId===projectId))throw Error('Photo target must belong to the selected project');
 const data=String(dataUrl||'');
 if(!data.startsWith(IMAGE_PREFIX)||!/^[A-Za-z0-9+/]*={0,2}$/.test(data.slice(IMAGE_PREFIX.length)))
  throw Error('Photos must be sanitized JPEG data URLs');
 if(data.length>390000)throw Error('Photo exceeds the maximum compressed size; retry with a smaller photo');
 if(s.projectEvidence.filter(x=>!x.archivedAt&&x.targetType===targetType&&x.targetId===targetId).length>=5)
  throw Error('Maximum five local photos per job or section in this prototype');
 const total=s.projectEvidence.filter(live).reduce((n,x)=>n+x.dataUrl.length,0);
 if(total+data.length>2_500_000)throw Error('Local browser photo storage is full. Export a backup, then migrate images to future secure storage');
 const row={id:uid('photo'),projectId,targetType,targetId,fileName:name(fileName,'Filename',180),
  caption:String(caption||'').slice(0,300),dataUrl:data,addedAt:now(),internalOnly:true};
 s.projectEvidence.push(row);
 writeAudit(s,'Internal photo attached',projectId+' / '+targetType+' '+targetId);
 return row;
}
export function removeEvidencePhoto(s,{photoId}){
 ensureTeam(s);const photo=s.projectEvidence.find(x=>x.id===photoId&&!x.archivedAt);
 if(!photo)throw Error('Photo not found');
 photo.archivedAt=now();photo.dataUrl='';writeAudit(s,'Internal photo removed',photo.id);
 return photo;
}
export function photosFor(s,projectId,targetType,targetId){
 ensureTeam(s);return s.projectEvidence.filter(x=>live(x)&&x.projectId===projectId&&x.targetType===targetType&&x.targetId===targetId);
}
export function saveCustomerProgressSnapshot(s,{projectId,taskId,publicNote,approvedBy}){
 ensureTeam(s);project(s,projectId);
 const t=s.tasks?.find(t=>live(t)&&t.id===taskId&&t.projectId===projectId);
 if(!t)throw Error('Only live jobs belonging to this project can be published');
 const note=name(publicNote,'Approved customer summary',600),reviewer=name(approvedBy,'Approver',120);
 const previous=s.customerProgressSnapshots.find(x=>live(x)&&x.projectId===projectId&&x.taskId===taskId);
 if(previous){previous.archivedAt=now()}
 const view={id:uid('customer-view'),projectId,taskId,title:t.title,status:t.status,
  publicNote:note,approvedBy:reviewer,publishedAt:now()};
 s.customerProgressSnapshots.push(view);
 writeAudit(s,'Curated progress snapshot published locally',taskId+' / approved by '+reviewer);
 return view;
}
export function withdrawCustomerProgressSnapshot(s,{snapshotId}){
 ensureTeam(s);
 const x=s.customerProgressSnapshots.find(x=>x.id===snapshotId&&live(x));
 if(!x)throw Error('Customer progress snapshot not found');
 x.archivedAt=now();writeAudit(s,'Curated progress snapshot withdrawn',x.id);return x;
}
export function customerPreviewProjection(s,projectId){
 ensureTeam(s);project(s,projectId);
 // Copy only reviewed, explicitly published fields. NEVER spread a raw project, task, PO or document object.
 return {progress:s.customerProgressSnapshots.filter(x=>live(x)&&x.projectId===projectId)
  .map(x=>({id:x.id,title:x.title,status:x.status,summary:x.publicNote,publishedAt:x.publishedAt})),
  updates:(s.updates||[]).filter(u=>live(u)&&u.projectId===projectId&&u.status==='published')
  .map(u=>({title:u.title||'',summary:u.description||'',publishedAt:u.publishedAt||''}))};
}
