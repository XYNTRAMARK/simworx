/* Simworx Website Intelligence — pure, browser-independent report calculations.
 * Events are deduplicated by event_id. Distinct visitor/session measures are
 * always recomputed from their underlying records, never summed across groups.
 */
export const defaultSettings = {
  timezone: 'Europe/Paris', sessionTimeoutMinutes: 30, liveWindowMinutes: 5,
  alertsEnabled: false,
  alertThresholds: { trafficIncreasePct: 50, conversionDropPct: 30, highValue: 100000 },
  scoring: { product_page_viewed: 5, visual_systems_viewed: 5, configurator_opened: 10,
    simulator_selected: 5, configurator_five_minutes: 5, pricing_reached: 15,
    configuration_completed: 15, returned_another_day: 10, email_entered: 20,
    configuration_emailed: 15, enquiry_submitted: 30 }
};

const ALL = value => value == null || value === '' || /^all(?:\s|$)/i.test(value);
const unique = values => [...new Set(values.filter(v => v != null && v !== ''))];
const count = (rows, key) => new Set(rows.map(r => typeof key === 'function' ? key(r) : r[key]).filter(Boolean)).size;
const pct = (numerator, denominator) => denominator ? 100 * numerator / denominator : null;
const avg = values => values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;
const numeric = value => value != null && value !== '' && Number.isFinite(Number(value));
const properties = event => event.properties || {};
const name = event => String(event.event_name || '');
const timestamp = event => Date.parse(event.timestamp || '');
const isView = e => name(e) === 'page_view';
const isStart = e => /^(?:(?:led|projection)_)?configurator_started$/.test(name(e));
const isOpen = e => /^(?:(?:led|projection)_)?configurator_opened$/.test(name(e));
const isCompleted = e => /^(?:configuration_completed|led_configuration_completed|projection_configuration_completed)$/.test(name(e));
const isEmail = e => name(e) === 'email_entered' || name(e) === 'email_captured' || name(e) === 'lead_captured';
const isEmailed = e => name(e) === 'configuration_emailed';
const isEnquiry = e => name(e) === 'enquiry_submitted' || name(e) === 'contact_form_submitted';
const isPrice = e => ['price_viewed','price_or_spec_viewed'].includes(name(e));
const isSimulator = e => ['simulator_category_selected','simulator_model_selected'].includes(name(e));
const configType = e => properties(e).configurator_type || properties(e).configurator || (/^led_/.test(name(e)) ? 'led' : /^projection_/.test(name(e)) ? 'projection' : null);
const configKey = e => properties(e).configuration_id || properties(e).configurator_session_id || `${e.session_id}:${configType(e) || ''}`;
const leadKey = e => properties(e).lead_id || String(properties(e).email || '').trim().toLowerCase() || e.visitor_id;
const enumValues = rows => unique(rows).sort((a,b)=>String(a).localeCompare(String(b)));
const dayFormatters = new Map(), dayCache = new Map();

function dateKey(date, timezone = 'Europe/Paris') {
  const cacheKey=timezone+':'+date;
  if(dayCache.has(cacheKey)) return dayCache.get(cacheKey);
  if(!dayFormatters.has(timezone))dayFormatters.set(timezone,new Intl.DateTimeFormat('en-CA', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}));
  const parts = dayFormatters.get(timezone).formatToParts(new Date(date));
  const value=['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
  if(dayCache.size>100000)dayCache.clear();
  dayCache.set(cacheKey,value);return value;
}
function shiftDay(day, by) { return new Date(Date.parse(day+'T12:00:00Z') + by*86400000).toISOString().slice(0,10); }
function localMidnight(day, timezone) {
  const target = Date.parse(day+'T00:00:00Z'); let estimate = target;
  for (let i=0; i<3; i++) {
    const parts = new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(estimate));
    const get = k => parts.find(p=>p.type===k).value;
    const represented = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
    estimate += target-represented;
  }
  return estimate;
}

export function dateRange(filters = {}, now = new Date(), timezone = 'Europe/Paris') {
  const today = dateKey(now, timezone), preset = filters.preset || 'Last 30 Days';
  let from = today, to = today;
  const label = preset.toLowerCase();
  if (label === 'yesterday') from = to = shiftDay(today,-1);
  else if (/last (7|30|90) days/.test(label)) from = shiftDay(today,1-Number(label.match(/\d+/)[0]));
  else if (label === 'this month') from = today.slice(0,7)+'-01';
  else if (label === 'last month') { to=shiftDay(today.slice(0,7)+'-01',-1); from=to.slice(0,7)+'-01'; }
  else if (label === 'this year') from=today.slice(0,4)+'-01-01';
  else if (/custom/.test(label)) {
    from = /^\d{4}-\d{2}-\d{2}$/.test(filters.from || '') ? filters.from : today;
    to = /^\d{4}-\d{2}-\d{2}$/.test(filters.to || '') ? filters.to : from;
  }
  if (from > to) [from,to] = [to,from];
  const days = Math.round((Date.parse(to+'T12:00:00Z') - Date.parse(from+'T12:00:00Z'))/86400000)+1;
  const previousTo = shiftDay(from,-1), previousFrom = shiftDay(from,-days);
  return {from,to,start:localMidnight(from,timezone),end:localMidnight(shiftDay(to,1),timezone),
    previousFrom,previousTo,previousStart:localMidnight(previousFrom,timezone),previousEnd:localMidnight(from,timezone),
    days,label:preset,timezone};
}

