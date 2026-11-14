import test from 'node:test';
import assert from 'node:assert/strict';

const tables={wi_admin_sessions:[],wi_events:[],wi_leads:[],wi_configurations:[],wi_visitors:[],wi_sessions:[],wi_settings:[{id:true,settings:{scoring:{email_entered:20},alertsEnabled:false,alertThresholds:{highValue:100000}}}]};
const originalFetch=globalThis.fetch;
let captured;
globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://storage.example.test',SUPABASE_SERVICE_ROLE_KEY:'server-only-test-key'}[name])},serve:()=>{}};
globalThis.fetch=async (target,options={})=>{
  const url=new URL(target), table=url.pathname.split('/').at(-1);
  assert.equal(new Headers(options.headers).get('apikey'),'server-only-test-key');
  captured={url,options};
  const payload=options.body?JSON.parse(options.body):undefined;
  if(table==='wi_ingest_events') return Response.json({accepted:payload.p_events.length,duplicates:0});
  assert.ok(table in tables,`Unknown mock table ${table}`);
  const matches=row=>[...url.searchParams.entries()].every(([key,value])=>{
    if(['select','order','offset','limit'].includes(key))return true;
    const dot=value.indexOf('.'),op=value.slice(0,dot),v=value.slice(dot+1);
    if(op==='eq')return String(row[key])===v;
    if(op==='gt')return String(row[key])>v;
    if(op==='lt')return String(row[key])<v;
    return true;
  });
  const method=options.method??'GET';
  if(method==='POST'){tables[table].push(payload);return new Response(null,{status:201});}
  if(method==='DELETE'){tables[table]=tables[table].filter(r=>!matches(r));return new Response(null,{status:204});}
  if(method==='PATCH'){const rows=tables[table].filter(matches);rows.forEach(r=>Object.assign(r,payload));return new Response(new Headers(options.headers).get('prefer')==='return=representation'?JSON.stringify(rows):null,{status:200});}
  const found=tables[table].filter(matches),offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??1000);
  return Response.json(found.slice(offset,offset+limit),{headers:{'content-range':`${offset}-${Math.min(found.length,offset+limit)-1}/${found.length}`}});
};
const {handler,validateEvents}=await import('../supabase/functions/simworx-intelligence/index.ts');
const call=(body,token)=>handler(new Request('https://reports.example.test/api',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Reports-Session':token}:{})},body:JSON.stringify(body)}));
const event={event_id:'evt_1',visitor_id:'visitor_1',session_id:'session_1',event_name:'page_view',page_url:'https://www.sim-worx.com/visual-systems?email=private@example.test',timestamp:new Date().toISOString(),properties:{page_title:'Visual systems'}};

await test('collection validation strips URL queries, excludes admin, validates event names and times',async()=>{
  const valid=validateEvents([event],new Request('https://test'));
  assert.equal(valid[0].page_url,'/visual-systems');
  assert.equal(validateEvents([{...event,page_url:'/reports/'}],new Request('https://test')).length,0);
  assert.throws(()=>validateEvents([{...event,event_name:'BadName'}],new Request('https://test')),/snake_case/);
  assert.throws(()=>validateEvents([{...event,timestamp:'2000-01-01'}],new Request('https://test')),/7 days/);
  assert.throws(()=>validateEvents([{...event,page_url:'https://evil.example/test'}],new Request('https://test')),/Simworx/);
  assert.throws(()=>validateEvents([{...event,properties:{marketing_consent:'true'}}],new Request('https://test')),/boolean/);
  assert.throws(()=>validateEvents([{...event,properties:{scroll_depth:101}}],new Request('https://test')),/scroll/);
});
await test('anonymous callers can collect but cannot read or edit analytics',async()=>{
  assert.equal((await call({action:'snapshot'})).status,401);
  assert.equal((await call({action:'update_lead',id:'anything',status:'LOST'})).status,401);
  const response=await call({action:'collect',events:[event]});
  assert.equal(response.status,200);assert.equal((await response.json()).accepted,1);
  assert.ok(captured.url.pathname.endsWith('/rpc/wi_ingest_events'));
});
let token;
await test('PIN login stores only a token hash and returns an eight-hour expiry',async()=>{
  assert.equal((await call({action:'login',pin:'000000'})).status,401);
  const response=await call({action:'login',pin:'260873'});assert.equal(response.status,200);
  const result=await response.json();token=result.token;
  assert.match(token,/^[0-9a-f]{64}$/);assert.equal(tables.wi_admin_sessions.length,1);
  assert.notEqual(tables.wi_admin_sessions[0].token_hash,token);
  assert.ok(Date.parse(result.expires_at)-Date.now()>7.9*3600000);
  assert.ok(!JSON.stringify(result).includes('server-only-test-key'));
});
await test('authenticated snapshot has truthful limits and settings; lead edits are validated',async()=>{
  const result=await (await call({action:'snapshot'},token)).json();
  assert.deepEqual(result.events,[]);assert.equal(result.meta.counts.events.total,0);assert.equal(result.meta.truncated,false);assert.equal(result.meta.demo,false);
  assert.equal(result.settings.scoring.email_entered,20);
  const id='d6e41082-55d7-4021-aa4c-e1a194bb614b';tables.wi_leads.push({id,email:'test@example.test',status:'NEW',notes:''});
  assert.equal((await call({action:'update_lead',id,status:'INVALID'},token)).status,400);
  const edited=await (await call({action:'update_lead',id,status:'CONTACTED',notes:'Follow up next week'},token)).json();
  assert.equal(edited.lead.status,'CONTACTED');assert.equal(edited.lead.notes,'Follow up next week');
});
await test('editable scoring settings use the frontend contract and reject invalid weights',async()=>{
  const response=await call({action:'settings',settings:{scoring:{email_entered:25},alertsEnabled:true,alertThresholds:{highValue:200000}}},token);
  assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.settings.scoring.email_entered,25);assert.equal(result.settings.alertThresholds.highValue,200000);assert.equal(result.settings.alertsEnabled,true);
  assert.equal((await call({action:'settings',settings:{scoring:{email_entered:-1}}},token)).status,400);
});
await test('logout revokes the session immediately',async()=>{
  assert.equal((await call({action:'logout'},token)).status,200);assert.equal(tables.wi_admin_sessions.length,0);
  assert.equal((await call({action:'snapshot'},token)).status,401);
});
globalThis.fetch=originalFetch;
