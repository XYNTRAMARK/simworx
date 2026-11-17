/* V0.4.7 sourcing and purchase-history links. Staff-entered metadata only.
 No online lookup, automatic POs, inferred quote approval or stock changes. */
import {contractControlled,assertContractPOGate} from './procurement-workflow-v047.mjs';
const now=()=>new Date().toISOString();
const max=(v,n,label)=>{const s=String(v??'').trim();if(s.length>n)throw Error(label+' exceeds '+n+' characters');return s;};
export function safeProductURL(value){
 const raw=max(value,2048,'Product URL');
 if(!raw)return '';
 let u;try{u=new URL(raw);}catch{throw Error('Product URL must be a complete HTTPS link');}
 if(u.protocol!=='https:'||!u.hostname||u.username||u.password)
  throw Error('Product URL must be HTTPS without embedded account credentials');
 return u.href;
}
export function sourceInput({supplier='',productUrl='',vendorSku='',quoteRef='',notes='',responsibility='Unverified'}={}){
 if(!['Unverified','Sim-Worx','Customer-direct','Subcontractor'].includes(responsibility))
  throw Error('Invalid purchasing responsibility');
 return {responsibility,supplier:max(supplier,160,'Supplier'),productUrl:safeProductURL(productUrl),
  vendorSku:max(vendorSku,120,'Supplier part number'),quoteRef:max(quoteRef,120,'Quote reference'),
  notes:max(notes,800,'Sourcing notes')};
}
const plain=v=>JSON.stringify(v);
export function saveRequirementSource(s,{occurrenceId,...data}){
 const occ=s.assemblyBOM?.find(x=>x.id===occurrenceId&&!x.archivedAt);
 if(!occ)throw Error('Material requirement not found');
 const next=sourceInput(data),old=occ.purchaseSource||{};
 if(plain(next)===plain({responsibility:old.responsibility||'Unverified',supplier:old.supplier||'',productUrl:old.productUrl||'',
   vendorSku:old.vendorSku||'',quoteRef:old.quoteRef||'',notes:old.notes||''}))return occ;
 occ.purchaseSourceHistory??=[];
 if(occ.purchaseSource?.updatedAt)occ.purchaseSourceHistory.push({...occ.purchaseSource});
 occ.purchaseSource={...next,updatedAt:now()};
 s.audit??=[];s.audit.unshift({id:'audit-'+Math.random().toString(36).slice(2,12),
  action:'Sourcing reference edited',detail:'Requirement '+occ.id+' / supplier '+(next.supplier||'unconfirmed'),
  actor:'Local staff',at:now()});
 return occ;
}
const positive=(v,label)=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<=0||n>1e7)throw Error(label+' must be a positive whole number');return n;};
const price=(v)=>{const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e10||Math.abs(n*100-Math.round(n*100))>0.00001)throw Error('Unit cost must be a non-negative amount with at most two decimals');return Math.round(n*100)/100;};
const etaDate=value=>{const s=max(value,10,'ETA');if(s&&!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('ETA must be YYYY-MM-DD');if(s&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)!==s)throw Error('Invalid ETA');return s;};
export function updatePurchaseLineRecord(s,{orderId,lineId,quantity,unitCost,eta,productUrl='',vendorSku='',quoteRef='',notes='',reason=''}){
 const order=s.orders?.find(o=>o.id===orderId&&!o.archivedAt);
 if(!order)throw Error('Purchase order not found');
 const line=order.items?.find(l=>l.id===lineId);
 if(!line)throw Error('Order line not found');
 const qty=positive(quantity,'Order quantity'),cost=price(unitCost);
 if(qty<Number(line.received||0)+Number(line.closedQuantity||0))throw Error('Quantity cannot be less than received + confirmed closed balance');
 if(Number(line.closedQuantity||0)>0&&qty!==Number(line.quantity||0))
  throw Error('Reopen a closed supplier balance before changing its ordered quantity');
 if(Number(line.received||0)>0&&cost!==Number(line.unitCost||0))
  throw Error('Received items have locked unit prices; keep history and handle price corrections separately');
 const next={quantity:qty,unitCost:cost,eta:etaDate(eta),productUrl:safeProductURL(productUrl),
  vendorSku:max(vendorSku,120,'Vendor part number'),quoteRef:max(quoteRef,120,'Supplier quote reference'),notes:max(notes,800,'Purchase note')};
 if(['quantity','unitCost','productUrl','vendorSku','quoteRef']
  .some(k=>String(line[k]??'')!==String(next[k]??'')))
  throw Error('Recorded supplier PO financial/identity values are historical evidence and cannot be overwritten, even for legacy orders. Close the remaining balance with a reason; record a corrected, separately approved PO.');
 const prior=Object.fromEntries(Object.keys(next).map(k=>[k,line[k]??'']));
 const identityChange=['productUrl','vendorSku','quoteRef'].some(k=>(line[k]||'')!==(next[k]||''));
 let verified=null;
 if(contractControlled(s,order.projectId)&&identityChange){
  if(Number(line.received||0)>0)throw Error('Cannot replace the specified model on a line with accepted receipts. Create a corrected purchase and return goods separately.');
  verified=assertContractPOGate(s,order.projectId,{partId:line.partId,sourceOccurrenceId:line.sourceOccurrenceId,
   productUrl:next.productUrl,vendorSku:next.vendorSku,quoteRef:next.quoteRef},order.supplier);
 }
 if(JSON.stringify(prior)===JSON.stringify(next))return line;
 const explanation=max(reason,300,'Change reason');
 if(explanation.length<5)throw Error('Explain the confirmed supplier amendment (at least 5 characters)');
 line.revisions??=[];line.revisions.push({at:now(),reason:explanation,before:prior,after:next});
 Object.assign(line,next);
 if(verified)line.specificationEvidence=verified;
 s.audit??=[];s.audit.unshift({id:'audit-'+Math.random().toString(36).slice(2,12),actor:'Local staff',
  action:'Purchase order line edited',detail:order.code+' / '+line.id,at:now()});
 return line;
}
