/* V0.5.1 — private, source-linked work and purchasing evidence.
 * Local-only storage. Never exports files to public repository or auto-publishes to customers.
 * An upload is EVIDENCE ONLY: not proof of a paid invoice, supplier acceptance, an approval,
 * a PO, shipment or a stock movement without separate matching business records. */
const live=x=>x&&!x.archivedAt;
const uid=p=>p+'-'+Math.random().toString(36).slice(2,12);
const stamp=()=>new Date().toISOString();
const required=(v,label,max=200)=>{const x=String(v??'').trim();if(!x||x.length>max)throw Error(label+' is required (max '+max+' characters)');return x;};
const audit=(s,action,detail)=>{s.audit??=[];s.audit.unshift({id:uid('audit'),actor:'Owner (local entry)',at:stamp(),action,detail})};
const project=(s,id)=>{const p=s.projects?.find(x=>live(x)&&x.id===id);if(!p)throw Error('Project unavailable');return p};
const task=(s,id,projectId)=>{const t=s.tasks?.find(x=>live(x)&&x.projectId===projectId&&x.id===id);if(!t)throw Error('Job is missing or not in selected project');return t};
const requirement=(s,id,projectId,taskId)=>{if(!id)return null;const x=s.assemblyBOM?.find(o=>live(o)&&o.id===id&&o.projectId===projectId);if(!x||x.linkedTaskId!==taskId)throw Error('Evidence must reference a material assigned to this exact job');return x};
export const evidenceKinds=[
 ['Photo / screenshot','Photo / screenshot'],
 ['Technical reference','Technical reference / drawing image'],
 ['Supplier quotation','Supplier quotation (not an order)'],
 ['Supplier order confirmation','Supplier order confirmation'],
 ['Receipt / supplier invoice','Receipt or supplier invoice (not proof of payment)'],
 ['Delivery / inspection','Delivery note or quality-inspection photo'],
 ['Job progress','Work progress photo'],
 ['Other','Other supporting evidence']
];
export const allowedMime=['image/jpeg','image/png','image/webp','application/pdf'];
export function ensureWorkEvidence(s){s.workEvidence??=[];return s;}
function safeFile(mime,dataUrl){
 const kind=required(mime,'File MIME',80);
 if(!allowedMime.includes(kind))throw Error('Only JPG, PNG, WebP photos and PDF documents are supported');
 const value=String(dataUrl||'');
 const prefixes={'image/jpeg':'/9j','image/png':'iVBOR','image/webp':'UklGR','application/pdf':'JVBERi0'};
 const prefix='data:'+kind+';base64,';
 if(!value.startsWith(prefix)||!value.slice(prefix.length).startsWith(prefixes[kind])||!/^[A-Za-z0-9+/]+={0,2}$/.test(value.slice(prefix.length)))
  throw Error('Invalid encoded file, file type or signature');
 const max=kind==='application/pdf'?530000:330000;
 if(value.length>max)throw Error('File is too large for local workspace storage. Keep original privately; use a compressed image or a small PDF');
 return value;
}
const purchaseOnly=['Supplier order confirmation','Receipt / supplier invoice'];
export function attachWorkEvidence(s,{projectId,taskId,occurrenceId='',orderId='',lineId='',title,kind,notes='',filename,mime,dataUrl}){
 ensureWorkEvidence(s);project(s,projectId);const job=task(s,taskId,projectId);
 const occ=requirement(s,occurrenceId,projectId,job.id);
 if(!evidenceKinds.some(x=>x[0]===kind))throw Error('Select an evidence category');
 const order=orderId?s.orders?.find(o=>live(o)&&o.id===orderId&&o.projectId===projectId):null;
 const line=lineId?order?.items?.find(x=>x.id===lineId):null;
 if(orderId&&!order)throw Error('Actual supplier PO reference not found in this project');
 if(lineId&&!line)throw Error('PO line does not belong to selected order');
 if(occ&&line&&line.sourceOccurrenceId!==occ.id)throw Error('PO line is not linked to this engineering material');
 if(line&&!occ)throw Error('Select the exact engineering material before attaching supplier order evidence');
 if(purchaseOnly.includes(kind)&&!line)throw Error('Order confirmation/invoice evidence must be attached to a previously recorded actual supplier PO line');
 const data=safeFile(mime,dataUrl),now=stamp();
 const active=s.workEvidence.filter(x=>live(x)&&x.projectId===projectId);
 if(active.length>=30)throw Error('Project evidence limit reached (30 files). Archive obsolete evidence, keeping the originals safely');
 const used=active.reduce((n,x)=>n+(x.dataUrl?.length||0),0);
 if(used+data.length>5_500_000)throw Error('Local embedded evidence exceeds the 5.5 MB project limit. Keep originals externally and attach smaller reference images');
 const description=String(notes||'').trim();if(description.length>1000)throw Error('Evidence notes exceed 1,000 characters');
 const row={id:uid('workproof'),projectId,sectionId:job.sectionId,taskId:job.id,occurrenceId:occ?.id||null,
  orderId:order?.id||null,lineId:line?.id||null,title:required(title,'Evidence title',180),
  kind,notes:description,filename:required(filename,'File name',180),mime,dataUrl:data,
  customerApproval:null,createdAt:now,provenance:'owner-supplied file (not independently verified)'};
 s.workEvidence.push(row);
 audit(s,'Private work / purchasing evidence attached',row.id+' / '+job.title+' / '+kind+' / '+(order?.code||'No PO'));
 return row;
}
export function evidenceForJob(s,taskId){
 ensureWorkEvidence(s);
 return s.workEvidence.filter(x=>live(x)&&x.taskId===taskId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
export function evidenceForOccurrence(s,occurrenceId){
 ensureWorkEvidence(s);
 return s.workEvidence.filter(x=>live(x)&&x.occurrenceId===occurrenceId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
}
export function setEvidenceCustomerPreview(s,{evidenceId,visible,reviewer='',caption='',redactionConfirmed=false}){
 ensureWorkEvidence(s);const e=s.workEvidence.find(x=>live(x)&&x.id===evidenceId);
 if(!e)throw Error('Evidence unavailable');
 if(!visible){const prev=e.customerApproval;e.customerApproval=null;audit(s,'Customer evidence local preview revoked',e.id+(prev?' / previous '+prev.reviewer:''));return e;}
 // Client-safe image must be individually selected even when its work package is permitted.
 const section=s.customerShareRules?.find(x=>x.projectId===e.projectId&&x.sectionId===e.sectionId&&x.visible);
 if(!section)throw Error('First allow this work package in the Customer preview section. Each image then requires separate review.');
 if(!e.mime.startsWith('image/'))throw Error('PDFs and original documents are not supported in the customer-safe preview. Supply a reviewed and redacted image instead.');
 if(!redactionConfirmed)throw Error('Confirm that the image contains no confidential supplier prices, account numbers, personal data, addresses or sensitive contract terms');
 const who=required(reviewer,'Person approving this specific image',120);
 const publicCaption=required(caption,'Customer-safe description',400);
 e.customerApproval={visible:true,reviewer:who,caption:publicCaption,at:stamp(),scope:'OWNER PREVIEW ONLY — no live customer publication'};
 audit(s,'Owner marked redacted evidence for LOCAL customer preview',e.id+' / '+who);
 return e;
}
export function customerEvidenceProjection(s,projectId){
 ensureWorkEvidence(s);project(s,projectId);
 const sections=new Set((s.customerShareRules||[]).filter(r=>r.projectId===projectId&&r.visible).map(r=>r.sectionId));
 return s.workEvidence.filter(x=>live(x)&&x.projectId===projectId&&sections.has(x.sectionId)&&x.customerApproval?.visible===true&&x.mime.startsWith('image/'))
  .map(x=>({id:x.id,sectionId:x.sectionId,title:'Reviewed progress photo',caption:x.customerApproval.caption,approvedAt:x.customerApproval.at,
   image:x.dataUrl})); // No private buyer, supplier, cost, original filename, source path, PO number, notes, or contact information.
}
export function archiveWorkEvidence(s,id){
 ensureWorkEvidence(s);const e=s.workEvidence.find(x=>live(x)&&x.id===id);if(!e)throw Error('Evidence unavailable');
 e.archivedAt=stamp();if(e.customerApproval)e.customerApproval=null;
 audit(s,'Evidence archived (owner local)',id+' / '+e.title+' / retained in existing private backups');
 return e;
}