function normalizedEvents(snapshot, now) {
  const seen=new Set();
  return (snapshot.events || []).filter(e=> {
    if (!e.event_id || !e.visitor_id || !e.session_id || !Number.isFinite(timestamp(e)) || timestamp(e)>+now || seen.has(e.event_id)) return false;
    seen.add(e.event_id); return true;
  }).sort((a,b)=>timestamp(a)-timestamp(b));
}
function sessionFacts(events,snapshot={}) {
  const storedSessions=new Map((snapshot.sessions||[]).map(s=>[s.id,s]));
  const storedVisitors=new Map((snapshot.visitors||[]).map(v=>[v.id||v.anonymous_id,v]));
  const map=new Map();
  for(const event of events) {
    let row=map.get(event.session_id);
    if(!row) {const stored=storedSessions.get(event.session_id)||{};row={id:event.session_id,visitor_id:event.visitor_id,start:Number.isFinite(Date.parse(stored.start_time))?Date.parse(stored.start_time):timestamp(event),end:timestamp(event),events:[],source:stored.source||'Direct',campaign:stored.campaign||'(none)',country:stored.country||'Unknown',device:stored.device||'Unknown',category:'Not Selected',model:'Not Selected',configurator:'Not Selected',versions:[],explicitReturning:false}; map.set(row.id,row);}
    row.events.push(event);row.end=Math.max(row.end,timestamp(event));
    const p=properties(event);
    if(p.returning===true)row.explicitReturning=true;
    if(p.source || p.utm_source) row.source=p.source || sourceFromUTM(p.utm_source,p.utm_medium);
    if(p.campaign || p.utm_campaign || p.ref_code || p.ref) row.campaign=p.campaign || p.utm_campaign || p.ref_code || p.ref;
    if(p.country) row.country=p.country;
    if(p.device) row.device=p.device;
    if(p.simulator_category || p.category) row.category=p.simulator_category || p.category;
    if(p.simulator_model || p.model) row.model=p.simulator_model || p.model;
    if(configType(event)) row.configurator=String(configType(event)).toLowerCase();
    if(p.configurator_version) row.versions.push(p.configurator_version);
  }
  const firstByVisitor=new Map();
  for(const row of map.values()) {
    const first=firstByVisitor.get(row.visitor_id);
    if(!first || row.start<first.start) firstByVisitor.set(row.visitor_id,row);
  }
  for(const row of map.values()) {const firstSeen=Date.parse(storedVisitors.get(row.visitor_id)?.first_seen);row.returning=row.explicitReturning||firstByVisitor.get(row.visitor_id).id!==row.id||(Number.isFinite(firstSeen)&&firstSeen<row.start-1000);}
  return map;
}
export function sourceFromUTM(source='',medium='') {
  const s=String(source).toLowerCase(),m=String(medium).toLowerCase();
  if(/google/.test(s)) return /cpc|paid|ppc/.test(m)?'Google Ads':'Google Organic';
  if(/bing/.test(s)) return 'Bing';
  if(/linkedin/.test(s)) return 'LinkedIn';
  if(/facebook|meta/.test(s)) return 'Facebook';
  if(/instagram/.test(s)) return 'Instagram';
  if(/openai|chatgpt/.test(s)) return /cpc|ppc|paid|ads?/.test(m)?'OpenAI Ads':'Referral';
  if(/email|newsletter/.test(s+' '+m)) return 'Email';
  return source || 'Direct';
}

function leadForVisitors(snapshot) {
  const result=new Map();
  for(const lead of snapshot.leads || []) for(const id of lead.visitor_ids || (lead.visitor_id?[lead.visitor_id]:[])) result.set(id,lead);
  return result;
}
function scoreLevel(score) {return score>=80?'Sales Lead':score>=60?'High Intent':score>=40?'Engaged':score>=20?'Interested':'Low';}
export function intentScore(events = [], settings = defaultSettings) {
  const rules={...defaultSettings.scoring,...(settings.scoring || {})}, done=new Set();
  const score=key=>done.add(key);
  const days=new Set(); let firstConfig=null,lastConfig=null;
  for(const event of events) {
    const p=properties(event), n=name(event),url=String(event.page_url || '');
    days.add(dateKey(event.timestamp,settings.timezone || 'Europe/Paris'));
    if(isView(event) && /simulator|da40|da42|da62|gameitizer|simstarter|frames|mission-system/i.test(url)) score('product_page_viewed');
    if(isView(event) && /visual-system/i.test(url)) score('visual_systems_viewed');
    if(isOpen(event)||isStart(event)) score('configurator_opened');
    if(isSimulator(event)) score('simulator_selected');
    if(isPrice(event)) score('pricing_reached');
    if(isCompleted(event)) score('configuration_completed');
    if(isEmail(event)) score('email_entered');
    if(isEmailed(event)) score('configuration_emailed');
    if(isEnquiry(event)) score('enquiry_submitted');
    if(configType(event)) {firstConfig=firstConfig==null?timestamp(event):Math.min(firstConfig,timestamp(event));lastConfig=Math.max(lastConfig || 0,timestamp(event));}
    if(n==='configurator_engaged' && Number(p.engagement_time || p.duration_seconds)>=300) score('configurator_five_minutes');
  }
  if(days.size>1) score('returned_another_day');
  // Elapsed time between two different sessions is not engagement.
  const configs=new Map();
  for(const event of events.filter(e=>configType(e))) { const id=event.session_id; const t=timestamp(event); const x=configs.get(id)||[t,t];x[0]=Math.min(x[0],t);x[1]=Math.max(x[1],t);configs.set(id,x); }
  if([...configs.values()].some(([a,b])=>b-a>=300000)) score('configurator_five_minutes');
  return [...done].reduce((total,key)=>total+(Number(rules[key]) || 0),0);
}

