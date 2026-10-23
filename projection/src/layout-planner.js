import {screenPoint,screenPointCoverage,firstScreenIntersection} from 'projection:/src/optics.js';
const RAD=Math.PI/180,DEG=180/Math.PI,finite=n=>typeof n==='number'&&Number.isFinite(n),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const screenOf=s=>({radius:s.diameter/2,height:s.viewableHeight,bottom:s.screenBottom,arcDegrees:s.horizontalFov});
const blocked=value=>value===true||value?.blocked===true||value?.assessed===false;
export function normalisePreferences(input={},defaultModel=''){
 const p=input&&typeof input==='object'?input:{};
 return {budget:finite(p.budget)&&p.budget>0&&p.budget<=10000000?p.budget:null,mode:p.mode==='fixed'?'fixed':'recommend',modelId:typeof p.modelId==='string'&&p.modelId.length<=200?p.modelId:defaultModel,count:['2','3',2,3].includes(p.count)?String(p.count):'auto',band:['500-1000','1000-3000','3000-plus'].includes(p.band)?p.band:'any',mountDrop:finite(p.mountDrop)&&p.mountDrop>=.2&&p.mountDrop<=1.5?p.mountDrop:.35,allowScreenResize:p.allowScreenResize===true,objective:['room','projector','budget'].includes(p.objective)?p.objective:'current'};
}
function pilotSees(eye,point,state,obstruction){
 const delta=point.map((v,k)=>v-eye[k]),distance=Math.hypot(...delta),hit=firstScreenIntersection(eye,delta,screenOf(state),{maxDistance:distance+1e-5});
 return Boolean(hit&&Math.abs(hit.distance-distance)<1e-4&&!blocked(obstruction(eye,point)));
}
export function roomIssues(state){
 const room=state.room,issues=[];
 if(!room||!['width','depth','height'].every(k=>finite(room[k])&&room[k]>=1&&room[k]<=50))return ['Enter valid internal room dimensions.'];
 const screen=screenOf(state),extra=state.enclosure==='fully-enclosed'?.42:state.enclosure==='semi-enclosed'?.34:0;
 for(let i=0;i<=64;i++){const p=screenPoint(screen,i/64,1);if(Math.abs(p[0])>room.width/2-.06||Math.abs(p[2])>room.depth/2-.06){issues.push('The screen extends outside the room. Reduce its diameter or use a larger room.');break;}}
 if(state.screenBottom+state.viewableHeight+extra>room.height-.05)issues.push('The screen or enclosure is taller than the clear room height. Lower its top edge or reduce its height.');
 if(state.showSimulator){const r=state.simulatorYaw*RAD,w=Math.abs(Math.cos(r))*state.simulatorWidth+Math.abs(Math.sin(r))*state.simulatorDepth,d=Math.abs(Math.sin(r))*state.simulatorWidth+Math.abs(Math.cos(r))*state.simulatorDepth;
 if(Math.abs(state.simulatorX)+w/2>room.width/2-.05||Math.abs(state.simulatorZ)+d/2>room.depth/2-.05||state.simulatorY+state.simulatorHeight>room.height-.05)issues.push('The cockpit extends outside the room. Review its position or room dimensions.');}
 return issues;
}
export function budgetAssessment({model,count,catalogue,budget,band='any',servicePlan='self',mountingKit=true,supply='simworx'}){
 const unit=catalogue.commercial.projectorPricesEur[model.id],known=finite(unit)&&unit>0,projectorCost=supply==='customer'?0:known?count*unit:null;
 const limits={'500-1000':[500,1000],'1000-3000':[1000,3000],'3000-plus':[3000,Infinity]};
 const permitted=band==='any'||!known||(unit>=limits[band]?.[0]&&unit<=limits[band]?.[1]);
 const plan=catalogue.ledTariff.servicePlans.find(p=>p.id===servicePlan),service=plan?.rate?.currency==='EUR'?plan.rate.amount:null,kit=mountingKit?catalogue.commercial.mountingKit.priceEur:0;
 const knownSubtotal=projectorCost===null?null:projectorCost+(finite(service)?service:0)+(finite(kit)?kit:0);
 return {permitted,unitPrice:known?unit:null,projectorCost,knownSubtotal,withinKnownBudget:finite(budget)&&budget>0&&projectorCost!==null?projectorCost<=budget:null,confirmed:false,reason:projectorCost===null?'Projector selling prices need confirmation.':'Projector budget checks apply to the projector set; screen, mounting and services are separate.'};
}
function points(state,columns,rows,context,eyes){
 const s=screenOf(state),all=[];
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
  const p=screenPoint(s,(x+.5)/columns,(y+.5)/rows);
  const visible=!state.showSimulator||eyes.some(eye=>pilotSees(eye,p,state,context.obstruction));
  all.push({p,visible,row:y});
 }
 return all;
}
function assess(state,projectors,context,samples,shadow){
 const screen=screenOf(state),records=projectors.map(p=>context.makeRecord(p)),rows=new Map(),pairs=Array.from({length:Math.max(0,projectors.length-1)},()=>new Map());let lit=0,visible=0,visibleLit=0,visibleShadow=0,overlap=0;
 for(const sample of samples){let n=0,planned=0,mask=0;
  for(let i=0;i<records.length;i++){const c=screenPointCoverage(sample.p,screen,records[i],{obstruction:shadow?context.obstruction:undefined,index:i});if(c.inFootprint)planned++;if(c.usable){n++;mask|=1<<i;}}
  for(let i=0;i<pairs.length;i++)pairs[i].set(sample.row,(pairs[i].get(sample.row)||false)||Boolean((mask&(1<<i))&&(mask&(1<<(i+1)))));
  if(n)lit++;if(n>1)overlap++;
  if(sample.visible){visible++;if(n)visibleLit++;if(planned&&!n)visibleShadow++;}
  const r=rows.get(sample.row)||{total:0,overlap:0};r.total++;if(n>1)r.overlap++;rows.set(sample.row,r);
 }
 const coverage=lit/samples.length,pilotCoverage=visible?visibleLit/visible:null,shadowFraction=visible?visibleShadow/visible:null,overlapFraction=overlap/samples.length;
 const overlapEveryRow=pairs.length>0&&pairs.every(pair=>[...pair.values()].every(Boolean));
 const score=(pilotCoverage??coverage)*6+coverage*1.5+(Math.min(overlapFraction,.18)/.18)*.15-(shadowFraction??0)*2-(overlapEveryRow?0:.4);
 return {coverage,pilotCoverage,shadowFraction,overlapFraction,visibleSamples:visible,totalSamples:samples.length,score,overlapEveryRow};
}
function channelLayout(state,model,count,height,scale,zShift,throwRatio,fan,vertical){
 const r=state.diameter/2,arc=state.horizontalFov*RAD,aspect=model.resolution.aspectWidth/model.resolution.aspectHeight,offset=model.opticalOffset?.normalizedCenterOffsetImageHeights;
 if(!finite(offset)||!(aspect>0))return null;
 const chord=2*r*Math.sin(arc/count/2),distance=Math.max(state.viewableHeight*aspect,chord)*throwRatio*scale;
 const list=[];
 for(let i=0;i<count;i++){
  const angle=((i+.5)/count-.5)*arc*fan,target=screenPoint(screenOf(state),clamp((i+.5)/count*fan+(1-fan)/2,0,1),vertical);
  const position=[Math.sin(angle)*(r-distance),height,-Math.cos(angle)*(r-distance)+zShift],delta=target.map((n,k)=>n-position[k]);
  const pitch=(Math.atan2(delta[1],Math.hypot(delta[0],delta[2]))+Math.atan(offset/(throwRatio*aspect)))*DEG,yaw=Math.atan2(-delta[0],-delta[2])*DEG;
  if(finite(model.installation?.maxPitchFromLevelDeg)&&Math.abs(pitch)>model.installation.maxPitchFromLevelDeg+.001)return null;
  list.push({id:'P'+(i+1),modelId:model.id,supplyStatus:'simworx',position,yaw,pitch,roll:180,throwRatio,shiftX:0,shiftY:0,locked:false});
 }
 return list;
}
function placementPenalty(state,list,model,context){
 const b=model.body||{},margin=Math.max(.12,Math.hypot(b.widthMm||300,b.heightMm||150,b.depthMm||300)/2000),wall=margin+(model.installation?.wallClearanceMm||0)/1000,box=context.cockpitBounds;
 if(list.some(p=>Math.abs(p.position[0])+wall>=state.room.width/2||Math.abs(p.position[2])+wall>=state.room.depth/2||p.position[1]+margin>=state.room.height||p.position[1]-margin<=0))return {hard:true,penalty:99,reasons:['Projector body would lie outside the room boundary.']};
 let penalty=0,reasons=[];
 if(list.some((a,i)=>list.slice(i+1).some(b=>Math.hypot(...a.position.map((v,k)=>v-b.position[k]))<2*margin+.08))){penalty+=1.5;reasons.push('Projector body clearances overlap in the schematic model.');}
 if(box&&list.some(p=>p.position.every((n,k)=>n>box.min[k]-margin&&n<box.max[k]+margin))){penalty+=1.2;reasons.push('A schematic projector body overlaps the cockpit clearance envelope.');}
 return {hard:false,penalty,reasons};
}
function fits(state,list,model,context){const result=placementPenalty(state,list,model,context);return !result.hard&&result.penalty===0;}
export async function findLayout({state,models,catalogue,preferences,contextFor,eyesFor,yieldControl=()=>new Promise(r=>setTimeout(r,0)),onProgress=()=>{}}){
 const prefs={...normalisePreferences(preferences),supply:preferences?.supply},variants=[{...state}];
 const roomOptimisation=prefs.objective==='room'||prefs.objective==='budget';
 if(roomOptimisation){
  const extra=state.enclosure==='fully-enclosed'?.42:state.enclosure==='semi-enclosed'?.34:0;
  const maxDiameter=Math.max(2,Math.min(state.room.width-.3,state.room.depth-.3,12));
  const maxHeight=Math.max(1,Math.min(state.room.height-state.screenBottom-extra-.15,5));
  const diameters=[state.diameter,state.diameter-.3,state.diameter+.3,state.diameter-.6,state.diameter+.6].map(v=>clamp(v,2,maxDiameter));
  const heights=[state.viewableHeight,state.viewableHeight-.2,state.viewableHeight+.2].map(v=>clamp(v,1,maxHeight));
  const cockpitMoves=state.showSimulator?[0,.2,.4,-.2]:[0];
  for(const diameter of diameters)for(const viewableHeight of heights)for(const move of cockpitMoves){
   const candidate={...state,diameter,viewableHeight,simulatorZ:clamp((state.simulatorZ||0)+move,-4,4)};
   if(!variants.some(v=>Math.abs(v.diameter-candidate.diameter)<1e-6&&Math.abs(v.viewableHeight-candidate.viewableHeight)<1e-6&&Math.abs((v.simulatorZ||0)-candidate.simulatorZ)<1e-6))variants.push(candidate);
  }
 }
 if(prefs.allowScreenResize&&prefs.objective!=='projector'){
  const extra=state.enclosure==='fully-enclosed'?.42:state.enclosure==='semi-enclosed'?.34:0;
  const diameter=Math.min(state.diameter,state.room.width-.3,state.room.depth-.3),height=Math.min(state.viewableHeight,state.room.height-state.screenBottom-extra-.15);
  if(diameter>=2&&height>=1)variants.push({...state,diameter,viewableHeight:height});
  for(const factor of [.9,.8])if(height*factor>=1)variants.push({...state,diameter,viewableHeight:height*factor});
  if(diameter*.9>=Math.max(2,state.showSimulator?state.simulatorWidth+.4:2)&&height>=1)variants.push({...state,diameter:diameter*.9,viewableHeight:height});
 }
 let best=null,examined=0,geometric=0,priceExcluded=0,eligible=0;const failures=[];
 for(let index=0;index<variants.length;index++){
  const candidateState=variants[index],issues=roomIssues(candidateState);if(issues.length){failures.push(...issues);continue;}
  const context=contextFor(candidateState),box=context.cockpitBounds;
  if(box){let intersects=false;for(let u=0;u<=64&&!intersects;u++)for(const v of [.05,.5,.95]){const point=screenPoint(screenOf(candidateState),u/64,v);if(point.every((n,k)=>n>box.min[k]+.02&&n<box.max[k]-.02)){intersects=true;break;}}if(intersects)failures.push('The current screen passes through the cockpit clearance envelope. The planner will still show the best projector result so you can move the cockpit or resize the screen and compare.');}
  const eyes=eyesFor(candidateState),coarse=points(candidateState,12,6,context,eyes),shortlists=new Map();
  for(const model of models){
   if(model.plannerReady===false||!finite(model.throwRatio?.min)||!finite(model.throwRatio?.max)||!finite(model.opticalOffset?.normalizedCenterOffsetImageHeights)||!model.installation?.orientations?.includes('ceiling-inverted'))continue;
   for(const count of prefs.count==='auto'?[2,3]:[Number(prefs.count)]){
    const budget=budgetAssessment({model,count,catalogue,budget:prefs.objective==='room'?null:prefs.budget,band:prefs.objective==='room'?'any':prefs.band,servicePlan:state.servicePlan,mountingKit:state.mountingKit,supply:prefs.supply});
    if(!budget.permitted){priceExcluded++;continue;}if(budget.withinKnownBudget===false)priceExcluded++;eligible++;
    const budgetPenalty=budget.withinKnownBudget===false?(prefs.objective==='budget'?4:2):0;
    const zoom=[...new Set([model.throwRatio.min,(model.throwRatio.min+model.throwRatio.max)/2,model.throwRatio.max])];
    for(const height of [state.room.height-prefs.mountDrop,state.room.height-prefs.mountDrop-.25,state.room.height-prefs.mountDrop-.5])for(const scale of [.85,1.05,1.3,1.6])for(const z of [0,.45,.9])for(const ratio of zoom)for(const fan of [1,1.12])for(const v of [.4,.55]){
     examined++;if(examined%80===0){onProgress({examined,stage:'Searching room-fitting layouts'});await yieldControl();}
     const list=channelLayout(candidateState,model,count,height,scale,z,ratio,fan,v);if(!list)continue;const placement=placementPenalty(candidateState,list,model,context);if(placement.hard)continue;geometric++;
     const metrics=assess(candidateState,list,context,coarse,false),changePenalty=(prefs.objective==='projector'?0:(Math.abs(candidateState.diameter-state.diameter)*.04+Math.abs(candidateState.viewableHeight-state.viewableHeight)*.04+Math.abs((candidateState.simulatorZ||0)-(state.simulatorZ||0))*.08)),choice={state:candidateState,projectors:list,model,budget,metrics,placement,layoutParams:{height,scale,z,ratio,fan,v},score:metrics.score-count*.002-placement.penalty-budgetPenalty-changePenalty};
     const key=model.id+':'+count,listOfChoices=shortlists.get(key)||[];listOfChoices.push(choice);listOfChoices.sort((a,b)=>b.score-a.score);if(listOfChoices.length>5)listOfChoices.length=5;shortlists.set(key,listOfChoices);
    }
   }
  }
  const fine=points(candidateState,40,20,context,eyes);
  for(const choice of [...shortlists.values()].flat()){choice.metrics=assess(candidateState,choice.projectors,context,fine,true);const changePenalty=(prefs.objective==='projector'?0:(Math.abs(choice.state.diameter-state.diameter)*.04+Math.abs(choice.state.viewableHeight-state.viewableHeight)*.04+Math.abs((choice.state.simulatorZ||0)-(state.simulatorZ||0))*.08));choice.score=choice.metrics.score-choice.projectors.length*.002-(choice.placement?.penalty||0)-(choice.budget?.withinKnownBudget===false?(prefs.objective==='budget'?4:2):0)-changePenalty+Math.log2(Math.max(1,(choice.model.resolution.width||1)*(choice.model.resolution.height||1))/1e6)*.015+Math.log2(Math.max(1,choice.model.brightness?.lumens||1)/1000)*.005;
   if(!best||choice.score>best.score+1e-8||Math.abs(choice.score-best.score)<1e-8&&(choice.budget.knownSubtotal??Infinity)<(best.budget.knownSubtotal??Infinity))best=choice;
   onProgress({examined,stage:'Checking pilot-visible shadows'});await yieldControl();
  }
 }
 let requiredThrowRatio=null;
 if(best){
  const current=Math.min(...best.projectors.map(p=>p.throwRatio).filter(finite));
  requiredThrowRatio=current;
  if((best.metrics.shadowFraction??0)>.005||best.metrics.pilotCoverage<.995){
   const context=contextFor(best.state),eyes=eyesFor(best.state),fine=points(best.state,32,16,context,eyes),p=best.layoutParams;
   for(let ratio=Math.max(.2,current-.03);ratio>=Math.max(.2,current*.55)-1e-9;ratio-=.03){
    const list=channelLayout(best.state,best.model,best.projectors.length,p.height,p.scale,p.z,ratio,p.fan,p.v);if(!list)continue;
    const placement=placementPenalty(best.state,list,best.model,context);if(placement.hard)continue;
    const metrics=assess(best.state,list,context,fine,true);
    if(metrics.pilotCoverage>=.995&&metrics.coverage>=.95&&(metrics.shadowFraction??1)<=.005){requiredThrowRatio=Math.round(ratio*100)/100;break;}
   }
  }
 }
 return {best,examined,geometric,priceExcluded,eligible,requiredThrowRatio,fallbackUsed:Boolean(best?.placement?.penalty),objective:prefs.objective,issues:[...new Set([...(failures||[]),...(best?.placement?.reasons||[])])],method:'Matched ceiling-mounted layouts; bounded sampled search; one lens height per layout; optional room/projector/budget objectives; imperfect arrangements retained and scored',completeSearch:false};
}
export function evaluatePilotCoverage(state,result,eyes,obstruction){
 const cells=result?.cells||[],stride=Math.max(1,Math.floor(cells.length/800));let visible=0,covered=0,shadow=0;
 for(let i=0;i<cells.length;i+=stride){const cell=cells[i];if(state.showSimulator&&!eyes.some(eye=>pilotSees(eye,cell.position,state,obstruction)))continue;visible++;if(cell.unblockedCount>0)covered++;if(cell.classification==='shadow')shadow++;}
 return {visibleSamples:visible,pilotCoverage:visible?covered/visible:null,shadowFraction:visible?shadow/visible:null};
}
