/* V0.4 manufacturing domain. Browser-local simulation, NOT a security or stock transaction boundary.
   E-BOM occurrences stay editable; releasing a revision stores an independent M-BOM snapshot. */
const id = p => `${p}-${Math.random().toString(36).slice(2,10)}`;
const stamp = () => new Date().toISOString();
const live = x => x && !x.archivedAt;
const qty = (value,label='Quantity') => {
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1)throw Error(`${label} must be a positive whole number`);
  return n;
};
const required = (value,label) => {const s=String(value??'').trim();if(!s)throw Error(`${label} is required`);return s;};
const log = (s,action,detail) => {s.audit??=[];s.audit.unshift({id:id('audit'),actor:'Sim-Worx Demo',action,detail,at:stamp()});};
const copy = v => JSON.parse(JSON.stringify(v));
export const activeAssemblies = (s,projectId) => (s.assemblies||[]).filter(a=>live(a)&&(!projectId||a.projectId===projectId));
export const activeBOM = (s,assemblyId) => (s.assemblyBOM||[]).filter(x=>live(x)&&(!assemblyId||x.assemblyId===assemblyId));
export function ensureManufacturing(s){
  s.assemblies??=[];s.assemblyBOM??=[];s.drawingRevisions??=[];s.engineeringChanges??=[];s.jobAssemblyLinks??=[];
  if(s.manufacturingMigrationVersion===1)return s;
  // Deterministic, idempotent migration of each V0.3 section and its BOM requirements.
  for(const section of s.sections||[]){
    if(!live(section)||!s.projects?.some(p=>live(p)&&p.id===section.projectId))continue;
    const assemblyId=`asm-v03-${section.id}`;
    if(!s.assemblies.some(a=>a.id===assemblyId))s.assemblies.push({id:assemblyId,projectId:section.projectId,sectionId:section.id,parentId:null,name:section.name,code:section.name.toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28),perParentQty:1,buildQty:1,status:'Design',owner:'Unassigned',notes:'Imported V0.3 work section'});
  }
  for(const b of s.bom||[]){
    if(!live(b))continue;
    const target=s.assemblies.find(a=>live(a)&&a.projectId===b.projectId&&a.sectionId===b.sectionId)||s.assemblies.find(a=>live(a)&&a.projectId===b.projectId);
    if(!target||!s.parts?.some(p=>live(p)&&p.id===b.partId))continue;
    const occurrenceId=`occ-v03-${b.id}`;
    if(!s.assemblyBOM.some(x=>x.id===occurrenceId))s.assemblyBOM.push({id:occurrenceId,projectId:b.projectId,assemblyId:target.id,partId:b.partId,quantity:Math.max(1,Math.trunc(Number(b.required)||1)),position:'Legacy '+b.id,sourceBomId:b.id,notes:'V0.3 BOM import; separately editable E-BOM occurrence'});
  }
  // No automatic manufacturing release: historical document metadata is not an authenticated approval.
  s.manufacturingMigrationVersion=1;
  return s;
}
function getAssembly(s,assemblyId){const a=s.assemblies.find(x=>live(x)&&x.id===assemblyId);if(!a)throw Error('Assembly unavailable');return a;}
function checkParent(s,projectId,parentId,selfId){
 if(!parentId)return null;
 let p=getAssembly(s,parentId),visited=new Set();
 if(p.projectId!==projectId)throw Error('Parent assembly must belong to this project');
 while(p){if(p.id===selfId||visited.has(p.id))throw Error('Assembly cycle is not allowed');visited.add(p.id);p=p.parentId?getAssembly(s,p.parentId):null;}
 return parentId;
}
export function saveAssembly(s,form){ensureManufacturing(s);
 if(!s.projects.some(p=>live(p)&&p.id===form.projectId))throw Error('Project unavailable');
 const existing=form.id?getAssembly(s,form.id):null;
 if(existing&&existing.projectId!==form.projectId)throw Error('Cannot move an assembly between projects');
 const parentId=checkParent(s,form.projectId,form.parentId||null,existing?.id);
 const name=required(form.name,'Assembly name');const perParentQty=qty(form.perParentQty??1);const buildQty=qty(form.buildQty??1);
 const next={name,code:required(form.code,'Assembly code'),parentId,perParentQty,buildQty,owner:String(form.owner||'Unassigned'),status:form.status||'Design',notes:String(form.notes||'')};
 if(!['Design','Ready','In manufacture','Inspection','Complete','On hold'].includes(next.status))throw Error('Invalid assembly status');
 if(existing){Object.assign(existing,next);log(s,'Assembly edited',existing.name);return existing;}
 const created={id:id('asm'),projectId:form.projectId,sectionId:form.sectionId||null,...next};s.assemblies.push(created);log(s,'Assembly created',name);return created;
}
export function saveOccurrence(s,form){ensureManufacturing(s);
 const a=getAssembly(s,form.assemblyId),part=s.parts?.find(p=>live(p)&&p.id===form.partId);
 if(!part)throw Error('Part master unavailable');
 const existing=form.id?s.assemblyBOM.find(x=>live(x)&&x.id===form.id):null;
 if(existing&&existing.assemblyId!==a.id)throw Error('Cannot move an existing BOM line to another assembly');
 const next={partId:part.id,quantity:qty(form.quantity),position:String(form.position||'').trim(),notes:String(form.notes||''),makeBuy:form.makeBuy==='Make'?'Make':'Buy'};
 if(existing){Object.assign(existing,next);log(s,'E-BOM occurrence edited',a.name+' / '+part.code);return existing;}
 const row={id:id('occ'),projectId:a.projectId,assemblyId:a.id,...next};s.assemblyBOM.push(row);log(s,'E-BOM occurrence added',a.name+' / '+part.code);return row;
}
export function archiveManufacturing(s,kind,rowId,restore=false){ensureManufacturing(s);
 const table={assembly:'assemblies',occurrence:'assemblyBOM',change:'engineeringChanges'}[kind];if(!table)throw Error('Invalid record kind');
 const row=s[table].find(x=>x.id===rowId);if(!row)throw Error('Record unavailable');
 if(kind==='assembly'&&!restore&&s.assemblies.some(a=>live(a)&&a.parentId===row.id))throw Error('Archive child assemblies first');
 if(kind==='assembly'&&restore&&row.parentId&&!s.assemblies.some(a=>live(a)&&a.id===row.parentId))throw Error('Restore parent assembly first');
 if(restore){if(!row.archivedAt)throw Error('Already active');delete row.archivedAt;}else{if(row.archivedAt)throw Error('Already archived');row.archivedAt=stamp();}
 log(s,restore?'Manufacturing record restored':'Manufacturing record archived',`${kind} ${rowId}`);return row;
}
export function assemblyTree(s,projectId){ensureManufacturing(s);const assemblies=activeAssemblies(s,projectId);return assemblies.filter(a=>!a.parentId).map(a=>node(a,new Set()));function node(a,seen){if(seen.has(a.id))throw Error('Assembly cycle detected');const next=new Set([...seen,a.id]);return {...a,children:assemblies.filter(b=>b.parentId===a.id).map(b=>node(b,next))};}}
export function assemblyRollup(s,assemblyId){ensureManufacturing(s);const root=getAssembly(s,assemblyId),items=new Map(),nodes=[],seen=new Set();
 function walk(a,factor,depth){if(seen.has(a.id))throw Error('Assembly cycle detected');seen.add(a.id);
  const total=factor*(depth===0?a.buildQty:a.perParentQty);
  nodes.push({assemblyId:a.id,name:a.name,depth,multiplier:total,status:a.status});
  for(const occ of activeBOM(s,a.id)){const p=s.parts.find(p=>live(p)&&p.id===occ.partId);if(!p)continue;const row=items.get(p.id)||{partId:p.id,part:p,required:0,occurrences:0};row.required+=total*occ.quantity;row.occurrences++;items.set(p.id,row);}
  for(const child of activeAssemblies(s,a.projectId).filter(x=>x.parentId===a.id))walk(child,total,depth+1);
  seen.delete(a.id);
 }
 walk(root,1,0);
 const parts=[...items.values()].map(r=>({...r,available:Math.max(0,Number(r.part.onHand||0)-Number(r.part.reserved||0)),shortage:Math.max(0,r.required-Math.max(0,Number(r.part.onHand||0)-Number(r.part.reserved||0)))}));
 return {assembly:root,assemblies:nodes,parts,requiredTotal:parts.reduce((n,x)=>n+x.required,0),shortages:parts.filter(x=>x.shortage>0)};
}
export function createDrawingRevision(s,form){ensureManufacturing(s);const assembly=getAssembly(s,form.assemblyId);const code=required(form.revision,'Revision').toUpperCase();
 if(s.drawingRevisions.some(r=>live(r)&&r.assemblyId===assembly.id&&r.revision.toUpperCase()===code))throw Error('Revision already exists for this assembly');
 const row={id:id('rev'),projectId:assembly.projectId,assemblyId:assembly.id,revision:code,title:required(form.title,'Drawing title'),description:String(form.description||''),status:'Draft',createdAt:stamp(),owner:String(form.owner||'Engineering'),releasedSnapshot:null};
 s.drawingRevisions.push(row);assembly.pendingRevisionId=row.id;log(s,'New drawing revision drafted',assembly.name+' / '+code);return row;
}
export function updateDraftRevision(s,revisionId,patch){const r=s.drawingRevisions.find(x=>live(x)&&x.id===revisionId);if(!r)throw Error('Drawing revision unavailable');if(r.status!=='Draft')throw Error('Only draft revisions can be edited');
 r.title=required(patch.title??r.title,'Drawing title');r.description=String(patch.description??r.description);log(s,'Drawing draft edited',r.revision);return r;}
