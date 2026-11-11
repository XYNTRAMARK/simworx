import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReport,adAttribution} from '../reports/analytics.js';
test('paid attribution repairs Other label, groups IDs and counts outcomes without duplicating visitors',()=>{
 const base={visitor_id:'v1',session_id:'s1',timestamp:'2026-10-25T12:00:00Z',page_url:'https://www.sim-worx.com/?utm_source=chatgpt&utm_medium=paid&utm_campaign=led_promotion&campaign_id=c1&ad_group_id=g1&ad_id=a1',properties:{source:'Other'}};
 const events=['page_view','page_view','enquiry_submitted'].map((event_name,i)=>({...base,event_name,event_id:'e'+i}));
 const r=buildReport({events},{preset:'Today'},new Date('2026-10-25T15:00:00Z'));
 assert.equal(r.openaiAds.length,1);assert.equal(r.openaiAds[0].ad_id,'a1');assert.equal(r.openaiAds[0].visitors,1);assert.equal(r.openaiAds[0].sessions,1);assert.equal(r.openaiAds[0].enquiries,1);assert.equal(r.sources[0].name,'OpenAI Ads');
});
test('unresolved placeholders are not treated as actual IDs',()=>{
 assert.equal(adAttribution({properties:{ad_id:'{ad_id}'}}).ad_id,undefined);
});

test('configurator navigation stays local and Live cannot be hidden by advanced filters',async()=>{
 const {readFile}=await import('node:fs/promises');
 const app=await readFile(new URL('../reports/app.js',import.meta.url),'utf8');
 assert.doesNotMatch(app,/value==='configurators'&&state\.filters\.configurator==='All'/);
 assert.doesNotMatch(app,/state\.configuratorTab=value;state\.filters\.configurator=value/);
 assert.match(app,/function liveWithoutAdvancedFilters\(\)/);
 assert.match(app,/hidden filters cannot make Live appear empty/);
 assert.match(app,/action==='clear-live-filters'/);
 assert.match(app,/action==='live-journey'/);
});
