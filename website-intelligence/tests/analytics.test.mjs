import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReport,dateRange,intentScore,toCSV} from '../reports/analytics.js';
import {demoSnapshot} from '../reports/demo-data.js';

const now=new Date('2026-10-25T12:00:00Z');
let eventNo=0;
function event(visitor,session,event_name,timestamp,properties={}) {
  return {event_id:'event_'+(++eventNo),visitor_id:visitor,session_id:session,event_name,timestamp,page_url:'/visual-systems.html',properties:{source:'Google Ads',device:'Desktop',country:'United Kingdom',...properties}};
}
function funnelSession(visitor,session,at,type='led',extra={}) {
  const steps=['page_view',`${type}_configurator_opened`,`${type}_configurator_started`,'room_dimensions_entered','simulator_category_selected',type==='led'?'screen_configuration_completed':'screen_geometry_selected','price_viewed','configuration_completed','email_entered','configuration_emailed','enquiry_submitted'];
  return steps.map((step,i)=>event(visitor,session,step,new Date(Date.parse(at)+i*60000).toISOString(),{configurator_type:type,simulator_category:'Fighter',configuration_id:session+'_cfg',...extra}));
}

test('calendar ranges are Europe/Paris day boundaries and preserve DST day length',()=>{
  const today=dateRange({preset:'Today'},now);
  assert.equal(today.from,'2026-10-25');
  assert.equal(today.start,Date.parse('2026-10-24T22:00:00Z'));
  assert.equal(today.end,Date.parse('2026-10-25T23:00:00Z'));
  assert.equal(today.end-today.start,25*3600000);
  assert.equal(today.previousFrom,'2026-10-24');
  const afterCustom=dateRange({preset:'Today',from:'2026-09-01',to:'2026-09-10'},now);
  assert.equal(afterCustom.from,today.from);assert.equal(afterCustom.to,today.to);
  const days=dateRange({preset:'Last 30 Days'},now);
  assert.equal(days.from,'2026-09-26');assert.equal(days.to,'2026-10-25');
  assert.equal(days.previousFrom,'2026-08-27');assert.equal(days.previousTo,'2026-09-25');
  const lastMonth=dateRange({preset:'Last Month'},now);
  assert.equal(lastMonth.from,'2026-09-01');assert.equal(lastMonth.to,'2026-09-30');
});

test('empty snapshots stay empty, rather than presenting fictional observations',()=>{
  const r=buildReport({}, {preset:'Last 30 Days'},now);
  assert.equal(r.metrics.visitors,0);assert.equal(r.metrics.configuratorToCompleted,null);
  assert.equal(r.daily.length,0);assert.equal(r.insights.length,0);
  assert.equal(r.meta.collectionHasHistory,false);
});

test('duplicates and screen-setup events do not inflate completed configurations',()=>{
  const rows=funnelSession('v1','s1','2026-10-24T10:00:00Z');
  const completion=rows.find(e=>e.event_name==='configuration_completed');
  const r=buildReport({events:[...rows,completion,{...completion,event_id:'completion_retry'}]}, {preset:'Last 7 Days'},now);
  assert.equal(r.metrics.visitors,1);assert.equal(r.metrics.sessions,1);
  assert.equal(r.metrics.configuratorStarts,1);assert.equal(r.metrics.completed,1);
  const early=buildReport({events:rows.slice(0,6)},{preset:'Last 7 Days'},now);
  assert.equal(early.metrics.completed,0);assert.equal(early.funnels.led[4].count,1);
});

test('funnels enforce chronology and same-session progression',()=>{
  const ordered=funnelSession('v1','s1','2026-10-24T10:00:00Z');
  const outOfOrder=[event('v2','s2','page_view','2026-10-24T09:00:00Z',{configurator_type:'led'}),event('v2','s2','configuration_completed','2026-10-24T09:01:00Z',{configurator_type:'led'}),event('v2','s2','led_configurator_opened','2026-10-24T09:02:00Z',{configurator_type:'led'}),event('v2','s2','led_configurator_started','2026-10-24T09:03:00Z',{configurator_type:'led'})];
  const r=buildReport({events:[...ordered,...outOfOrder]},{preset:'Last 7 Days'},now);
  assert.deepEqual(r.funnels.led.map(s=>s.count),[2,2,1,1,1,1,1,1,1,1]);
  assert.equal(r.funnels.led[2].lost,1);assert.deepEqual(r.funnels.led[2].lostSessionIds,['s2']);
});

