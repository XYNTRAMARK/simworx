import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/simworx-intelligence-contact-v2.js',import.meta.url),'utf8');
class Target{constructor(){this.listeners=new Map();}addEventListener(type,fn,options){this.listeners.set(type,[...(this.listeners.get(type)||[]),{fn,options}]);}dispatchEvent(event){event.target??=this;for(const {fn}of this.listeners.get(event.type)||[])fn(event);}}
function setup({enabled=true,path='/contact.html',statusClass='ct-form-status full',invalid=false}={}){
 const window=new Target(),document=new Target(),form=new Target();let active=enabled;const calls=[],timers=[],reads=[];
 const values={name:'A Person',organisation:'Flight Company',email:' Person@Example.Test ',phone:'+34123456789',interest:'Visual Systems',message:'PRIVATE MESSAGE',website:'',token:'PRIVATE TOKEN'};
 const elements=Object.entries(values).map(([name,value])=>{const element={name,disabled:false,willValidate:true,validity:{valid:!invalid}};Object.defineProperty(element,'value',{get(){reads.push(name);return values[name];}});return element;});
 elements.namedItem=name=>elements.find(el=>el.name===name)||null;form.elements=elements;
 const button={disabled:false};form.querySelector=()=>button;form.checkValidity=form.reportValidity=()=>{throw Error('Tracking invoked form validation UI');};form.reset=()=>{throw Error('Tracking reset existing form');};
 const status={className:statusClass,textContent:'Original status content'};
 document.readyState='complete';document.getElementById=id=>id==='contact-form'?form:id==='contact-form-status'?status:null;
 Object.assign(window,{document,SimworxIntelligence:{getContext:()=>({enabled:active,visitor_id:'visitor_123'}),trackEvent:(...args)=>calls.push({method:'trackEvent',args}),enquirySubmitted:(...args)=>calls.push({method:'enquirySubmitted',args})}});
 const context=vm.createContext({window,document,location:new URL('https://sim-worx.com'+path),setTimeout:fn=>{timers.push(fn);return timers.length;},Object,Array,String,RegExp});
 vm.runInContext(source,context);return{window,document,form,status,button,values,reads,calls,timers,setEnabled(value){active=value;window.dispatchEvent({type:'simworx:consentchange',detail:{analytics:value}});},submit(){form.dispatchEvent({type:'submit',preventDefault(){throw Error('Tracking blocked submit');},stopPropagation(){throw Error('Tracking stopped submit');}});},complete(success){status.className='ct-form-status full show '+(success?'success':'error');form.dispatchEvent({type:'simworx:submission-complete'});}};
}

test('contact click/initial sent flag do not manufacture an enquiry or capture details',()=>{
 const b=setup({path:'/contact.html?sent=1',statusClass:'ct-form-status full show success'});b.form.dispatchEvent({type:'simworx:submission-complete'});
 assert.equal(b.calls.length,0);assert.equal(b.reads.length,0);assert.equal(b.status.textContent,'Original status content');
});
test('contacts are linked only after a consented valid submit and native successful completion',()=>{
 const b=setup();b.submit();assert.equal(b.calls.filter(c=>c.method==='enquirySubmitted').length,0);
 b.values.email='';b.values.name='';b.complete(true);
 const call=b.calls.find(c=>c.method==='enquirySubmitted');assert.ok(call);assert.equal(call.args[0].contact.email,'person@example.test');assert.equal(call.args[0].contact.company,'Flight Company');
 assert.equal(Object.hasOwn(call.args[0].contact,'marketing_consent'),false);assert.ok(!b.reads.includes('message'));assert.ok(!b.reads.includes('token'));assert.ok(!b.reads.includes('website'));
 assert.equal(b.status.textContent,'Original status content');b.complete(true);assert.equal(b.calls.filter(c=>c.method==='enquirySubmitted').length,1);
});
test('failed responses and invalid form attempts do not capture successful leads',()=>{
 const failed=setup();failed.submit();failed.complete(false);assert.equal(failed.calls.filter(c=>c.method==='enquirySubmitted').length,0);
 const invalid=setup({invalid:true});invalid.submit();invalid.complete(true);assert.equal(invalid.calls.length,0);assert.equal(invalid.reads.length,0);
});
test('no contact fields are read or sent before consent or on excluded pages',()=>{
 const b=setup({enabled:false});b.submit();b.complete(true);assert.equal(b.calls.length,0);assert.equal(b.reads.length,0);
 for(const path of ['/reports/','/portal/','/admin/']){const excluded=setup({path});excluded.submit();excluded.complete(true);assert.equal(excluded.calls.length,0);assert.equal(excluded.reads.length,0);}
});
test('withdrawing consent or allowing pending contact memory to expire prevents later capture',()=>{
 const b=setup();b.submit();b.setEnabled(false);b.setEnabled(true);b.complete(true);assert.equal(b.calls.filter(c=>c.method==='enquirySubmitted').length,0);
 const expired=setup();expired.submit();expired.timers.forEach(fn=>fn());expired.complete(true);assert.equal(expired.calls.filter(c=>c.method==='enquirySubmitted').length,0);
});
test('duplicate submissions during an existing send preserve the actual in-flight contact',()=>{
 const b=setup();b.submit();b.button.disabled=true;b.values.email='other@example.test';b.submit();b.complete(true);
 const successes=b.calls.filter(c=>c.method==='enquirySubmitted');assert.equal(successes.length,1);assert.equal(successes[0].args[0].contact.email,'person@example.test');
});
test('tracking failures never alter normal submission completion or status markup',()=>{
 const b=setup();b.window.SimworxIntelligence.trackEvent=()=>{throw Error('Optional telemetry error');};b.window.SimworxIntelligence.enquirySubmitted=()=>{throw Error('Optional telemetry error');};
 assert.doesNotThrow(()=>b.submit());assert.doesNotThrow(()=>b.complete(true));assert.equal(b.status.textContent,'Original status content');
});
