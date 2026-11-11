import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

const source = await readFile(process.env.TRACKER_FILE || new URL('../assets/simworx-intelligence-tracker-v2.js', import.meta.url), 'utf8');
class Target {
  constructor(){this.listeners=new Map();}
  addEventListener(type,callback,options){this.listeners.set(type,[...(this.listeners.get(type)||[]),{callback,options}]);}
  removeEventListener(type,callback){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x.callback!==callback));}
  dispatchEvent(event){event.target??=this;for(const {callback} of this.listeners.get(event.type)||[])callback(event);return true;}
}
function storage(){const data=new Map();const ops=[];return {ops,data,get length(){ops.push(['length']);return data.size;},key(i){ops.push(['key',i]);return [...data.keys()][i];},getItem(k){ops.push(['read',k]);return data.get(k)||null;},setItem(k,v){ops.push(['write',k]);data.set(k,String(v));},removeItem(k){ops.push(['remove',k]);data.delete(k);}};}
function setup({consent=false,path='/visual-systems.html'}={}){
  const window=new Target(),document=new Target(),localStorage=storage(),sessionStorage=storage();
  const location=new URL('https://sim-worx.com'+path);const requests=[],timers=[],intervals=[],nativeHistory=[];let now=Date.parse('2026-10-25T12:00:00Z');
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const noDom=()=>{throw new Error('Visible DOM mutation attempted');};
  const frozenStyle=new Proxy({}, {set:noDom,deleteProperty:noDom});
  document.readyState='complete';document.hidden=false;document.visibilityState='visible';document.title='Original page title';document.referrer='';
  document.currentScript={dataset:{endpoint:'https://collector.example.test/analytics'}};
  document.body=Object.freeze({scrollHeight:1600,scrollTop:0,appendChild:noDom,append:noDom,remove:noDom,style:frozenStyle});
  document.documentElement=Object.freeze({scrollHeight:1600,clientHeight:800,scrollTop:0,style:frozenStyle});
  document.createElement=noDom;document.appendChild=noDom;document.querySelector=()=>null;document.querySelectorAll=()=>[];
  const businessFetch=async(input,init)=>{requests.push({input,init,body:init?.body?JSON.parse(init.body):undefined});return {ok:true,status:200};};
  const history={pushState(...args){nativeHistory.push({method:'pushState',receiver:this,args});if(args[0]?.throw)throw args[0].throw;if(args[2])location.href=new URL(args[2],location.href);return 'native push result';},replaceState(...args){nativeHistory.push({method:'replaceState',receiver:this,args});if(args[0]?.throw)throw args[0].throw;if(args[2])location.href=new URL(args[2],location.href);return 'native replace result';}};
  const observer=class{observe(){}disconnect(){}};
  const navigator={userAgent:'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36',language:'en-GB'};
  const setTimeout=fn=>{timers.push(fn);return timers.length;},setInterval=fn=>{intervals.push(fn);return intervals.length;};
  Object.assign(window,{window,self:window,document,navigator,location,history,localStorage,sessionStorage,crypto:webcrypto,fetch:businessFetch,innerWidth:1440,innerHeight:800,scrollY:0,
    SimworxCookieConsent:{getConsent:()=>({analytics:consent,marketing:false})},setTimeout,setInterval,clearTimeout(){},clearInterval(){},PerformanceObserver:observer,performance:{getEntriesByType:()=>[],now:()=>now}});
  const context=vm.createContext({...window,window,self:window,document,navigator,location,history,localStorage,sessionStorage,fetch:businessFetch,crypto:webcrypto,Date:Clock,URL,URLSearchParams,TextEncoder,Blob,AbortController,console,PerformanceObserver:observer,
    CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;}},setTimeout,setInterval,clearTimeout(){},clearInterval(){}});
  vm.runInContext(source,context,{filename:'activation-tracker.js'});
  return {window,document,history,location,localStorage,sessionStorage,requests,nativeHistory,businessFetch,api:window.SimworxIntelligence,timers,intervals,advance(ms){now+=ms;}};
}
const events=b=>b.requests.flatMap(r=>r.body?.events||[]);
const neverCancel=()=>{throw new Error('Tracking cancelled a business event');};