function selectEvents(snapshot, filters, now, range, allEvents, facts) {
  const leads=leadForVisitors(snapshot), scores=new Map();
  for(const event of allEvents) if(timestamp(event)<range.end) {const arr=scores.get(event.visitor_id)||[];arr.push(event);scores.set(event.visitor_id,arr);}
  const visitorScores=new Map([...scores].map(([id,rows])=>[id,intentScore(rows,{...defaultSettings,...snapshot.settings})]));
  for(const lead of snapshot.leads||[]) {
    const ids=lead.visitor_ids||(lead.visitor_id?[lead.visitor_id]:[]),rows=ids.flatMap(id=>scores.get(id)||[]),score=intentScore(rows,{...defaultSettings,...snapshot.settings});
    for(const id of ids)visitorScores.set(id,score);
  }
  const query=String(filters.query || '').trim().toLowerCase();
  const allowed=new Set();
  for(const fact of facts.values()) {
    const lead=leads.get(fact.visitor_id), score=visitorScores.get(fact.visitor_id)||0;
    const matches=(key,value)=>ALL(filters[key]) || String(filters[key]).toLowerCase()===String(value).toLowerCase();
    if(!matches('source',fact.source)||!matches('campaign',fact.campaign)||!matches('country',fact.country)||!matches('device',fact.device)||!matches('category',fact.category)||!matches('model',fact.model)||!matches('configurator',fact.configurator)) continue;
    if(!ALL(filters.visitorType) && !matches('visitorType',fact.returning?'Returning':'New')) continue;
    if(!ALL(filters.identity) && !matches('identity',lead?'Known':'Anonymous') && !(lead && /known/i.test(filters.identity))) continue;
    if(!ALL(filters.status) && !matches('status',lead?.status || 'New')) continue;
    if(!ALL(filters.intent) && !matches('intent',scoreLevel(score))) continue;
    if(query) {
      const related=(snapshot.configurations || []).filter(c=>c.visitor_id===fact.visitor_id).map(c=>c.id);
      const haystack=[fact.visitor_id,fact.id,fact.source,fact.campaign,fact.country,fact.category,fact.model,...related,lead?.email,lead?.name,lead?.company].join(' ').toLowerCase();
      if(!haystack.includes(query)) continue;
    }
    allowed.add(fact.id);
  }
  return allEvents.filter(e=>allowed.has(e.session_id)&&timestamp(e)>=range.start&&timestamp(e)<range.end);
}
export function filterEvents(snapshot, filters = {}, now = new Date()) {
  const events=normalizedEvents(snapshot,now),facts=sessionFacts(events,snapshot);
  return selectEvents(snapshot,filters,now,dateRange(filters,now,snapshot.settings?.timezone || 'Europe/Paris'),events,facts);
}

function measures(events, facts, snapshot, visitorEvents) {
  const sessions=unique(events.map(e=>e.session_id)).map(id=>{const selected=events.filter(e=>e.session_id===id);return {id,start:timestamp(selected[0]),end:timestamp(selected[selected.length-1])};});
  const known=leadForVisitors(snapshot),captureIdentity=e=>known.get(e.visitor_id)?.id||leadKey(e);
  const visitors=count(events,'visitor_id'),starts=count(events.filter(isStart),'session_id'),complete=count(events.filter(isCompleted),configKey),emails=count(events.filter(isEmail),captureIdentity);
  const enquiryVisitors=count(events.filter(isEnquiry),'visitor_id');
  const completedSessions=new Set(events.filter(isCompleted).map(e=>e.session_id));
  const emailSessions=new Set(events.filter(isEmail).map(e=>e.session_id));
  const reachesAfter=(first,second)=>new Set(events.filter(second).filter(e=>events.some(before=>before.session_id===e.session_id&&first(before)&&timestamp(before)<timestamp(e))).map(e=>e.session_id));
  const orderedCompleted=reachesAfter(isStart,isCompleted),orderedCaptured=reachesAfter(isCompleted,isEmail),orderedEnquiries=reachesAfter(isEmail,isEnquiry);
  const startVisitors=new Set(events.filter(isStart).map(e=>e.visitor_id));
  const completedVisitors=new Set(events.filter(isCompleted).map(e=>e.visitor_id));
  const capturedVisitors=new Set(events.filter(isEmail).map(e=>e.visitor_id));
  const activeLeadIds=new Set(unique(events.map(e=>known.get(e.visitor_id)?.id)));
  const highIntent=(snapshot.leads||[]).filter(lead=>activeLeadIds.has(lead.id)&&intentScore((lead.visitor_ids||(lead.visitor_id?[lead.visitor_id]:[])).flatMap(id=>visitorEvents.get(id)||[]),snapshot.settings)>=60).length;
  const captureLeads=unique(events.filter(isEmail).map(e=>known.get(e.visitor_id)?.id).filter(Boolean));
  const returning=count(events.filter(e=>facts.get(e.session_id)?.returning),'visitor_id');
  return {visitors,returningVisitors:returning,newVisitors:count(events.filter(e=>!facts.get(e.session_id)?.returning),'visitor_id'),sessions:sessions.length,
    pageViews:events.filter(isView).length,avgSessionDuration:avg(sessions.map(s=>(s.end-s.start)/1000)),
    pagesPerSession:sessions.length?events.filter(isView).length/sessions.length:null,
    configuratorStarts:starts,ledStarts:count(events.filter(e=>isStart(e)&&configType(e)==='led'),'session_id'),
    projectionStarts:count(events.filter(e=>isStart(e)&&configType(e)==='projection'),'session_id'),completed:complete,
    emailed:count(events.filter(isEmailed),configKey),leads:emails,
    subscribers:(snapshot.leads||[]).filter(l=>captureLeads.includes(l.id)&&l.marketing_consent===true).length,
    enquiries:count(events.filter(isEnquiry),e=>properties(e).enquiry_id||e.session_id),highIntent,
    visitorToConfigurator:pct(startVisitors.size,visitors),configuratorToCompleted:pct(orderedCompleted.size,starts),
    completedToEmail:pct(orderedCaptured.size,completedSessions.size),
    emailToEnquiry:pct(orderedEnquiries.size,emailSessions.size)};
}

