/* Sim-Worx Project Hub. Pure domain functions for the local demonstration.
   This is not a security boundary: production requires server-side permission checks and RLS. */
export const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const money = n => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
export const number = n => new Intl.NumberFormat('en-GB').format(Number(n || 0));
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const taskProgress = (projectId, tasks) => {
  const list = tasks.filter(t => t.projectId === projectId && !t.archivedAt && t.status !== 'Cancelled' && !tasks.some(child => !child.archivedAt && child.parentId === t.id));
  return list.length ? Math.round(list.reduce((sum,t)=>sum + (t.status === 'Done' ? 100 : t.status === 'Inspection' ? 80 : t.status === 'In progress' ? 45 : 0),0)/list.length) : 0;
};
export const availableStock = part => Number(part.onHand) - Number(part.reserved);
export const lineOutstanding = line => Math.max(0, Number(line.quantity)-Number(line.received||0));
export function stockMove(state, {partId, quantity, type, actor = 'Sim-Worx Admin', projectId = null}) {
  const part = state.parts.find(p=>p.id===partId);
  if (!part) throw Error('Part not found');
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) throw Error('Quantity must be a positive whole number');
  if (!['receipt','issue','adjust-in','adjust-out'].includes(type)) throw Error('Invalid movement');
  if (['issue','adjust-out'].includes(type) && availableStock(part)<q) throw Error('Insufficient available stock');
  if (type==='issue' || type==='adjust-out') part.onHand-=q;
  else part.onHand+=q;
  state.movements.unshift({id:uid('mv'),partId,quantity:q,type,actor,projectId,date:new Date().toISOString()});
  state.audit.unshift({id:uid('audit'),actor,action:`Stock ${type}`,detail:`${q} × ${part.code}`,at:new Date().toISOString()});
  return part;
}
export function receiveOrder(state, orderId, actor='Sim-Worx Admin') {
  const order=state.orders.find(o=>o.id===orderId);
  if(!order)throw Error('Purchase order not found');
  const quantities=order.items.map(i=>lineOutstanding(i));
  if(!quantities.some(q=>q>0))throw Error('This order is already fully received');
  // Validate every line before mutating anything.
  order.items.forEach(i=>{if(!state.parts.some(p=>p.id===i.partId)) throw Error('Order has an unknown part')});
  order.items.forEach((i,idx)=>{
    if(quantities[idx]>0){stockMove(state,{partId:i.partId,quantity:quantities[idx],type:'receipt',actor,projectId:order.projectId});i.received=Number(i.quantity)}
  });
  order.status='Received';
  state.audit.unshift({id:uid('audit'),actor,action:'Purchase order received',detail:order.code,at:new Date().toISOString()});
}
export function publishUpdate(state, updateId, actor='Sim-Worx Admin') {
  const u=state.updates.find(u=>u.id===updateId);
  if(!u)throw Error('Update not found');
  if(u.status==='published')throw Error('Already published');
  u.status='published';u.publishedAt=new Date().toISOString();u.publishedBy=actor;
  state.audit.unshift({id:uid('audit'),actor,action:'Customer publication',detail:u.title,at:u.publishedAt});
  state.notifications.unshift({id:uid('note'),text:`${u.title} has been published to the customer portal.`,date:today(),read:false});
}
export function decideApproval(state, approvalId, decision, actor='Client Approver'){
  const a=state.approvals.find(a=>a.id===approvalId);
  if(!a || a.status!=='Pending')throw Error('Approval is not pending');
  if(!['Approved','Changes requested','Rejected'].includes(decision))throw Error('Invalid decision');
  a.status=decision;a.decisionBy=actor;a.decidedAt=new Date().toISOString();
  state.audit.unshift({id:uid('audit'),actor,action:'Customer decision',detail:`${a.title} (${a.revision}): ${decision}`,at:a.decidedAt});
}
export function clientProjection(state, orgId, projectId, memberId=null){
  const organization=state.organizations.find(o=>o.id===orgId && !o.archivedAt);
  if(!organization)return null;
  const accessibleProjects=state.projects.filter(p=>!p.archivedAt && p.orgId===orgId && (!memberId || state.members.some(m=>!m.archivedAt&&m.id===memberId&&m.orgId===orgId&&m.projects.includes(p.id))));
  const project=accessibleProjects.find(p=>p.id===projectId)||accessibleProjects[0];
  if(!project)return {organization,projects:accessibleProjects,project:null,updates:[],approvals:[],documents:[],messages:[],members:[]};
  // Explicit allowlist: no internal cost, task, supplier, PO or stock fields escape this function.
  return {
    organization:{id:organization.id,name:organization.name,accent:organization.accent,logo:organization.logo},
    projects:accessibleProjects.map(p=>({id:p.id,name:p.name,code:p.code})),
    project:{id:project.id,name:project.name,code:project.code,description:project.publicDescription||project.description,delivery:project.due,publishedProgress:project.publishedProgress,phase:project.phase},
    updates:state.updates.filter(u=>!u.archivedAt&&u.projectId===project.id&&u.status==='published').map(u=>({id:u.id,title:u.title,description:u.description,kind:u.kind,part:u.part,status:u.status,publishedAt:u.publishedAt||u.date})),
    approvals:state.approvals.filter(a=>!a.archivedAt&&a.projectId===project.id&&a.shared).map(a=>({id:a.id,title:a.title,kind:a.kind,revision:a.revision,status:a.status,due:a.due,requested:a.requested})),
    documents:state.documents.filter(d=>!d.archivedAt&&d.projectId===project.id&&d.visibility==='customer').map(d=>({id:d.id,title:d.title,rev:d.rev,type:d.type,date:d.date})),
    messages:state.messages.filter(m=>!m.archivedAt&&m.projectId===project.id&&m.visibility==='customer').map(m=>({id:m.id,author:m.author,text:m.text,at:m.at})),
    members:state.members.filter(m=>!m.archivedAt&&m.orgId===orgId && m.projects.includes(project.id)).map(m=>({id:m.id,name:m.name,role:m.role,email:m.email}))
  };
}
export function clientInvite(state,{orgId,name,email,role,projectIds},actor='Client Admin'){
  if(!name?.trim()||!email?.includes('@'))throw Error('Enter a valid name and email');
  if(!['Client Viewer','Client Engineer','Client Approver','Client Lead'].includes(role))throw Error('Role outside delegation ceiling');
  if(!projectIds?.length || !projectIds.every(p=>state.projects.some(x=>x.id===p&&x.orgId===orgId)))throw Error('Project outside customer organisation');
  if(state.members.some(m=>m.email.toLowerCase()===email.toLowerCase()))throw Error('Email already exists in this demo');
  state.members.push({id:uid('mem'),orgId,name:name.trim(),email:email.trim(),role,projects:projectIds,status:'Demo invite'});
  state.audit.unshift({id:uid('audit'),actor,action:'Client invitation drafted',detail:`${email} / ${role} / ${projectIds.join(',')}`,at:new Date().toISOString()});
}

