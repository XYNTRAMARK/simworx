import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../simworx-intelligence-bootstrap-v2.js',import.meta.url),'utf8');

function browser({pathname='/index.html',dataset={},contact=false,sdk}={}){
  const nodes=[],configured=[];
  const location=new URL('https://sim-worx.com'+pathname);
  const owner={src:'https://sim-worx.com/assets/js/simworx-intelligence-bootstrap-v2.js',dataset,nonce:'existing-script-nonce'};
  const document={currentScript:owner,head:{appendChild(node){assert.equal(node.tagName,'SCRIPT');nodes.push(node);}},documentElement:{appendChild(){throw new Error('HEAD exists; no root DOM append needed');}},createElement(tag){assert.equal(tag,'script');return{tagName:'SCRIPT',dataset:{}};},getElementById(id){return id==='contact-form'&&contact?{}:null;}};
  const window={SimworxIntelligence:sdk?{configure(value){configured.push(value);}}:undefined};
  const context=vm.createContext({window,document,location,URL,Object});
  const run=()=>vm.runInContext(source,context);
  run();return{window,document,nodes,configured,run};
}

test('public website loads one inert script into HEAD and does not duplicate initialization',()=>{
  const b=browser();assert.equal(b.nodes.length,1);assert.match(b.nodes[0].src,/\/simworx-intelligence-tracker-v2\.js$/);
  assert.equal(b.nodes[0].async,false);assert.equal(b.nodes[0].defer,true);assert.equal(b.nodes[0].nonce,'existing-script-nonce');
  b.run();assert.equal(b.nodes.length,1);
});
test('private report/admin/portal paths do not load tracking assets',()=>{
  for(const pathname of ['/reports/','/reports/index.html','/admin/','/portal/'])assert.equal(browser({pathname}).nodes.length,0);
});
test('configurator adapter loads only after SDK and retains reviewed type and version',()=>{
  const b=browser({pathname:'/projection-screen-configurator-v37.html',dataset:{configurator:'projection',configuratorVersion:'projection-v37-reviewed'}});
  assert.equal(b.nodes.length,1);assert.equal(b.nodes[0].dataset.configurator,'projection');assert.equal(b.nodes[0].dataset.configuratorVersion,'projection-v37-reviewed');
  b.window.SimworxIntelligence={configure(value){b.configured.push(value);}};b.nodes[0].onload();
  assert.equal(b.nodes.length,2);assert.match(b.nodes[1].src,/simworx-intelligence-configurator-v2\.js$/);assert.equal(b.configured[0].configurator_version,'projection-v37-reviewed');
});
test('filename inference uses compatible live LED and versioned projection funnel names',()=>{
  assert.equal(browser({pathname:'/led-screen-configurator.html'}).nodes[0].dataset.configuratorVersion,'led-live-v1');
  assert.equal(browser({pathname:'/projection-screen-configurator-v37.html'}).nodes[0].dataset.configuratorVersion,'projection-v37');
});
test('contact observer is loaded only on the existing contact form after SDK initialization',()=>{
  const b=browser({contact:true});assert.equal(b.nodes.length,1);
  b.window.SimworxIntelligence={configure(){}};b.nodes[0].onload();
  assert.equal(b.nodes.length,2);assert.match(b.nodes[1].src,/simworx-intelligence-contact-v2\.js$/);
  const other=browser({sdk:true});assert.equal(other.nodes.length,0);
});
