import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const target=new URL('../analytics.js',import.meta.url);
const {buildReport,filterEvents,toCSV}=await import('data:text/javascript;base64,'+Buffer.from(await readFile(target,'utf8')).toString('base64'));
const now=new Date('2026-10-25T17:46:00Z');
const filters={preset:'Today'};
const tests=[
 {visitor:'3d82ec87-3bb0-46ae-b264-08a7e6a7c6dc',session:'08edd8cb-64a0-46c0-ba2b-e1b852773123',campaign:'TRACKING-VALIDATION-40216219930-454b04bd'},
 {visitor:'ff2236eb-5727-4cf6-83cf-8abdde5f96e0',session:'4a305dab-b73c-47b5-b555-740ce028e954',campaign:'TRACKING-VALIDATION-40217404628-da535ec6'},
];
const real={event_id:'real-1',visitor_id:'customer-1',session_id:'customer-session-1',event_name:'page_view',timestamp:'2026-10-25T17:45:00Z',page_url:'/visual-systems.html',properties:{source:'Direct',campaign:'Autumn',country:'France',device:'Desktop'}};
const qa=tests.flatMap((t,index)=>['session_started','page_view'].map((event_name,offset)=>({event_id:`qa-${index}-${offset}`,visitor_id:t.visitor,session_id:t.session,event_name,timestamp:`2026-10-25T17:44:0${index*2+offset}Z`,page_url:'/index.html',properties:{source:'Other',campaign:t.campaign,utm_campaign:t.campaign,utm_source:'tracking_validation',utm_medium:'verification',utm_content:'deployed-sdk',country:'QA-only-country',device:'QA-only-device'}})));
const snapshot={events:[...qa,real],sessions:tests.map(t=>({id:t.session,visitor_id:t.visitor,start_time:'2026-10-25T17:44:00Z',source:'Other',campaign:t.campaign,country:'QA-only-country',device:'QA-only-device'})),visitors:tests.map(t=>({id:t.visitor,first_seen:'2026-10-25T17:44:00Z'})),leads:tests.map((t,i)=>({id:'qa-lead-'+i,visitor_ids:[t.visitor],email:`qa${i}@example.invalid`,marketing_consent:true})),configurations:tests.map((t,i)=>({id:'qa-config-'+i,visitor_id:t.visitor,session_id:t.session,created_at:'2026-10-25T17:44:10Z',estimated_price:1000000,currency:'EUR'})),settings:{}};
function deepFreeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}

test('both known controlled visits are excluded consistently from every report result',()=>{
 const report=buildReport(snapshot,filters,now);
 const reference=buildReport({events:[real],settings:{}},filters,now);
 for(const key of ['metrics','previousMetrics','configuratorMetrics','deltas','daily','pages','sources','campaigns','categories','devices','countries','funnels','leads','subscribers','configurations','journeys','live','problems','abandoned','preferences','events','options','insights'])assert.deepEqual(report[key],reference[key],key);
 assert.equal(report.metrics.visitors,1);
 assert.equal(report.metrics.sessions,1);
 assert.equal(report.metrics.pageViews,1);
 assert.deepEqual(filterEvents(snapshot,filters,now),[real]);
 assert.ok(!toCSV(report.campaigns).includes('TRACKING-VALIDATION-'));
 assert.ok(!toCSV(report.leads).includes('@example.invalid'));
});

test('input remains unchanged and can be frozen: filtering never deletes stored records',()=>{
 const copy=structuredClone(snapshot),before=JSON.stringify(copy);
 deepFreeze(copy);
 buildReport(copy,filters,now);filterEvents(copy,filters,now);
 assert.equal(JSON.stringify(copy),before);
 assert.equal(copy.events.length,5);
 assert.equal(copy.sessions.length,2);
});

test('all events in a known controlled session are excluded even without marker properties',()=>{
 const unmarked={...qa[1],event_id:'unmarked-in-test-session',properties:{}};
 const report=buildReport({events:[unmarked,real]},filters,now);
 assert.deepEqual(report.events,[real]);
});

test('campaign prefix alone never hides a real visitor',()=>{
 const ordinary={...real,event_id:'similar-1',visitor_id:'customer-2',session_id:'customer-session-2',properties:{...real.properties,campaign:tests[0].campaign,utm_campaign:tests[0].campaign,utm_source:'google',utm_medium:'cpc'}};
 assert.equal(buildReport({events:[ordinary]},filters,now).metrics.visitors,1);
});

test('test-looking page names alone never hide real traffic',()=>{
 const ordinary={...real,page_url:'/tracking-validation.html',properties:{...real.properties,campaign:'TRACKING-VALIDATION-customer-campaign'}};
 assert.equal(buildReport({events:[ordinary]},filters,now).metrics.visitors,1);
});

test('empty or absent records remain valid',()=>{
 assert.equal(buildReport({},filters,now).metrics.visitors,0);
 assert.deepEqual(filterEvents({},filters,now),[]);
});

test('a future fully marked validation excludes its unmarked sibling events',()=>{
 const session_id='future-validation-session';
 const marker={...qa[0],event_id:'future-marker',session_id,properties:{...qa[0].properties,utm_campaign:'TRACKING-VALIDATION-40220000000-abcdef12'}};
 const sibling={...qa[1],event_id:'future-sibling',session_id,properties:{}};
 assert.deepEqual(filterEvents({events:[sibling,real,marker]},filters,now),[real]);
});

test('each part of the dedicated signature is required for unknown sessions',()=>{
 const signature={utm_source:'tracking_validation',utm_medium:'verification',utm_content:'deployed-sdk',utm_campaign:'TRACKING-VALIDATION-40220000000-abcdef12'};
 for(const key of Object.keys(signature)){
  const properties={...signature,[key]:'ordinary'};
  const ordinary={...real,event_id:'partial-'+key,session_id:'partial-'+key,properties};
  assert.equal(buildReport({events:[ordinary]},filters,now).metrics.visitors,1,key);
 }
});

test('later ordinary visits from a validation browser are still reported',()=>{
 const later={...real,visitor_id:tests[0].visitor,session_id:'new-real-session'};
 const r=buildReport({events:[...qa,later]},filters,now);
 assert.deepEqual(r.events,[later]);assert.equal(r.metrics.visitors,1);
 assert.equal(r.metrics.pageViews,1);assert.equal(r.journeys.length,1);
});

test('test traffic in the previous period is excluded from comparisons',()=>{
 const previous=qa.map(e=>({...e,timestamp:e.timestamp.replace('2026-10-25','2026-10-24')}));
 const r=buildReport({events:[...previous,real]},filters,now);
 assert.equal(r.previousMetrics.visitors,0);assert.equal(r.previousMetrics.pageViews,0);
 assert.equal(r.metrics.visitors,1);
});
