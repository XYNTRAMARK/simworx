/* V0.5.0 work plan editor: build jobs first; source the same material records in Purchasing.
   Pure rendering. Forms invoke workplan domain functions through the owner event controller. */
import {jobRequirements,workHierarchy,flaggedUnspecifiedPurchases,materialKinds,deptOptions} from './workplan-v050.mjs';
import {procurementState} from './procurement-workflow-v047.mjs';
import {renderJobEvidence,helpTip,helpTopics} from './work-evidence-ui-v051.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'" :'&#39;'}[c]));
const live=x=>x&&!x.archivedAt;
const opt=(choices,selected)=>choices.map(([v,t])=>'<option value="'+esc(v)+'" '+(String(v)===String(selected)?'selected':'')+'>'+esc(t)+'</option>').join('');
const inp=(label,name,value='',attrs='')=>'<label class="v50-field"><span>'+esc(label)+(label.includes('title')?helpTip(helpTopics.job):label.includes('Assigned')?helpTip(helpTopics.owner):label.includes('date')?helpTip(helpTopics.dates):label.includes('quantity')?helpTip(helpTopics.requirement):'')+'</span><input name="'+esc(name)+'" value="'+esc(value)+'" '+attrs+'></label>';
const text=(label,name,value='',hint='')=>'<label class="v50-field v50-wide"><span>'+esc(label)+(label.includes('scope')?helpTip(helpTopics.description):label.includes('Technical')?helpTip(helpTopics.spec):label.includes('sourced')?helpTip(helpTopics.buyflag):'')+'</span><textarea name="'+esc(name)+'" rows="4" maxlength="4000" placeholder="'+esc(hint)+'">'+esc(value||'')+'</textarea></label>';
const select=(label,name,values,value)=>'<label class="v50-field"><span>'+esc(label)+'</span><select name="'+esc(name)+'">'+opt(values,value)+'</select></label>';
const button=(action,id,title,style='')=>'<button type="button" class="btn small '+style+'" data-action="'+esc(action)+'" data-id="'+esc(id)+'">'+esc(title)+'</button>';
const pill=(title,tone='')=>'<span class="v50-tag '+tone+'">'+esc(title)+'</span>';
const dept=values=>values.map(x=>[x,x]);
function editor(s,ui,projectId){
 const open=ui.v50JobEditor;if(!open||open.projectId!==projectId)return '';
 const existing=open.id?s.tasks.find(t=>live(t)&&t.id===open.id&&t.projectId===projectId):null;
 const sec=s.sections.find(x=>live(x)&&x.id===(existing?.sectionId||open.sectionId)&&x.projectId===projectId);
 if(!sec)return '<p class="v50-alert">Select or add a work package before adding jobs.</p>';
 const parent=existing?.parentId||open.parentId||'',other=s.tasks.filter(t=>live(t)&&t.projectId===projectId&&t.sectionId===sec.id&&t.id!==existing?.id);
 const ancestors=[];let cursor=parent?s.tasks.find(t=>t.id===parent):null;const seen=new Set();
 while(cursor&&!seen.has(cursor.id)){seen.add(cursor.id);ancestors.unshift(cursor.title);cursor=cursor.parentId?s.tasks.find(t=>t.id===cursor.parentId):null}
 const path=[sec.name,...ancestors].join(' → ');
 const parentSelector=existing?
   select('Move beneath (optional)','parentId',[['','Top-level job in this work package'],...other.map(t=>[t.id,t.title])],parent):
   '<input type="hidden" name="parentId" value="'+esc(parent)+'"><p class="v51-parent-lock">'+
   (parent?'CREATING CHILD UNDER: '+esc(path):'TOP-LEVEL JOB IN: '+esc(sec.name))+' '+helpTip(helpTopics.subjob)+'</p>';
 const form='<form class="v50-editor-form" data-form="v50-job">'+
 '<input type="hidden" name="projectId" value="'+esc(projectId)+'"><input type="hidden" name="recordId" value="'+esc(existing?.id||'')+'">'+
 '<input type="hidden" name="sectionId" value="'+esc(sec.id)+'">'+
 inp('Job / activity title','title',existing?.title||'','maxlength="220" required placeholder="e.g. Build avionics harness"')+
 parentSelector+
 text('Detailed scope / instructions','description',existing?.description||'','What needs to be made, checked, ordered, tested or delivered?')+
 select('Responsible department','department',dept(deptOptions),existing?.department||s.tasks.find(t=>t.id===parent)?.department||'Workshop')+
 inp('Person assigned (owner only assigns for now)','assignee',existing?.assignee||'Unassigned','maxlength="160" required')+
 select('Priority','priority',dept(['Normal','High','Critical']),existing?.priority||'Normal')+
 select('Status','status',dept(['Backlog','Ready','In progress','Blocked','Inspection','Done','Cancelled']),existing?.status||'Backlog')+
 inp('Start date (optional)','start',existing?.start||'','type="date"')+
 inp('Finish date (optional)','due',existing?.due||'','type="date"')+
 '<label class="v50-checkbox v50-wide"><input type="checkbox" name="needsPurchasing" '+(existing?.needsPurchasing?'checked':'')+'><span>Purchasing action required for this job '+helpTip(helpTopics.buyflag)+'</span></label>'+
 text('What needs to be sourced? (planning instructions)','purchaseNeedNotes',existing?.purchaseNeedNotes||'',
  'e.g. select an exact G1000 unit after confirming the approved technical specification')+
 '<p class="v50-info v50-wide">Flagging a job creates a purchasing action, not a supplier order. Add exact material lines after saving to transfer quantities and specifications to Purchasing & Materials.</p>'+
 '<div class="v50-form-actions v50-wide"><button class="btn primary" type="submit">'+(existing?'Save changes':'Create job / sub-job')+'</button>'+
 button('v50-close-job','','Cancel')+'</div></form>';
 return '<section id="v50-job-editor" class="v50-panel v50-edit-panel"><div class="v50-panel-title"><div><small>WORK PACKAGE: '+esc(sec.name)+'</small>'+
 '<h3>'+(existing?'Edit job':parent?'New child of '+esc(ancestors.at(-1)||'parent job'):'New top-level job')+'</h3><p class="v51-editor-breadcrumb">'+esc(path)+'</p></div>'+button('v50-close-job','','Close')+'</div>'+form+'</section>';
}
function materialEditor(s,ui,task){
 const selected=ui.v50MaterialEditor;
 if(!selected||selected.taskId!==task.id)return '';
 const occ=selected.id?s.assemblyBOM.find(o=>live(o)&&o.id===selected.id&&o.projectId===task.projectId):null;
 const part=occ?s.parts.find(p=>p.id===occ.partId):null;
 if(occ&&!occ.workplanCreated)return '<p class="v50-info">Imported contract requirements are controlled in the engineering or purchasing screen; their source cannot be overwritten here.</p>';
 const form='<form data-form="v50-material" class="v50-editor-form">'+
 '<input type="hidden" name="projectId" value="'+esc(task.projectId)+'"><input type="hidden" name="taskId" value="'+esc(task.id)+'"><input type="hidden" name="recordId" value="'+esc(occ?.id||'')+'">'+
 inp('Item / component description','name',part?.name||'','maxlength="220" required placeholder="Exact equipment or material to source"')+
 inp('Internal part identifier (optional)','code',part?.code||'','maxlength="100" placeholder="Leave blank to generate an INTERNAL code"')+
 inp('Required quantity (whole numbers)','quantity',occ?.quantity||1,'type="number" min="1" step="1" required')+
 inp('Unit of measure','unit',part?.unit||'ea','maxlength="24" required placeholder="ea, m, kg"')+
 select('Responsibility / action','kind',materialKinds,occ?.workplanKind||selected.kind||'buy')+
 text('Technical description and exact requirements','specification',occ?.notes||part?.notes||'','Dimensions, tolerances, capacity, manufacturer constraints, interfaces, drawing revision…')+
 '<p class="v50-info v50-wide">This adds ONE linked engineering requirement to your project. It remains a draft until controlled scope, technical match, supplier evidence, budget and owner authorization are verified. No PO, quote, supplier price or goods receipt is created.</p>'+
 '<div class="v50-form-actions v50-wide"><button type="submit" class="btn primary">'+(occ?'Save requirement revision':'Add requirement to project')+'</button>'+
 button('v50-close-material','','Cancel')+'</div></form>';
 return '<div class="v50-material-form">'+form+'</div>';
}
function taskDetails(s,ui,projectId){
 const task=s.tasks.find(t=>live(t)&&t.id===ui.v50SelectedTask&&t.projectId===projectId);
 if(!task)return '';
 const section=s.sections.find(x=>x.id===task.sectionId),rows=jobRequirements(s,task.id);
 const eligible=(s.assemblyBOM||[]).filter(o=>live(o)&&o.projectId===projectId&&!o.linkedTaskId);
 return '<section id="v50-job-details" class="v50-panel"><div class="v50-panel-title"><div><small>JOB DETAIL · '+esc(section?.name||'')+'</small><h3>'+esc(task.title)+'</h3></div>'+
 '<div class="v50-actions">'+button('v50-edit-job',task.id,'Edit job')+button('v50-add-child',task.id,'+ Child job')+button('v50-material-add',task.id,'+ Add material / buying item','primary')+button('v50-archive-job',task.id,'Archive job','danger')+button('v50-clear-selection','','Close')+'</div></div>'+
 (task.description?'<p class="v50-job-copy">'+esc(task.description)+'</p>':'<p class="v50-info">No detailed instructions yet. Select Edit job to type them in.</p>')+
 '<div class="v50-summary-line">'+pill(task.department||'Unassigned')+pill(task.assignee||'Unassigned')+pill(task.status||'Backlog')+
 (task.needsPurchasing?pill('Purchasing required','warn'):'')+'</div>'+
 (task.needsPurchasing&&task.purchaseNeedNotes?'<p class="v50-job-copy"><b>Purchasing instructions:</b> '+esc(task.purchaseNeedNotes)+'</p>':'')+
 '<div class="v50-divider"><h4>Materials, manufactured items & supplier responsibilities</h4>'+
 '<p>These items are linked to this job and appear in the purchasing workspace; they are not separate shopping lists.</p></div>'+
 (rows.length?'<div class="v50-material-table"><table class="v46-table"><thead><tr><th>Component / requirement</th><th>Qty</th><th>Type</th><th>Current status</th><th>Action</th></tr></thead><tbody>'+
 rows.map(o=>{const p=s.parts.find(p=>p.id===o.partId)||{},kind=materialKinds.find(k=>k[0]===o.workplanKind)?.[1]||o.makeBuy||'Unclassified';
 let status='Engineering draft';try{status=procurementState(s,o.id).status}catch{}
 return '<tr><td><b>'+esc(p.name||p.code||'Unknown part')+'</b><small>'+esc(p.code||'')+'</small><small>'+esc(o.notes||'Technical specification not entered')+'</small></td>'+
 '<td>'+esc(o.quantity)+' '+esc(p.unit||'ea')+'</td><td>'+esc(kind)+'</td><td>'+pill(status)+'</td><td><div class="v50-actions">'+
 button('v50-open-purchasing',o.id,'Purchasing / QA')+button('v51-evidence-material',o.id,'Photo / proof')+
 (o.workplanCreated?button('v50-edit-material',o.id,'Edit draft')+button('v50-archive-material',o.id,'Archive','danger'):'')+
 '</div></td></tr>'}).join('')+'</tbody></table></div>':
 '<p class="v50-alert">No materials linked yet. Use <b>+ Add material / buying item</b> to create a requirement that appears in Purchasing.</p>')+
 (eligible.length?'<form data-form="v50-link-existing" class="v50-attach-existing">'+
 '<input type="hidden" name="taskId" value="'+esc(task.id)+'"><input type="hidden" name="projectId" value="'+esc(projectId)+'">'+
 '<label>Or attach a contract/engineering requirement already on this project <select name="occurrenceId">'+
 opt(eligible.map(o=>{const p=s.parts.find(p=>p.id===o.partId)||{};return [o.id,(p.code||'Unknown')+' · '+(p.name||'Item')]}),'')+'</select></label>'+
 '<button type="submit" class="btn small">Link existing requirement (no duplicate)</button></form>':'')+
 materialEditor(s,ui,task)+renderJobEvidence(s,ui,task)+'</section>';
}
function sectionCreator(s,ui,projectId){
 if(!ui.v50NewSection&&!ui.v50EditSection)return '';
 const current=s.sections.find(x=>live(x)&&x.id===ui.v50EditSection&&x.projectId===projectId);
 return '<section class="v50-panel v50-edit-panel"><h3>'+(current?'Edit work package':'Add work package')+'</h3><form data-form="v50-section" class="v50-editor-form">'+
 '<input name="recordId" type="hidden" value="'+esc(current?.id||'')+'">'+
 '<input name="projectId" type="hidden" value="'+esc(projectId)+'">'+
 inp('Work package name','name',current?.name||'','required maxlength="160" placeholder="e.g. Avionics, Displays, Integration"')+
 inp('Progress weighting (%)','weight',current?.weight??'0','type="number" min="0" max="100" step="1" required')+
 '<div class="v50-form-actions v50-wide"><button type="submit" class="btn primary">'+(current?'Save work package':'Create work package')+'</button>'+button('v50-close-section','','Cancel')+'</div></form></section>';
}
export function renderWorkPlanV050(s,ui,projectId){
 const project=s.projects.find(x=>live(x)&&x.id===projectId);
 if(!project)return '<p>Choose an active project first.</p>';
 const jobs=(s.tasks||[]).filter(t=>live(t)&&t.projectId===projectId),sections=(s.sections||[]).filter(x=>live(x)&&x.projectId===projectId);
 const flag=flaggedUnspecifiedPurchases(s,projectId);
 const query=String(ui.v50Search||'').trim().toLowerCase();
 const status=ui.v50Status||'All';
 const groups=sections.map((sec,si)=>{
  const hierarchy=workHierarchy(s,projectId,sec.id);
  const inline=ui.v50JobEditor?.projectId===projectId&&ui.v50JobEditor.sectionId===sec.id?ui.v50JobEditor:null;
  const included=hierarchy.filter(({task})=>(status==='All'||task.status===status)&&(!query||[task.title,task.description,task.department,task.assignee,task.purchaseNeedNotes].some(x=>String(x||'').toLowerCase().includes(query))));
  return '<section class="v50-work-package"><div class="v50-work-package-head" style="--work-accent:var(--violet)"><div><span class="v50-number">'+String(si+1).padStart(2,'0')+'</span><b>'+esc(sec.name)+'</b><small>'+hierarchy.length+' jobs / sub-jobs</small></div>'+
   '<div class="v50-actions">'+button('v50-edit-section',sec.id,'Edit package')+button('v50-add-job',sec.id,'+ Job in package')+'</div></div>'+
   ((inline&&!inline.id&&!inline.parentId?'<div class="v51-package-editor">'+editor(s,ui,projectId)+'</div>':'')+(included.length?'<div class="v50-scroll"><table class="v50-tree"><thead><tr><th>WBS / job</th><th>Department / responsible</th><th>Progress</th><th>Materials</th><th>Actions</th></tr></thead><tbody>'+
   included.map(({task:t,depth,wbs})=>{const materials=jobRequirements(s,t.id),busy=t.needsPurchasing&&materials.filter(o=>o.makeBuy!=='Make').length===0;
    const evidenceCount=(s.workEvidence||[]).filter(x=>live(x)&&x.taskId===t.id).length+(s.projectEvidence||[]).filter(x=>live(x)&&x.taskId===t.id).length;
    const informative=Boolean(t.description?.trim()||t.purchaseNeedNotes?.trim()||materials.length||evidenceCount);
    return '<tr data-v51-job-row="'+esc(t.id)+'" class="'+(t.id===ui.v50SelectedTask?'v50-selected':'')+'"><td><div class="v50-tree-title" style="--depth:'+Math.min(depth,8)+'">'+
      '<span class="v50-wbs">'+esc((si+1)+'.'+wbs)+'</span>'+
      '<div><b>'+esc(t.title)+'</b>'+
      (t.description?'<small>'+esc(t.description.length>250?t.description.slice(0,250)+'…':t.description)+'</small>':'')+
      (busy?'<small class="v50-need-warning">Purchasing details still required</small>':'')+'</div></div></td>'+
      '<td><b>'+esc(t.department||'No department')+'</b><small>'+esc(t.assignee||'Unassigned')+'</small></td>'+
      '<td>'+pill(t.status||'Backlog')+'</td>'+
      '<td>'+pill(materials.length+' linked')+(t.needsPurchasing?pill('BUY FLAG','warn'):'')+'</td>'+
      '<td><div class="v50-actions">'+button('v50-select-job',t.id,informative?'Details ●':'Details',informative?'v51-details-ready':'')+button('v50-edit-job',t.id,'Edit')+button('v50-add-child',t.id,'+ Sub-job')+
      button('v50-material-add',t.id,'+ Material')+'</div></td></tr>'+((inline&&((inline.id&&inline.id===t.id)||(!inline.id&&inline.parentId===t.id)))?'<tr class="v51-inline-editor"><td colspan="5">'+editor(s,ui,projectId)+'</td></tr>':'')
    }).join('')+'</tbody></table></div>':'<p class="v50-info v50-empty">No jobs match, or this work package is empty. Add a job to start building this project.</p>'))+
   '</section>';
 }).join('');
 return '<section class="v50-workplan">'+
 '<div class="v50-hero"><div><small>WORK PLAN · V0.5.1</small><h3>Build your project here</h3>'+
 '<p>Use + Sub-job on the exact parent row, even if that row is already a sub-job. The new editor appears directly underneath it. Details glows when there are instructions, materials or proof attached.</p></div>'+
 '<div class="v50-actions">'+button('v50-create-section','','+ Work package')+
 (sections.length?button('v50-add-job',sections[0].id,'+ Add job','primary'):'')+
 button('project-tab','procurement','View purchasing')+'</div></div>'+
 '<div class="v50-stats">'+
 [['Jobs and sub-jobs',jobs.length],['Require purchase details',flag.length],['Open work items',jobs.filter(t=>t.status!=='Done'&&t.status!=='Cancelled').length],['Work packages',sections.length]].map(([label,value])=>
 '<div><small>'+esc(label)+'</small><strong>'+value+'</strong></div>').join('')+'</div>'+
 (flag.length?'<div class="v50-alert"><b>'+flag.length+' work item(s) flagged for purchasing without a linked Sim-Worx buying requirement.</b> Open their details, then add the specific item and quantity. Purchasing shows this same action queue.</div>':'')+
 sectionCreator(s,ui,projectId)+
 '<details class="v51-wbs-help"><summary>How to organise engineering work '+helpTip(helpTopics.workpackage)+'</summary><p>Work package = major subsystem. Job = deliverable. Sub-job = step under the parent selected. Purchase flag = action reminder, not a purchase order. Material = specific item and quantity. QA = inspect goods separately from delivery. Every blue question mark explains a term.</p></details>'+
 '<div class="v50-filters"><label>Find a job<input type="search" data-filter="v50-search" value="'+esc(ui.v50Search||'')+'" placeholder="Search job, instructions or person…"></label>'+
 '<label>Status<select data-filter="v50-status">'+opt([['All','All statuses'],...['Backlog','Ready','In progress','Blocked','Inspection','Done','Cancelled'].map(x=>[x,x])],status)+'</select></label></div>'+
 (groups||'<p class="v50-alert">No work packages yet. Start with <b>+ Work package</b>, then add jobs and sub-jobs manually. You do not need to accept a template structure.</p>')+
 taskDetails(s,ui,projectId)+'</section>';
}
