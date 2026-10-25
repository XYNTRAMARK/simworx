/** SIMWORX Website Intelligence — new, isolated reports API.
 * Deploy with verify_jwt=false: collection is public; reads require the PIN session.
 * This module has no external dependencies and never returns a database key.
 */
type Json = Record<string, unknown>;
type AnalyticsEvent = { event_id: string; visitor_id: string; session_id: string; event_name: string; page_url: string; timestamp: string; properties: Json };
type Runtime = { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const runtime = (globalThis as unknown as { Deno?: Runtime }).Deno;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-reports-session,apikey,authorization,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Max-Age': '3600', 'Vary': 'Origin' };
const STATUSES = new Set(['NEW','ENGAGED','HIGH INTENT','CONTACTED','OPPORTUNITY','CUSTOMER','LOST']);
const MAX_BODY = 250_000;
const MAX_EVENTS = 25_000;
const MAX_RECORDS = 10_000;
const ID = /^[a-zA-Z0-9_.:\-]{1,160}$/;

class ApiError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status=status; } }
function json(data: unknown, status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } }); }
function object(value: unknown): value is Json { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function env(name: string): string { return runtime?.env.get(name) ?? ''; }
function string(value: unknown, maximum = 300): string | undefined { return typeof value === 'string' ? value.slice(0,maximum) : undefined; }
function trimString(value: unknown, maximum = 300): string | undefined { const s = string(value,maximum)?.trim(); return s || undefined; }
async function digest(value: string): Promise<string> { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,'0')).join(''); }
function sameText(a: string,b: string): boolean { const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b); let difference = x.length ^ y.length; for (let i=0;i<Math.max(x.length,y.length);i++) difference |= (x[i] ?? 0) ^ (y[i] ?? 0); return difference === 0; }

