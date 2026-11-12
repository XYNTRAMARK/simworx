/* Sim-Worx Project Hub. Pure domain functions for the local demonstration.
   This is not a security boundary: production requires server-side permission checks and RLS. */
export const uid = (prefix = 'id') => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const money = n => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0));
export const number = n => new Intl.NumberFormat('en-GB').format(Number(n || 0));
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const taskProgress = (projectId, tasks) => {
  const list = tasks.filter(t => t.projectId === projectId && t.status !== 'Cancelled');
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
  const organization=state.organizations.find(o=>o.id===orgId);
  if(!organization)return null;
  const accessibleProjects=state.projects.filter(p=>p.orgId===orgId && (!memberId || state.members.some(m=>m.id===memberId&&m.orgId===orgId&&m.projects.includes(p.id))));
  const project=accessibleProjects.find(p=>p.id===projectId)||accessibleProjects[0];
  if(!project)return {organization,projects:accessibleProjects,project:null,updates:[],approvals:[],documents:[],messages:[],members:[]};
  // Explicit allowlist: no internal cost, task, supplier, PO or stock fields escape this function.
  return {
    organization:{id:organization.id,name:organization.name,accent:organization.accent,logo:organization.logo},
    projects:accessibleProjects.map(p=>({id:p.id,name:p.name,code:p.code})),
    project:{id:project.id,name:project.name,code:project.code,description:project.publicDescription||project.description,delivery:project.due,publishedProgress:project.publishedProgress,phase:project.phase},
    updates:state.updates.filter(u=>u.projectId===project.id&&u.status==='published').map(u=>({id:u.id,title:u.title,description:u.description,kind:u.kind,part:u.part,status:u.status,publishedAt:u.publishedAt||u.date})),
    approvals:state.approvals.filter(a=>a.projectId===project.id&&a.shared).map(a=>({id:a.id,title:a.title,kind:a.kind,revision:a.revision,status:a.status,due:a.due,requested:a.requested})),
    documents:state.documents.filter(d=>d.projectId===project.id&&d.visibility==='customer').map(d=>({id:d.id,title:d.title,rev:d.rev,type:d.type,date:d.date})),
    messages:state.messages.filter(m=>m.projectId===project.id&&m.visibility==='customer').map(m=>({id:m.id,author:m.author,text:m.text,at:m.at})),
    members:state.members.filter(m=>m.orgId===orgId && m.projects.includes(project.id)).map(m=>({id:m.id,name:m.name,role:m.role,email:m.email}))
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