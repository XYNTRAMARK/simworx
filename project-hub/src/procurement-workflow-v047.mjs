/* V0.4.7 supplier workflow and contract specification guard.
   No remote verification, supplier communication, document transmission or stock accounting.
   Customer contract information lives only in the user's private imported workspace. */
const stamp=()=>new Date().toISOString();
const id=(p)=>p+'-'+Math.random().toString(36).slice(2,12);
const clean=(v,max=800)=>{const s=String(v??'').trim();if(s.length>max)throw Error('Entry exceeds '+max+' characters');return s;};
const valid=(v,label,min=1,max=240)=>{const s=clean(v,max);if(s.length<min)throw Error(label+' needs at least '+min+' character(s)');return s;};
const live=x=>x&&!x.archivedAt;
const sourceKey=o=>JSON.stringify([o?.responsibility||'Unverified',o?.supplier||'',o?.productUrl||'',
 o?.vendorSku||'',o?.quoteRef||'']);
export function contractControlled(s,projectId){
 const project=s.projects?.find(p=>live(p)&&p.id===projectId);
 if(!project)return false;
 if(project.specGateRequired===true)return true;
 const provenance=s.dataProvenance;
 if(provenance?.type!=='contract-initialization')return false;
 if(provenance.projectId)return provenance.projectId===projectId;
 const projects=(s.projects||[]).filter(live);
 return projects.length===1?projects[0].id===projectId:projects[0]?.id===projectId;
}
export function requirementBaseline(s,occurrenceId){
 const occ=s.assemblyBOM?.find(o=>live(o)&&o.id===occurrenceId);
 if(!occ)throw Error('Active engineering requirement not found');
 const part=s.parts?.find(p=>live(p)&&p.id===occ.partId);
 if(!part)throw Error('Engineering part master missing');
 return {occ,part,projectId:occ.projectId,
  label:part.name||part.code||'Unnamed requirement',
  partCode:part.code||'',notes:String(part.notes||'').trim(),
  requirementNotes:String(occ.notes||'').trim(),
  quantity:Number(occ.quantity||0),makeBuy:occ.makeBuy||'Buy'};
}
export function specFingerprint(s,occurrenceId){
 const b=requirementBaseline(s,occurrenceId),occ=b.occ;
 return JSON.stringify([b.partCode,b.label,b.notes,b.requirementNotes,b.quantity,b.makeBuy,
  sourceKey(occ.purchaseSource)]);
}
export function specStatus(s,occurrenceId){
 const b=requirementBaseline(s,occurrenceId),v=b.occ.specReview;
 if(!v)return {status:'Unverified',approved:false,reason:'Not compared with controlled contract and drawings'};
 if(v.fingerprint!==specFingerprint(s,occurrenceId))
  return {status:'Stale',approved:false,reason:'Source item, specification or purchasing responsibility has changed'};
 return {status:v.decision,approved:v.decision==='Matches contract',reason:v.notes||''};
}
export function reviewRequirementSpec(s,{occurrenceId,decision,proposedSpecification,reviewer,evidenceRef,notes=''}){
 const baseline=requirementBaseline(s,occurrenceId),occ=baseline.occ;
 const options=['Matches contract','Deviation proposed','Does not comply'];
 if(!options.includes(decision))throw Error('Choose a specification review decision');
 const source=occ.purchaseSource||{};
 if(decision==='Matches contract'&&source.responsibility!=='Sim-Worx')
  throw Error('Assign internal buying responsibility before approving an internal PO');
 const candidate=valid(proposedSpecification,'Proposed supplier model and technical specification',10,1500);
 const person=valid(reviewer,'Person who compared specifications',3,160);
 const ref=valid(evidenceRef,'Controlled drawing/contract comparison reference',4,240);
 const explanation=valid(notes,'Evidence and reason for this conclusion',8,1200);
 const previous=occ.specReview;
 occ.specReviewHistory??=[];
 if(previous)occ.specReviewHistory.push({...previous});
 occ.specReview={decision,proposedSpecification:candidate,reviewer:person,evidenceRef:ref,notes:explanation,
  fingerprint:specFingerprint(s,occurrenceId),checkedAt:stamp(),
  baseline:{partCode:baseline.partCode,label:baseline.label,partNotes:baseline.notes,requirementNotes:baseline.requirementNotes}};
 s.audit??=[];s.audit.unshift({id:id('audit'),at:stamp(),actor:person,action:'Specification comparison recorded',
  detail:baseline.partCode+' / '+decision+' / evidence '+ref});
 return occ.specReview;
}
export function assertContractPOGate(s,projectId,input,supplier){
 if(!contractControlled(s,projectId))return null;
 const applicable=(s.assemblyBOM||[]).filter(o=>live(o)&&o.projectId===projectId&&o.partId===input.partId);
 if(!applicable.length)throw Error('Contract-controlled purchase must reference an approved engineering requirement. Add and review the BOM line first');
 const occ=applicable.find(o=>o.id===input.sourceOccurrenceId);
 if(!occ)throw Error('Select the specific contract requirement before recording a supplier purchase');
 if(occ.makeBuy==='Make')throw Error('This requirement is marked for in-house manufacture; engineering must review its source classification');
 if(occ.purchaseSource?.responsibility!=='Sim-Worx')throw Error('Confirm Sim-Worx purchasing responsibility before placing its order');
 const review=specStatus(s,occ.id);
 if(!review.approved)throw Error('Purchase blocked: contract specification check is '+review.status+'. Open Review specification on the requirement');
 const source=occ.purchaseSource||{},expectedSupplier=(source.supplier||'').trim();
 if(!expectedSupplier||expectedSupplier.toLowerCase()!==String(supplier||'').trim().toLowerCase())
  throw Error('Purchase supplier differs from the verified source; review its specifications again');
 for(const field of ['productUrl','vendorSku','quoteRef']){
  if((source[field]||'')!==String(input[field]||'').trim())
   throw Error('Purchase '+field+' differs from the verified item; update the source and repeat the spec check');
 }
 if(!input.productUrl&&!input.vendorSku&&!input.quoteRef)
  throw Error('At least one verified product URL, vendor SKU or quotation reference is required');
 return {occurrenceId:occ.id,status:'Verified against recorded source',reviewedAt:occ.specReview.checkedAt,
  reviewer:occ.specReview.reviewer,evidenceRef:occ.specReview.evidenceRef,sourceFingerprint:occ.specReview.fingerprint};
}
export const sourcingStages=['Research','RFQ requested','Quote received','On hold','Change requested','Replacement requested'];
export function setSourcingStage(s,{occurrenceId,stage,reason}){
 const b=requirementBaseline(s,occurrenceId);
 if(!sourcingStages.includes(stage))throw Error('Use a planning stage; Ordered and Received require actual PO and receipt records');
 const note=valid(reason,'Reason / supplier communication reference',5,500);
 const old=b.occ.sourcingStage||'Research';
 if(old===stage)return b.occ;
 b.occ.sourcingStageHistory??=[];
 b.occ.sourcingStageHistory.push({at:stamp(),from:old,to:stage,reason:note});
 b.occ.sourcingStage=stage;
 s.audit??=[];s.audit.unshift({id:id('audit'),at:stamp(),actor:'Local staff',action:'Sourcing planning stage updated',
  detail:b.partCode+' / '+old+' → '+stage+' / '+note});
 return b.occ;
}
export function orderLinesForRequirement(s,occurrenceId){
 return (s.orders||[]).filter(live).flatMap(o=>(o.items||[])
  .filter(l=>l.sourceOccurrenceId===occurrenceId).map(line=>({order:o,line})));
}
export function procurementState(s,occurrenceId){
 const b=requirementBaseline(s,occurrenceId),occ=b.occ,linked=orderLinesForRequirement(s,occurrenceId);
 const review=specStatus(s,occurrenceId),arrivals=(s.procurementArrivals||[])
  .filter(a=>a.sourceOccurrenceId===occurrenceId);
 const waiting=arrivals.filter(a=>a.status==='Awaiting inspection'),rejected=arrivals.filter(a=>a.status==='Rejected');
 const actualReceived=linked.reduce((n,{line})=>n+Number(line.received||0),0);
 const pending=linked.reduce((n,{line})=>n+Math.max(0,Number(line.quantity||0)-Number(line.received||0)-Number(line.closedQuantity||0)),0);
 const onWay=linked.some(({order})=>order.dispatchState==='Out for delivery');
 const planning=occ.sourcingStage||'Research';
 let status=planning;
 if(review.status==='Stale'&&linked.length===0)status='Spec recheck required';
 else if(review.status!=='Matches contract'&&linked.length===0&&planning==='Research')status='Contract check required';
 if(review.approved&&!linked.length&&planning==='Research')status='Spec verified · ready for PO';
 if(linked.length)status=actualReceived>0?(pending>0?'Part received':'Received'):(onWay?'In transit':'Ordered');
 if(waiting.length)status='Arrived · inspect';
 if(rejected.length&&rejected.at(-1)?.at>= (waiting.at(-1)?.at||''))status='Rejected · replacement needed';
 if(['On hold','Change requested','Replacement requested'].includes(planning))
  status=planning+(linked.length?' · PO still recorded':'');
 return {status,review,planning,linked,waiting,rejected,received:actualReceived,pending,
  needsAction:review.status!=='Matches contract'&&linked.length===0};
}
export function ensureArrivals(s){s.procurementArrivals??=[];return s.procurementArrivals;}
export function recordArrival(s,{orderId,lineId,quantity,deliveryRef}){
 ensureArrivals(s);
 const o=s.orders?.find(o=>live(o)&&o.id===orderId);if(!o)throw Error('Purchase order not found');
 const line=o.items?.find(l=>l.id===lineId);if(!line)throw Error('Purchase line not found');
 const q=Number(quantity);
 if(!Number.isSafeInteger(q)||q<=0)throw Error('Arrival quantity must be a positive whole number');
 const pending=s.procurementArrivals.filter(a=>a.orderId===orderId&&a.lineId===lineId&&a.status==='Awaiting inspection')
  .reduce((n,a)=>n+a.quantity,0);
 const outstanding=Number(line.quantity||0)-Number(line.received||0)-Number(line.closedQuantity||0);
 if(q>outstanding-pending)throw Error('Arrival exceeds outstanding units after pending inspection quantities');
 const ref=valid(deliveryRef,'Supplier shipment/delivery reference',3,200);
 const row={id:id('arrival'),orderId,lineId,sourceOccurrenceId:line.sourceOccurrenceId||null,partId:line.partId,
  quantity:q,deliveryRef:ref,status:'Awaiting inspection',at:stamp()};
 s.procurementArrivals.unshift(row);
 s.audit??=[];s.audit.unshift({id:id('audit'),at:stamp(),action:'Goods arrived for QA',actor:'Local staff',
  detail:o.code+' / '+q+' units / '+ref});
 return row;
}
export function rejectArrival(s,{arrivalId,reviewer,reason,evidenceRef}){
 const row=ensureArrivals(s).find(x=>x.id===arrivalId);
 if(!row||row.status!=='Awaiting inspection')throw Error('Only a pending arrival can be rejected');
 const who=valid(reviewer,'Inspector',3,160),why=valid(reason,'Measured non-conformity or wrong model',8,800);
 const proof=valid(evidenceRef,'Inspection evidence reference',4,240);
 Object.assign(row,{status:'Rejected',reviewedAt:stamp(),reviewer:who,evidenceRef:proof,notes:why});
 if(row.sourceOccurrenceId){
  const occ=s.assemblyBOM?.find(x=>x.id===row.sourceOccurrenceId);
  if(occ){
   const old=occ.sourcingStage||'Research';occ.sourcingStageHistory??=[];
   occ.sourcingStageHistory.push({at:stamp(),from:old,to:'Replacement requested',reason:why});
   occ.sourcingStage='Replacement requested';
  }
 }
 s.audit??=[];s.audit.unshift({id:id('audit'),at:stamp(),actor:who,action:'Incoming goods rejected – no stock entered',
  detail:row.orderId+' / '+proof+' / '+why});
 return row;
}
export function acceptArrivalRecord(s,{arrivalId,reviewer,evidenceRef,receiptId}){
 const row=ensureArrivals(s).find(x=>x.id===arrivalId);
 if(!row||row.status!=='Awaiting inspection')throw Error('Arrival no longer awaiting inspection');
 row.status='Accepted';row.reviewedAt=stamp();row.reviewer=valid(reviewer,'Inspector',3,160);
 row.evidenceRef=valid(evidenceRef,'Inspection evidence reference',4,240);row.receiptId=receiptId;
 return row;
}