export function transitionRevision(s,revisionId,to,actor='Demo Engineering Lead'){
 ensureManufacturing(s);const r=s.drawingRevisions.find(x=>live(x)&&x.id===revisionId);if(!r)throw Error('Drawing revision unavailable');
 const edges={Draft:['In review','Withdrawn'],'In review':['Draft','Released','Withdrawn'],Released:['Superseded','Withdrawn'],Superseded:[],Withdrawn:[]};
 if(!edges[r.status]?.includes(to))throw Error(`Revision cannot transition ${r.status} → ${to}`);
 const a=getAssembly(s,r.assemblyId);
 if(to==='Released'){
  const previous=s.drawingRevisions.find(x=>x.id===a.releasedRevisionId&&x.status==='Released');
  if(previous){previous.status='Superseded';previous.supersededAt=stamp();}
  const rollup=assemblyRollup(s,a.id);
  r.releasedSnapshot=copy({assembly:{id:a.id,name:a.name,code:a.code},bomLines:activeBOM(s).filter(x=>rollup.assemblies.some(n=>n.assemblyId===x.assemblyId)),rollup:rollup.parts.map(p=>({partId:p.partId,required:p.required}))});
  r.releasedBy=actor;r.releasedAt=stamp();a.releasedRevisionId=r.id;if(a.pendingRevisionId===r.id)a.pendingRevisionId=null;
 }
 if(to==='Withdrawn'&&a.releasedRevisionId===r.id)a.releasedRevisionId=null;
 r.status=to;log(s,'Drawing revision state',`${a.name} ${r.revision} → ${to}`);return r;
}
export function saveEngineeringChange(s,form){ensureManufacturing(s);const assembly=getAssembly(s,form.assemblyId);const item=form.id?s.engineeringChanges.find(x=>live(x)&&x.id===form.id):null;
 const next={assemblyId:assembly.id,projectId:assembly.projectId,reason:required(form.reason,'Change reason'),owner:required(form.owner,'Change owner'),impact:String(form.impact||''),status:form.status||'Open'};
 if(!['Open','Assessing','Approved','Rejected','Closed'].includes(next.status))throw Error('Invalid change state');
 if(item){Object.assign(item,next);log(s,'Engineering change edited',item.reason);return item;}
 const record={id:id('ecr'),...next,createdAt:stamp()};s.engineeringChanges.push(record);log(s,'Engineering change raised',next.reason);return record;
}
export function linkAssemblyJob(s,{taskId,assemblyId,revisionId}){ensureManufacturing(s);const assembly=getAssembly(s,assemblyId),task=s.tasks.find(x=>live(x)&&x.id===taskId);
 if(!task||task.projectId!==assembly.projectId)throw Error('Job must belong to the same project');
 if(revisionId&&!s.drawingRevisions.some(r=>r.id===revisionId&&r.assemblyId===assembly.id))throw Error('Drawing revision does not belong to this assembly');
 const existing=s.jobAssemblyLinks.find(x=>x.taskId===taskId);
 if(existing){existing.assemblyId=assemblyId;existing.revisionId=revisionId||null;}else s.jobAssemblyLinks.push({id:id('jlink'),taskId,assemblyId,revisionId:revisionId||null});
 log(s,'Job linked to assembly',task.title+' / '+assembly.name);return existing||s.jobAssemblyLinks.at(-1);
}
export function jobManufacturingReadiness(s,taskId){ensureManufacturing(s);const link=s.jobAssemblyLinks.find(x=>x.taskId===taskId),task=s.tasks.find(x=>x.id===taskId);
 if(!link||!task)return null;const assembly=getAssembly(s,link.assemblyId),rollup=assemblyRollup(s,assembly.id),blockers=[],warnings=[];
 const released=s.drawingRevisions.find(r=>r.id===assembly.releasedRevisionId&&r.status==='Released');
 if(!released)blockers.push('No released drawing: submit a revision for review, then release it');
 if(link.revisionId&&link.revisionId!==released?.id)blockers.push('Linked work instruction is superseded or not released: reassign the current released revision');
 if(!link.revisionId&&released)warnings.push('Link this job to the released revision for traceability');
 const pending=s.drawingRevisions.find(r=>r.id===assembly.pendingRevisionId&&['Draft','In review'].includes(r.status));
 if(pending)warnings.push(`Pending drawing ${pending.revision} requires review; it has NOT replaced the released revision`);
 for(const part of rollup.shortages)blockers.push(`${part.part.code}: ${part.shortage} ${part.part.unit} short (${part.required} required; ${part.available} available)`);
 return {taskId,assemblyId:assembly.id,revisionId:released?.id||null,ready:blockers.length===0,blockers,warnings,rollup};
}
export function projectManufacturingAlerts(s,projectId){ensureManufacturing(s);return s.jobAssemblyLinks.filter(l=>s.tasks.some(t=>live(t)&&t.projectId===projectId&&t.id===l.taskId)).map(l=>jobManufacturingReadiness(s,l.taskId)).filter(Boolean).filter(x=>!x.ready||x.warnings.length);
}