const stages = (type,version='') => {
  const definitions=type==='website' ? [
  ['visitors','Website sessions',()=>true],['starts','Started a configurator',isStart],['completed','Completed a configuration',isCompleted],['emails','Provided an email',isEmail],['emailed','Emailed configuration',isEmailed],['enquiries','Submitted enquiry',isEnquiry]
] : [
  ['visitors','Opened configurator',e=>isOpen(e)||isStart(e)],['starts','Started configuration',isStart],
  ['room','Entered room dimensions',e=>name(e)==='room_dimensions_entered'],
  ['simulator','Selected simulator',isSimulator],
  ['screen','Configured screen',e=>['screen_configuration_completed','led_screen_completed','screen_completed','screen_geometry_selected','screen_type_selected'].includes(name(e))],
  ['price',type==='projection'?'Viewed specification':'Viewed price',isPrice],['completed','Completed configuration',isCompleted],
  ['emails','Provided an email',isEmail],['emailed','Emailed configuration',isEmailed],['enquiries','Submitted enquiry',isEnquiry]
];
  // These instrumented live versions have different real product steps. Keep
  // older event histories on their original definition instead of inventing a
  // room or simulator selection merely to make a newer session pass a funnel.
  const currentLED=/^led-live-v1(?:$|[-_:])/i.test(version);
  const currentProjection=/^projection[-_]v37(?:$|[-_:])/i.test(version);
  return definitions.filter(([key])=>!(type==='led'&&currentLED&&['room','simulator'].includes(key))&&!(type==='projection'&&currentProjection&&key==='simulator')&&!((currentLED||currentProjection)&&key==='emailed'));
};
function makeFunnel(events,type='website') {
  const sessionEvents=new Map();
  for(const event of events) {if(type!=='website'&&configType(event)!==type)continue;const rows=sessionEvents.get(event.session_id)||[];rows.push(event);sessionEvents.set(event.session_id,rows);}
  const cohorts=[];
  for(const [id,sessionRows] of sessionEvents) {
    if(type==='website'){
      const version=String(sessionRows.map(e=>properties(e).configurator_version).find(v=>/^led-live-v1(?:$|[-_:])|^projection[-_]v37(?:$|[-_:])/i.test(String(v)))||'');
      cohorts.push({id,rows:sessionRows,version,definitions:stages(type,version)});continue;
    }
    const versions=unique(sessionRows.map(e=>properties(e).configurator_version));
    const byVersion=new Map();
    for(const event of sessionRows) {
      const version=String(properties(event).configurator_version||(versions.length===1?versions[0]:'Unknown'));
      const rows=byVersion.get(version)||[];rows.push(event);byVersion.set(version,rows);
    }
    for(const [version,rows] of byVersion)cohorts.push({id,rows,version,definitions:stages(type,version)});
  }
  const activeCohorts=cohorts.filter(c=>type==='website'||c.rows.some(e=>isOpen(e)||isStart(e)));
  // One existing chart can compare versions through milestones they share.
  // Each cohort still has to satisfy ALL of its own required earlier steps.
  const definitions=stages(type).filter(([key])=>!activeCohorts.length||activeCohorts.every(c=>c.definitions.some(([stageKey])=>stageKey===key)));
  const reachedByKey=new Map(definitions.map(([key])=>[key,new Set()]));
  for(const {id,rows,definitions:cohortDefinitions} of cohorts) {
    let cursor=-1;
    for(const [key,,test] of cohortDefinitions) {
      const match=rows.findIndex((event,i)=>i>cursor&&test(event));
      if(match<0)break;
      reachedByKey.get(key)?.add(id);cursor=match;
    }
  }
  const reached=definitions.map(([key])=>[...reachedByKey.get(key)]);
  const versions=unique(activeCohorts.map(c=>c.version)).sort();
  return definitions.map(([key,label],i)=>({key,label,unit:'sessions',count:reached[i].length,previousPct:i?pct(reached[i].length,reached[i-1].length):reached[i].length?100:null,
    totalPct:pct(reached[i].length,reached[0].length),pct:pct(reached[i].length,reached[0].length),
    lost:i?reached[i-1].length-reached[i].length:0,dropPct:i?pct(reached[i-1].length-reached[i].length,reached[i-1].length):null,
    sessionIds:reached[i],lostSessionIds:i?reached[i-1].filter(id=>!reached[i].includes(id)):[],configuratorVersions:versions}));
}

