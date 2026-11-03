/** Actual deployed SDK -> public collector -> protected reports snapshot.
 * Creates only a uniquely marked anonymous page/session trace, never a lead,
 * configuration or email. The parent removes the trace using this proof file.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto,createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

const origin=process.env.TRACKING_PUBLIC_BASE||'https://sim-worx.com';
assert.ok(['https://sim-worx.com','https://www.sim-worx.com'].includes(origin),'Use the actual Simworx origin.');
const endpoint='https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence';
const sdkURL=origin+'/assets/js/simworx-intelligence-tracker-v2.js';
const marker='TRACKING-VALIDATION-'+String(process.env.GITHUB_RUN_ID||randomUUID()).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)+'-'+randomUUID().slice(0,8);
const proofPath=process.env.TRACKING_PROOF_PATH||path.join(process.env.RUNNER_TEMP||'.','simworx-tracking-validation.json');
const proof={passed:false,campaign:marker,origin,visitor_ids:[],session_ids:[],event_ids:[],event_names:[],stage:'starting'};
const requests=[];
let token;

function requireCors(response){
 const allow=response.headers.get('access-control-allow-origin');
 assert.ok(allow==='*'||allow===origin,'Collector response must allow the real website origin.');
}
async function realFetch(url,options={}){
 return fetch(url,{...options,signal:AbortSignal.timeout(30000)});
}
async function request(body,session){
 const response=await realFetch(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(session?{'X-Reports-Session':session}:{})},body:JSON.stringify(body)});
 requireCors(response);
 let data;try{data=await response.json();}catch{throw new Error('The reports API did not return JSON.');}
 return{status:response.status,data};
}
class Target{
 constructor(){this.listeners=new Map();}
 addEventListener(type,listener){const list=this.listeners.get(type)||[];list.push(listener);this.listeners.set(type,list);}
 removeEventListener(type,listener){this.listeners.set(type,(this.listeners.get(type)||[]).filter(fn=>fn!==listener));}
 dispatchEvent(event){event.target=event.target||this;for(const listener of this.listeners.get(event.type)||[])listener(event);return true;}
}
function browser(source){
 const window=new Target(),document=new Target();
 const location=new URL(origin+'/index.html');
 for(const[key,value]of Object.entries({utm_source:'tracking_validation',utm_medium:'verification',utm_campaign:marker,utm_content:'deployed-sdk',utm_term:'collector-contract',ref:marker}))location.searchParams.set(key,value);
 const preference={analytics:true,marketing:false,version:'SWX-CKN-001-v1.0-2026-08-14',timestamp:new Date().toISOString()};
 const values=new Map([['simworx_cookie_consent',JSON.stringify(preference)]]);
 const localStorage={get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 Object.assign(document,{readyState:'complete',hidden:false,visibilityState:'visible',title:'Simworx tracking validation',referrer:'',cookie:'swx_cookie_consent='+encodeURIComponent(JSON.stringify(preference)),currentScript:{src:sdkURL,dataset:{endpoint}},documentElement:{scrollHeight:900,clientHeight:900},body:{scrollHeight:900},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,createElement:()=>{throw new Error('SDK must not create rendered elements.');}});
 const sdkFetch=async(url,options)=>{
  assert.equal(url,endpoint,'The actual SDK must send to the configured collector.');
  const body=JSON.parse(options.body);
  assert.equal(body.action,'collect','SDK may only submit collection requests.');
  assert.ok(Array.isArray(body.events),'SDK submits a real event batch.');
  assert.ok(body.events.every(event=>['session_started','page_view','page_performance','web_vitals'].includes(event.event_name)),'Validation must not create lead/configuration/email events.');
  requests.push(...body.events);
  const response=await realFetch(url,{...options,headers:{...options.headers,Origin:origin}});
  requireCors(response);
  return response;
 };
 const scheduled=[];
 const setTimeout=(callback)=>{scheduled.push(callback);return scheduled.length;};
 const setInterval=()=>1;
 Object.assign(window,{window,self:window,document,location,navigator:{userAgent:'SimworxTrackingVerification/1.0'},history:{pushState(){},replaceState(){}},crypto:webcrypto,localStorage,fetch:sdkFetch,innerWidth:1440,innerHeight:900,scrollY:0,performance:{getEntriesByType:()=>[]},setTimeout,setInterval,clearTimeout(){},clearInterval(){}});
 const context=vm.createContext({...window,window,self:window,document,location,URL,URLSearchParams,TextEncoder,Uint8Array,Date,Promise,console,CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},fetch:sdkFetch,setTimeout,setInterval,clearTimeout(){},clearInterval(){}});
 vm.runInContext(source,context,{filename:'actual-public-simworx-intelligence-tracker-v2.js',timeout:3000});
 return window.SimworxIntelligence;
}

try{
 proof.stage='cors';
 const preflight=await realFetch(endpoint,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-reports-session'}});
 assert.ok(preflight.status===200||preflight.status===204,'Website collection preflight must succeed.');requireCors(preflight);
 assert.ok(/post/i.test(preflight.headers.get('access-control-allow-methods')||''),'POST must be allowed.');
 assert.ok(/content-type/i.test(preflight.headers.get('access-control-allow-headers')||''),'JSON collection must be allowed.');
 assert.ok(/x-reports-session/i.test(preflight.headers.get('access-control-allow-headers')||''),'Reports session reads must be allowed.');
 proof.stage='public-sdk';
 const publicSDK=await realFetch(sdkURL);
 assert.ok(publicSDK.status===200,'The deployed first-party SDK must be publicly available.');
 const source=await publicSDK.text();
 proof.sdk_sha256=createHash('sha256').update(source).digest('hex');
 if(process.env.EXPECTED_TRACKER_SHA256)assert.ok(proof.sdk_sha256===process.env.EXPECTED_TRACKER_SHA256,'The public SDK must match the deployed manifest.');
 const sdk=browser(source);
 assert.ok(sdk&&sdk.getContext().enabled===true,'The actual SDK must honor the existing valid analytics preference.');
 const context=sdk.getContext();
 proof.visitor_ids=[context.visitor_id];proof.session_ids=[context.session_id];proof.sdk_version=sdk.version;
 proof.stage='collection';
 assert.ok(await sdk.flush(),'The actual SDK must successfully flush the public HTTP collector.');
 proof.event_ids=[...new Set(requests.map(event=>event.event_id))];
 assert.ok(requests.some(event=>event.event_name==='session_started')&&requests.some(event=>event.event_name==='page_view'),'SDK must emit its real session and page events.');
 proof.stage='reports-login';
 const login=await request({action:'login',pin:process.env.SIMWORX_REPORTS_PIN||'260873'});
 assert.ok(login.status===200&&typeof login.data.token==='string','Reports PIN login must succeed.');token=login.data.token;
 proof.stage='snapshot';
 const snapshot=await request({action:'snapshot'},token);
 assert.ok(snapshot.status===200&&Array.isArray(snapshot.data.events),'Protected reports snapshot must succeed.');
 const events=snapshot.data.events.filter(event=>event.visitor_id===context.visitor_id);
 const sessionEvent=events.find(event=>event.event_name==='session_started');
 const pageEvent=events.find(event=>event.event_name==='page_view');
 assert.ok(sessionEvent&&pageEvent,'Reports must read back the actual collected page/session trace.');
 for(const event of [sessionEvent,pageEvent]){
  assert.ok(event.session_id===context.session_id,'Stored event must retain the real SDK session.');
  assert.ok(event.page_url==='/index.html','The collector must retain the safe public page path.');
  assert.ok(event.properties.campaign===marker&&event.properties.utm_campaign===marker,'Campaign must survive SDK -> collector -> reports.');
  assert.ok(event.properties.source==='Other'&&event.properties.utm_source==='tracking_validation'&&event.properties.utm_medium==='verification','Source and raw UTM fields must be stored.');
  assert.ok(event.properties.ref_code===marker,'The independent Simworx ref identifier must be stored.');
 }
 assert.ok(Date.parse(sessionEvent.timestamp)<Date.parse(pageEvent.timestamp),'The SDK session must precede its first page view.');
 const storedSession=(snapshot.data.sessions||[]).find(session=>session.id===context.session_id);
 assert.ok(storedSession&&storedSession.visitor_id===context.visitor_id&&storedSession.campaign===marker,'Session facts must be linked and attributed.');
 assert.ok(!(snapshot.data.leads||[]).some(lead=>(lead.visitor_ids||[]).includes(context.visitor_id)),'Anonymous validation must not create a lead.');
 assert.ok(!(snapshot.data.configurations||[]).some(config=>config.visitor_id===context.visitor_id),'Anonymous validation must not create a configuration.');
 proof.event_ids=[...new Set([...proof.event_ids,...events.map(event=>event.event_id)])];
 proof.event_names=[...new Set(events.map(event=>event.event_name))];
 proof.passed=true;proof.stage='complete';
 console.log('Collector trace verified:',JSON.stringify({campaign:marker,visitor_ids:proof.visitor_ids,session_ids:proof.session_ids}));
}finally{
 if(token){try{const logout=await request({action:'logout'},token);proof.logout_verified=logout.status===200;}catch{proof.logout_verified=false;}}
 proof.verified_at=new Date().toISOString();
 await mkdir(path.dirname(proofPath),{recursive:true});
 await writeFile(proofPath,JSON.stringify(proof,null,2)+'\n');
}
