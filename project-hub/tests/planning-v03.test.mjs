import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../src/demo-data.mjs';
import {saveTask,setTaskStatus,predecessorIds,updateTaskPlan,captureBaseline,scheduleSummary,materialReadiness,clientProjection,saveBomLine} from '../src/model.mjs';

const get=(state,id)=>state.tasks.find(x=>x.id===id);

test('V0.3: multiple dependency links enforce same-project integrity',()=>{
 const s=seed();const t=saveTask(s,{projectId:'p1',sectionId:'s1',title:'Assembly acceptance',department:'Quality',priority:'High',start:'2027-02-04',due:'2027-02-11',predecessors:['t1','t3'],status:'Backlog'});
 assert.deepEqual(predecessorIds(t),['t1','t3']);
 assert.throws(()=>setTaskStatus(s,t.id,'Done'),/predecessor/);
 assert.throws(()=>updateTaskPlan(s,t.id,{predecessors:['t12']}),/from this project/);
 assert.throws(()=>updateTaskPlan(s,'t1',{predecessors:[t.id]}),/Circular/);
 assert.deepEqual(predecessorIds(get(s,'t1')),[]);
 setTaskStatus(s,'t3','Done');setTaskStatus(s,t.id,'Done');assert.equal(t.status,'Done');
});
test('V0.3: planning dates checked before any edit is saved',()=>{
 const s=seed(),t=get(s,'t3'),old=t.start;
 assert.throws(()=>updateTaskPlan(s,'t3',{start:'2027-01-01'}),/Finish date/);
 assert.equal(t.start,old);
 assert.throws(()=>updateTaskPlan(s,'t3',{start:'2026-02-30'}),/valid ISO/);
 assert.equal(t.start,old);
 updateTaskPlan(s,'t3',{start:'2026-11-10',due:'2026-11-24'});
 assert.equal(t.due,'2026-11-24');
});
test('V0.3: baseline snapshot stays unchanged after rescheduling and records lateness',()=>{
 const s=seed();const b=captureBaseline(s,'p1');const old=b.jobs.t3.due;
 updateTaskPlan(s,'t3',{due:'2026-12-02'});
 assert.equal(s.projects.find(p=>p.id==='p1').baseline.jobs.t3.due,old);
 const summary=scheduleSummary(s,'p1','2026-11-12');
 assert(summary.slipped.some(t=>t.id==='t3'));
 assert(summary.lagDays(get(s,'t3').due,old)>0);
 assert(summary.conflicts.some(x=>x.jobId==='t4'));
});
test('V0.3: omitted start dates are explicit unscheduled work, not invented',()=>{
 const s=seed();updateTaskPlan(s,'t7',{start:''});const r=scheduleSummary(s,'p1');
 assert(r.unscheduled.some(t=>t.id==='t7'));
 assert(r.total>r.planned);
});
test('V0.3: material readiness estimates missing quantities without mutating stock',()=>{
 const s=seed();const initial=s.parts.map(p=>p.onHand);const res=materialReadiness(s,'p1');
 assert(res.length>0);
 assert(res.every(x=>x.estimatedGap>=0&&x.incoming>=0));
 assert.deepEqual(s.parts.map(p=>p.onHand),initial);
 const extra=saveBomLine(s,{projectId:'p1',partId:'part6',sectionId:'s4',required:500});
 const later=materialReadiness(s,'p1').find(x=>x.id===extra.id);
 assert(later.estimatedGap>0);
 assert.equal(later.sectionId,'s4');
 assert.throws(()=>saveBomLine(s,{projectId:'p1',partId:'part7',sectionId:'s8',required:1}),/this project/);
});
test('V0.3: internal scheduling, material and baseline fields never leak to client projection',()=>{
 const s=seed();captureBaseline(s,'p1');const view=clientProjection(s,'noah','p1');
 assert(view?.project?.name.includes('NOAH'));
 assert(!JSON.stringify(view).includes('baseline'));
 assert(!JSON.stringify(view).includes('predecessors'));
 assert(!JSON.stringify(view).includes('SW-AL-100'));
 assert(!JSON.stringify(view).includes('€'));
});