function enrichConfigurations(snapshot,events,facts,known,range) {
  const sessionIds=new Set(events.map(e=>e.session_id));
  return (snapshot.configurations||[]).filter(c=>sessionIds.has(c.session_id)&&Number.isFinite(Date.parse(c.created_at))&&Date.parse(c.created_at)>=range.start&&Date.parse(c.created_at)<range.end).map(c=> {
    const fact=facts.get(c.session_id),lead=known.get(c.visitor_id);
    const completion=events.find(e=>isCompleted(e)&&configKey(e)===c.id),payload=properties(completion||{}),saved=c.configuration_json||{},state=saved.configuration||saved;
    const specification={...state,...payload,
      screen_type:payload.screen_type??state.screen_type??state.geometry,
      pixel_pitch:payload.pixel_pitch??state.pixel_pitch??state.pixelPitch??state.pitch,
      horizontal_fov:payload.horizontal_fov??state.horizontal_fov??state.horizontalFov,
      vertical_fov:payload.vertical_fov??state.vertical_fov??state.verticalFov,
      projector_type:payload.projector_type??state.projector_type,
      mount_style:payload.mount_style??payload.mount_type??state.mount_style??state.placementMode};
    return {...c,source:fact?.source||'Unknown',campaign:fact?.campaign||'(none)',country:fact?.country||'Unknown',device:fact?.device||'Unknown',email:lead?.email||null,
      specification,
      configuredValueLabel:numeric(c.estimated_price)?`${c.currency||'Unknown currency'} ${Number(c.estimated_price).toLocaleString('en-GB')}`:'Not recorded'};
  });
}
function groupSummary(events,facts,configs,visitorEvents,snapshot,dimension) {
  const groups=new Map();
  for(const event of events) {const fact=facts.get(event.session_id),value=fact?.[dimension]||'Unknown';const rows=groups.get(value)||[];rows.push(event);groups.set(value,rows);}
  return [...groups].map(([groupName,rows])=> {
    const m=measures(rows,facts,snapshot,visitorEvents),sessionIds=new Set(rows.map(e=>e.session_id));
    const values={},amounts={};
    for(const c of configs.filter(c=>sessionIds.has(c.session_id))) if(numeric(c.estimated_price)&&c.currency) { values[c.currency]=(values[c.currency]||0)+Number(c.estimated_price);const arr=amounts[c.currency]||[];arr.push(Number(c.estimated_price));amounts[c.currency]=arr;}
    const first=facts.get(rows[0]?.session_id);
    return {name:groupName,visitors:m.visitors,returning:m.returningVisitors,sessions:m.sessions,pageViews:m.pageViews,starts:m.configuratorStarts,completed:m.completed,
      emails:m.leads,emailed:m.emailed,enquiries:m.enquiries,conversion:pct(count(rows.filter(isEnquiry),'visitor_id'),m.visitors),
      startRate:m.visitorToConfigurator,completionRate:m.configuratorToCompleted,emailRate:pct(count(rows.filter(isEmail),'visitor_id'),m.visitors),
      avgIntent:avg(unique(rows.map(e=>e.visitor_id)).map(id=>intentScore(visitorEvents.get(id)||[],snapshot.settings))),valueByCurrency:values,avgValueByCurrency:Object.fromEntries(Object.entries(amounts).map(([currency,vals])=>[currency,avg(vals)])),
      source:first?.source,simulatorTypes:unique(rows.map(e=>facts.get(e.session_id)?.category)),sessionIds:[...sessionIds],funnel:makeFunnel(rows)};
  }).sort((a,b)=>b.visitors-a.visitors||a.name.localeCompare(b.name));
}
function pagesReport(events,facts) {
  const groups=new Map();
  for(const e of events.filter(isView)) {const url=e.page_url||'(unknown)',rows=groups.get(url)||[];rows.push(e);groups.set(url,rows);}
  return [...groups].map(([url,rows])=> {
    const sessionIds=unique(rows.map(e=>e.session_id)),previous=[],next=[],entry=[],exit=[],engagement=[],depth=[];
    for(const e of rows) {
      const fact=facts.get(e.session_id),views=fact.events.filter(isView),index=views.findIndex(v=>v.event_id===e.event_id);
      if(index===0)entry.push(e.session_id);if(index===views.length-1)exit.push(e.session_id);
      if(index>0)previous.push(views[index-1].page_url);if(index>=0&&index<views.length-1)next.push(views[index+1].page_url);
      const nextView=views[index+1],pageId=properties(e).page_view_id||e.event_id;
      const relevant=events.filter(x=>{
        if(x.session_id!==e.session_id||x.page_url!==url||!['page_engagement','engagement','scroll_depth','page_view'].includes(name(x)))return false;
        if(properties(x).page_view_id)return properties(x).page_view_id===pageId;
        return timestamp(x)>=timestamp(e)&&(!nextView||timestamp(x)<timestamp(nextView));
      });
      const times=relevant.map(x=>properties(x).engagement_time ?? properties(x).engagement_seconds).filter(numeric).map(Number);
      const scroll=relevant.map(x=>properties(x).scroll_depth ?? properties(x).depth).filter(numeric).map(Number);
      if(times.length)engagement.push(Math.max(...times));if(scroll.length)depth.push(Math.max(...scroll));
    }
    return {url,title:properties(rows[rows.length-1]).page_title||properties(rows[rows.length-1]).title||url,visitors:count(rows,'visitor_id'),returning:count(rows.filter(e=>facts.get(e.session_id)?.returning),'visitor_id'),sessions:sessionIds.length,
      views:rows.length,pageViews:rows.length,avgTime:avg(engagement),scrollDepth:avg(depth),entryRate:pct(unique(entry).length,sessionIds.length),exitRate:pct(unique(exit).length,sessionIds.length),
      previousPages:unique(previous),nextPages:unique(next),devices:unique(rows.map(e=>facts.get(e.session_id)?.device)),countries:unique(rows.map(e=>facts.get(e.session_id)?.country)),sources:unique(rows.map(e=>facts.get(e.session_id)?.source)),sessionIds};
  }).sort((a,b)=>b.views-a.views);
}

