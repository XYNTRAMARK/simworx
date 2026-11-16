/* V0.4.3: project-owned manual progress, with explicit weights and completion.
   Not inferred from job counts, dates, or customer publication. Local demo only. */
const id=()=> 'step-'+Math.random().toString(36).slice(2,11);
const validProject=(s,pid)=>{if(!s.projects?.some(p=>p.id===pid&&!p.archivedAt))throw Error('Active project not found');};
const basis=(value,label)=>{
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||n>100)throw Error(label+' must be between 0 and 100');
 const bp=Math.round(n*100);
 if(Math.abs(n*100-bp)>0.00000001)throw Error(label+' supports up to two decimal places');
 return bp;
};
const name=str=>{const v=String(str||'').trim();if(!v||v.length>140)throw Error('Progress step title must be 1–140 characters');return v;};
const now=()=>new Date().toISOString();
export function ensureProgress(s){
 if(!Array.isArray(s.projectProgressSteps))s.projectProgressSteps=[];
 s.progressSchemaVersion=1;
 return s;
}
export function projectSteps(s,projectId){
 ensureProgress(s);
 return s.projectProgressSteps.filter(x=>x.projectId===projectId&&!x.archivedAt)
  .sort((a,b)=>(a.order||0)-(b.order||0)||a.id.localeCompare(b.id));
}
export function progressSnapshot(s,projectId){
 validProject(s,projectId);
 const steps=projectSteps(s,projectId);
 const totalBasis=steps.reduce((n,x)=>n+x.weightBp,0);
 const earnedBasis=Math.round(steps.reduce((n,x)=>n+x.weightBp*x.doneBp,0)/10000);
 return {projectId,configured:steps.length>0,count:steps.length,
   weightTotal:totalBasis/100,unassigned:Math.max(0,10000-totalBasis)/100,
   earned:earnedBasis/100,
   completed:steps.filter(x=>x.doneBp===10000).length,
   partial:steps.filter(x=>x.doneBp>0&&x.doneBp<10000).length,
   outstanding:steps.length-steps.filter(x=>x.doneBp===10000).length,
   fullyWeighted:totalBasis===10000};
}
export function saveProgressStep(s,{projectId,id:existingId,title,weight,completion}){
 ensureProgress(s);validProject(s,projectId);
 const existing=existingId?s.projectProgressSteps.find(x=>x.id===existingId&&!x.archivedAt):null;
 if(existingId&&!existing)throw Error('Progress step not found');
 if(existing&&existing.projectId!==projectId)throw Error('Progress step belongs to another project');
 if(!existing&&projectSteps(s,projectId).length>=1000)throw Error('Maximum 1,000 active progress steps per project');
 const w=basis(weight,'Weight'),done=basis(completion,'Completion'),label=name(title);
 const oldWeight=existing?.weightBp||0;
 const allocation=projectSteps(s,projectId).reduce((n,x)=>n+x.weightBp,0)-oldWeight+w;
 if(allocation>10000)throw Error('Assigned progress weights exceed 100%; reduce another step first');
 if(existing){Object.assign(existing,{title:label,weightBp:w,doneBp:done,updatedAt:now()});return existing;}
 const current=projectSteps(s,projectId);
 const row={id:id(),projectId,title:label,weightBp:w,doneBp:done,
  order:(current.at(-1)?.order||0)+1,createdAt:now()};
 s.projectProgressSteps.push(row);
 return row;
}
export function archiveProgressStep(s,{projectId,stepId,restore=false}){
 ensureProgress(s);validProject(s,projectId);
 const row=s.projectProgressSteps.find(x=>x.projectId===projectId&&x.id===stepId);
 if(!row)throw Error('Progress step not found');
 if(restore){
   if(!row.archivedAt)throw Error('Progress step is already active');
   if(projectSteps(s,projectId).length>=1000)throw Error('Maximum 1,000 active progress steps');
   const total=projectSteps(s,projectId).reduce((v,x)=>v+x.weightBp,0);
   if(total+row.weightBp>10000)throw Error('Restoration would exceed 100% weighting');
   delete row.archivedAt;
 }else{
   if(row.archivedAt)throw Error('Already removed');
   row.archivedAt=now();
 }
 return row;
}
export function generateProgressSteps(s,{projectId,count,prefix='Step'}){
 ensureProgress(s);validProject(s,projectId);
 const n=Number(count),existing=projectSteps(s,projectId).length;
 if(!Number.isSafeInteger(n)||n<1||n>1000||existing+n>1000)throw Error('Choose a number of steps that keeps the project at 1,000 or fewer');
 const label=name(prefix);
 const last=projectSteps(s,projectId).at(-1)?.order||0;
 const stamp=now();
 const created=Array.from({length:n},(_,i)=>({id:id(),projectId,title:label+' '+(existing+i+1),
  weightBp:0,doneBp:0,order:last+i+1,createdAt:stamp}));
 s.projectProgressSteps.push(...created);
 return created;
}
export function importProgressSteps(s,{projectId,lines}){
 ensureProgress(s);validProject(s,projectId);
 const list=String(lines||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!list.length||list.length+projectSteps(s,projectId).length>1000)throw Error('Import must contain 1–1,000 steps within the project limit');
 // title | weight % | completion %, title|weight and title-only lines also accepted.
 const parsed=list.map(line=>{
   const a=line.split('|').map(x=>x.trim());
   if(a.length>3)throw Error('Use: Step title | weight % | completion %');
   return {title:name(a[0]),weightBp:basis(a[1]||0,'Weight'),doneBp:basis(a[2]||0,'Completion')};
 });
 const current=projectSteps(s,projectId),total=current.reduce((n,x)=>n+x.weightBp,0)+parsed.reduce((n,x)=>n+x.weightBp,0);
 if(total>10000)throw Error('Imported step weights exceed 100% with existing steps');
 const order=current.at(-1)?.order||0;
 const added=parsed.map((x,i)=>({id:id(),projectId,title:x.title,weightBp:x.weightBp,doneBp:x.doneBp,
   order:order+i+1,createdAt:now()}));
 s.projectProgressSteps.push(...added);
 return added;
}
export function distributeProgressWeights(s,projectId){
 const steps=projectSteps(s,projectId);
 if(!steps.length)throw Error('Add at least one progress step first');
 const each=Math.floor(10000/steps.length),remainder=10000-each*steps.length;
 steps.forEach((x,i)=>{x.weightBp=each+(i<remainder?1:0);x.updatedAt=now();});
 return progressSnapshot(s,projectId);
}
export function updateStepCompletion(s,{projectId,stepId,completion}){
 const step=projectSteps(s,projectId).find(x=>x.id===stepId);
 if(!step)throw Error('Progress step not found');
 step.doneBp=basis(completion,'Completion');step.updatedAt=now();
 return step;
}
