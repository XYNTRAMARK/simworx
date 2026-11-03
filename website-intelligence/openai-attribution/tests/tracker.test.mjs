import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const sourcePath = new URL('../assets/js/simworx-intelligence-tracker-v1.js', import.meta.url);

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) || [];
    callbacks.push(callback); this.listeners.set(name, callbacks);
  }
  removeEventListener(name, callback) {
    this.listeners.set(name, (this.listeners.get(name) || []).filter(fn => fn !== callback));
  }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    for (const fn of this.listeners.get(event.type) || []) fn(event);
    return true;
  }
}

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values, writes,
    get length() { return values.size; },
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem(key, value) { values.set(key, String(value)); writes.push(['set', key]); },
    removeItem(key) { values.delete(key); writes.push(['remove', key]); },
    key: index => [...values.keys()][index] ?? null,
    clear() { values.clear(); writes.push(['clear']); },
  };
}

async function browser({ url = 'https://www.sim-worx.com/visual-systems.html', referrer = '', sharedStorage, consent = false, consentManager = true, cookie = '', endpoint = 'https://example.supabase.co/functions/v1/simworx-intelligence', XMLHttpRequest, responses = [], startAt = Date.parse('2026-10-25T12:00:00Z') } = {}) {
  const window = new Target();
  const document = new Target();
  const localStorage = sharedStorage || storage();
  const sessionStorage = storage();
  const calls = [];
  const timers = [];
  const intervals = [];
  let now = startAt;
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const location = new URL(url);
  const element = () => ({ addEventListener() {}, removeEventListener() {}, getAttribute() { return null; }, querySelectorAll() { return []; }, closest() { return null; }, matches() { return false; }, dataset: {}, style: {}, getBoundingClientRect: () => ({ top: 0, height: 0, bottom: 0 }), appendChild() {}, append() {}, remove() {} });
  document.readyState = 'complete';
  document.visibilityState = 'visible';
  document.hidden = false;
  document.title = 'Visual systems | SIMWORX';
  document.referrer = referrer;
  document.cookie = cookie;
  document.currentScript = { dataset: { endpoint }, src: 'https://www.sim-worx.com/reports/tracker.js' };
  document.documentElement = { scrollHeight: 2000, clientHeight: 800, scrollTop: 0 };
  document.body = { scrollHeight: 2000, scrollTop: 0, appendChild() {} };
  document.querySelectorAll = () => [];
  document.querySelector = () => null;
  document.getElementById = () => null;
  document.createElement = element;
  document.hasFocus = () => true;
  const navigator = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', language: 'en-GB', platform: 'Linux', sendBeacon() { return false; } };
  const history = {
    pushState(_state, _unused, next) { if (next) location.href = new URL(next, location.href).href; },
    replaceState(_state, _unused, next) { if (next) location.href = new URL(next, location.href).href; },
  };
  const schedule = fn => { timers.push(fn); return timers.length; };
  const repeat = fn => { intervals.push(fn); return intervals.length; };
  const fetch = async (input, init) => {
    calls.push({ input, init, body: init?.body ? JSON.parse(init.body) : undefined });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response || { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  const observer = class { observe() {} disconnect() {} };
  Object.assign(window, {
    window, self: window, document, navigator, location, history, localStorage, sessionStorage,
    crypto: webcrypto, fetch, XMLHttpRequest, innerWidth: 1440, innerHeight: 800, scrollY: 0, pageYOffset: 0,
    setTimeout: schedule, setInterval: repeat, clearTimeout() {}, clearInterval() {},
    SimworxCookieConsent: consentManager ? { getConsent: () => ({ analytics: consent, marketing: false }) } : undefined,
    performance: { now: () => now, getEntriesByType: () => [], timing: {} },
    MutationObserver: observer, IntersectionObserver: observer, PerformanceObserver: observer,
    requestAnimationFrame: schedule,
  });
  const context = vm.createContext({
    ...window, window, self: window, document, navigator, location, history, localStorage, sessionStorage,
    Date: ClockDate, URL, URLSearchParams, crypto: webcrypto, fetch,
    console, Promise, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Set, Map,
    TextEncoder, Blob, AbortController, Error, Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    MutationObserver: observer, IntersectionObserver: observer, PerformanceObserver: observer,
    setTimeout: schedule, setInterval: repeat, clearTimeout() {}, clearInterval() {},
    requestAnimationFrame: schedule,
  });
  vm.runInContext(await readFile(sourcePath, 'utf8'), context, { filename: 'tracker.js' });
  return { api: window.SimworxIntelligence, window, document, localStorage, sessionStorage, calls, timers, intervals, location, originalFetch: fetch, advance: milliseconds => { now += milliseconds; } };
}

function collected(b) { return b.calls.flatMap(call => call.body?.events || []); }

test('does not persist or send anonymous analytics until analytics consent', async () => {
  const b = await browser();
  assert.ok(b.api);
  b.api.trackEvent('cta_clicked', { cta_id: 'start' });
  await b.api.flush();
  assert.equal(b.localStorage.writes.length, 0);
  assert.equal(b.sessionStorage.writes.length, 0);
  assert.equal(b.calls.length, 0);
  b.api.setConsent({ analytics: true });
  b.api.trackEvent('cta_clicked', { cta_id: 'start' });
  await b.api.flush();
  assert.ok(b.localStorage.writes.length > 0);
  assert.ok(collected(b).some(event => event.event_name === 'cta_clicked'));
});

test('shares visitor and active session between browser tabs', async () => {
  const sharedStorage = storage();
  const first = await browser({ consent: true, sharedStorage });
  first.api.trackEvent('test_tab_one');
  await first.api.flush();
  const second = await browser({ consent: true, sharedStorage });
  second.api.trackEvent('test_tab_two');
  await second.api.flush();
  const a = collected(first).find(event => event.event_name === 'test_tab_one');
  const b = collected(second).find(event => event.event_name === 'test_tab_two');
  assert.ok(a?.visitor_id);
  assert.equal(a.visitor_id, b.visitor_id);
  assert.equal(a.session_id, b.session_id);
});

test('expires session after thirty minutes of inactivity while retaining visitor', async () => {
  const b = await browser({ consent: true });
  b.api.trackEvent('test_before');
  await b.api.flush();
  b.advance(31 * 60 * 1000);
  b.api.trackEvent('test_after');
  await b.api.flush();
  const before = collected(b).find(event => event.event_name === 'test_before');
  const after = collected(b).find(event => event.event_name === 'test_after');
  assert.equal(before.visitor_id, after.visitor_id);
  assert.notEqual(before.session_id, after.session_id);
});

test('retries retain event IDs and do not throw when collection is unavailable', async () => {
  const b = await browser({ consent: true, responses: [new Error('offline')] });
  b.api.trackEvent('test_retry', { label: 'unchanged' });
  await b.api.flush();
  await b.api.flush();
  const attempts = b.calls.flatMap(call => call.body?.events || []).filter(event => event.event_name === 'test_retry');
  assert.ok(attempts.length >= 2);
  assert.ok(attempts[0].event_id);
  assert.equal(attempts[0].event_id, attempts[1].event_id);
});

test('analytics consent withdrawal removes tracking state and stops collection', async () => {
  const b = await browser({ consent: true });
  b.api.trackEvent('test_before');
  await b.api.flush();
  b.api.setConsent({ analytics: false });
  const count = b.calls.length;
  b.api.trackEvent('test_after');
  await b.api.flush();
  assert.equal(b.calls.length, count);
  assert.equal(b.localStorage.length, 0);
});

test('PIN-only reports, admin and portal pages are excluded from public tracking', async () => {
  for (const path of ['/reports/', '/admin/', '/portal/']) {
    const b = await browser({ url: `https://www.sim-worx.com${path}`, consent: true });
    b.api?.trackEvent('private_page');
    await b.api?.flush();
    assert.equal(b.calls.length, 0, `${path} must not send public analytics`);
    assert.equal(b.localStorage.writes.length, 0, `${path} must not create tracking state`);
  }
});

test('generic events redact contact fields while voluntary identification is explicit', async () => {
  const b = await browser({ consent: true });
  b.api.trackEvent('cta_clicked', { email: 'person@example.com', name: 'A Person', nested: { telephone: '+34123456789' }, cta_id: 'contact' });
  b.api.identify({ email: ' Person@Example.com ', name: 'A Person', marketing_consent: false });
  await b.api.flush();
  const generic = collected(b).find(event => event.event_name === 'cta_clicked');
  assert.ok(!JSON.stringify(generic.properties).includes('person@example.com'));
  assert.ok(!JSON.stringify(generic.properties).includes('A Person'));
  assert.ok(!JSON.stringify(generic.properties).includes('+34123456789'));
  const identity = collected(b).find(event => event.event_name === 'email_entered');
  assert.equal(identity.properties.email, 'person@example.com');
  assert.equal(identity.properties.marketing_consent, false);
});

test('clicking email or enquiry controls cannot manufacture a successful conversion', async () => {
  const b = await browser({ consent: true });
  const button = { id: 'projection-enquiry', dataset: {}, tagName: 'BUTTON', textContent: 'Email proposal', getAttribute() { return null; }, closest() { return this; }, matches() { return false; } };
  b.document.dispatchEvent({ type: 'click', target: button });
  await b.api.flush();
  assert.ok(!collected(b).some(event => ['configuration_emailed', 'enquiry_submitted', 'email_entered'].includes(event.event_name)));
});

test('classifies campaign and exact-referrer sources without discarding attribution', async () => {
  const cases = [
    { url: 'https://www.sim-worx.com/', source: 'Direct' },
    { url: 'https://www.sim-worx.com/?utm_source=google&utm_medium=cpc&utm_campaign=LED-01', source: 'Google Ads', campaign: 'LED-01' },
    { url: 'https://www.sim-worx.com/?gclid=example-click', source: 'Google Ads' },
    { referrer: 'https://www.google.com/search?q=simulator', source: 'Google Organic' },
    { referrer: 'https://aviation.example/blog/simulator', source: 'Referral', domain: 'aviation.example' },
    { url: 'https://www.sim-worx.com/?ref=LINKEDIN-LED-01', source: 'LinkedIn', campaign: 'LINKEDIN-LED-01' },
    { url: 'https://www.sim-worx.com/?utm_source=openai&utm_medium=paid&utm_campaign=OPENAI-LED-01', source: 'OpenAI Ads', campaign: 'OPENAI-LED-01' },
  ];
  for (const row of cases) {
    const b = await browser({ ...row, consent: true });
    const context = b.api.getContext();
    assert.equal(context.source, row.source);
    if (row.campaign) assert.equal(context.campaign, row.campaign);
    if (row.domain) {
      assert.equal(context.first_touch.referrer_domain, row.domain);
      assert.equal(context.first_touch.referrer, row.referrer);
    }
  }
});

test('retains first touch when a later session acquires a different campaign', async () => {
  const sharedStorage = storage();
  const first = await browser({ consent: true, sharedStorage, url: 'https://www.sim-worx.com/?ref=LINKEDIN-LED-01' });
  await first.api.flush();
  const second = await browser({ consent: true, sharedStorage, startAt: Date.parse('2026-10-26T12:00:00Z'), url: 'https://www.sim-worx.com/?utm_source=google&utm_medium=cpc&utm_campaign=GOOGLE-02' });
  const context = second.api.getContext();
  assert.equal(context.first_touch.source, 'LinkedIn');
  assert.equal(context.first_touch.campaign, 'LINKEDIN-LED-01');
  assert.equal(context.last_touch.source, 'Google Ads');
  assert.equal(context.last_touch.campaign, 'GOOGLE-02');
  assert.equal(context.returning, true);
});

test('uses one stable configuration ID per explicitly completed configuration', async () => {
  const b = await browser({ consent: true });
  b.api.configure({ configurator_type: 'led', configurator_version: 'led_test_v1' });
  const first = b.api.completeConfiguration({ screen_type: 'curved', horizontal_fov: 180 }, { estimated_price: 17000, currency: 'EUR' });
  const duplicate = b.api.completeConfiguration({ screen_type: 'curved', horizontal_fov: 180 });
  assert.ok(first.startsWith('CFG-20261025-'));
  assert.equal(first, duplicate);
  await b.api.flush();
  const completions = collected(b).filter(event => event.event_name === 'configuration_completed');
  assert.equal(completions.length, 1);
  assert.equal(completions[0].properties.configuration_id, first);
  assert.equal(completions[0].properties.configuration.screen_type, 'curved');
  assert.equal(completions[0].properties.configurator_version, 'led_test_v1');
});

test('durable queue bounds retries and keeps voluntary contacts in memory only', async () => {
  const b = await browser({ consent: true });
  for (let i = 0; i < 100; i++) b.api.trackEvent('retry_sample', { index: i });
  b.api.identify({ email: 'private@example.com', name: 'Private Name' });
  const stored = [...b.localStorage.values.values()].join('\n');
  assert.ok(!stored.includes('private@example.com'));
  assert.ok(!stored.includes('Private Name'));
  const queues = [...b.localStorage.values].filter(([key]) => key.includes(':queue:')).map(([, value]) => JSON.parse(value));
  assert.ok(queues.flat().length <= 60);
  await b.api.flush();
});

test('automatic idle heartbeat ticks cannot keep an inactive session alive', async () => {
  const b = await browser({ consent: true });
  const before = b.api.getContext();
  for (let i = 0; i < 124; i++) {
    b.advance(15000);
    b.intervals.forEach(callback => callback());
    await b.api.flush();
  }
  b.document.dispatchEvent({ type: 'pointerdown' });
  b.api.trackEvent('activity_after_idle');
  const after = b.api.getContext();
  assert.equal(after.visitor_id, before.visitor_id);
  assert.notEqual(after.session_id, before.session_id);
});

test('recognizes www and apex hostname referrers as the same website', async () => {
  for (const [url, referrer] of [
    ['https://www.sim-worx.com/visual-systems.html', 'https://sim-worx.com/'],
    ['https://sim-worx.com/visual-systems.html', 'https://www.sim-worx.com/'],
  ]) {
    const b = await browser({ url, referrer, consent: true });
    assert.equal(b.api.getContext().source, 'Direct');
  }
});

test('updates last touch for a new campaign within an existing session', async () => {
  const sharedStorage = storage();
  const first = await browser({ consent: true, sharedStorage, url: 'https://www.sim-worx.com/?ref=LINKEDIN-LED-01' });
  const firstContext = first.api.getContext();
  await first.api.flush();
  const second = await browser({ consent: true, sharedStorage, url: 'https://www.sim-worx.com/?utm_source=google&utm_medium=cpc&utm_campaign=GOOGLE-02' });
  const secondContext = second.api.getContext();
  assert.equal(secondContext.session_id, firstContext.session_id);
  assert.equal(secondContext.first_touch.source, 'LinkedIn');
  assert.equal(secondContext.last_touch.source, 'Google Ads');
  assert.equal(secondContext.last_touch.campaign, 'GOOGLE-02');
});

test('blocked browser storage retains stable visitor and session IDs in memory', async () => {
  const denied = () => { throw new Error('Storage access denied'); };
  const sharedStorage = { getItem: denied, setItem: denied, removeItem: denied, key: denied, get length() { throw new Error('Storage access denied'); } };
  const b = await browser({ consent: true, sharedStorage });
  b.api.trackEvent('storage_blocked_one');
  b.api.trackEvent('storage_blocked_two');
  await b.api.flush();
  const one = collected(b).find(event => event.event_name === 'storage_blocked_one');
  const two = collected(b).find(event => event.event_name === 'storage_blocked_two');
  assert.ok(one.visitor_id);
  assert.equal(two.visitor_id, one.visitor_id);
  assert.equal(two.session_id, one.session_id);
});

test('starts a session once with flat attribution fields used by the collector', async () => {
  const b = await browser({ consent: true, url: 'https://www.sim-worx.com/?utm_source=google&utm_medium=cpc&utm_campaign=LED-01&utm_content=visual&utm_term=screen&ref=GOOGLE-LED-01' });
  b.api.trackEvent('cta_clicked', { cta: 'start' });
  await b.api.flush();
  const starts = collected(b).filter(e => e.event_name === 'session_started');
  assert.equal(starts.length, 1);
  assert.equal(starts[0].properties.utm_source, 'google');
  assert.equal(starts[0].properties.utm_medium, 'cpc');
  assert.equal(starts[0].properties.utm_campaign, 'LED-01');
  assert.equal(starts[0].properties.utm_content, 'visual');
  assert.equal(starts[0].properties.utm_term, 'screen');
  assert.equal(starts[0].properties.ref_code, 'GOOGLE-LED-01');
  b.advance(31*60*1000);b.api.trackEvent('resumed_action');await b.api.flush();
  assert.equal(collected(b).filter(e => e.event_name === 'session_started').length, 2);
});

test('current conversion attribution uses the latest acquisition without changing first touch', async () => {
  const sharedStorage=storage();
  const first=await browser({consent:true,sharedStorage,url:'https://www.sim-worx.com/?ref=LINKEDIN-LED-01'});
  await first.api.flush();
  const second=await browser({consent:true,sharedStorage,url:'https://www.sim-worx.com/?utm_source=google&utm_medium=cpc&utm_campaign=GOOGLE-02'});
  second.api.identify({email:'volunteer@example.test'});await second.api.flush();
  const capture=collected(second).find(e=>e.event_name==='email_entered');
  assert.equal(capture.properties.source,'Google Ads');
  assert.equal(capture.properties.campaign,'GOOGLE-02');
  assert.equal(capture.properties.first_touch.source,'LinkedIn');
  assert.equal(capture.properties.last_touch.source,'Google Ads');
});

test('late passive pagehide cannot extend an expired session', async () => {
  const b=await browser({consent:true});await b.api.flush();
  const before=collected(b).length;
  b.advance(31*60*1000);b.window.dispatchEvent({type:'pagehide'});await b.api.flush();
  assert.equal(collected(b).length,before);
});

test('engagement preserves the last visible seconds and omits hidden time', async () => {
  const b=await browser({consent:true});
  b.advance(7000);b.document.hidden=true;b.document.dispatchEvent({type:'visibilitychange'});await b.api.flush();
  assert.equal(collected(b).filter(e=>e.event_name==='engagement').at(-1).properties.engagement_time,7);
  b.advance(60000);b.document.hidden=false;b.document.dispatchEvent({type:'visibilitychange'});
  b.document.dispatchEvent({type:'pointerdown'});b.advance(5000);b.intervals.forEach(callback=>callback());await b.api.flush();
  assert.equal(collected(b).filter(e=>e.event_name==='engagement').at(-1).properties.engagement_time,12);
});

test('errors before consent do not exhaust consented error tracking', async () => {
  const b=await browser();
  for(let i=0;i<25;i++)b.api.reportError('asset_error');
  b.api.setConsent({analytics:true});assert.ok(b.api.reportError('actual_error'));await b.api.flush();
  assert.equal(collected(b).filter(e=>e.event_name==='website_error').length,1);
});

test('UTF-8 payload batches stay inside keepalive size and oversized properties are marked', async () => {
  const b=await browser({consent:true});
  b.api.trackEvent('large_snapshot',Object.fromEntries(Array.from({length:80},(_,i)=>['dimension_'+i,'飛'.repeat(1200)])));
  await b.api.flush();
  assert.ok(b.calls.every(c=>new TextEncoder().encode(c.init.body).length<50000));
  assert.equal(collected(b).find(e=>e.event_name==='large_snapshot').properties.payload_truncated,true);
});

test('standalone pages honor only the existing unexpired exact-version consent preference', async () => {
  const valid={version:'SWX-CKN-001-v1.0-2026-08-14',timestamp:'2026-10-24T12:00:00Z',analytics:true,marketing:false};
  const allowed=await browser({consentManager:false,sharedStorage:storage({simworx_cookie_consent:JSON.stringify(valid)})});
  await allowed.api.flush();assert.ok(collected(allowed).some(e=>e.event_name==='page_view'));
  for(const override of [{analytics:false},{analytics:'true'},{version:'old-version'},{timestamp:'2025-10-20T00:00:00Z'},{timestamp:'2026-10-26T12:00:00Z'}]){
    const b=await browser({consentManager:false,sharedStorage:storage({simworx_cookie_consent:JSON.stringify({...valid,...override})})});
    await b.api.flush();assert.equal(b.calls.length,0);assert.equal(b.localStorage.writes.length,0);
  }
  const noChoice=await browser({consentManager:false});await noChoice.api.flush();assert.equal(noChoice.calls.length,0);assert.equal(noChoice.localStorage.writes.length,0);
  const cookie=await browser({consentManager:false,cookie:'swx_cookie_consent='+encodeURIComponent(JSON.stringify(valid))});await cookie.api.flush();assert.ok(collected(cookie).some(e=>e.event_name==='page_view'));
});

test('late consent manager default preserves an existing accepted identity; actual withdrawal clears it', async () => {
  const shared=storage({simworx_cookie_consent:JSON.stringify({version:'SWX-CKN-001-v1.0-2026-08-14',timestamp:'2026-10-24T12:00:00Z',analytics:true,marketing:false})});
  const b=await browser({consentManager:false,sharedStorage:shared});const id=b.api.getContext().visitor_id;
  b.window.dispatchEvent({type:'simworx:consentchange',detail:{analytics:false}});
  assert.equal(b.api.getContext().visitor_id,id);
  shared.setItem('simworx_cookie_consent',JSON.stringify({version:'SWX-CKN-001-v1.0-2026-08-14',timestamp:'2026-10-25T12:00:00Z',analytics:false}));
  b.window.dispatchEvent({type:'simworx:consentchange',detail:{analytics:false}});
  assert.equal(b.api.getContext().enabled,false);
  assert.ok(![...shared.values.keys()].some(key=>key.startsWith('swx_intelligence_v1:')));
});

test('rapid ordered configurator actions have strictly increasing event timestamps', async () => {
  const b=await browser({consent:true});
  b.api.startConfigurator('led','led-live-v1');
  b.api.step('screen_completed',{screen_type:'curved'});
  b.api.trackEvent('price_viewed');
  b.api.completeConfiguration({screen_type:'curved'});
  b.api.identify({email:'order@example.test'});
  await b.api.flush();
  const events=collected(b);for(let i=1;i<events.length;i++)assert.ok(Date.parse(events[i].timestamp)>Date.parse(events[i-1].timestamp));
  const names=events.map(e=>e.event_name);
  assert.ok(names.indexOf('led_configurator_opened')<names.indexOf('led_configurator_started'));
  assert.ok(names.indexOf('price_viewed')<names.indexOf('configuration_completed'));
  assert.ok(names.indexOf('configuration_completed')<names.indexOf('email_entered'));
});

test('reviewed offline Projection V37 posts only analytics through native XHR without changing app fetch', async () => {
  const instances=[];
  class XHR {
    constructor(){this.headers={};instances.push(this);}
    open(method,url,async){this.opened={method,url,async};}
    setRequestHeader(key,value){this.headers[key]=value;}
    send(body){this.body=JSON.parse(body);this.status=200;this.onload();}
  }
  const endpoint='https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence';
  const b=await browser({consent:true,endpoint,XMLHttpRequest:XHR});
  b.api.configure({configurator_type:'projection',configurator_version:'projection-v37-reviewhash'});
  b.api.trackEvent('projector_spec_generated');assert.equal(await b.api.flush(),true);
  assert.equal(b.window.fetch,b.originalFetch);assert.equal(b.calls.length,0);assert.equal(instances.length,1);
  assert.deepEqual(instances[0].opened,{method:'POST',url:endpoint,async:true});
  assert.equal(instances[0].headers['Content-Type'],'application/json');assert.equal(instances[0].timeout,15000);assert.equal(instances[0].withCredentials,false);
  assert.equal(instances[0].body.action,'collect');assert.ok(instances[0].body.events.some(e=>e.event_name==='projector_spec_generated'));
});

test('failed projection XHR preserves queued event IDs for the next bounded retry', async () => {
  const batches=[];
  class XHR {
    open(){}setRequestHeader(){}
    send(body){batches.push(JSON.parse(body).events);if(batches.length===1)this.ontimeout();else{this.status=200;this.onload();}}
  }
  const b=await browser({consent:true,endpoint:'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence',XMLHttpRequest:XHR});
  b.api.configure({configurator_type:'projection',configurator_version:'projection-v37'});
  assert.equal(await b.api.flush(),false);assert.equal(await b.api.flush(),true);
  assert.deepEqual(batches[0].map(e=>e.event_id),batches[1].map(e=>e.event_id));assert.equal(b.calls.length,0);assert.equal(b.window.fetch,b.originalFetch);
});

test('other pages, unknown versions and unavailable XHR retain existing fetch keepalive transport', async () => {
  for(const [type,version,xhr]of [['led','led-live-v1',class{constructor(){throw new Error('LED must not use XHR');}}],['projection','projection-v38',class{constructor(){throw new Error('Unreviewed version must not use XHR');}}],['projection','projection-v37',undefined]]){
    const b=await browser({consent:true,endpoint:'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence',XMLHttpRequest:xhr});
    b.api.configure({configurator_type:type,configurator_version:version});assert.equal(await b.api.flush(),true);
    assert.equal(b.calls.length,1);assert.equal(b.calls[0].init.keepalive,true);assert.equal(b.window.fetch,b.originalFetch);
  }
});

 test('OpenAI paid codes survive navigation into enquiry events',async()=>{
 const b=await browser({consent:true,url:'https://www.sim-worx.com/?utm_source=chatgpt&utm_medium=paid&utm_campaign=led_promotion&campaign_id=c1&ad_group_id=g1&ad_id=a1'});
 b.api.trackEvent('enquiry_submitted');await b.api.flush();
 const e=collected(b).find(e=>e.event_name==='enquiry_submitted');
 assert.equal(e.properties.source,'OpenAI Ads');assert.equal(e.properties.campaign_id,'c1');assert.equal(e.properties.ad_group_id,'g1');assert.equal(e.properties.ad_id,'a1');
 const next=await browser({consent:true,sharedStorage:b.localStorage,url:'https://www.sim-worx.com/contact.html',referrer:b.location.href});
 next.api.trackEvent('enquiry_submitted');await next.api.flush();
 assert.equal(collected(next).find(e=>e.event_name==='enquiry_submitted').properties.ad_id,'a1');
 });