// V0.2 local-domain integrity rules. Production must enforce these server-side.
export const activeRecords = list => list.filter(item => !item.archivedAt);
const requireText = (value,label) => {
  const text=String(value ?? '').trim();
  if(!text)throw Error(`${label} is required`);
  return text;
};
const requireAmount = (value,label) => {
  const n=Number(value);
  if(!Number.isFinite(n)||n<0)throw Error(`${label} must be zero or greater`);
  return n;
};
const logChange = (state,action,detail) => {
  state.audit.unshift({id:uid('audit'),actor:'Sim-Worx Admin',action,detail,at:new Date().toISOString()});
};
export function saveOrganization(state,{id,name,code,contact,accent}){
  const n=requireText(name,'Customer name'),c=requireText(code,'Customer code').toUpperCase();
  if(state.organizations.some(o=>o.id!==id && o.code.toUpperCase()===c))throw Error('Customer code already exists');
  const color=/^#[0-9a-f]{6}$/i.test(accent)?accent:'#5369c4';
  if(id){const o=state.organizations.find(o=>o.id===id && !o.archivedAt);if(!o)throw Error('Customer unavailable');
    Object.assign(o,{name:n,code:c,contact:String(contact||''),accent:color,logo:n[0]?.toUpperCase()||'?'});logChange(state,'Customer updated',n);return o;}
  const org={id:uid('org'),name:n,code:c,contact:String(contact||''),accent:color,logo:n[0].toUpperCase()};
  state.organizations.push(org);logChange(state,'Customer created',n);return org;
}
export function saveProject(state,{id,orgId,name,template,status,phase,due,budget,contract,lead,description}){
  const org=state.organizations.find(o=>o.id===orgId&&!o.archivedAt);
  if(!org)throw Error('Choose an active customer');
  const n=requireText(name,'Project name');const b=requireAmount(budget,'Budget'),c=requireAmount(contract,'Contract value');
  if(id){const p=state.projects.find(p=>p.id===id&&!p.archivedAt);if(!p)throw Error('Project unavailable');
    if(p.orgId!==orgId)throw Error('Moving a project to a different customer is not permitted');
    Object.assign(p,{name:n,status:status||p.status,phase:phase||p.phase,due:String(due||''),budget:b,contract:c,lead:String(lead||''),description:String(description||'')});
    logChange(state,'Project updated',p.code);return p;}
  const code=`SW-${String(new Date().getFullYear()).slice(-2)}${String(Math.max(0,...state.projects.map(x=>Number(String(x.code).match(/\d{3}$/)?.[0]||0)))+1).padStart(3,'0')}`;
  const p={id:uid('p'),orgId,name:n,code,template:template||'Bespoke Simulator',status:'Design',phase:'Engineering',due:String(due||''),budget:b,contract:c,spent:0,committed:0,publishedProgress:0,lead:String(lead||''),description:String(description||''),created:today()};
  state.projects.unshift(p);logChange(state,'Project created',`${code} for ${org.name}`);return p;
}
export function saveSection(state,{id,projectId,name,weight}){
  if(!state.projects.some(p=>p.id===projectId&&!p.archivedAt))throw Error('Project unavailable');
  const n=requireText(name,'Section name'),w=Number(weight);
  if(!Number.isFinite(w)||w<0||w>100)throw Error('Weight must be between 0 and 100');
  if(id){const s=state.sections.find(s=>s.id===id&&!s.archivedAt&&s.projectId===projectId);if(!s)throw Error('Section unavailable');Object.assign(s,{name:n,weight:w});logChange(state,'Section updated',n);return s;}
  const s={id:uid('s'),projectId,name:n,weight:w};state.sections.push(s);logChange(state,'Section created',n);return s;
}
// V0.3 planning model: dependency graph, dated plans and immutable-by-default baselines.
export function predecessorIds(task){
  return [...new Set([...(Array.isArray(task.predecessors)?task.predecessors:[]),...(task.blockedBy?[task.blockedBy]:[])].filter(Boolean))];
}
const validDate = value => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value);
function verifyJobDates(start,due){
  if(!validDate(start)||!validDate(due))throw Error('Enter valid ISO dates');
  if(start && due && due<start)throw Error('Finish date cannot precede start date');
}
function verifyPredecessors(state, projectId, taskId, ids){
  const all=[...new Set(ids.filter(Boolean))];
  for(const id of all){const other=state.tasks.find(t=>t.id===id&&!t.archivedAt);if(!other||other.projectId!==projectId||id===taskId)throw Error('Predecessors must be different jobs from this project');}
  const adjacency=id=>id===taskId?all:predecessorIds(state.tasks.find(t=>t.id===id)||{});
  for(const id of all){const seen=new Set();const check=node=>{if(node===taskId)throw Error('Circular predecessor dependency is not permitted');if(seen.has(node))return;seen.add(node);adjacency(node).forEach(check)};check(id);}
  return all;
}
export function saveTask(state,{id,projectId,sectionId,title,department,assignee,priority,due,start,status,parentId,blockedBy,predecessors}){
  if(!state.projects.some(p=>p.id===projectId&&!p.archivedAt))throw Error('Project unavailable');
  if(!state.sections.some(s=>s.id===sectionId&&s.projectId===projectId&&!s.archivedAt))throw Error('Invalid section for project');
  const name=requireText(title,'Job title');
  if(!['Office','Workshop','Purchasing','Quality'].includes(department))throw Error('Invalid department');
  if(!['Normal','High','Critical'].includes(priority))throw Error('Invalid priority');
  const current=id?state.tasks.find(t=>t.id===id&&!t.archivedAt):null;
  if(id&&!current)throw Error('Job unavailable');
  if(id&&current.projectId!==projectId)throw Error('Cannot move a job to another project');
  const parent=parentId?state.tasks.find(t=>t.id===parentId&&!t.archivedAt):null;
  if(parentId&&(!parent||parent.projectId!==projectId||parent.sectionId!==sectionId||parent.id===id))throw Error('Parent job must belong to this section');
  if(current && sectionId!==current.sectionId&&state.tasks.some(c=>!c.archivedAt&&c.parentId===id))throw Error('Move child jobs before moving this parent');
  let cursor=parent;const ancestors=new Set(id?[id]:[]);
  while(cursor){if(ancestors.has(cursor.id))throw Error('Circular work breakdown is not permitted');ancestors.add(cursor.id);cursor=state.tasks.find(t=>t.id===cursor.parentId&&!t.archivedAt)}
  const startDate=start===undefined?(current?.start||''):String(start||'');
  const finishDate=String(due||'');verifyJobDates(startDate,finishDate);
  let requested=Array.isArray(predecessors)?predecessors.slice():blockedBy?[blockedBy]:[];
  // Backward compatible with V0.2 callers modifying blockedBy while spreading an existing record.
  if(Array.isArray(predecessors)&&blockedBy && current && blockedBy!==current.blockedBy)requested=[blockedBy,...requested];
  const dependencies=verifyPredecessors(state,projectId,id,requested);
  if(status==='Done' && dependencies.some(x=>state.tasks.find(t=>t.id===x)?.status!=='Done'))throw Error('Complete predecessor job first');
  const fields={sectionId,title:name,department,assignee:String(assignee||'Unassigned'),priority,due:finishDate,start:startDate,status:status||current?.status||'Backlog',parentId:parentId||null,predecessors:dependencies,blockedBy:dependencies[0]||null};
  if(current){Object.assign(current,fields);logChange(state,'Job updated',name);return current;}
  const record={id:uid('t'),projectId,...fields};state.tasks.push(record);logChange(state,'Job created',name);return record;
}
export function setTaskStatus(state,id,status){
  const t=state.tasks.find(t=>t.id===id&&!t.archivedAt);if(!t)throw Error('Job unavailable');
  if(!['Backlog','Ready','In progress','Blocked','Inspection','Done','Cancelled'].includes(status))throw Error('Invalid job status');
  if(['Ready','In progress','Inspection','Done'].includes(status)){
    const waiting=predecessorIds(t).filter(x=>state.tasks.find(d=>d.id===x&&!d.archivedAt)?.status!=='Done');
    if(waiting.length)throw Error('Complete predecessor job first');
  }
  t.status=status;logChange(state,'Job status updated',`${t.title} → ${status}`);return t;
}
export function updateTaskPlan(state,taskId,{start,due,predecessors}){
  const task=state.tasks.find(t=>t.id===taskId&&!t.archivedAt);if(!task)throw Error('Job unavailable');
  const draft={...task,start:start===undefined?task.start:start,due:due===undefined?task.due:due,predecessors:predecessors===undefined?predecessorIds(task):predecessors,blockedBy:null};
  return saveTask(state,draft);
}
export function captureBaseline(state,projectId,actor='Sim-Worx Project Manager'){
  const project=state.projects.find(p=>p.id===projectId&&!p.archivedAt);if(!project)throw Error('Project unavailable');
  const jobs=state.tasks.filter(t=>t.projectId===projectId&&!t.archivedAt&&t.status!=='Cancelled'&&t.start&&t.due);
  if(!jobs.length)throw Error('Plan start and finish dates for at least one job first');
  project.baseline={capturedAt:new Date().toISOString(),capturedBy:actor,jobs:Object.fromEntries(jobs.map(t=>[t.id,{start:t.start,due:t.due}]))};
  logChange(state,'Schedule baseline captured',`${project.code} · ${jobs.length} planned jobs`);return project.baseline;
}
export function scheduleSummary(state,projectId,asOf=today()){
  const jobs=state.tasks.filter(t=>t.projectId===projectId&&!t.archivedAt&&t.status!=='Cancelled');
  const byId=new Map(jobs.map(t=>[t.id,t]));
  const project=state.projects.find(p=>p.id===projectId);const base=project?.baseline?.jobs||{};
  const lagDays=(newDate,oldDate)=>Math.round((Date.parse(newDate+'T12:00:00Z')-Date.parse(oldDate+'T12:00:00Z'))/86400000);
  const conflicts=[];
  jobs.forEach(t=>predecessorIds(t).forEach(id=>{const p=byId.get(id);if(p&&t.start&&p.due&&t.start<=p.due)conflicts.push({jobId:t.id,predecessorId:id,job:t.title,predecessor:p.title});}));
  const slipped=jobs.filter(t=>base[t.id]?.due&&t.due&&t.due>base[t.id].due);
  const unscheduled=jobs.filter(t=>!t.start||!t.due);
  const overdue=jobs.filter(t=>t.due&&t.due<asOf&&t.status!=='Done');
  return {total:jobs.length,planned:jobs.length-unscheduled.length,unscheduled,overdue,conflicts,slipped,baselineAt:project?.baseline?.capturedAt||null,lagDays};
}
export function materialReadiness(state,projectId){
  return state.bom.filter(b=>b.projectId===projectId&&!b.archivedAt).map(b=>{
    const part=state.parts.find(p=>p.id===b.partId);
    const outstanding=Math.max(0,Number(b.required||0)-Number(b.issued||0)-Number(b.reserved||0));
    const freeStock=part?Math.max(0,availableStock(part)):0;
    const incoming=state.orders.filter(o=>o.projectId===projectId&&!o.archivedAt).reduce((sum,o)=>sum+o.items.filter(i=>i.partId===b.partId).reduce((s,i)=>s+lineOutstanding(i),0),0);
    return {...b,part,quantityOutstanding:outstanding,freeStock,incoming,estimatedGap:Math.max(0,outstanding-freeStock-incoming)};
  });
}
export function savePart(state,{id,code,name,unit,supplier,location,min,cost}){
  const c=requireText(code,'Part number').toUpperCase(),n=requireText(name,'Part name');
  if(state.parts.some(p=>p.id!==id&&p.code.toUpperCase()===c))throw Error('Part number already exists');
  const reorder=requireAmount(min,'Minimum stock'),price=requireAmount(cost,'Reference cost');
  if(!Number.isInteger(reorder))throw Error('Minimum stock must be a whole number');
  const base={code:c,name:n,unit:requireText(unit,'Unit'),supplier:String(supplier||''),location:String(location||''),min:reorder,cost:price};
  if(id){const p=state.parts.find(p=>p.id===id&&!p.archivedAt);if(!p)throw Error('Part unavailable');Object.assign(p,base);logChange(state,'Part updated',c);return p;}
  const p={id:uid('part'),...base,onHand:0,reserved:0};state.parts.push(p);logChange(state,'Part created',c);return p;
}
export function saveBomLine(state,{id,projectId,partId,required,sectionId}){
  if(!state.projects.some(p=>p.id===projectId&&!p.archivedAt))throw Error('Project unavailable');
  if(!state.parts.some(p=>p.id===partId&&!p.archivedAt))throw Error('Part unavailable');
  if(sectionId&&!state.sections.some(s=>s.id===sectionId&&!s.archivedAt&&s.projectId===projectId))throw Error('Assembly section must belong to this project');
  const q=Number(required);if(!Number.isInteger(q)||q<1)throw Error('Required quantity must be a positive whole number');
  if(state.bom.some(b=>!b.archivedAt&&b.id!==id&&b.projectId===projectId&&b.partId===partId))throw Error('This part is already in the project BOM');
  if(id){const b=state.bom.find(b=>b.id===id&&!b.archivedAt&&b.projectId===projectId);if(!b)throw Error('BOM line unavailable');if(b.partId!==partId)throw Error('Change the quantity or archive this line and add another part');if(q<Number(b.issued||0)+Number(b.reserved||0))throw Error('Cannot reduce below issued and reserved quantity');b.required=q;b.sectionId=sectionId===undefined?b.sectionId:(sectionId||null);logChange(state,'BOM quantity updated',`${projectId}: ${partId} × ${q}`);return b;}
  const b={id:uid('bom'),projectId,partId,sectionId:sectionId||null,required:q,reserved:0,issued:0};state.bom.push(b);logChange(state,'BOM part added',`${projectId}: ${partId} × ${q}`);return b;
}
export function archiveRecord(state,kind,id){
  const whitelist=['organizations','projects','sections','tasks','parts','bom','documents','members','updates','orders'];
  if(!whitelist.includes(kind))throw Error('Archiving not available for this record');
  const row=state[kind].find(x=>x.id===id&&!x.archivedAt);if(!row)throw Error('Record unavailable');
  if(kind==='organizations'&&state.projects.some(p=>p.orgId===id&&!p.archivedAt))throw Error('Archive customer projects before archiving the customer');
  if(kind==='sections'&&state.tasks.some(t=>t.sectionId===id&&!t.archivedAt))throw Error('Archive jobs in this section first');
  if(kind==='parts'&&(row.onHand!==0||row.reserved!==0||state.bom.some(b=>b.partId===id&&!b.archivedAt)||state.orders.some(o=>!o.archivedAt&&o.items.some(l=>l.partId===id))))throw Error('Part still has stock or is referenced in purchasing/BOM');
  if(kind==='bom'&&(Number(row.issued)>0||Number(row.reserved)>0))throw Error('Cannot archive an issued or reserved BOM line');
  if(kind==='orders'&&row.items.some(l=>Number(l.received)>0))throw Error('Cannot archive an order with received stock');
  if(kind==='tasks'&&state.tasks.some(t=>!t.archivedAt&&(t.parentId===id||predecessorIds(t).includes(id))))throw Error('Archive or unlink dependent jobs first');
  if(kind==='updates'&&row.status==='published')throw Error('Published updates require a withdrawal, not deletion');
  row.archivedAt=new Date().toISOString();logChange(state,'Record archived',`${kind}: ${row.title||row.name||row.code||id}`);return row;
}
export function restoreRecord(state,kind,id){
  const row=state[kind]?.find(x=>x.id===id&&x.archivedAt);if(!row)throw Error('Archived record unavailable');
  if(kind==='projects'&&!state.organizations.some(o=>o.id===row.orgId&&!o.archivedAt))throw Error('Restore parent customer first');
  if(['sections','tasks','bom','documents','orders','updates'].includes(kind)&&!state.projects.some(p=>p.id===row.projectId&&!p.archivedAt))throw Error('Restore the parent project first');
  if(kind==='tasks'&&!state.sections.some(s=>s.id===row.sectionId&&!s.archivedAt))throw Error('Restore the parent section first');
  if(kind==='bom'&&!state.parts.some(p=>p.id===row.partId&&!p.archivedAt))throw Error('Restore the part first');
  if(kind==='members'&&!state.organizations.some(o=>o.id===row.orgId&&!o.archivedAt))throw Error('Restore customer first');
  delete row.archivedAt;logChange(state,'Record restored',`${kind}: ${row.title||row.name||row.code||id}`);return row;
}