function makePreferences(configurations) {
  const dimensions={screenTypes:'screen_type',pixelPitches:'pixel_pitch',fieldOfView:'horizontal_fov',projectorTypes:'projector_type',mountStyles:'mount_style'};
  const result={};
  for(const [key,property] of Object.entries(dimensions)) {
    const groups=new Map();let total=0;
    for(const c of configurations) {const value=c.specification?.[property]??c.configuration_json?.[property]??c[property];if(value==null||value==='')continue;groups.set(String(value),(groups.get(String(value))||0)+1);total++;}
    result[key]=[...groups].map(([name,count])=>({name,count,pct:pct(count,total)})).sort((a,b)=>b.count-a.count);
  }
  const bands=new Map();
  for(const c of configurations) if(numeric(c.estimated_price)&&c.currency) {const v=Number(c.estimated_price);const band=`${c.currency} ${v<25000?'under 25k':v<50000?'25k–50k':v<100000?'50k–100k':v<250000?'100k–250k':'250k+'}`;bands.set(band,(bands.get(band)||0)+1);}
  result.priceBands=[...bands].map(([name,count])=>({name,count,pct:pct(count,configurations.filter(c=>numeric(c.estimated_price)&&c.currency).length)}));
  return result;
}
function buildInsights(report) {
  const insights=[];
  if(!report.events.length)return insights;
  const {metrics,previousMetrics,sources,devices,funnels}=report;
  if(previousMetrics.configuratorStarts>=5&&metrics.configuratorStarts>=5&&previousMetrics.configuratorToCompleted!=null&&metrics.configuratorToCompleted!=null) {
    const change=metrics.configuratorToCompleted-previousMetrics.configuratorToCompleted;
    if(Math.abs(change)>=5)insights.push({id:'completion-change',title:`Configurator completion ${change>=0?'rose':'fell'} ${Math.abs(change).toFixed(1)} percentage points`,detail:`${metrics.configuratorToCompleted.toFixed(1)}% of started sessions completed, compared with ${previousMetrics.configuratorToCompleted.toFixed(1)}% in the previous period.`,type:change>=0?'positive':'warning',tab:'configurators'});
  }
  const qualified=sources.filter(s=>s.visitors>=10&&s.enquiries>0).sort((a,b)=>b.conversion-a.conversion);
  if(qualified.length>=2) {
    const first=qualified[0],last=qualified[qualified.length-1];
    if(first.conversion>=last.conversion*1.5)insights.push({id:'source-quality',title:`${first.name} has the strongest enquiry rate`,detail:`${first.conversion.toFixed(1)}% (${first.enquiries} enquiries from ${first.visitors} visitors), versus ${last.conversion.toFixed(1)}% for ${last.name}. Small samples can move quickly.`,type:'positive',tab:'campaigns',filter:{source:first.name}});
  }
  for(const type of ['led','projection']) {
    const stages=funnels[type],largest=stages.slice(1).filter(s=>s.lost>=3).sort((a,b)=>b.lost-a.lost)[0];
    if(largest) {const previous=stages[stages.indexOf(largest)-1];insights.push({id:`${type}-drop`,title:`${type==='led'?'LED':'Projection'} loses most sessions before ${largest.label.toLowerCase()}`,detail:`${largest.lost} sessions did not advance from “${previous.label}” (${largest.dropPct.toFixed(1)}%). Active sessions may still progress.`,type:'warning',tab:'funnels',filter:{configurator:type}});}
  }
  const desktop=devices.find(d=>/desktop/i.test(d.name)),mobile=devices.find(d=>/mobile/i.test(d.name));
  if(desktop?.starts>=5&&mobile?.starts>=5&&desktop.completionRate-mobile.completionRate>=15) insights.push({id:'mobile-completion',title:'Mobile configurator completion trails desktop',detail:`Mobile ${mobile.completionRate.toFixed(1)}% versus desktop ${desktop.completionRate.toFixed(1)}%. Review the mobile experience before attributing the difference to traffic quality.`,type:'warning',tab:'traffic',filter:{device:mobile.name}});
  if(report.problems.filter(p=>p.type==='error').length)insights.push({id:'errors',title:`${report.problems.filter(p=>p.type==='error').length} errors need review`,detail:'Inspect the affected pages and visitor journeys to understand their impact.',type:'warning',tab:'insights'});
  if(!insights.length)insights.push({id:'insufficient-signal',title:'More activity is needed for a reliable comparison',detail:'No configured comparison rule has enough evidence to flag a change in this selection.',type:'neutral',tab:'overview'});
  return insights;
}

