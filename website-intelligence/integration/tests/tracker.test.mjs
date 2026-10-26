import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const sourcePath = new URL('../tracker.js', import.meta.url);

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

async function browser({ url = 'https://www.sim-worx.com/visual-systems.html', referrer = '', sharedStorage, consent = false, responses = [], startAt = Date.parse('2026-10-25T12:00:00Z') } = {}) {
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
  document.currentScript = { dataset: { endpoint: 'https://example.supabase.co/functions/v1/simworx-intelligence' }, src: 'https://www.sim-worx.com/reports/tracker.js' };
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
    crypto: webcrypto, fetch, innerWidth: 1440, innerHeight: 800, scrollY: 0, pageYOffset: 0,
    setTimeout: schedule, setInterval: repeat, clearTimeout() {}, clearInterval() {},
    SimworxCookieConsent: { getConsent: () => ({ analytics: consent, marketing: false }) },
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
  return { api: window.SimworxIntelligence, window, document, localStorage, sessionStorage, calls, timers, intervals, location, advance: milliseconds => { now += milliseconds; } };
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
