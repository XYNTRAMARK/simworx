/* V0.4.9 — local, owner-recorded engineering purchase controls.
   Not a security boundary, banking approval, signed change order or accounting ledger.
   Private project/source records belong only in browser workspace JSON. */
import {contractControlled,specStatus,specFingerprint} from './procurement-workflow-v047.mjs';
const active=x=>x&&!x.archivedAt&&!x.revokedAt;
const stamp=()=>new Date().toISOString();
const uid=prefix=>prefix+'-'+Math.random().toString(36).slice(2,12);
const required=(v,label,min=1,max=500)=>{const x=String(v??'').trim();if(x.length<min||x.length>max)throw Error(label+' is required ('+min+'–'+max+' characters)');return x};
const amount=(v,label,zero=false)=>{const x=Number(v);if(!Number.isFinite(x)||(zero?x<0:x<=0)||x>1e9||Math.abs(x*100-Math.round(x*100))>0.00001)throw Error(label+' must be a valid amount (max 2 decimals)');return Math.round(x*100)/100};
const whole=(v,label)=>{const x=Number(v);if(!Number.isSafeInteger(x)||x<=0)throw Error(label+' must be a positive integer');return x};
const same=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
const log=(s,action,detail)=>{s.audit??=[];s.audit.unshift({id:uid('audit'),action,detail,actor:'Owner (local record)',at:stamp()})};
const project=(s,id)=>{const p=s.projects?.find(x=>active(x)&&x.id===id);if(!p)throw Error('Project missing');return p};
const occurrence=(s,id,projectId=null)=>{const o=s.assemblyBOM?.find(x=>active(x)&&x.id===id&&(!projectId||x.projectId===projectId));if(!o)throw Error('Engineering requirement not found in selected project');return o};
export function ensurePurchaseControls(s){s.purchaseAuthorisations??=[];return s;}
export const fulfilmentOptions=[
 ['simworx-make','Sim-Worx manufactures'],['simworx-buy','Sim-Worx purchases'],
 ['buyer-direct-integrated','Buyer pays supplier · Sim-Worx manages and integrates'],
 ['buyer-supplied','Buyer supplies · interface to be agreed'],['subcontracted','Subcontracted deliverable'],
 ['unresolved','Responsibility unresolved']];
export const sourceStatuses=[['binding','Controlling agreed requirement'],['indicative','Indicative hardware suggestion'],
 ['provisional','Provisional / design freeze pending'],['pending','Requires formal approval'],['excluded','Excluded / not in scope']];
