/* Contract scope and milestone register. All source content comes from imported private data.
   The application never bundles or publishes the customer's contract. */
const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;','"':'&#39;'}[ch]));
const iso=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const money=(v,curr)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:curr,maximumFractionDigits:0}).format(Number(v)||0);
function log(s,action,detail){s.audit??=[];s.audit.unshift({id:'contract-'+Math.random().toString(36).slice(2),at:new Date().toISOString(),actor:'Internal staff',action,detail});}
export function contractDatePlusMonths(date,months=12){
 if(!iso(date))throw Error('Enter a valid YYYY-MM-DD effective date');
 const [year,month,day]=date.split('-').map(Number);
 const targetYear=year+Math.floor((month-1+months)/12),targetMonth=(month-1+months)%12;
 const last=new Date(Date.UTC(targetYear,targetMonth+1,0)).getUTCDate();
 return new Date(Date.UTC(targetYear,targetMonth,Math.min(day,last))).toISOString().slice(0,10);
}
export function setVerifiedContractEffectiveDate(s,{projectId,effectiveDate,verified}){
 const p=s.projects.find(x=>x.id===projectId&&!x.archivedAt);
 if(!p)throw Error('Project does not exist');
 if(!verified)throw Error('Confirm you checked the signed effective date');
 if(!iso(effectiveDate))throw Error('Invalid executed contract date');
 p.contractInfo??={};
 const old=p.contractInfo.effectiveDate||'';
 p.contractInfo.effectiveDate=effectiveDate;
 p.contractInfo.signedStatus='Effective signature date entered and checked by staff; not independently verified by the application';
 p.due=contractDatePlusMonths(effectiveDate);
 log(s,'Contract date entered',p.code+' / '+old+' → '+effectiveDate+' / calculated SAT date '+p.due);
 return p;
}
export function updateContractMilestone(s,{projectId,milestoneId,status,notes}){
 const p=s.projects.find(x=>x.id===projectId&&!x.archivedAt);
 const x=s.projectCommercialMilestones?.find(x=>x.id===milestoneId&&x.projectId===p?.id);
 if(!x)throw Error('Milestone not found');
 if(!['Not verified / not invoiced','Invoiced','Accepted in writing','Paid','Not verified / not ordered','Ordered','Supplier paid'].includes(status))throw Error('Unsupported milestone status');
 x.status=status;x.staffNotes=String(notes||'').slice(0,800);x.lastReviewedAt=new Date().toISOString();
 log(s,'Commercial milestone manually updated',x.title+' / '+status+' / '+x.staffNotes);return x;
}
export function updateScopeReadiness(s,{checkId,status,note}){
 const x=s.readinessChecklist?.find(x=>x.id===checkId);
 if(!x)throw Error('Scope checklist item missing');
 if(!['Open','In progress','Confirmed'].includes(status))throw Error('Invalid checklist status');
 x.status=status;x.reviewNotes=String(note||'').slice(0,800);
 x.lastReviewedAt=new Date().toISOString();
 log(s,'Contract readiness item updated',x.text+' / '+status);return x;
}
export function renderContractScope(s,projectId){
 const p=s.projects.find(x=>x.id===projectId&&!x.archivedAt);
 if(!p)return '<p>Project missing.</p>';
 const info=p.contractInfo||{};
 const stages=(s.projectCommercialMilestones||[]).filter(x=>x.projectId===projectId);
 const checks=s.readinessChecklist||[];
 const exclusions=s.scopeExclusions||[];
 const sections=s.sections.filter(x=>x.projectId===projectId&&!x.archivedAt);
 const milestones=stages.map(x=>'<tr><td><b>'+safe(x.title)+'</b><small>'+safe(x.trigger||x.source||'')+'</small></td>'+
 '<td>'+safe(x.simWorxEUR!=null?money(x.simWorxEUR,'EUR'):money(x.contractValue,x.currency||'EUR'))+'</td>'+
 '<td><form data-form="v43-contract-milestone"><input type="hidden" name="projectId" value="'+safe(projectId)+'">'+
 '<input type="hidden" name="milestoneId" value="'+safe(x.id)+'">'+
 '<select name="status" aria-label="Status">'+['Not verified / not invoiced','Not verified / not ordered','Invoiced','Ordered','Accepted in writing','Paid','Supplier paid'].map(v=>'<option '+(v===x.status?'selected':'')+'>'+v+'</option>').join('')+'</select>'+
 '<input name="notes" placeholder="Evidence reference / review note" value="'+safe(x.staffNotes||'')+'">'+
 '<button type="submit" class="btn small primary">Save</button></form></td></tr>').join('');
 const checkRows=checks.map(x=>'<tr><td><b>'+safe(x.text)+'</b><small>'+safe(x.source||'')+'</small></td>'+
 '<td><form data-form="v43-contract-check"><input type="hidden" name="checkId" value="'+safe(x.id)+'">'+
 '<select name="status">'+['Open','In progress','Confirmed'].map(v=>'<option '+(v===x.status?'selected':'')+'>'+v+'</option>').join('')+'</select>'+
 '<input name="note" value="'+safe(x.reviewNotes||'')+'" placeholder="Evidence or notes">'+
 '<button type="submit" class="btn small primary">Save</button></form></td></tr>').join('');
 return '<div class="v43-contract-scope"><div class="v43-focus-heading"><div><h2>Contract scope & milestones</h2>'+
 '<p>Private register populated from your contract import. Review and update status against real documentary evidence.</p></div></div>'+
 '<div class="v43-contract-stats"><div><small>Sim-Worx contracted scope</small><strong>'+money(info.pricing?.simWorxEUR??p.contract,'EUR')+'</strong></div>'+
 '<div><small>Buyer-paid motion system</small><strong>'+money(info.pricing?.motionBuyerDirectEUR||0,'EUR')+'</strong></div>'+
 '<div><small>Buyer-paid LED system</small><strong>'+money(info.pricing?.ledBuyerDirectUSD||0,'USD')+'</strong></div>'+
 '<div><small>Approved internal spend budget</small><strong>'+money(p.budget||0,'EUR')+'</strong></div></div>'+
 '<div class="v43-contract-grid"><div><h3>Delivery & signature verification</h3>'+
 '<p>Contracted delivery/SAT rule: '+safe(info.deliveryRule||'Not entered')+'</p>'+
 '<p><b>Effective date:</b> '+safe(info.effectiveDate||'Not verified')+' · <b>Binding SAT deadline:</b> '+safe(p.due||'Not calculated')+'</p>'+
 '<form data-form="v43-contract-date"><input type="hidden" name="projectId" value="'+safe(projectId)+'">'+
 '<label>Signed effective date<input name="effectiveDate" type="date" value="'+safe(info.effectiveDate||'')+'" required></label>'+
 '<label class="v43-contract-confirm"><input name="verified" type="checkbox" value="yes" required> I checked the executed signature date</label>'+
 '<button class="btn primary" type="submit">Set date & calculate +12 months</button></form>'+
 '<p>Any contractually permitted extension must be separately evidenced; changing this field is not legal approval of an extension.</p></div>'+
 '<div><h3>Scope boundaries</h3>'+exclusions.map(x=>'<div class="v43-contract-exclusion"><b>'+safe(x.name)+'</b><small>'+safe(x.owner||'')+' · '+safe(x.source||'')+'</small></div>').join('')+'</div></div>'+
 '<div class="v43-contract-block"><h3>Delivery work packages ('+sections.length+')</h3>'+
 '<div class="v43-contract-chips">'+sections.map(x=>'<span title="'+safe(x.notes||'')+'">'+safe(x.name)+'</span>').join('')+'</div></div>'+
 '<div class="v43-contract-block"><h3>Acceptance, procurement and financial milestone register</h3>'+
 '<div class="v43-scroll"><table class="v43-table"><thead><tr><th>Milestone / trigger</th><th>Amount (source currency)</th><th>Manual verification</th></tr></thead><tbody>'+
 (milestones||'<tr><td colspan="3">No commercial milestones imported.</td></tr>')+'</tbody></table></div></div>'+
 '<div class="v43-contract-block"><h3>Project startup / contract obligations checklist</h3>'+
 '<div class="v43-scroll"><table class="v43-table"><thead><tr><th>Required action and source</th><th>Progress & evidence</th></tr></thead><tbody>'+
 (checkRows||'<tr><td colspan="2">No startup checklist imported.</td></tr>')+'</tbody></table></div></div>'+
 '<p class="v43-note">Contract value is NOT an approved internal purchasing budget; motion/LED buyer-direct payments remain separate in their currencies. These are editable staff records, not electronic signatures or proof of an external payment.</p></div>';
}
export function handleContractForm(s,form){
 const fd=new FormData(form),v=k=>String(fd.get(k)||'').trim();
 switch(form.dataset.form){
  case 'v43-contract-date':return setVerifiedContractEffectiveDate(s,{projectId:v('projectId'),effectiveDate:v('effectiveDate'),verified:v('verified')==='yes'});
  case 'v43-contract-milestone':return updateContractMilestone(s,{projectId:v('projectId'),milestoneId:v('milestoneId'),status:v('status'),notes:v('notes')});
  case 'v43-contract-check':return updateScopeReadiness(s,{checkId:v('checkId'),status:v('status'),note:v('note')});
  default:throw Error('Unknown contract form');
 }
}