test('returning classification uses prior sessions, including history outside selection',()=>{
  const rows=[event('v1','s_old','page_view','2026-08-10T10:00:00Z'),event('v1','s_new','page_view','2026-10-24T10:00:00Z'),event('v2','s_other','page_view','2026-10-24T11:00:00Z')];
  const r=buildReport({events:rows},{preset:'Last 7 Days'},now);
  assert.equal(r.metrics.visitors,2);assert.equal(r.metrics.returningVisitors,1);
  const f=buildReport({events:rows},{preset:'Last 7 Days',visitorType:'Returning'},now);
  assert.equal(f.metrics.visitors,1);assert.equal(f.journeys[0].visitor_id,'v1');
});

test('global simulator/source/search filters scope events, configurations and records together',()=>{
  const rows=[...funnelSession('v1','s1','2026-10-24T10:00:00Z','led',{simulator_category:'Fighter'}),...funnelSession('v2','s2','2026-10-24T12:00:00Z','projection',{source:'LinkedIn',simulator_category:'Airliner'})];
  const configurations=[{id:'s1_cfg',visitor_id:'v1',session_id:'s1',created_at:'2026-10-24T10:07:00Z',currency:'EUR',estimated_price:50000},{id:'s2_cfg',visitor_id:'v2',session_id:'s2',created_at:'2026-10-24T12:07:00Z',currency:'USD',estimated_price:80000}];
  const leads=[{id:'lead1',email:'one@example.test',visitor_ids:['v1'],marketing_consent:false},{id:'lead2',email:'two@example.test',visitor_ids:['v2'],marketing_consent:true}];
  const r=buildReport({events:rows,configurations,leads},{preset:'Last 7 Days',category:'Fighter'},now);
  assert.equal(r.metrics.visitors,1);assert.equal(r.metrics.completed,1);assert.equal(r.leads.length,1);
  assert.equal(r.configurations.length,1);assert.equal(r.sources.length,1);assert.equal(r.funnels.projection[0].count,0);
  const q=buildReport({events:rows,configurations,leads},{preset:'Last 7 Days',query:'two@example.test'},now);
  assert.equal(q.metrics.visitors,1);assert.equal(q.journeys[0].visitor_id,'v2');
});

test('potential configured values preserve currencies and newsletter subscribers require explicit opt-in',()=>{
  const events=[...funnelSession('v1','s1','2026-10-24T10:00:00Z'),...funnelSession('v2','s2','2026-10-24T12:00:00Z')];
  const configurations=[{id:'s1_cfg',visitor_id:'v1',session_id:'s1',created_at:'2026-10-24T10:07:00Z',currency:'EUR',estimated_price:50000},{id:'s2_cfg',visitor_id:'v2',session_id:'s2',created_at:'2026-10-24T12:07:00Z',currency:'USD',estimated_price:80000}];
  const leads=[{id:'l1',visitor_ids:['v1'],marketing_consent:false},{id:'l2',visitor_ids:['v2'],marketing_consent:true}];
  const r=buildReport({events,configurations,leads},{preset:'Last 7 Days'},now);
  assert.deepEqual(r.sources[0].valueByCurrency,{EUR:50000,USD:80000});
  assert.equal(r.leads.length,2);assert.equal(r.subscribers.length,1);assert.equal(r.metrics.subscribers,1);
});

test('inactivity, not a still-active session, determines inferred abandonment',()=>{
  const rows=[...funnelSession('old','old_session','2026-10-25T10:00:00Z').slice(0,5),...funnelSession('active','active_session','2026-10-25T11:50:00Z').slice(0,5)];
  const r=buildReport({events:rows},{preset:'Today'},now);
  assert.equal(r.abandoned.length,1);assert.equal(r.abandoned[0].visitor_id,'old');
  assert.equal(r.live.length,0); // last active event is six minutes ago, outside 5-minute live window
});