export function saveRequirementTrace(s,{occurrenceId,document,section,revision,requirementStatus,fulfilment,notes=''}){
 const o=occurrence(s,occurrenceId),p=project(s,o.projectId);
 const doc=required(document,'Source document',4,160),sec=required(section,'Clause / drawing reference',2,160),
 rev=required(revision,'Document date or revision',2,90),detail=String(notes||'').trim().slice(0,1200);
 if(!sourceStatuses.some(x=>x[0]===requirementStatus))throw Error('Select the controlling status');
 if(!fulfilmentOptions.some(x=>x[0]===fulfilment))throw Error('Select who supplies/manufactures this requirement');
 const prior=o.sourceTrace;if(prior){o.sourceTraceHistory??=[];o.sourceTraceHistory.push({...prior})}
 o.sourceTrace={document:doc,section:sec,revision:rev,requirementStatus,fulfilment,notes:detail,recordedAt:stamp()};
 if(o.specReview){o.specReviewHistory??=[];o.specReviewHistory.push({...o.specReview});o.specReview=null}
 log(s,'Controlled source mapped',p.code+' / '+o.id+' / '+doc+' '+sec+' / '+requirementStatus+' / '+fulfilment);
 return o.sourceTrace;
}
function allocation(s,o){
 const d=required(o.departmentOwner,'Responsible department',2,100);
 const assignee=required(o.responsiblePerson,'Assigned responsible person',2,160);
 const rows=(s.departmentAllocations||[]).filter(x=>active(x)&&x.projectId===o.projectId&&x.department===d&&same(x.assignee,assignee));
 const allocated=rows.reduce((n,x)=>n+Number(x.amount||0),0);
 if(allocated<=0)throw Error('Assign a verified internal budget envelope to '+d+' / '+assignee+' in Team & budgets');
 return {department:d,assignee,allocated};
}
function commitments(s,projectId,department=null,skipLineId=null){
 const occs=new Map((s.assemblyBOM||[]).filter(active).map(o=>[o.id,o]));
 let total=0;
 for(const po of s.orders||[]){
  if(!active(po)||po.projectId!==projectId)continue;
  const fx=po.currency==='EUR'?1:Number(po.eurExchangeRate||0);
  if(!Number.isFinite(fx)||fx<=0)throw Error('Existing '+po.code+' requires a verified EUR exchange rate before financial approval');
  const tax=Number(po.taxRate||0);if(tax<0||tax>100)throw Error('Existing PO tax assumption is invalid');
  for(const line of po.items||[]){
   if(line.id===skipLineId)continue;
   if(department&&occs.get(line.sourceOccurrenceId)?.departmentOwner!==department)continue;
   if(!Number.isFinite(Number(line.unitCost))||Number(line.unitCost)<0)throw Error('Existing PO contains invalid price');
   total+=Math.max(0,Number(line.quantity||0)-Number(line.closedQuantity||0))*Number(line.unitCost||0)*fx*(1+tax/100);
  }
 }
 return total;
}
function orderedAgainst(s,authorizationId,skipLineId=null){
 let count=0;
 for(const po of s.orders||[])if(active(po))for(const l of po.items||[]){
  if(l.id!==skipLineId&&l.purchaseAuthorisationId===authorizationId)count+=Math.max(0,Number(l.quantity||0)-Number(l.closedQuantity||0));
 }
 return count;
}
function authorisationBalance(s,projectId,department=null,excludeIds=[]){
 return (s.purchaseAuthorisations||[]).filter(a=>active(a)&&a.projectId===projectId&&(!department||a.department===department)&&!excludeIds.includes(a.id))
  .reduce((sum,a)=>sum+Math.max(0,a.maxQuantity-orderedAgainst(s,a.id))*a.maxUnitPrice*a.eurRate*(1+a.taxRate/100),0);
}
function budgetCheck(s,p,o,estimate,excludedAuthIds=[]){
 const alloc=allocation(s,o),totalBudget=Number(p.budget||0);
 if(!Number.isFinite(totalBudget)||totalBudget<=0)throw Error('Set the verified INTERNAL purchasing budget; customer contract sales price is not spend authority');
 const existing=commitments(s,p.id);
 const reserved=authorisationBalance(s,p.id,null,excludedAuthIds);
 if(existing+reserved+estimate>totalBudget+0.0001)throw Error('Owner approval blocked: project INTERNAL purchasing budget would be exceeded');
 const departmental=commitments(s,p.id,alloc.department)+authorisationBalance(s,p.id,alloc.department,excludedAuthIds);
 if(departmental+estimate>alloc.allocated+0.0001)throw Error('Owner approval blocked: '+alloc.department+' / '+alloc.assignee+' envelope would be exceeded');
 return {allocation:alloc,projectRemaining:Math.round((totalBudget-existing-reserved-estimate)*100)/100,
  departmentRemaining:Math.round((alloc.allocated-departmental-estimate)*100)/100};
}
export function approvalStatus(s,occurrenceId){
 const o=occurrence(s,occurrenceId),reviews=specStatus(s,o.id);
 const auths=(s.purchaseAuthorisations||[]).filter(x=>active(x)&&x.occurrenceId===o.id&&x.fingerprint===specFingerprint(s,o.id));
 if(!o.sourceTrace)return {status:'Source unmapped',approved:false};
 if(o.sourceTrace.requirementStatus!=='binding')return {status:'Scope not released',approved:false};
 if(o.sourceTrace.fulfilment!=='simworx-buy')return {status:'Not an internal purchase',approved:false};
 if(o.makeBuy==='Make'||o.purchaseSource?.responsibility!=='Sim-Worx')return {status:'Responsibility mismatch',approved:false};
 if(!reviews.approved)return {status:'Technical review required',approved:false};
 const ready=auths.find(a=>a.maxQuantity>orderedAgainst(s,a.id));
 return ready?{status:'Owner authorization recorded',approved:true,authorisation:ready,remaining:ready.maxQuantity-orderedAgainst(s,ready.id)}:
  {status:'Owner authorization required',approved:false};
}
export function recordOwnerAuthorisation(s,input){
 ensurePurchaseControls(s);
 const o=occurrence(s,input.occurrenceId),p=project(s,o.projectId);
 if(!contractControlled(s,p.id))throw Error('This controlled approval workflow is intended for contract-backed projects only');
 const status=approvalStatus(s,o.id);
 if(status.approved)throw Error('An unused authorization already exists; consume or revoke it before recording another');
 if(status.status!=='Owner authorization required')throw Error('Cannot authorize: '+status.status);
 const source=o.purchaseSource||{};
 const supplier=required(input.supplier,'Supplier',2,160);
 if(!same(supplier,source.supplier))throw Error('Supplier must match the checked source');
 const model=required(input.manufacturerModel,'Exact manufacturer and model',4,300);
 const code=required(input.vendorSku,'Supplier model / SKU',2,120);
 if(!same(code,source.vendorSku))throw Error('Product SKU must match the reviewed source');
 const quote=required(input.quoteRef,'Real supplier quotation reference',4,160);
 if(!same(quote,source.quoteRef))throw Error('Quotation reference does not match saved sourcing evidence');
 const qty=whole(input.maxQuantity,'Approved maximum quantity');
 const price=amount(input.maxUnitPrice,'Approved maximum unit price',true);
 const currency=required(input.currency,'Currency',3,3);
 if(!['EUR','USD','GBP','CAD'].includes(currency))throw Error('Unsupported currency');
 const eurRate=currency==='EUR'?1:amount(input.eurRate,'Documented EUR exchange rate');
 const taxRate=amount(input.taxRate??0,'Approved tax rate',true);if(taxRate>100)throw Error('Tax rate must be at most 100%');
 const reviewer=required(input.reviewer,'Owner recording the authorization',3,160);
 const approvalRef=required(input.approvalRef,'Actual authorization reference',5,200);
 const quoteEvidence=required(input.evidenceRef,'Quote and price evidence reference',4,300);
 if((s.purchaseAuthorisations||[]).some(a=>a.projectId===p.id&&a.approvalRef===approvalRef))
  throw Error('Authorization reference already used for this project');
 const sourceGap=Number((s.assemblyBOM||[]).filter(x=>active(x)&&x.id===o.id).length?o.quantity:0);
 if(sourceGap<1)throw Error('Engineering quantity not released');
 const estimate=qty*price*eurRate*(1+taxRate/100);
 const budget=budgetCheck(s,p,o,estimate);
 const record={id:uid('auth'),projectId:p.id,occurrenceId:o.id,department:budget.allocation.department,assignee:budget.allocation.assignee,
   supplier,manufacturerModel:model,vendorSku:code,quoteRef:quote,quoteEvidence,approvalRef,
   maxQuantity:qty,maxUnitPrice:price,currency,eurRate,taxRate,reviewer,fingerprint:specFingerprint(s,o.id),
   technicalReviewRef:o.specReview.evidenceRef,sourceDocument:o.sourceTrace.document+' / '+o.sourceTrace.section+' / '+o.sourceTrace.revision,
   recordedAt:stamp(),recordNature:'Owner-entered local authorization; not digitally signed'};
 s.purchaseAuthorisations.push(record);
 log(s,'Owner purchase authorization recorded',p.code+' / '+o.id+' / '+approvalRef+' / '+currency+' '+(qty*price).toFixed(2));
 return record;
}
export function revokeOwnerAuthorisation(s,{authorizationId,reason}){
 ensurePurchaseControls(s);
 const a=s.purchaseAuthorisations.find(x=>active(x)&&x.id===authorizationId);
 if(!a)throw Error('Active authorization not found');
 a.revokedAt=stamp();a.revokeReason=required(reason,'Reason for revocation',8,500);
 log(s,'Future owner authorization revoked',a.approvalRef+' / '+a.revokeReason);
 return a;
}
export function assertPOAuthorised(s,{projectId,supplier,currency,taxRate,eurExchangeRate,items,skipLineId=null}){
 if(!contractControlled(s,projectId))return [];
 ensurePurchaseControls(s);
 const p=project(s,projectId),tax=Number(taxRate||0),fx=currency==='EUR'?1:Number(eurExchangeRate||0);
 if(!Number.isFinite(fx)||fx<=0||!Number.isFinite(tax)||tax<0||tax>100)throw Error('PO currency conversion and tax assumption must be verified');
 const checked=[],qtyByAuthorization=new Map(),amountsByDepartment=new Map(),excluded=new Set();
 for(const line of items){
  const o=occurrence(s,line.sourceOccurrenceId,projectId);
  const status=approvalStatus(s,o.id);
  if(!status.approved)throw Error('PO blocked for '+o.id+': '+status.status);
  const a=status.authorisation;
  if(!same(supplier,a.supplier)||!same(line.vendorSku,a.vendorSku)||!same(line.quoteRef,a.quoteRef))
   throw Error('Purchase supplier, model or quote differs from owner authorization');
  if(currency!==a.currency||Math.abs(fx-a.eurRate)>0.0000001||Math.abs(tax-a.taxRate)>0.0000001)
   throw Error('Currency, conversion rate or tax differs from the recorded owner authorization');
  if(Number(line.unitCost||0)>a.maxUnitPrice+0.00001)throw Error('PO unit cost exceeds owner-approved supplier price');
  const q=whole(line.quantity,'PO quantity');
  qtyByAuthorization.set(a.id,(qtyByAuthorization.get(a.id)||0)+q);
  const c=q*Number(line.unitCost||0)*fx*(1+tax/100);
  amountsByDepartment.set(a.department,(amountsByDepartment.get(a.department)||0)+c);
  checked.push({authorizationId:a.id,occurrenceId:o.id,approvalRef:a.approvalRef});
  excluded.add(a.id);
 }
 for(const [aid,quantity] of qtyByAuthorization){
  const a=s.purchaseAuthorisations.find(x=>x.id===aid);
  if(quantity+orderedAgainst(s,aid,skipLineId)>a.maxQuantity)
   throw Error('Duplicate/over-quantity order blocked: authorization '+a.approvalRef+' has insufficient uncommitted quantity');
 }
 const existing=commitments(s,projectId,null,skipLineId),reserved=authorisationBalance(s,projectId,null,[...excluded]);
 const proposed=[...amountsByDepartment.values()].reduce((a,b)=>a+b,0);
 if(existing+reserved+proposed>Number(p.budget||0)+0.0001)throw Error('Purchase blocked: verified internal project budget exceeded');
 for(const [department,value] of amountsByDepartment){
  const allocationTotal=(s.departmentAllocations||[]).filter(x=>active(x)&&x.projectId===projectId&&x.department===department).reduce((n,x)=>n+Number(x.amount||0),0);
  const existingDept=commitments(s,projectId,department,skipLineId)+authorisationBalance(s,projectId,department,[...excluded]);
  if(existingDept+value>allocationTotal+0.0001)throw Error('Purchase blocked: '+department+' department envelope exceeded');
 }
 return checked;
}
