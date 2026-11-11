import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {buildReport,defaultSettings} from '../analytics.js';

const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const oldAccessor='sent=f.find(x=>/emailed|sent/i.test(x.key||x.label))?.count||0';
const newAccessor='sent=r.configuratorMetrics?.[type]?.emailed??(f.find(x=>/emailed|sent/i.test(x.key||x.label))?.count||0)';

test('restoring the one accessor yields the exact previous app bytes',()=>{
  assert.equal(source.split(newAccessor).length,2);
  const restored=source.replace(newAccessor,oldAccessor);
  assert.equal(createHash('sha256').update(restored).digest('hex'),'1f4665af3b1fa7d00062b5fd30d021e43d3c4aadf018710a699901cf942e29ec');
});

test('existing configurator Emailed card uses real successful emails even outside core funnel',()=>{
  const now=new Date('2026-10-25T18:00:00Z');
  const steps=['configurator_opened','configurator_started','screen_configuration_completed','price_viewed','configuration_completed','email_entered','configuration_emailed'];
  const snapshot={events:steps.map((event_name,i)=>({event_id:'e'+i,visitor_id:'v1',session_id:'s1',event_name,page_url:'/led-screen-configurator.html',timestamp:new Date(Date.parse('2026-10-25T10:00:00Z')+i*10).toISOString(),properties:{configurator_type:'led',configurator_version:'led-live-v1-659e06b8',configuration_id:'cfg1'}})),leads:[],configurations:[],settings:{},meta:{}};
  const elements=new Map();
  function element(key){if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',hidden:false,value:'',dataset:{},style:{},classList:{toggle(){},remove(){},add(){}},setAttribute(){},addEventListener(){},focus(){},querySelector(s){return element(key+' '+s)},querySelectorAll(){return []}});return elements.get(key);}
  const storage=()=>({getItem(){return null},setItem(){},removeItem(){}});
  const context={buildReport,defaultSettings,demoSnapshot:()=>snapshot,config:{endpoint:'https://example.test',sessionKey:'session',demoEditsKey:'demo',timezone:'Europe/Paris',refreshInterval:30000},document:{querySelector:element,querySelectorAll(){return []},addEventListener(){},body:{style:{}},activeElement:element('active')},location:{search:''},window:{scrollTo(){}},localStorage:storage(),sessionStorage:storage(),URLSearchParams,URL,FormData,Blob,setTimeout(){return 1},clearTimeout(){},setInterval(){},console,Intl,Date};
  vm.createContext(context);
  vm.runInContext(source.replace(/^import .*;\n/gm,'')+'\nglobalThis.test={state,renderConfigurators};',context);
  const {state,renderConfigurators}=context.test;
  state.snapshot=snapshot;state.report=buildReport(snapshot,{preset:'Today'},now);state.filters.configurator='led';
  assert.equal(state.report.funnels.led.some(row=>row.key==='emailed'),false);
  assert.match(renderConfigurators(),/<span>Emailed<\/span><strong>1<\/strong>/);
});