test('intent rules award once per behavior, not every event or every session',()=>{
  const rows=funnelSession('v1','s1','2026-10-24T10:00:00Z');
  assert.equal(intentScore([...rows,...rows]),intentScore(rows));
  const first=event('v','s1','led_configurator_opened','2026-10-24T10:00:00Z',{configurator_type:'led'});
  const later=event('v','s2','led_configurator_opened','2026-10-24T11:00:00Z',{configurator_type:'led'});
  assert.equal(intentScore([first,later]),10); // separate short sessions are not five minutes of engagement
});

test('CSV quotes content, preserves newlines and escapes spreadsheet formulas',()=>{
  const csv=toCSV([{email:'a@example.test',notes:'=HYPERLINK("x")\nhello,world'}],['email','notes']);
  assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes("\"'=HYPERLINK(\"\"x\"\")\nhello,world\""));
});

test('demo fixture is deterministic, fictional, chronological and never in the future',()=>{
  const a=demoSnapshot(now),b=demoSnapshot(now);
  assert.deepEqual(a,b);assert.equal(a.meta.demo,true);
  assert.ok(a.events.every(e=>Date.parse(e.timestamp)<=+now));
  assert.ok(a.leads.every(l=>l.email.endsWith('@example.test')));
  const r=buildReport(a,{preset:'Last 30 Days'},now);
  assert.ok(r.metrics.visitors>0);assert.equal(r.daily.length,30);assert.equal(r.live.length,3);
  for(const funnel of Object.values(r.funnels)) for(let i=1;i<funnel.length;i++)assert.ok(funnel[i].count<=funnel[i-1].count);
});

test('midnight-spanning configurations are confined to their creation calendar date',()=>{
  const events=[event('v','s','page_view','2026-10-24T21:55:00Z'),event('v','s','configuration_completed','2026-10-24T22:05:00Z',{configuration_id:'midnight'})];
  const configurations=[{id:'midnight',visitor_id:'v',session_id:'s',created_at:'2026-10-24T22:05:00Z',estimated_price:10000,currency:'EUR'}];
  const yesterday=buildReport({events,configurations},{preset:'Yesterday'},now);
  assert.equal(yesterday.metrics.visitors,1);assert.equal(yesterday.configurations.length,0);
  assert.deepEqual(yesterday.sources[0].valueByCurrency,{});
  const today=buildReport({events,configurations},{preset:'Today'},now);
  assert.equal(today.configurations.length,1);
});

test('completion rate rejects completion emitted before start',()=>{
  const rows=[event('v','s','configuration_completed','2026-10-24T10:00:00Z',{configurator_type:'led'}),event('v','s','led_configurator_started','2026-10-24T10:01:00Z',{configurator_type:'led'})];
  const r=buildReport({events:rows},{preset:'Last 7 Days'},now);
  assert.equal(r.metrics.completed,1);assert.equal(r.metrics.configuratorToCompleted,0);
});

test('page engagement belongs to its page-view identifier or interval, including revisits',()=>{
  const first=event('v','s','page_view','2026-10-24T10:00:00Z',{page_view_id:'view1'});
  const firstTime=event('v','s','engagement','2026-10-24T10:01:00Z',{page_view_id:'view1',engagement_seconds:10,scroll_depth:25});
  const other={...event('v','s','page_view','2026-10-24T10:02:00Z'),page_url:'/other.html'};
  const second=event('v','s','page_view','2026-10-24T10:03:00Z',{page_view_id:'view2'});
  const secondTime=event('v','s','engagement','2026-10-24T10:04:00Z',{page_view_id:'view2',engagement_seconds:100,scroll_depth:75});
  const r=buildReport({events:[first,firstTime,other,second,secondTime]},{preset:'Last 7 Days'},now);
  const page=r.pages.find(p=>p.url==='/visual-systems.html');
  assert.equal(page.views,2);assert.equal(page.avgTime,55);assert.equal(page.scrollDepth,50);
});
