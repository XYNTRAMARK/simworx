import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/js/simworx-intelligence-configurator-v2.js',import.meta.url),'utf8');
class Target{constructor(){this.listeners=new Map();}addEventListener(name,callback){this.listeners.set(name,[...(this.listeners.get(name)||[]),callback]);}dispatchEvent(event){event.target ||=this;for(const callback of this.listeners.get(event.type)||[])callback(event);}}
function element(id,options={}){return {id,type:'button',value:'',textContent:'',dataset:{},validity:{valid:true},open:false,selectedOptions:[],...options,hasAttribute(name){return Object.hasOwn(this.attributes||{},name);},getAttribute(name){return this.attributes?.[name]??null;},closest(selector){return selector==='label'?this.label||null:this;},matches(selector){return selector.split(',').some(s=>s.trim()==='#'+id || this.selectorMatches?.includes(s.trim()));}};}
function setup({type='projection',enabled=true,state={},pricing={total:48000,currency:'EUR'},version}={}){
 const window=new Target(),document=new Target(),calls=[],timers=[],intervals=[];let active=enabled,id=null,number=0;
 const configuration={geometry:'curved',diameter:5,horizontalFov:180,viewableHeight:2.4,showSimulator:true,simulatorType:'airliner',simulatorX:0,simulatorY:0,simulatorZ:0,simulatorYaw:0,room:{width:7,depth:6,height:4},projectors:[{id:'P1',modelId:'projector-model',position:[0,3,1],throwRatio:.72}],guidedStep:1,layoutReady:false,layoutDirty:true,currency:'EUR',notes:'Private name and address must not be copied',...state};
 const elements={};const add=(e)=>{elements[e.id]=e;return e;};
 add(element('led-simulatorType',{type:'select-one',value:configuration.simulatorType,selectedOptions:[{textContent:'Airliner cockpit (A320)',dataset:{}}]}));
 add(element('guided-next'));add(element('projection-room-width',{type:'number',value:'7'}));
 add(element('led-email',{type:'email',value:'visitor@example.test'}));add(element('led-name',{type:'text',value:'Test Contact'}));add(element('led-company',{type:'text',value:'Test Company'}));add(element('led-phone',{type:'tel',value:'123'}));add(element('led-country',{type:'select-one',value:'ES'}));
 add(element('led-newsletter',{type:'checkbox',checked:false,label:{textContent:'Yes, send me Simworx updates and newsletters in future. Optional — you can unsubscribe at any time.'}}));
 add(element('led-quote-action',{type:'hidden',value:'email'}));add(element('led-quote-dialog',{open:true}));add(element('led-action-result'));add(element('led-quote-form',{type:'form'}));
 add(element('v37-email-send'));add(element('v37-email-address',{type:'email',value:'recipient@example.test'}));add(element('v37-email-name',{type:'text',value:'Recipient'}));add(element('v37-email-status'));
 document.currentScript={dataset:{configurator:type,configuratorVersion:version||(type==='led'?'led-live-v1-12345678':'projection-v37-12345678')}};document.readyState='complete';document.getElementById=id=>elements[id]||null;
 document.querySelector=selector=>selector==='[data-guided-go][aria-current="step"]'?null:null;
 const record=(method,...args)=>{if(active)calls.push({method,args});};
 const sdk={configure:s=>record('configure',s),getContext:()=>({enabled:active,session_id:'session-1',configuration_id:id}),openConfigurator:(...a)=>record('open',...a),startConfigurator:(...a)=>record('start',...a),step:(...a)=>record('step',...a),trackEvent:(...a)=>record('event',...a),newConfiguration(){id=null;record('newConfiguration');},completeConfiguration(raw,props){id ||= 'CFG-test-'+(++number);record('complete',raw,{...props,configuration_id:id});return id;},configurationEmailed:(...a)=>record('emailed',...a),enquirySubmitted:(...a)=>record('enquiry',...a),identify:(...a)=>record('identify',...a),flush:()=>record('flush')};
 window.SimworxIntelligence=sdk;window.location={pathname:type==='led'?'/led-screen-configurator.html':'/projection-screen-configurator-v37.html'};
 window[type==='led'?'SimworxLED':'SimworxProjection']={snapshot:()=>({configuration:structuredClone(configuration),pricing:structuredClone(pricing),quote:structuredClone(pricing),dimensions:{area:40,moduleLayout:{columns:10,rows:15}}})};
 vm.runInContext(source,vm.createContext({window,document,setTimeout:callback=>timers.push(callback),setInterval:callback=>intervals.push(callback),console}),{filename:'simworx-intelligence-configurator-v2.js'});
 return {window,document,sdk,state:configuration,elements,add,calls,events:method=>calls.filter(c=>c.method===method),steps:name=>calls.filter(c=>c.method==='step'&&c.args[0]===name),commit(){while(timers.length)timers.shift()();},tick(){intervals.forEach(c=>c());},setEnabled(value){active=value;window.dispatchEvent({type:value?'simworx:intelligence-ready':'simworx:intelligence-consent',detail:{analytics:value}});},click(el){document.dispatchEvent({type:'click',target:typeof el==='string'?elements[el]:el});},submit(){document.dispatchEvent({type:'submit',target:elements['led-quote-form']});},finish(){document.dispatchEvent({type:'simworx:submission-complete',target:elements['led-quote-form']});}};
}
test('projection V37 accepts a real manually edited Proposal and completes once',()=>{
 const b=setup({state:{guidedStep:4,layoutReady:true,layoutDirty:true}});b.tick();b.tick();
 assert.equal(b.events('complete').length,1);assert.equal(b.events('complete')[0].args[1].simulator_category,'Airliner');assert.equal(b.events('complete')[0].args[1].simulator_model,'A320');
 assert.equal(b.events('complete')[0].args[0].configuration.notes,undefined);
 b.state.layoutDirty=false;b.tick();assert.equal(b.events('complete').length,1,'workflow dirty-state changes cannot create another configuration');
});
test('projection incomplete layout or earlier steps cannot fabricate completion',()=>{
 for(const state of [{guidedStep:4,layoutReady:false},{guidedStep:3,layoutReady:true},{guidedStep:4,layoutReady:true,projectors:[]}]){const b=setup({state});b.tick();assert.equal(b.events('complete').length,0);}
});
test('default latent cockpit does not become simulator interest when cockpit is disabled',()=>{
 const b=setup({state:{guidedStep:4,layoutReady:true,showSimulator:false}});b.tick();const props=b.events('complete')[0].args[1];assert.equal(props.simulator_category,'Not Selected');assert.equal(props.simulator_model,null);
});
test('projection Continue observes accepted default room and screen milestones after app changes step',()=>{
 const b=setup();b.click('guided-next');b.state.guidedStep=2;b.commit();assert.equal(b.steps('room_dimensions_entered').length,1);
 b.click('guided-next');b.state.guidedStep=3;b.commit();assert.equal(b.steps('screen_configuration_completed').length,1);
});
test('LED Review records a valid final screen without a nonexistent room event',()=>{
 const b=setup({type:'led',state:{showSimulator:false}});const review=element('review',{attributes:{href:'#led-review'}});b.click(review);b.commit();b.click(review);b.commit();
 assert.equal(b.events('complete').length,1);assert.equal(b.steps('room_dimensions_entered').length,0);assert.equal(b.steps('screen_configuration_completed').length,1);assert.equal(b.steps('price_viewed').length,1);
 assert.equal(b.events('emailed').length,0);assert.equal(b.events('identify').length,0);
});
test('LED real successful email response captures one conversion and explicit opt-in evidence',()=>{
 const b=setup({type:'led'});b.elements['led-newsletter'].checked=true;b.submit();
 assert.equal(b.events('emailed').length,0);assert.equal(b.events('identify').length,0);
 b.elements['led-quote-dialog'].open=false;b.elements['led-action-result'].textContent='Quote SWX-123 has been sent to visitor@example.test.';b.finish();
 const success=b.events('emailed');assert.equal(success.length,1);assert.equal(success[0].args[0].contact.email,'visitor@example.test');assert.equal(success[0].args[0].contact.marketing_consent,true);assert.equal(success[0].args[0].contact.consent_text_version,'led-updates-v1');assert.match(success[0].args[0].contact.consent_text,/updates/);b.finish();assert.equal(b.events('emailed').length,1);
});
test('LED failed response and stale previous success text cannot produce conversion',()=>{
 const b=setup({type:'led'});b.elements['led-action-result'].textContent='Quote OLD has been sent to visitor@example.test.';b.submit();b.finish();
 assert.equal(b.events('emailed').length,0);assert.equal(b.events('identify').length,0);
});
test('LED unchecked default never withdraws an earlier newsletter opt-in',()=>{
 const b=setup({type:'led'});b.submit();b.elements['led-quote-dialog'].open=false;b.elements['led-action-result'].textContent='Quote SWX-456 has been sent to visitor@example.test.';b.finish();
 assert.equal(Object.hasOwn(b.events('emailed')[0].args[0].contact,'marketing_consent'),false);
});
test('LED print and contact replies are distinct from configuration email delivery',()=>{
 for(const action of ['print','contact']){const b=setup({type:'led'});b.elements['led-quote-action'].value=action;b.submit();b.elements['led-quote-dialog'].open=false;b.elements['led-action-result'].textContent=action==='print'?'Quote SWX-789 is ready to print.':'Simworx has received quote SWX-789 and your contact request.';b.finish();assert.equal(b.events('emailed').length,0);assert.equal(b.events(action==='print'?'identify':'enquiry').length,1);}
});
test('projection mail preparation can capture submitted email but cannot claim delivery or enquiry',()=>{
 const b=setup({state:{guidedStep:4,layoutReady:true}});b.click('v37-email-send');b.elements['v37-email-status'].textContent='Proposal downloaded. Opening your email application with the proposal summary.';b.commit();
 assert.equal(b.events('identify').length,1);assert.equal(b.events('identify')[0].args[1].delivery_confirmed,false);assert.equal(b.events('emailed').length,0);assert.equal(b.events('enquiry').length,0);
});
test('invalid email and typing never capture contact details',()=>{
 const b=setup({type:'led'});b.elements['led-email'].validity.valid=false;b.submit();b.elements['led-quote-dialog'].open=false;b.elements['led-action-result'].textContent='Quote SWX-000 has been sent to invalid.';b.finish();b.document.dispatchEvent({type:'change',target:b.elements['led-email']});b.commit();assert.equal(b.events('emailed').length,0);assert.equal(b.events('identify').length,0);
});
test('tracking consent withdrawal stops all configurator callbacks',()=>{
 const b=setup({state:{guidedStep:4,layoutReady:true}});b.setEnabled(false);const before=b.calls.length;b.tick();b.click('v37-email-send');b.elements['v37-email-status'].textContent='Proposal downloaded. Opening your email application with the proposal summary.';b.commit();assert.equal(b.calls.length,before);
});
test('projection V38 preserves DOM-only commercial add-ons and partial known-value basis',()=>{
 const b=setup({version:'projection-v38-live',state:{guidedStep:4,layoutReady:true,layoutDirty:true}});
 b.add(element('v37-proposal-total',{textContent:'£28,450.00 + quoted/POA items + delivery'}));
 b.add(element('v37-destination',{type:'select-one',value:'uk'}));b.add(element('v37-customer-type',{type:'select-one',value:'business'}));
 b.add(element('v38-onsite',{type:'checkbox',checked:true}));b.add(element('v38-custom-enclosure',{type:'checkbox',checked:true}));b.add(element('v38-warranty',{type:'checkbox',checked:false}));
 b.tick();const complete=b.events('complete')[0];
 assert.equal(complete.args[0].configuration.commercial_options.onsite,true);assert.equal(complete.args[0].configuration.commercial_options.custom_enclosure,true);
 assert.equal(complete.args[0].configuration.commercial_options.delivery_destination,'uk');assert.equal(complete.args[1].estimated_price,28450);assert.equal(complete.args[1].price_status,'partial_known_total_excludes_quoted_items');
 b.elements['v38-warranty'].checked=true;b.document.dispatchEvent({type:'change',target:b.elements['v38-warranty']});b.commit();b.tick();
 assert.equal(b.events('complete').length,2);assert.equal(b.events('complete')[1].args[0].configuration.commercial_options.warranty,true);
});

test('live numeric input starts LED step tracking even before the state API is ready',()=>{
 const b=setup({type:'led'});delete b.window.SimworxLED;
 const control=b.add(element('led-diameter',{type:'number',value:'6',selectorMatches:['[data-led-number="diameter"]']}));
 b.document.dispatchEvent({type:'input',target:control});b.commit();
 assert.equal(b.steps('screen_dimensions_changed').length,1);
 assert.equal(b.steps('screen_configuration_completed').length,1);
 assert.equal(b.events('complete').length,0);
 b.document.dispatchEvent({type:'change',target:control});b.commit();
 assert.equal(b.steps('screen_dimensions_changed').length,1);
});
test('projection records actual step navigation without inventing completion',()=>{
 const b=setup();b.click('guided-next');b.state.guidedStep=2;b.commit();
 assert.equal(b.steps('configurator_step_viewed').length,1);
 assert.equal(b.events('complete').length,0);
});