async function db(path: string, options: RequestInit = {}): Promise<{ data: unknown; count: number | null }> {
  const base = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!base || !key) throw new ApiError(503,'Reports storage is not configured.');
  const response = await fetch(`${base}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...Object.fromEntries(new Headers(options.headers).entries()) }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) {
    // Do not send SQL, internal responses, contact details, or credentials to clients/logs.
    console.error('Reports database request failed', response.status, path.split('?')[0]);
    throw new ApiError(503,'Reports storage is temporarily unavailable.');
  }
  const content = await response.text();
  const total = response.headers.get('content-range')?.split('/')[1];
  return { data: content ? JSON.parse(content) : null, count: total && total !== '*' ? Number(total) : null };
}
function query(values: Record<string,string>): string { return new URLSearchParams(values).toString(); }
async function readRows(table: string, order: string, limit: number): Promise<{rows: Json[]; total: number; truncated: boolean}> {
  const rows: Json[] = []; let total: number | null = null;
  const page = 1000;
  for (let offset=0;offset<limit;offset+=page) {
    const take = Math.min(page,limit-offset);
    const result = await db(`${table}?${query({ select:'*', order, offset:String(offset), limit:String(take) })}`, { headers: { Prefer: 'count:exact' } });
    const chunk = Array.isArray(result.data) ? result.data as Json[] : [];
    total = result.count ?? total;
    rows.push(...chunk);
    if (chunk.length < take || (total !== null && rows.length >= total)) break;
  }
  return { rows, total: total ?? rows.length, truncated: total !== null ? total > rows.length : rows.length === limit };
}
async function session(request: Request): Promise<string> {
  const token = request.headers.get('X-Reports-Session') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) throw new ApiError(401,'Enter your PIN to continue.');
  const hash = await digest(token);
  const result = await db(`wi_admin_sessions?${query({select:'token_hash',token_hash:`eq.${hash}`,expires_at:`gt.${new Date().toISOString()}`,limit:'1'})}`);
  if (!Array.isArray(result.data) || result.data.length !== 1) throw new ApiError(401,'Your session has expired. Enter your PIN again.');
  return hash;
}
function cleanPath(value: unknown): string {
  const raw = trimString(value,2000);
  if (!raw) throw new ApiError(400,'Every event needs a page URL.');
  let url: URL;
  try { url = new URL(raw,'https://www.sim-worx.com'); } catch { throw new ApiError(400,'Invalid page URL.'); }
  if (!['sim-worx.com','www.sim-worx.com'].includes(url.hostname.toLowerCase())) throw new ApiError(400,'Events must come from the Simworx website.');
  // URL query strings may contain contact data or arbitrary tokens; attribution has its own fields.
  return url.pathname.slice(0,1000);
}
function sanitize(value: unknown,depth=0): unknown {
  if (depth>6) return null;
  if (typeof value==='string') return value.slice(0,4000);
  if (typeof value==='number') return Number.isFinite(value) ? value : null;
  if (typeof value==='boolean' || value===null) return value;
  if (Array.isArray(value)) return value.slice(0,80).map(v=>sanitize(v,depth+1));
  if (object(value)) return Object.fromEntries(Object.entries(value).slice(0,100).filter(([k])=>!['__proto__','prototype','constructor'].includes(k)).map(([k,v])=>[k.slice(0,80),sanitize(v,depth+1)]));
  return null;
}
export function validateEvents(value: unknown, request: Request, now = Date.now()): AnalyticsEvent[] {
  if (!Array.isArray(value) || value.length<1 || value.length>50) throw new ApiError(400,'Send between 1 and 50 events.');
  const country = request.headers.get('cf-ipcountry');
  return value.map((raw: unknown) => {
    if (!object(raw)) throw new ApiError(400,'Invalid event.');
    for (const field of ['event_id','visitor_id','session_id']) if (typeof raw[field]!=='string' || !ID.test(raw[field] as string)) throw new ApiError(400,`Invalid ${field}.`);
    const eventName = trimString(raw.event_name,100) ?? '';
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(eventName)) throw new ApiError(400,'Use lowercase snake_case event names.');
    const timestamp = typeof raw.timestamp==='string' ? Date.parse(raw.timestamp) : NaN;
    if (!Number.isFinite(timestamp) || timestamp>now+300_000 || timestamp<now-7*86400_000) throw new ApiError(400,'Event timestamp must be within the last 7 days.');
    const path = cleanPath(raw.page_url);
    const properties = object(raw.properties) ? sanitize(raw.properties) as Json : {};
    // Accept older adapters while storing one canonical vocabulary.
    properties.configurator_type = properties.configurator_type ?? properties.configurator;
    properties.consent_text_version = properties.consent_text_version ?? properties.consent_version;
    properties.consent_text = properties.consent_text ?? properties.consent_wording;
    for (const field of ['engagement_time','engagement_seconds','scroll_depth','estimated_price']) {
      if (properties[field]!==undefined && properties[field]!==null && (typeof properties[field]!=='number' || !Number.isFinite(properties[field] as number) || (properties[field] as number)<0)) throw new ApiError(400,`Invalid ${field}.`);
    }
    if (properties.scroll_depth!==undefined && Number(properties.scroll_depth)>100) throw new ApiError(400,'Invalid scroll depth.');
    if (properties.marketing_consent!==undefined && typeof properties.marketing_consent!=='boolean') throw new ApiError(400,'Marketing consent must be an explicit boolean.');
    if (country && /^[A-Z]{2}$/.test(country) && country!=='XX' && country!=='T1') properties.country = country;
    // Country is unavailable rather than inferred from language, timezone, or IP guesses.
    delete properties.ip; delete properties.ip_address;
    return { event_id: raw.event_id as string,visitor_id:raw.visitor_id as string,session_id:raw.session_id as string,event_name:eventName==='marketing_consent_revoked'?'marketing_consent_withdrawn':eventName,page_url:path,timestamp:new Date(timestamp).toISOString(),properties };
  }).filter(e=>!/^\/(reports|admin|portal)(\/|$)/i.test(e.page_url));
}
function validateSettings(input: unknown): Json {
  if (!object(input)) throw new ApiError(400,'Invalid settings.');
  const settings: Json = {};
  if (object(input.scoring)) {
    const weights: Json = {};
    for (const [key,value] of Object.entries(input.scoring)) {
      if (!/^[a-z][a-z0-9_]{0,79}$/.test(key) || typeof value!=='number' || !Number.isInteger(value) || value<0 || value>100) throw new ApiError(400,'Intent weights must be whole numbers from 0 to 100.');
      weights[key]=value;
    }
    settings.scoring=weights;
  }
  if (input.alertsEnabled!==undefined) {
    if (typeof input.alertsEnabled!=='boolean') throw new ApiError(400,'Alerts enabled must be a boolean.');
    settings.alertsEnabled=input.alertsEnabled;
  }
  if (object(input.alertThresholds)) {
    const limits: Json={};
    for (const key of ['trafficIncreasePct','conversionDropPct','highValue']) {
      if (input.alertThresholds[key]!==undefined) {
        const value=input.alertThresholds[key];
        if (typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e9) throw new ApiError(400,'Alert thresholds must be positive numbers.');
        limits[key]=value;
      }
    }
    settings.alertThresholds=limits;
  }
  // Retention is a declared preference only; this version never deletes analytics automatically.
  if (input.retentionDays===null) settings.retentionDays=null;
  else if (typeof input.retentionDays==='number' && Number.isInteger(input.retentionDays) && input.retentionDays>=90 && input.retentionDays<=3650) settings.retentionDays=input.retentionDays;
  settings.sessionTimeoutMinutes=30;
  settings.liveWindowMinutes=5;
  settings.timezone='Europe/Paris';
  return settings;
}

export async function handler(request: Request): Promise<Response> {
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers:CORS});
  if (request.method!=='POST') return json({error:'Use POST.'},405);
  try {
    const advertised=Number(request.headers.get('content-length')??0);
    if (advertised>MAX_BODY) throw new ApiError(413,'Event batch is too large.');
    const raw=await request.text();
    if (new TextEncoder().encode(raw).length>MAX_BODY) throw new ApiError(413,'Event batch is too large.');
    let body: Json;
    try { const parsed=JSON.parse(raw); if (!object(parsed)) throw Error(); body=parsed; } catch { throw new ApiError(400,'Send a JSON object.'); }
    if (body.action==='collect') {
      const events=validateEvents(body.events,request);
      if (!events.length) return json({accepted:0,duplicates:0});
      const result=await db('rpc/wi_ingest_events',{method:'POST',body:JSON.stringify({p_events:events})});
      return json(result.data);
    }
    if (body.action==='login') {
      if (typeof body.pin!=='string' || !sameText(body.pin,env('REPORTS_PIN')||'260873')) throw new ApiError(401,'That PIN is not correct.');
      const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
      const expires_at=new Date(Date.now()+8*3600_000).toISOString();
      await db('wi_admin_sessions',{method:'POST',body:JSON.stringify({token_hash:await digest(token),expires_at})});
      // Delete expired login sessions only; no analytics retention cleanup is automatic.
      await db(`wi_admin_sessions?${query({expires_at:`lt.${new Date().toISOString()}`})}`,{method:'DELETE'});
      return json({token,expires_at});
    }
    const tokenHash=await session(request);
    if (body.action==='logout') { await db(`wi_admin_sessions?${query({token_hash:`eq.${tokenHash}`})}`,{method:'DELETE'});return json({ok:true}); }
    if (body.action==='snapshot') {
      const [events,leads,configurations,visitors,sessions,settingsResult]=await Promise.all([
        readRows('wi_events','timestamp.desc,event_id.desc',MAX_EVENTS),
        readRows('wi_leads','last_seen.desc,id.desc',MAX_RECORDS),
        readRows('wi_configurations','created_at.desc,id.desc',MAX_RECORDS),
        readRows('wi_visitors','last_seen.desc,id.desc',MAX_RECORDS),
        readRows('wi_sessions','start_time.desc,id.desc',MAX_RECORDS),
        db('wi_settings?select=settings&id=eq.true')
      ]);
      const settings=Array.isArray(settingsResult.data)&&settingsResult.data[0] ? (settingsResult.data[0] as Json).settings : {};
      const tables={events,leads,configurations,visitors,sessions};
      const counts=Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,{returned:v.rows.length,total:v.total,truncated:v.truncated}]));
      const truncated=Object.values(tables).some(t=>t.truncated);
      return json({events:events.rows.reverse(),leads:leads.rows,configurations:configurations.rows,visitors:visitors.rows,sessions:sessions.rows,settings,meta:{generated_at:new Date().toISOString(),demo:false,source:'First-party Simworx events',timezone:'Europe/Paris',tracking_active:events.total>0,counts,truncated,earliest_event:events.rows[0]?.timestamp??null,warning:truncated?'This snapshot is bounded. Some earlier records are outside the loaded data; totals and comparisons may be incomplete.':null}});
    }
    if (body.action==='update_lead') {
      const id=trimString(body.id,100);
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(400,'Invalid lead ID.');
      const changes: Json={};
      if (body.status!==undefined) { if (!STATUSES.has(body.status as string)) throw new ApiError(400,'Invalid lead status.');changes.status=body.status; }
      if (body.notes!==undefined) { if (typeof body.notes!=='string' || body.notes.length>10000) throw new ApiError(400,'Notes must be under 10,000 characters.');changes.notes=body.notes; }
      if (!Object.keys(changes).length) throw new ApiError(400,'No lead changes supplied.');
      const result=await db(`wi_leads?${query({id:`eq.${id}`,select:'*'})}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(changes)});
      if (!Array.isArray(result.data)||result.data.length===0) throw new ApiError(404,'Lead not found.');
      return json({lead:result.data[0],ok:true});
    }
    if (body.action==='settings') {
      const changes=validateSettings(body.settings);
      const old=await db('wi_settings?select=settings&id=eq.true');
      const previous=Array.isArray(old.data)&&old.data[0] ? (old.data[0] as Json).settings as Json : {};
      const settings={...previous,...changes,scoring:{...(object(previous.scoring)?previous.scoring:{}),...(object(changes.scoring)?changes.scoring:{})},alertThresholds:{...(object(previous.alertThresholds)?previous.alertThresholds:{}),...(object(changes.alertThresholds)?changes.alertThresholds:{})}};
      await db('wi_settings?id=eq.true',{method:'PATCH',body:JSON.stringify({settings,updated_at:new Date().toISOString()})});
      return json({settings,ok:true});
    }
    throw new ApiError(400,'Unknown reports action.');
  } catch (error) {
    if (error instanceof ApiError) return json({error:error.message},error.status);
    console.error('Reports request failed',error instanceof Error ? error.name : 'UnknownError');
    return json({error:'Reports are temporarily unavailable. Please try again.'},503);
  }
}
if (runtime?.serve) runtime.serve(handler);
