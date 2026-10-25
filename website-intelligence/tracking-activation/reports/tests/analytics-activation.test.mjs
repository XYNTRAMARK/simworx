import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReport} from '../analytics.js';

const now=new Date('2026-10-25T18:00:00Z');
const legacySteps=['configurator_opened','configurator_started','room_dimensions_entered','simulator_category_selected','screen_configuration_completed','price_viewed','configuration_completed','email_entered','configuration_emailed','enquiry_submitted'];
const ledSteps=legacySteps.filter(step=>!['room_dimensions_entered','simulator_category_selected'].includes(step));
const projectionSteps=legacySteps.filter(step=>step!=='simulator_category_selected');
let id=0;
function chain(session,type,version,steps,base='2026-10-25T10:00:00Z'){
  return steps.map((event_name,index)=>({event_id:'event_'+(++id),visitor_id:'visitor_'+session,session_id:session,event_name,page_url:type==='led'?'/led-screen-configurator.html':'/projection-screen-configurator-v37.html',timestamp:new Date(Date.parse(base)+index*10).toISOString(),properties:{configurator_type:type,configurator_version:version,configuration_id:'cfg_'+session,source:'Direct'}}));
}
function report(events){return buildReport({events,leads:[],configurations:[]},{preset:'Today'},now);}
const counts=rows=>Object.fromEntries(rows.map(row=>[row.key,row.count]));

test('current LED counts valid completion without fictional room or simulator steps',()=>{
  const events=chain('led-current','led','led-live-v1-659e06b8',ledSteps);
  const r=report(events),f=r.funnels.led;
  assert.equal(f.length,7);
  assert.equal(f.some(row=>['room','simulator'].includes(row.key)),false);
  assert.equal(counts(f).completed,1);assert.equal(counts(f).enquiries,1);
  assert.equal(r.metrics.configuratorToCompleted,100);
  assert.equal(r.events.some(e=>e.event_name==='room_dimensions_entered'||e.event_name==='simulator_category_selected'),false);
});

test('current Projection keeps its room requirement while simulator selection stays optional',()=>{
  const events=chain('projection-current','projection','projection-v37-d0f33b82',projectionSteps);
  const f=report(events).funnels.projection;
  assert.equal(f.some(row=>row.key==='room'),true);
  assert.equal(f.some(row=>row.key==='simulator'),false);
  assert.equal(counts(f).completed,1);
  const withoutRoom=events.filter(e=>e.event_name!=='room_dimensions_entered');
  assert.equal(counts(report(withoutRoom).funnels.projection).completed,0);
});

test('historical and unrecognized versions preserve their complete ordered funnel',()=>{
  for(const version of ['led_v1','led_v2','Unknown','led-live-v10']){
    const all=chain('old-'+version,'led',version,legacySteps);
    const complete=report(all).funnels.led;
    assert.equal(complete.length,10);assert.equal(counts(complete).completed,1);
    const missingRoom=report(all.filter(e=>e.event_name!=='room_dimensions_entered')).funnels.led;
    assert.equal(counts(missingRoom).completed,0);
  }
});

test('mixed LED versions show common milestones while retaining historical prerequisites',()=>{
  const current=chain('new','led','led-live-v1-659e06b8',ledSteps);
  const historical=chain('old','led','led_v1',legacySteps.filter(step=>step!=='room_dimensions_entered'));
  const rows=report([...historical,...current]).funnels.led;
  assert.equal(rows.some(row=>['room','simulator'].includes(row.key)),false);
  assert.equal(counts(rows).visitors,2);assert.equal(counts(rows).starts,2);
  assert.equal(counts(rows).screen,1);assert.equal(counts(rows).completed,1);
  assert.deepEqual(rows.find(row=>row.key==='screen').lostSessionIds,['old']);
  assert.deepEqual(rows[0].configuratorVersions,['led-live-v1-659e06b8','led_v1']);
});

test('two valid mixed-version cohorts each contribute one session to common milestones',()=>{
  const r=report([...chain('new','led','led-live-v1',ledSteps),...chain('old','led','led_v1',legacySteps)]);
  assert.ok(r.funnels.led.every(row=>row.count===2));
});

test('versions in one browser session cannot borrow missing progress from one another',()=>{
  const old=chain('shared','led','led_v1',['configurator_opened','configurator_started','room_dimensions_entered']);
  const current=chain('shared','led','led-live-v1',['screen_configuration_completed','price_viewed','configuration_completed'],'2026-10-25T10:01:00Z');
  const r=report([...old,...current]);
  assert.equal(counts(r.funnels.led).completed,0);
});

test('actual SDK performance and invalid-form names appear without mislabeling CLS as milliseconds',()=>{
  const events=chain('observations','led','led-live-v1',ledSteps.slice(0,2));
  const add=(event_name,properties)=>events.push({...events[0],event_id:'event_'+(++id),event_name,timestamp:'2026-10-25T10:10:00Z',properties});
  add('page_performance',{load_ms:1270,ttfb_ms:45});
  add('web_vitals',{metric:'LCP',value_ms:800});
  add('web_vitals',{metric:'CLS',value:0.02});
  add('form_invalid',{field_type:'email'});
  const problems=report(events).problems;
  assert.equal(problems.length,4);
  assert.equal(problems.find(p=>p.name==='page_performance').duration_ms,1270);
  assert.equal(problems.find(p=>p.message==='LCP').duration_ms,800);
  assert.equal(problems.find(p=>p.message==='CLS').type,'performance');
  assert.equal(problems.find(p=>p.message==='CLS').duration_ms,null);
  assert.equal(problems.find(p=>p.name==='form_invalid').type,'error');
});

test('current LED contact success reaches enquiry without inventing an emailed configuration',()=>{
  const events=chain('direct-contact','led','led-live-v1-659e06b8',ledSteps.filter(step=>step!=='configuration_emailed'));
  const r=report(events);
  assert.equal(counts(r.funnels.led).enquiries,1);
  assert.equal(counts(r.funnels.website).enquiries,1);
  assert.equal(r.funnels.led.some(row=>row.key==='emailed'),false);
  assert.equal(r.metrics.enquiries,1);assert.equal(r.metrics.emailed,0);
  assert.equal(r.configuratorMetrics.led.emailed,0);
  assert.equal(r.events.some(e=>e.event_name==='configuration_emailed'),false);
});

test('actual emailed configurations remain measured separately from the current core funnel',()=>{
  const events=chain('email-only','led','led-live-v1-659e06b8',ledSteps.filter(step=>step!=='enquiry_submitted'));
  const r=report(events);
  assert.equal(r.metrics.emailed,1);assert.equal(r.configuratorMetrics.led.emailed,1);
  assert.equal(r.configuratorMetrics.projection.emailed,0);
  assert.equal(counts(r.funnels.led).enquiries,0);
  assert.equal(r.funnels.led.some(row=>row.key==='emailed'),false);
});

test('historical enquiry funnel still requires its recorded emailed-configuration milestone',()=>{
  const events=chain('historical-contact','led','led_v1',legacySteps.filter(step=>step!=='configuration_emailed'));
  const r=report(events);
  assert.equal(r.metrics.enquiries,1);
  assert.equal(counts(r.funnels.led).enquiries,0);
  assert.equal(counts(r.funnels.website).enquiries,0);
});
