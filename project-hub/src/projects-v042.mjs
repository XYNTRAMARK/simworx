/* Project Hub V0.4.2 — project budget summary & updates. Browser demo only.
   Preserve old manual baseline and do not double-count legacy POs with imported commitments. */
const live=x=>x&&!x.archivedAt;
const euroMoney=v=>Math.round((Number(v)||0)*100)/100;
const validAmount=(v,name)=>{
 const n=Number(v);
 if(!Number.isFinite(n)||n<0||Math.round(n*100)!==n*100 && Math.abs(Math.round(n*100)-n*100)>0.000001)
   throw Error(name+' must be a non-negative amount (up to 2 decimals)');
 if(n>1e11)throw Error(name+' exceeds demo limit');
 return euroMoney(n);
};
const isNewOrder=o=>String(o.id||'').startsWith('po-')||o.origin==='v041'||o.origin==='v042';
export function projectBudgetSnapshot(state,projectId){
 const project=state.projects?.find(p=>live(p)&&p.id===projectId);
 if(!project)throw Error('Project not found');
 const budget=euroMoney(project.budget),legacySpent=euroMoney(project.spent),legacyCommitted=euroMoney(project.committed);
 let poReceived=0,poOpen=0,unconverted=[],orders=0;
 for(const o of state.orders||[]){
  if(!live(o)||o.projectId!==projectId||!isNewOrder(o))continue;
  const currency=o.currency||'EUR',rate=currency==='EUR'?1:Number(o.eurExchangeRate||0);
  if(!Number.isFinite(rate)||rate<=0){unconverted.push({id:o.id,code:o.code,currency});continue;}
  orders++;
  for(const line of o.items||[]){
    const price=Number(line.unitCost||0)*rate,received=Number(line.received||0),quantity=Number(line.quantity||0);
    poReceived+=price*received;poOpen+=price*Math.max(0,quantity-received);
  }
 }
 poReceived=euroMoney(poReceived);poOpen=euroMoney(poOpen);
 const actual=euroMoney(legacySpent+poReceived);
 const commitment=euroMoney(legacyCommitted+poOpen);
 const forecast=euroMoney(actual+commitment);
 const headroom=euroMoney(budget-forecast);
 return {projectId,budget,legacySpent,legacyCommitted,poReceived,poOpen,actual,commitment,forecast,headroom,
  overBudget:headroom<0,percent:budget>0?Math.round(forecast/budget*100):forecast>0?100:0,
  includedOrders:orders,unconverted};
}
export function updateProjectBudget(state,{projectId,budget,spent,committed}){
 const p=state.projects?.find(p=>live(p)&&p.id===projectId);
 if(!p)throw Error('Project not found');
 const next={budget:validAmount(budget,'Budget'),spent:validAmount(spent,'Recorded costs'),committed:validAmount(committed,'Other committed costs')};
 Object.assign(p,next);
 state.audit??=[];
 state.audit.unshift({id:'audit-'+Math.random().toString(36).slice(2,10),actor:'Sim-Worx Demo',
 action:'Project budget updated',detail:p.code+' · €'+next.budget,at:new Date().toISOString()});
 return projectBudgetSnapshot(state,p.id);
}
export function setPurchaseExchangeRate(state,{orderId,eurExchangeRate}){
 const o=state.orders?.find(o=>live(o)&&o.id===orderId);
 if(!o)throw Error('Purchase order unavailable');
 if((o.currency||'EUR')==='EUR')throw Error('EUR orders do not require a conversion rate');
 const n=Number(eurExchangeRate);
 if(!Number.isFinite(n)||n<=0||n>10000)throw Error('Enter a positive EUR-per-currency-unit conversion rate');
 o.eurExchangeRate=n;
 state.audit??=[];
 state.audit.unshift({id:'audit-'+Math.random().toString(36).slice(2,10),actor:'Sim-Worx Demo',action:'PO exchange rate set',detail:o.code,at:new Date().toISOString()});
 return o;
}
