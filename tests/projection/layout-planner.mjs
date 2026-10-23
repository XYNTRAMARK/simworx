import assert from 'node:assert/strict';
import {findLayout,roomIssues,budgetAssessment} from '../../projection/src/layout-planner.js';
let checks=0;const check=(v,message)=>{assert.ok(v,message);checks++;};
const model={id:'fixture',model:'Known fixture',plannerReady:true,fullVerificationAllowed:true,throwRatio:{min:.5,max:.8},resolution:{width:1920,height:1080,aspectWidth:16,aspectHeight:9},opticalOffset:{normalizedCenterOffsetImageHeights:.525},body:{widthMm:300,heightMm:100,depthMm:200},installation:{orientations:['ceiling-inverted'],maxPitchFromLevelDeg:90,wallClearanceMm:0}};
const catalogue={commercial:{projectorPricesEur:{fixture:1000},mountingKit:{priceEur:0}},ledTariff:{servicePlans:[{id:'self',rate:{amount:0,currency:'EUR'}}]}};
const state={room:{enabled:true,width:8,depth:8,height:3.6},diameter:4.5,viewableHeight:2,screenBottom:.4,horizontalFov:180,enclosure:'screen-only',showSimulator:false,servicePlan:'self',mountingKit:true,simulatorX:0,simulatorZ:0,simulatorY:0,simulatorYaw:0,simulatorWidth:2,simulatorDepth:2,simulatorHeight:2};
const makeRecord=p=>{const [y,a,r]=[p.yaw,p.pitch,p.roll].map(v=>v*Math.PI/180),cy=Math.cos(y),sy=Math.sin(y),ca=Math.cos(a),sa=Math.sin(a),cr=Math.cos(r),sr=Math.sin(r);return {id:p.id,position:p.position,forward:[-sy*ca,sa,-cy*ca],right:[cy*cr+sy*sa*sr,ca*sr,-sy*cr+cy*sa*sr],up:[-cy*sr+sy*sa*cr,ca*cr,sy*sr+cy*sa*cr],aspect:16/9,throwRatio:p.throwRatio,throwRatioMin:.5,throwRatioMax:.8,centerOffset:.525};};
const options={state,models:[model],catalogue,preferences:{budget:2500},contextFor:()=>({makeRecord,obstruction:()=>false,cockpitBounds:null}),eyesFor:()=>[[0,1.5,0]],yieldControl:async()=>{}};
check(!roomIssues(state).length,'Valid room and screen fit');check(roomIssues({...state,room:{...state.room,height:2}}).some(s=>s.includes('height')),'Low ceilings fail screen fit');check(roomIssues({...state,room:{...state.room,width:3}}).some(s=>s.includes('screen')),'Narrow room rejects oversized screen');
const first=await findLayout(options);check(first.best,'Search finds a physical matched layout');check(first.best.projectors.length===2,'Known budget excludes unaffordable third projector');check(first.best.projectors.every(p=>p.position[1]===first.best.projectors[0].position[1]),'Every projector shares one lens height');check(first.best.projectors.every(p=>Math.abs(p.position[0])<state.room.width/2&&Math.abs(p.position[2])<state.room.depth/2&&p.position[1]<state.room.height),'Positions remain inside room');
check(first.best.projectors.every(p=>Math.hypot(p.position[0],p.position[2])<=state.diameter/2-.08+1e-6),'Projector lens centres remain inside the screen plan footprint');

const offCentre={...state,room:{...state.room,width:9,depth:8,screenFromLeft:3.2,screenFromFront:4.7}};
check(roomIssues(offCentre).length===0,'Off-centre screen position can be valid inside the room');
const impossibleScreen={...state,room:{...state.room,width:4,depth:4,screenFromLeft:.2,screenFromFront:.2}};
check(roomIssues(impossibleScreen).some(x=>x.includes('screen lies outside')),'Screen position is checked against actual room wall distances');
check(first.best.projectors.every(p=>p.throwRatio>=.5&&p.throwRatio<=.8&&p.roll===180),'Throw and mounting orientation restrictions enforced');check(first.best.budget.confirmed===false,'Known projector prices never establish a complete system budget');check(state.diameter===4.5&&state.room.height===3.6,'Search does not mutate original screen or room');
const none=await findLayout({...options,preferences:{budget:1500}});check(none.best&&none.priceExcluded>0&&none.best.budget.withinKnownBudget===false,'Insufficient known budget still returns the nearest geometric proposal and flags the budget compromise');
const unknown=budgetAssessment({model,count:3,catalogue:{...catalogue,commercial:{...catalogue.commercial,projectorPricesEur:{fixture:null}}},budget:2500,band:'500-1000'});check(unknown.projectorCost===null&&unknown.withinKnownBudget===null&&!unknown.confirmed,'Unknown prices remain unknown rather than zero or under budget');
check(!budgetAssessment({model,count:2,catalogue,budget:5000,band:'3000-plus'}).permitted,'Price band excludes known nonmatching models');
const low=await findLayout({...options,state:{...state,room:{...state.room,height:2}}});check(!low.best&&low.issues.length,'Impossible room produces explicit failure');
const resized=await findLayout({...options,state:{...state,viewableHeight:3.4},preferences:{budget:2500,allowScreenResize:true}});check(resized.best&&resized.best.state.viewableHeight<3.4,'Opt-in screen optimisation can return a fitting smaller screen');
check(first.requiredThrowRatio!==null&&first.requiredThrowRatio<=first.best.projectors[0].throwRatio,'Planner reports an indicative target throw ratio');

const projectorOnly=await findLayout({...options,state:{...state,showSimulator:true,simulatorZ:.3},preferences:{budget:2500,objective:'projector'}});
check(projectorOnly.best&&projectorOnly.best.state.diameter===state.diameter&&projectorOnly.best.state.viewableHeight===state.viewableHeight&&projectorOnly.best.state.simulatorZ===.3,'Projector objective preserves the physical screen and cockpit setup');
const roomMode=await findLayout({...options,state:{...state,showSimulator:true,simulatorZ:0},preferences:{budget:2500,objective:'room'}});
check(roomMode.best&&roomMode.objective==='room','Room objective returns a scored room-fit proposal');
const budgetMode=await findLayout({...options,state:{...state,showSimulator:true,simulatorZ:0},preferences:{budget:1500,objective:'budget'}});
check(budgetMode.best&&budgetMode.objective==='budget','Budget objective still returns the best visible compromise when the known projector set exceeds budget');

const noCeiling=await findLayout({...options,models:[{...model,installation:{orientations:['upright']}}]});check(!noCeiling.best&&!noCeiling.eligible,'Unsupported mounting orientation does not receive an automatic ceiling recommendation');
console.log(checks+' independent geometry, room, budget and matching checks passed');
