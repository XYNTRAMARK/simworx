/* Read the deployed calculation module and verify filtering with local fixtures.
 * This verifier never contacts the collection API or database.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const plan=JSON.parse(await readFile(new URL('../plan.json',import.meta.url),'utf8'));
const response=await fetch('https://sim-worx.com/reports/analytics.js?report-filter='+plan.expected_after.slice(0,12),{signal:AbortSignal.timeout(30000)});
assert.equal(response.status,200,'Deployed report calculations must be readable.');
const source=await response.text();
assert.equal(createHash('sha256').update(source).digest('hex'),plan.expected_after,'Public calculations must match the reviewed file.');
const {buildReport,filterEvents}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const now=new Date();
const base={event_name:'page_view',timestamp:new Date(+now-1000).toISOString(),page_url:'/index.html',properties:{}};
const qa=[
 {event_id:'preserved-qa-1',visitor_id:'3d82ec87-3bb0-46ae-b264-08a7e6a7c6dc',session_id:'08edd8cb-64a0-46c0-ba2b-e1b852773123'},
 {event_id:'preserved-qa-2',visitor_id:'ff2236eb-5727-4cf6-83cf-8abdde5f96e0',session_id:'4a305dab-b73c-47b5-b555-740ce028e954'}
].map(row=>({...base,...row}));
const ordinary={...base,event_id:'ordinary-visit',visitor_id:'ordinary-browser',session_id:'ordinary-session'};
const snapshot={events:[...qa,ordinary]};
const before=JSON.stringify(snapshot);
const report=buildReport(snapshot,{preset:'Last 7 Days'},now);
assert.equal(report.metrics.visitors,1);assert.equal(report.metrics.sessions,1);assert.equal(report.metrics.pageViews,1);
assert.deepEqual(report.events,[ordinary]);assert.deepEqual(filterEvents(snapshot,{preset:'Last 7 Days'},now),[ordinary]);
assert.equal(JSON.stringify(snapshot),before,'Filtering must leave input records intact.');
assert.equal(buildReport({events:qa},{preset:'Last 7 Days'},now).metrics.visitors,0);
const proof={passed:true,verified_at:new Date().toISOString(),sha256:plan.expected_after,checks:['deployed-file-hash','known-test-sessions-excluded','ordinary-visit-preserved','input-records-unchanged'],database_requests:0};
const output=process.env.REPORT_FILTER_PROOF_PATH;
if(output){await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(proof,null,2)+'\n');}
console.log('Deployed report filter verified:',JSON.stringify(proof));
