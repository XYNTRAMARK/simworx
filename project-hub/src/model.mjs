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
export function saveTask(state,{id,projectId,sectionId,title,department,assignee,priority,due,status,parentId,blockedBy}){
  if(!state.projects.some(p=>p.id===projectId&&!p.archivedAt))throw Error('Project unavailable');
  if(!state.sections.some(s=>s.id===sectionId&&s.projectId===projectId&&!s.archivedAt))throw Error('Invalid section for project');
  const name=requireText(title,'Job title');
  if(!['Office','Workshop','Purchasing','Quality'].includes(department))throw Error('Invalid department');
  if(!['Normal','High','Critical'].includes(priority))throw Error('Invalid priority');
  const parent=parentId?state.tasks.find(t=>t.id===parentId&&!t.archivedAt):null;
  const dependency=blockedBy?state.tasks.find(t=>t.id===blockedBy&&!t.archivedAt):null;
  if(parentId&&(!parent||parent.projectId!==projectId||parent.sectionId!==sectionId||parent.id===id))throw Error('Parent job must belong to this section');
  if(blockedBy&&(!dependency||dependency.projectId!==projectId||dependency.id===id))throw Error('Predecessor must be another job in this project');
  if(id){const t=state.tasks.find(t=>t.id===id&&!t.archivedAt);if(!t)throw Error('Job unavailable');
    if(sectionId!==t.sectionId && state.tasks.some(child=>!child.archivedAt&&child.parentId===id))throw Error('Move child jobs before moving this parent');
    // Prevent a task becoming an ancestor of itself.
    let cursor=parent;const seen=new Set([id]);while(cursor){if(seen.has(cursor.id))throw Error('Circular work breakdown is not permitted');seen.add(cursor.id);cursor=state.tasks.find(x=>x.id===cursor.parentId&&!x.archivedAt)}
    if(status==='Done'&&dependency&&dependency.status!=='Done')throw Error('Predecessor is not completed');
    let depCursor=dependency;const dependencySeen=new Set([id]);while(depCursor){if(dependencySeen.has(depCursor.id))throw Error('Circular predecessor dependency is not permitted');dependencySeen.add(depCursor.id);depCursor=state.tasks.find(x=>x.id===depCursor.blockedBy&&!x.archivedAt)}
    Object.assign(t,{sectionId,title:name,department,assignee:String(assignee||'Unassigned'),priority,due:String(due||''),status:status||t.status,parentId:parentId||null,blockedBy:blockedBy||null});
    logChange(state,'Job updated',name);return t;
  }
  const t={id:uid('t'),projectId,sectionId,title:name,department,assignee:String(assignee||'Unassigned'),priority,due:String(due||''),status:status||'Backlog',parentId:parentId||null,blockedBy:blockedBy||null};
  state.tasks.push(t);logChange(state,'Job created',name);return t;
}
export function setTaskStatus(state,id,status){
  const t=state.tasks.find(t=>t.id===id&&!t.archivedAt);if(!t)throw Error('Job unavailable');
  if(!['Backlog','Ready','In progress','Blocked','Inspection','Done','Cancelled'].includes(status))throw Error('Invalid job status');
  if(['Ready','In progress','Inspection','Done'].includes(status)&&t.blockedBy){const dep=state.tasks.find(x=>x.id===t.blockedBy);if(!dep||dep.archivedAt||dep.status!=='Done')throw Error('Complete predecessor job first');}
  t.status=status;logChange(state,'Job status updated',`${t.title} → ${status}`);return t;
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
export function saveBomLine(state,{id,projectId,partId,required}){
  if(!state.projects.some(p=>p.id===projectId&&!p.archivedAt))throw Error('Project unavailable');
  if(!state.parts.some(p=>p.id===partId&&!p.archivedAt))throw Error('Part unavailable');
  const q=Number(required);if(!Number.isInteger(q)||q<1)throw Error('Required quantity must be a positive whole number');
  if(state.bom.some(b=>!b.archivedAt&&b.id!==id&&b.projectId===projectId&&b.partId===partId))throw Error('This part is already in the project BOM');
  if(id){const b=state.bom.find(b=>b.id===id&&!b.archivedAt&&b.projectId===projectId);if(!b)throw Error('BOM line unavailable');if(b.partId!==partId)throw Error('Change the quantity or archive this line and add another part');if(q<Number(b.issued||0)+Number(b.reserved||0))throw Error('Cannot reduce below issued and reserved quantity');b.required=q;logChange(state,'BOM quantity updated',`${projectId}: ${partId} × ${q}`);return b;}
  const b={id:uid('bom'),projectId,partId,required:q,reserved:0,issued:0};state.bom.push(b);logChange(state,'BOM part added',`${projectId}: ${partId} × ${q}`);return b;
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
  if(kind==='tasks'&&state.tasks.some(t=>!t.archivedAt&&(t.parentId===id||t.blockedBy===id)))throw Error('Archive or unlink dependent jobs first');
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