export function buildReport(snapshot = {}, filters = {}, now = new Date()) {
  const settings={...defaultSettings,...snapshot.settings,scoring:{...defaultSettings.scoring,...snapshot.settings?.scoring}};
  snapshot={...snapshot,settings};
  const allEvents=normalizedEvents(snapshot,now),facts=sessionFacts(allEvents,snapshot),known=leadForVisitors(snapshot);
  const range=dateRange(filters,now,settings.timezone),events=selectEvents(snapshot,filters,now,range,allEvents,facts);
  const previousRange={...range,start:range.previousStart,end:range.previousEnd};
  const previousEvents=selectEvents(snapshot,filters,now,previousRange,allEvents,facts);
  const visitorEvents=new Map();
  for(const e of allEvents)if(timestamp(e)<range.end) {const arr=visitorEvents.get(e.visitor_id)||[];arr.push(e);visitorEvents.set(e.visitor_id,arr);}
  const previousVisitorEvents=new Map();
  for(const e of allEvents)if(timestamp(e)<range.previousEnd) {const arr=previousVisitorEvents.get(e.visitor_id)||[];arr.push(e);previousVisitorEvents.set(e.visitor_id,arr);}
  const metrics=measures(events,facts,snapshot,visitorEvents),previousMetrics=measures(previousEvents,facts,snapshot,previousVisitorEvents);
  const deltas=Object.fromEntries(Object.keys(metrics).map(key=>[key,previousMetrics[key]===0?(metrics[key]===0?0:null):(metrics[key]==null||previousMetrics[key]==null?null:100*(metrics[key]-previousMetrics[key])/previousMetrics[key])]));
  const configs=enrichConfigurations(snapshot,events,facts,known,range);
  const currentVisitorIds=new Set(events.map(e=>e.visitor_id)),sessionIds=new Set(events.map(e=>e.session_id));
  const journeys=[...currentVisitorIds].map(visitor_id=> {
    const rows=events.filter(e=>e.visitor_id===visitor_id),last=rows[rows.length-1],fact=facts.get(last.session_id),lead=known.get(visitor_id);
    const score=intentScore(visitorEvents.get(visitor_id)||[],settings);
    return {visitor_id,lead:lead||null,events:rows,source:fact.source,campaign:fact.campaign,country:fact.country,device:fact.device,category:fact.category,
      simulator_model:fact.model,configurator_type:fact.configurator,lastActivity:last.timestamp,currentPage:last.page_url,lastStep:name(last).replaceAll('_',' '),intentScore:score,intentLevel:scoreLevel(score),
      returning:rows.some(e=>facts.get(e.session_id)?.returning),sessions:count(rows,'session_id'),configurations:configs.filter(c=>c.visitor_id===visitor_id)};
  }).sort((a,b)=>Date.parse(b.lastActivity)-Date.parse(a.lastActivity));
  const leads=(snapshot.leads||[]).filter(l=>(l.visitor_ids||(l.visitor_id?[l.visitor_id]:[])).some(id=>currentVisitorIds.has(id))).map(l=> {
    const ids=l.visitor_ids||(l.visitor_id?[l.visitor_id]:[]),rows=allEvents.filter(e=>ids.includes(e.visitor_id)&&timestamp(e)<range.end),selected=events.filter(e=>ids.includes(e.visitor_id));
    const score=intentScore(rows,settings),last=rows[rows.length-1],first=rows[0],selectedLast=selected[selected.length-1],fact=selectedLast?facts.get(selectedLast.session_id):null;
    return {...l,status:l.status||'New',intentScore:score,intent_score:score,intentLevel:scoreLevel(score),events:rows,selectedEvents:selected,
      configurations:configs.filter(c=>ids.includes(c.visitor_id)),first_seen:l.first_seen||first?.timestamp,last_seen:last?.timestamp||l.last_seen,
      first_source:l.first_source||properties(first||{}).source||'Unknown',latest_source:fact?.source||l.latest_source||'Unknown',
      latest_campaign:fact?.campaign||l.latest_campaign||'(none)',simulator_interest:l.simulator_interest||fact?.category||'Not Selected',configurator_used:unique(selected.map(configType)),last_configuration:configs.filter(c=>ids.includes(c.visitor_id)).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0]||null};
  }).sort((a,b)=>b.intentScore-a.intentScore);
  const daily=[],dayGroups=new Map();
  for(const event of events){const day=dateKey(event.timestamp,settings.timezone),rows=dayGroups.get(day)||[];rows.push(event);dayGroups.set(day,rows);}
  if(events.length)for(let date=range.from;date<=range.to;date=shiftDay(date,1)) {
    const rows=dayGroups.get(date)||[],m=measures(rows,facts,snapshot,visitorEvents);
    daily.push({date,visitors:m.visitors,sessions:m.sessions,pageViews:m.pageViews,starts:m.configuratorStarts,configuratorStarts:m.configuratorStarts,completed:m.completed,leads:m.leads,enquiries:m.enquiries});
  }
  const sources=groupSummary(events,facts,configs,visitorEvents,snapshot,'source'),campaigns=groupSummary(events,facts,configs,visitorEvents,snapshot,'campaign'),categories=groupSummary(events,facts,configs,visitorEvents,snapshot,'category'),devices=groupSummary(events,facts,configs,visitorEvents,snapshot,'device'),countries=groupSummary(events,facts,configs,visitorEvents,snapshot,'country');
  const live=journeys.filter(j=>+now-Date.parse(j.lastActivity)<=settings.liveWindowMinutes*60000);
  const problems=events.filter(e=>/error|failure|timeout|broken_asset|invalid_form|form_invalid/.test(name(e))||['performance','performance_measured','page_performance','web_vitals'].includes(name(e))).map(e=>({event_id:e.event_id,name:name(e),message:properties(e).message||properties(e).metric||name(e).replaceAll('_',' '),page_url:e.page_url,timestamp:e.timestamp,visitor_id:e.visitor_id,session_id:e.session_id,type:/performance/.test(name(e))||name(e)==='web_vitals'?'performance':'error',duration_ms:properties(e).duration_ms??properties(e).value_ms??(name(e)==='page_performance'?properties(e).load_ms:null)??null}));
  const abandoned=[...sessionIds].map(id=>facts.get(id)).filter(s=>s.configurator!=='Not Selected'&&s.events.some(isStart)&&!s.events.some(isCompleted)&&+now-s.end>=settings.sessionTimeoutMinutes*60000).map(s=>({session_id:s.id,visitor_id:s.visitor_id,configurator_type:s.configurator,configurator_version:s.versions[s.versions.length-1]||'Unknown',lastStep:name(s.events.filter(e=>!['heartbeat','page_engagement'].includes(name(e))).at(-1)||{}),lastActivity:new Date(s.end).toISOString(),source:s.source,category:s.category}));
  const configuratorMetrics=Object.fromEntries(['led','projection'].map(type=>[type,measures(events.filter(e=>configType(e)===type),facts,snapshot,visitorEvents)]));
  const report={range,metrics,previousMetrics,configuratorMetrics,deltas,daily,pages:pagesReport(events,facts),sources,campaigns,categories,devices,countries,
    funnels:{website:makeFunnel(events),led:makeFunnel(events,'led'),projection:makeFunnel(events,'projection')},
    leads,subscribers:leads.filter(l=>l.marketing_consent===true),configurations:configs,journeys,live,problems,abandoned,preferences:makePreferences(configs),events,
    options:{sources:enumValues([...facts.values()].map(s=>s.source)),campaigns:enumValues([...facts.values()].map(s=>s.campaign)),countries:enumValues([...facts.values()].map(s=>s.country)),devices:enumValues([...facts.values()].map(s=>s.device)),categories:enumValues([...facts.values()].map(s=>s.category)),models:enumValues([...facts.values()].map(s=>s.model)),configurators:enumValues([...facts.values()].map(s=>s.configurator).filter(s=>s!=='Not Selected')),statuses:['New','Engaged','High Intent','Contacted','Opportunity','Customer','Lost'],intents:['Low','Interested','Engaged','High Intent','Sales Lead']},
    meta:{...snapshot.meta,totalEvents:allEvents.length,selectedEvents:events.length,historyStart:allEvents[0]?.timestamp||null,timezone:settings.timezone,comparisonEnabled:filters.compare!==false,collectionHasHistory:!!allEvents.length,methodology:'First-party browser identifiers identify browsers, not individual people. Funnels use the required steps of each recorded configurator version; mixed versions display common milestones without skipping a version’s prerequisites. Distinct counts are recomputed for each selection. Potential Configured Value is not revenue.'},settings};
  report.insights=buildInsights(report);
  return report;
}

export function toCSV(rows = [], columns) {
  if(!columns)columns=unique(rows.flatMap(Object.keys));
  const fields=columns.map(c=>typeof c==='string'?{key:c,label:c}:c);
  const encode=value=>{if(value==null)return '';if(typeof value==='object')value=JSON.stringify(value);value=String(value);if(/^\s*[=+\-@]|^[\t\r\n]/.test(value))value="'"+value;return '"'+value.replaceAll('"','""')+'"';};
  return '\uFEFF'+[fields.map(c=>encode(c.label||c.key)).join(','),...rows.map(row=>fields.map(c=>encode(row[c.key])).join(','))].join('\r\n');
}
export const csv=toCSV;