test('loading and using tracker never mutates visible DOM, styles, fetch or forms',async()=>{
  const b=setup({consent:true});assert.ok(b.api);assert.equal(b.window.fetch,b.businessFetch);
  const button=Object.freeze({id:'unchanged-cta',dataset:Object.freeze({}),textContent:'Original text',className:'btn',tagName:'BUTTON',hasAttribute:()=>false,closest(){return this;}});
  b.document.dispatchEvent({type:'click',target:button,preventDefault:neverCancel,stopPropagation:neverCancel,stopImmediatePropagation:neverCancel});
  b.document.dispatchEvent({type:'submit',target:{id:'existing-form'},preventDefault:neverCancel,stopPropagation:neverCancel});
  await b.api.flush();assert.equal(button.textContent,'Original text');assert.equal(b.document.title,'Original page title');assert.equal(b.window.fetch,b.businessFetch);
  assert.ok(events(b).some(e=>e.event_name==='cta_clicked'));
});

test('no analytics storage access or requests occur before consent, or on private paths',async()=>{
  for(const path of ['/visual-systems.html','/reports/','/admin/','/portal/']){
    const b=setup({consent:path!=='/visual-systems.html',path});
    b.api?.trackEvent('test_probe',{ordinary:true});await b.api?.flush();
    const analyticsOps=b.localStorage.ops.filter(op=>!(op[0]==='read'&&op[1]==='simworx_cookie_consent'));
    assert.equal(analyticsOps.length,0,path);assert.equal(b.sessionStorage.ops.length,0,path);assert.equal(b.requests.length,0,path);
  }
});

test('history wrappers preserve native receiver, arguments, return and exceptions',()=>{
  const b=setup({consent:true});const state={business:'unchanged'};
  assert.equal(b.history.pushState(state,'Original','/contact.html'),'native push result');
  assert.equal(b.history.replaceState(state,'Original','/about.html'),'native replace result');
  for(const record of b.nativeHistory){assert.equal(record.receiver,b.history);assert.equal(record.args[0],state);assert.equal(record.args[1],'Original');}
  const failure=new Error('Native expected exception');
  assert.throws(()=>b.history.pushState({throw:failure},'','/no-change.html'),error=>error===failure);
  assert.equal(b.location.pathname,'/about.html');
});

test('telemetry failure cannot turn a successful native navigation into an application error',()=>{
  const b=setup({consent:true});Object.defineProperty(b.document,'title',{get(){throw new Error('Broken telemetry title read');}});
  assert.equal(b.history.pushState({business:1},'', '/contact.html'),'native push result');
  assert.equal(b.location.pathname,'/contact.html');
});

test('email and enquiry clicks or form submissions never imply successful conversion',async()=>{
  const b=setup({consent:true});
  for(const id of ['projection-enquiry','led-email','led-enquiry']){
    const control={id,dataset:{},textContent:'Send',className:'led-button',tagName:'BUTTON',hasAttribute:()=>false,closest(){return this;}};
    b.document.dispatchEvent({type:'click',target:control,preventDefault:neverCancel,stopPropagation:neverCancel});
    b.document.dispatchEvent({type:'submit',target:control,preventDefault:neverCancel});
  }
  await b.api.flush();assert.equal(events(b).filter(e=>['email_entered','configuration_emailed','enquiry_submitted','configuration_completed'].includes(e.event_name)).length,0);
});

test('unavailable analytics collector does not reject existing business requests',async()=>{
  const b=setup({consent:true});
  const promise=b.window.fetch('/existing-business-endpoint',{method:'POST',body:JSON.stringify({unchanged:true})});
  assert.equal((await promise).status,200);assert.equal(b.requests[0].input,'/existing-business-endpoint');assert.equal(b.requests[0].body.unchanged,true);
  assert.equal(b.window.fetch,b.businessFetch);
});
