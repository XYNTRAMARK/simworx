/* Weighted progress UI. At most 50 steps visible at once for large projects. */
import {projectSteps,progressSnapshot,saveProgressStep,archiveProgressStep,
 generateProgressSteps,importProgressSteps,distributeProgressWeights,updateStepCompletion} from './progress-v043.mjs';
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const pct=x=>(Number(x)||0).toFixed(2).replace(/\.?0+$/,'');
const btn=(title,action,attrs='',color='')=>'<button type="button" data-action="'+action+'" '+attrs+' class="btn small '+color+'">'+h(title)+'</button>';
export function renderProjectProgress(s,ui,projectId){
 const summary=progressSnapshot(s,projectId),steps=projectSteps(s,projectId);
 const filter=String(ui.progressQuery||'').trim().toLowerCase();
 const found=filter?steps.filter(x=>x.title.toLowerCase().includes(filter)):steps;
 const perPage=40,maxPage=Math.max(0,Math.ceil(found.length/perPage)-1);
 const page=Math.min(Math.max(0,Number(ui.progressPage)||0),maxPage);ui.progressPage=page;
 const paged=found.slice(page*perPage,(page+1)*perPage);
 const rows=paged.map(x=>'<tr><td><form class="v43-progress-edit" data-form="v43-step-edit">'+
  '<input type="hidden" name="projectId" value="'+h(projectId)+'"><input type="hidden" name="stepId" value="'+h(x.id)+'">'+
  '<input name="title" maxlength="140" required aria-label="Progress step title" value="'+h(x.title)+'"></td>'+
  '<td><input name="weight" aria-label="Weight percent" type="number" step="0.01" min="0" max="100" required value="'+pct(x.weightBp/100)+'"></td>'+
  '<td><input name="completion" aria-label="Completion percent" type="number" step="0.01" min="0" max="100" required value="'+pct(x.doneBp/100)+'"></td>'+
  '<td><div class="v43-table-actions"><button type="submit" class="btn small primary">Save</button>'+
  btn(x.doneBp===10000?'Reset':'Done','v43-progress-toggle','data-id="'+h(x.id)+'" data-project="'+h(projectId)+'"')+
  btn('Remove','v43-progress-remove','data-id="'+h(x.id)+'" data-project="'+h(projectId)+'"','danger')+'</div></form></td></tr>').join('');
 const removed=s.projectProgressSteps.filter(x=>x.projectId===projectId&&x.archivedAt);
 return '<div class="v43-progress-workspace"><div class="v43-title-row"><div><h2>Manual project progress</h2>'+
  '<p>Define exactly which steps count toward project completion and how much each one is worth.</p></div>'+
  '<strong class="v43-progress-big">'+pct(summary.earned)+'%</strong></div>'+
  '<div class="v43-progress-track"><span style="width:'+summary.earned+'%"></span></div>'+
  '<div class="v43-progress-stats"><span>'+summary.completed+' / '+summary.count+' completed</span>'+
  '<span>'+pct(summary.weightTotal)+'% of weights assigned</span>'+
  '<span class="'+(summary.fullyWeighted?'v43-good':'v43-warn')+'">'+(summary.fullyWeighted?'Weights total 100%':pct(summary.unassigned)+'% weight unassigned')+'</span></div>'+
  '<div class="v43-progress-setup"><form data-form="v43-step-add" class="v43-inline-form">'+
  '<input name="projectId" value="'+h(projectId)+'" type="hidden">'+
  '<label>New step title<input name="title" required maxlength="140" placeholder="e.g. Finalise cockpit drawings"></label>'+
  '<label>Weight (%)<input name="weight" required type="number" min="0" max="100" step="0.01" value="0"></label>'+
  '<button class="btn primary" type="submit">Add step</button></form>'+
  '<form data-form="v43-step-generate" class="v43-inline-form">'+
  '<input name="projectId" value="'+h(projectId)+'" type="hidden">'+
  '<label>Generate steps<input name="count" type="number" required min="1" max="1000" value="10"></label>'+
  '<button type="submit" class="btn">Create placeholders</button></form>'+
  '<div class="v43-progress-row">'+btn('Distribute weights equally','v43-progress-equal','data-project="'+h(projectId)+'"','')+
  '<span>Use equal weighting as a starting point, then edit each step to suit your project. Supports up to 1,000 steps.</span></div>'+
  '<form data-form="v43-step-import" class="v43-progress-import">'+
  '<input name="projectId" type="hidden" value="'+h(projectId)+'">'+
  '<label>Paste a step list (one per line). Optional: title | weight % | completion %<textarea name="lines" rows="3" placeholder="Design concept | 10 | 100&#10;Procure components | 25 | 0"></textarea></label>'+
  '<button class="btn" type="submit">Import steps</button></form></div>'+
  '<div class="v43-progress-list-head"><h3>Progress steps ('+found.length+')</h3>'+
  '<input data-filter="v43-progress-search" value="'+h(ui.progressQuery||'')+'" placeholder="Search steps" aria-label="Search progress steps"></div>'+
  '<div class="v43-scroll"><table class="v43-table"><thead><tr><th>Step</th><th>Weight %</th><th>Done %</th><th>Actions</th></tr></thead><tbody>'+
  (rows||'<tr><td colspan="4">No steps yet. Add your milestones above.</td></tr>')+'</tbody></table></div>'+
  '<div class="v43-pagination">'+btn('Previous','v43-progress-prev','','')+
  '<span>Page '+(page+1)+' / '+(maxPage+1)+'</span>'+btn('Next','v43-progress-next','','')+'</div>'+
  (removed.length?'<details class="v43-restore"><summary>'+removed.length+' removed progress steps</summary>'+
    removed.map(x=>'<div>'+h(x.title)+' '+btn('Restore','v43-progress-restore','data-id="'+h(x.id)+'" data-project="'+h(projectId)+'"')+'</div>').join('')+'</details>':'')+
  '<p class="v43-note">Completion = sum of each step’s percentage weight multiplied by its completion %. If weights total less than 100%, the remaining share is unearned. The original Work Register and Gantt are unchanged; the customer portal is not automatically updated.</p></div>';
}
export function handleProgressForm(s,ui,form){
 const fd=new FormData(form),get=x=>String(fd.get(x)||'').trim(),pid=get('projectId');
 switch(form.dataset.form){
  case 'v43-step-add':return saveProgressStep(s,{projectId:pid,title:get('title'),weight:get('weight'),completion:0});
  case 'v43-step-edit':return saveProgressStep(s,{projectId:pid,id:get('stepId'),title:get('title'),weight:get('weight'),completion:get('completion')});
  case 'v43-step-generate':return generateProgressSteps(s,{projectId:pid,count:get('count')});
  case 'v43-step-import':return importProgressSteps(s,{projectId:pid,lines:get('lines')});
  default:throw Error('Unknown progress form');
 }
}
export function handleProgressAction(s,ui,el,confirmFn=()=>true){
 const pid=el.dataset.project||ui.project,stepId=el.dataset.id;
 switch(el.dataset.action){
  case 'v43-progress-equal':if(confirmFn('Reallocate all progress step weights evenly to exactly 100%?'))return distributeProgressWeights(s,pid);return null;
  case 'v43-progress-toggle':{const row=projectSteps(s,pid).find(x=>x.id===stepId);if(!row)throw Error('Progress step unavailable');return updateStepCompletion(s,{projectId:pid,stepId,completion:row.doneBp===10000?0:100});}
  case 'v43-progress-remove':if(confirmFn('Remove this step from active progress? Its weight will become unassigned.'))return archiveProgressStep(s,{projectId:pid,stepId});return null;
  case 'v43-progress-restore':return archiveProgressStep(s,{projectId:pid,stepId,restore:true});
  case 'v43-progress-prev':ui.progressPage=Math.max(0,(ui.progressPage||0)-1);return 'ui';
  case 'v43-progress-next':ui.progressPage=(ui.progressPage||0)+1;return 'ui';
  default:throw Error('Unknown progress action');
 }
}
