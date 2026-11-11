import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReport} from '../reports/analytics.js';
const now=new Date('2026-10-27T12:00:00Z');
const event=(id,type,email,action,outcome='requested')=>({event_id:id,visitor_id:'v-'+email,session_id:'s-'+type+'-'+email,event_name:outcome==='confirmed'?'configuration_emailed':'email_entered',timestamp:'2026-10-27T10:00:00Z',page_url:'/'+type+'-screen-configurator.html',properties:{configurator_type:type,configurator_version:type==='led'?'led-live-v1':'projection-v63',email,contact_action:action,outcome,source:'Direct'}});
test('contacts retain submitted addresses, group per system and distinguish outcomes',()=>{
 const e=[event('1','led','One@example.test','download'),event('2','led','one@example.test','email','confirmed'),event('3','projection','one@example.test','email')];
 const snapshot={events:e,leads:[{id:'lead1',email:'one@example.test',name:'Customer',company:'Training School',visitor_ids:e.map(x=>x.visitor_id)}],configurations:[]};
 const r=buildReport(snapshot,{preset:'Today'},now);assert.equal(r.configuratorContacts.length,2);
 const led=r.configuratorContacts.find(c=>c.configurator_type==='led');assert.equal(led.email,'one@example.test');assert.equal(led.name,'Customer');assert.deepEqual(led.actions,['download','email']);assert.ok(led.outcomes.includes('Email sent'));
 const proj=r.configuratorContacts.find(c=>c.configurator_type==='projection');assert.deepEqual(proj.outcomes,['Requested']);
 const filtered=buildReport(snapshot,{preset:'Today',configurator:'projection'},now);assert.equal(filtered.configuratorContacts.length,1);assert.equal(filtered.configuratorContacts[0].configurator_type,'projection');
});
test('anonymous visitors and unrelated contact forms do not become configurator contacts',()=>{
 const e=event('1','led','','email');delete e.properties.email;
 const r=buildReport({events:[e,{...event('2','website','a@example.test','email'),page_url:'/contact.html'}],leads:[],configurations:[]},{preset:'Today'},now);assert.equal(r.configuratorContacts.length,0);
});
