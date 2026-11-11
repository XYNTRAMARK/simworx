/* SIMWORX Intelligence SDK 1.1.0 — consent-aware first-party tracking, no dependencies. */
(function (window, document) {
  'use strict';
  if (window.SimworxIntelligence) return;
  var script = document.currentScript;
  var COLLECTOR_ENDPOINT = 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence';
  var options = {
    endpoint: script && script.dataset.endpoint || COLLECTOR_ENDPOINT,
    configurator_type: script && script.dataset.configurator || '',
    configurator_version: script && script.dataset.configuratorVersion || 'unversioned'
  };
  var PREFIX = 'swx_intelligence_v1', SESSION_MS = 30 * 60 * 1000;
  var CONSENT_VERSION = 'SWX-CKN-001-v1.0-2026-08-14';
  var enabled = false, excluded = /^\/(reports|admin|portal)(\/|$)/i.test(location.pathname);
  var visitor = null, session = null, config = null, queue = [], inFlight = null;
  var flushTimer = null, retryMs = 5000, pageId = '', pageUrl = '', pageStarted = 0;
  var pageEngagement = 0, lastTick = Date.now(), lastActivity = Date.now(), maxScroll = 0;
  var scrollMilestones = {}, performanceStarted = false, errorCount = 0, seenPage = false;
  var openedKeys = {}, pendingSessionStarted = false, wasVisible = !document.hidden, lastEventMs = 0;
  var tabId = uuid(), queueKey = PREFIX + ':queue:' + tabId;
  var PII_KEYS = /^(email|e_mail|name|full_name|first_name|last_name|phone|telephone|company|organisation|organization|address|message|body|password|pin|token|authorization|cookie|contact|customer|billing|shipping_address|ip|ip_address)$/i;

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    var a = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (var n = 0; n < a.length; n++) a[n] = Math.random() * 256;
    a[6] = a[6] & 15 | 64; a[8] = a[8] & 63 | 128;
    return Array.from(a, function (v) { return v.toString(16).padStart(2, '0'); }).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  }
  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* Storage can be disabled. */ } }
  function savedConsent() {
    // This existing essential preference is read solely to enforce the visitor's choice.
    // Standalone configurators do not acquire a new banner or a default opt-in.
    var record = null;
    try { record = JSON.parse(localStorage.getItem('simworx_cookie_consent') || 'null'); } catch (_) {}
    if (!record) {
      try {
        var cookie = String(document.cookie || '').split('; ').find(function (item) { return item.indexOf('swx_cookie_consent=') === 0; });
        if (cookie) record = JSON.parse(decodeURIComponent(cookie.slice('swx_cookie_consent='.length)));
      } catch (_) {}
    }
    if (!record || record.version !== CONSENT_VERSION || !record.timestamp) return null;
    var age = Date.now() - Date.parse(record.timestamp);
    if (!Number.isFinite(age) || age < 0 || age > 365 * 86400000) return null;
    return { analytics: record.analytics === true, marketing: record.marketing === true };
  }
  function text(value, length) { return String(value == null ? '' : value).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/ig, '[redacted]').slice(0, length || 600); }
  function safeUrl(value) {
    try {
      var url = new URL(value, location.href);
      if (!/^https?:$/.test(url.protocol)) return '';
      url.hash = ''; url.username = ''; url.password = '';
      Array.from(url.searchParams.keys()).forEach(function (key) {
        if (PII_KEYS.test(key) || /email|phone|name|token|secret|key|message|configuration|question/i.test(key) || /@/.test(url.searchParams.get(key) || '')) url.searchParams.delete(key);
      });
      return url.href.slice(0, 1800);
    } catch (_) { return ''; }
  }
  function clean(value, depth) {
    depth = depth || 0;
    if (depth > 6 || value == null) return value == null ? null : undefined;
    if (typeof value === 'string') return text(value, 1200);
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 40).map(function (item) { return clean(item, depth + 1); });
    if (typeof value !== 'object') return undefined;
    var result = {};
    Object.keys(value).slice(0, 100).forEach(function (key) {
      if (!PII_KEYS.test(key) && !/__proto__|constructor|prototype|image|base64|screenshot|stack|html/i.test(key)) result[key] = clean(value[key], depth + 1);
    });
    return result;
  }
  function sourceGroup(touch) {
    var source = (touch.utm_source || '').toLowerCase(), medium = (touch.utm_medium || '').toLowerCase();
    var ref = (touch.ref || '').toLowerCase(), domain = touch.referrer_domain || '';
    var label = source + ' ' + ref;
    if (/email|newsletter/.test(medium) || /newsletter|email/.test(label)) return 'Email';
    if (/openai|chatgpt/.test(label) && (/ads|paid|cpc|ppc/.test(medium + ' ' + ref))) return 'OpenAI Ads';
    if (/linkedin/.test(label + ' ' + domain)) return 'LinkedIn';
    if (/instagram/.test(label + ' ' + domain)) return 'Instagram';
    if (/facebook|\bmeta\b|fb\.com|fb\.me/.test(label + ' ' + domain)) return 'Facebook';
    if (/bing|microsoft/.test(label + ' ' + domain) || touch.msclkid) return 'Bing';
    if (/google/.test(label + ' ' + domain) || touch.gclid || touch.gbraid || touch.wbraid) {
      return /cpc|ppc|paid|ads/.test(medium + ' ' + ref) || touch.gclid || touch.gbraid || touch.wbraid ? 'Google Ads' : 'Google Organic';
    }
    if (!source && !ref && !domain) return 'Direct';
    if (!source && !ref && domain) return 'Referral';
    return 'Other';
  }
  function attribution() {
    var params = new URLSearchParams(location.search), touch = { landing_page: safeUrl(location.href), timestamp: new Date().toISOString() };
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'campaign_id', 'ad_group_id', 'ad_id', 'ref', 'gclid', 'gbraid', 'wbraid', 'msclkid'].forEach(function (key) {
      if (params.get(key)) touch[key] = text(params.get(key), 240);
    });
    touch.referrer = safeUrl(document.referrer || '');
    try { touch.referrer_domain = new URL(touch.referrer).hostname.toLowerCase(); } catch (_) { touch.referrer_domain = ''; }
    // Internal navigation retains the session's acquisition touch.
    if (touch.referrer_domain.replace(/^www\./, '') === location.hostname.replace(/^www\./, '') && !touch.utm_source && !touch.ref && !touch.gclid && !touch.msclkid) return null;
    touch.source = sourceGroup(touch); touch.campaign = touch.utm_campaign || touch.ref || '(none)';
    return touch;
  }
  function device() {
    var ua = navigator.userAgent || '', browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /OPR\//.test(ua) ? 'Opera' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Other';
    var os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
    var type = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? 'Tablet' : /Mobi|iPhone|iPod/i.test(ua) ? 'Mobile' : 'Desktop';
    return { device: type, device_type: type, browser: browser, os: os, viewport_width: window.innerWidth || 0, viewport_height: window.innerHeight || 0 };
  }
  function ensureSession(interactive) {
    interactive = interactive !== false;
    var now = Date.now(), stored = read(PREFIX + ':session', null);
    if (!stored && session && session.visitor_id === visitor.id && now - session.last_activity < SESSION_MS) stored = session;
    if (stored && stored.visitor_id === visitor.id && now - stored.last_activity < SESSION_MS) session = stored;
    else if (interactive || !session) {
      var touch = attribution() || visitor.last_touch || { source: 'Direct', campaign: '(none)', landing_page: safeUrl(location.href), timestamp: new Date().toISOString() };
      session = { id: uuid(), visitor_id: visitor.id, started_at: now, last_activity: now, landing_page: safeUrl(location.href), source: touch.source, campaign: touch.campaign, touch: touch, returning: !!visitor.previous_session || !!visitor.last_session_id };
      visitor.previous_session = !!visitor.last_session_id; visitor.last_session_id = session.id;
      visitor.last_touch = touch; write(PREFIX + ':visitor', visitor); config = null; pendingSessionStarted = true;
    }
    if (interactive) { session.last_activity = now; write(PREFIX + ':session', session); }
    return session;
  }
  function context() {
    if (!enabled || !visitor || !session) return { enabled: false };
    var touch = visitor.last_touch || session.touch || {};
    var result = Object.assign({ enabled: true, visitor_id: visitor.id, session_id: session.id, returning: session.returning,
      source: touch.source || session.source, campaign: touch.campaign || session.campaign, first_touch: visitor.first_touch, last_touch: visitor.last_touch,
      attribution: { first_touch: visitor.first_touch, last_touch: visitor.last_touch }, page_view_id: pageId,
      configurator_type: options.configurator_type || undefined, configurator_version: options.configurator_type ? options.configurator_version : undefined,
      configurator_session_id: config && config.configurator_session_id, configuration_id: config && config.configuration_id }, device());
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'campaign_id', 'ad_group_id', 'ad_id', 'ref', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'referrer_domain', 'referrer'].forEach(function (key) {
      if (touch[key]) result[key] = touch[key];
    });
    if (touch.ref) result.ref_code = touch.ref;
    return result;
  }
  function persistQueue() {
    if (!enabled) return;
    // Personal contact events remain memory-only. Generic retries persist at most 24h.
    var safe = queue.filter(function (event) { return !event.__personal; }).slice(-60);
    while (JSON.stringify(safe).length > 48000 && safe.length) safe.shift();
    write(queueKey, safe);
  }
  function recoverQueues() {
    try {
      var keys = [], cutoff = Date.now() - 86400000;
      for (var i = 0; i < localStorage.length; i++) { var key = localStorage.key(i); if (key && key.indexOf(PREFIX + ':queue:') === 0) keys.push(key); }
      keys.forEach(function (key) {
        var recovered = read(key, []);
        if (Array.isArray(recovered)) recovered.forEach(function (event) {
          if (event.visitor_id === visitor.id && Date.parse(event.timestamp) > cutoff && !queue.some(function (item) { return item.event_id === event.event_id; })) queue.push(event);
        });
        localStorage.removeItem(key);
      });
      queue = queue.slice(-60); persistQueue();
    } catch (_) { /* In-memory events still work. */ }
  }
  function schedule(delay) {
    if (!enabled || flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(); }, delay || 5000);
  }
  function byteLength(value) { return typeof TextEncoder === 'function' ? new TextEncoder().encode(value).length : unescape(encodeURIComponent(value)).length; }
  function enqueue(name, props, personal) {
    lastEventMs = Math.max(Date.now(), lastEventMs + 1);
    var event = { event_id: uuid(), visitor_id: visitor.id, session_id: session.id, event_name: name,
      page_url: safeUrl(location.href), timestamp: new Date(lastEventMs).toISOString(), properties: props };
    if (byteLength(JSON.stringify(event)) > 28000) { event.properties.configuration = undefined; event.properties.configuration_json = undefined; event.properties.payload_truncated = true; }
    if (byteLength(JSON.stringify(event)) > 46000) { event.properties = { source: props.source, campaign: props.campaign, configurator_type: props.configurator_type, configurator_version: props.configurator_version, configuration_id: props.configuration_id, payload_truncated: true }; if (personal) Object.assign(event.properties, personal); }
    if (personal) Object.defineProperty(event, '__personal', { value: true, enumerable: false });
    queue.push(event); if (queue.length > 80) queue.shift(); persistQueue(); schedule();
    if (queue.length >= 15) flush();
    return event.event_id;
  }
  function track(name, properties, personal) {
    if (!enabled || excluded || !/^[a-z][a-z0-9_]{1,79}$/.test(name)) return null;
    var interactive = !/^(engagement|page_performance|web_vitals|website_error|configurator_abandoned)$/.test(name);
    // Passive observations must not extend a timed-out session or create a fresh one.
    if (!interactive && session && Date.now() - session.last_activity >= SESSION_MS) return null;
    ensureSession(interactive);
    var base = context(); delete base.enabled; delete base.visitor_id; delete base.session_id;
    if (pendingSessionStarted) {
      pendingSessionStarted = false;
      if (name !== 'session_started') enqueue('session_started', Object.assign({}, base, { landing_page: session.landing_page }), null);
    }
    var props = Object.assign({}, base, clean(properties || {}));
    if (personal) Object.assign(props, personal);
    return enqueue(name, props, personal);
  }
  function collectRequest(body) {
    // Reviewed V37 replaces fetch for its offline bundle. Do not alter that app
    // function: this native transport is used solely for the analytics endpoint.
    if (options.configurator_type === 'projection' && /^projection-v37(?:$|[-_])/.test(options.configurator_version) && options.endpoint === COLLECTOR_ENDPOINT && typeof window.XMLHttpRequest === 'function') {
      return new Promise(function (resolve, reject) {
        var request = new window.XMLHttpRequest();
        request.open('POST', COLLECTOR_ENDPOINT, true);
        request.withCredentials = false;
        request.timeout = 15000;
        request.setRequestHeader('Content-Type', 'application/json');
        request.onload = function () { resolve({ ok: request.status >= 200 && request.status < 300, status: request.status }); };
        request.onerror = request.ontimeout = request.onabort = function () { reject(new Error('Collection unavailable')); };
        request.send(body);
      });
    }
    return fetch(options.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: body, keepalive: true, credentials: 'omit', mode: 'cors' });
  }
  function flush() {
    if (!enabled || !options.endpoint || !queue.length) return Promise.resolve(false);
    if (inFlight) return inFlight;
    var batch = [], bytes = 0;
    for (var i = 0; i < queue.length && batch.length < 20; i++) {
      var size = byteLength(JSON.stringify(queue[i]));
      if (bytes + size > 48000 && batch.length) break;
      batch.push(queue[i]); bytes += size;
    }
    var ids = batch.map(function (event) { return event.event_id; });
    inFlight = Promise.resolve().then(function () {
      return collectRequest(JSON.stringify({ action: 'collect', events: batch }));
    }).then(function (response) {
      if (!response.ok) throw new Error('Collection unavailable');
      queue = queue.filter(function (event) { return ids.indexOf(event.event_id) < 0; });
      persistQueue(); retryMs = 5000; return true;
    }).catch(function () { retryMs = Math.min(retryMs * 2, 60000); return false; }).finally(function () {
      inFlight = null; if (queue.length) schedule(retryMs);
    });
    return inFlight;
  }
  function startConfigurator(type, version) {
    if (!enabled) return null;
    if (type) options.configurator_type = type;
    if (version) options.configurator_version = version;
    if (!options.configurator_type) return null;
    ensureSession();
    opened();
    if (!config) config = { configurator_session_id: uuid(), configuration_id: null, started: false, completed: false, last_step: 'opened' };
    if (!config.started) { config.started = true; config.last_step = 'started'; track(options.configurator_type + '_configurator_started', config); }
    return config.configurator_session_id;
  }
  function step(name, properties) {
    startConfigurator(); if (!config) return null;
    config.last_step = name; return track(name, Object.assign({}, properties || {}, { last_completed_step: name }));
  }
  function completeConfiguration(configuration, properties) {
    startConfigurator(); if (!config) return null;
    if (!config.configuration_id) config.configuration_id = 'CFG-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + uuid().slice(0, 12).toUpperCase();
    if (!config.completed) {
      config.completed = true; config.last_step = 'configuration_completed';
      track('configuration_completed', Object.assign({}, properties || {}, { configuration_id: config.configuration_id, configuration: clean(configuration || {}) }));
    }
    return config.configuration_id;
  }
  function contactFields(input) {
    input = input || {}; var email = String(input.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
    var output = { email: email };
    ['name', 'company', 'telephone', 'country'].forEach(function (key) { if (input[key]) output[key] = String(input[key]).slice(0, key === 'country' ? 80 : 200); });
    // Marketing opt-in needs the displayed wording and its version.
    if (input.marketing_consent === false) output.marketing_consent = false;
    if (input.marketing_consent === true && input.consent_text_version && input.consent_text) output.marketing_consent = true;
    if (input.consent_text_version) output.consent_text_version = String(input.consent_text_version).slice(0, 120);
    if (input.consent_text) output.consent_text = String(input.consent_text).slice(0, 500);
    if (typeof output.marketing_consent === 'boolean') output.consent_timestamp = new Date().toISOString();
    return output;
  }
  function identify(input, properties) {
    if (!enabled) return null;
    var personal = contactFields(input); if (!personal) return null;
    return track('email_entered', Object.assign({}, properties || {}, { configuration_id: input.configuration_id || config && config.configuration_id }), personal);
  }
  function marketingConsent(consent, input, properties) {
    var personal = contactFields(Object.assign({}, input || {}, { marketing_consent: consent === true }));
    if (!personal) return null;
    return track(consent === true ? 'marketing_consent_given' : 'marketing_consent_withdrawn', properties || {}, personal);
  }
  function successful(name, data) {
    data = data || {};
    var fields = contactFields(data.contact || data);
    if (fields) identify(Object.assign({}, data.contact || data, { configuration_id: data.configuration_id }), data);
    return track(name, Object.assign({}, data, { configuration_id: data.configuration_id || config && config.configuration_id }), fields);
  }
  function engagement() {
    var now = Date.now(), activeEnd = Math.min(now, lastActivity + 60000);
    if (enabled && wasVisible) pageEngagement += Math.max(0, Math.min(15000, activeEnd - lastTick)) / 1000;
    lastTick = now; wasVisible = !document.hidden;
  }
  function heartbeat(reason) {
    engagement(); if (!enabled || !seenPage) return;
    if (reason === 'heartbeat' && (document.hidden || Date.now() - lastActivity >= 60000)) return;
    track('engagement', { engagement_seconds: Math.round(pageEngagement * 10) / 10, engagement_time: Math.round(pageEngagement * 10) / 10,
      elapsed_seconds: Math.round((Date.now() - pageStarted) / 1000), scroll_depth: maxScroll, reason: reason || 'heartbeat', cumulative: true });
  }
  function pageView() {
    if (!enabled) return;
    if (seenPage) heartbeat('navigation');
    pageId = uuid(); pageUrl = safeUrl(location.href); pageStarted = Date.now(); pageEngagement = 0; maxScroll = 0; scrollMilestones = {}; lastTick = Date.now(); wasVisible = !document.hidden; seenPage = true;
    track('page_view', { page_title: text(document.title, 250), page_view_id: pageId, previous_page: previousPage || safeUrl(document.referrer || '') });
    previousPage = pageUrl;
  }
  var previousPage = '';
  function setConsent(value) {
    var next = value === true || !!(value && value.analytics === true);
    if (next === enabled || excluded) return;
    enabled = next;
    if (!enabled) {
      queue = []; visitor = null; session = null; config = null; seenPage = false; pendingSessionStarted = false;
      if (flushTimer) clearTimeout(flushTimer); flushTimer = null;
      try { var keys = []; for (var i = 0; i < localStorage.length; i++) { var key = localStorage.key(i); if (key && key.indexOf(PREFIX + ':') === 0) keys.push(key); } keys.forEach(function (key) { localStorage.removeItem(key); }); } catch (_) {}
      window.dispatchEvent(new CustomEvent('simworx:intelligence-consent', { detail: { analytics: false } })); return;
    }
    var touch = attribution() || { source: 'Direct', campaign: '(none)', landing_page: safeUrl(location.href), timestamp: new Date().toISOString() };
    visitor = read(PREFIX + ':visitor', null);
    if (!visitor || !visitor.id) visitor = { id: uuid(), first_seen: new Date().toISOString(), first_touch: touch, last_touch: touch };
    var stored = read(PREFIX + ':session', null);
    if (stored && stored.visitor_id === visitor.id && Date.now() - stored.last_activity < SESSION_MS) session = stored;
    if (touch && touch.source !== 'Direct') visitor.last_touch = touch;
    write(PREFIX + ':visitor', visitor); ensureSession(); recoverQueues(); pageView(); observePerformance();
    window.dispatchEvent(new CustomEvent('simworx:intelligence-ready', { detail: context() }));
  }
  function reportError(type, details) {
    if (!enabled || errorCount >= 20) return null;
    errorCount++; return track('website_error', Object.assign({ error_type: text(type, 80) }, details || {}));
  }
  function observePerformance() {
    if (performanceStarted) return; performanceStarted = true;
    var send = function () {
      try { var entry = performance.getEntriesByType('navigation')[0]; if (entry) track('page_performance', { ttfb_ms: Math.round(entry.responseStart - entry.requestStart), dom_ready_ms: Math.round(entry.domContentLoadedEventEnd), load_ms: Math.round(entry.loadEventEnd) }); } catch (_) {}
    };
    if (document.readyState === 'complete') setTimeout(send, 0); else window.addEventListener('load', send, { once: true });
    if (window.PerformanceObserver) {
      try { var lcp = new PerformanceObserver(function (list) { var entries = list.getEntries(), last = entries[entries.length - 1]; if (last && enabled) track('web_vitals', { metric: 'LCP', value_ms: Math.round(last.startTime) }); }); lcp.observe({ type: 'largest-contentful-paint', buffered: true }); } catch (_) {}
      try { var cls = 0, observer = new PerformanceObserver(function (list) { list.getEntries().forEach(function (entry) { if (!entry.hadRecentInput) cls += entry.value; }); if (enabled) track('web_vitals', { metric: 'CLS', value: Math.round(cls * 10000) / 10000, cumulative: true }); }); observer.observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
    }
  }
  function opened(type, version) {
    if (typeof type === 'string' && type) options.configurator_type = type;
    if (typeof version === 'string' && version) options.configurator_version = version;
    if (!enabled || !options.configurator_type) return;
    var key = session.id + ':' + options.configurator_type;
    if (!openedKeys[key]) { openedKeys[key] = true; track(options.configurator_type + '_configurator_opened', {}); }
  }
  function safely(callback, fallback) { return function () { try { return callback.apply(this, arguments); } catch (_) { return fallback === undefined ? null : fallback; } }; }
  window.SimworxIntelligence = Object.freeze({
    version: '1.1.0', trackEvent: safely(function (name, props) { return track(name, props); }), step: safely(step),
    identify: safely(identify), completeConfiguration: safely(completeConfiguration),
    configurationEmailed: safely(function (data) { return successful('configuration_emailed', data); }),
    enquirySubmitted: safely(function (data) { return successful('enquiry_submitted', data); }), marketingConsent: safely(marketingConsent),
    startConfigurator: safely(startConfigurator), openConfigurator: safely(opened), newConfiguration: safely(function () { config = null; return startConfigurator(); }),
    abandonConfigurator: safely(function (reason) { if (config && config.started && !config.completed) return track('configurator_abandoned', { last_completed_step: config.last_step, abandonment_signal: reason || 'explicit' }); return null; }),
    setConsent: safely(setConsent), getContext: safely(context, { enabled: false }), flush: function () { try { return flush(); } catch (_) { return Promise.resolve(false); } }, reportError: safely(reportError),
    configure: function (settings) { ['endpoint', 'configurator_type', 'configurator_version'].forEach(function (key) { if (settings && typeof settings[key] === 'string') options[key] = settings[key]; }); }
  });
  window.addEventListener('simworx:intelligence-ready', opened);
  window.addEventListener('simworx:consentchange', function (event) {
    // The existing manager emits a temporary denied default before applying a saved choice.
    if (event.detail && event.detail.analytics === false) { var saved = savedConsent(); if (saved && saved.analytics) return; }
    setConsent(event.detail);
  });
  window.addEventListener('storage', function (event) {
    if (event.key === PREFIX + ':visitor' && enabled && !event.newValue) setConsent(false);
    else if (event.key === 'simworx_cookie_consent') setConsent(savedConsent() || { analytics: false });
  });
  window.addEventListener('online', function () { flush(); });
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (event) { document.addEventListener(event, function () {
    engagement();
    lastActivity = Date.now();
    if (enabled) { var previousId = session && session.id; ensureSession(); if (previousId && previousId !== session.id) pageView(); }
  }, { passive: true }); });
  window.addEventListener('scroll', function () {
    if (!enabled) return;
    var height = Math.max(document.documentElement.scrollHeight, document.body && document.body.scrollHeight || 0) - window.innerHeight;
    if (height <= 0) return;
    maxScroll = Math.min(100, Math.max(maxScroll, Math.round((window.scrollY || 0) / height * 100)));
    [25, 50, 75, 100].forEach(function (milestone) { if (maxScroll >= milestone && !scrollMilestones[milestone]) { scrollMilestones[milestone] = true; track('scroll_depth', { scroll_depth: milestone }); } });
  }, { passive: true });
  document.addEventListener('click', function (event) {
    var element = event.target.closest && event.target.closest('a,button,[data-intelligence-cta]'); if (!element || !enabled) return;
    var href = element.href && safeUrl(element.href), label = element.dataset.intelligenceCta || element.id || '';
    if (href && (/\.pdf(?:\?|$)/i.test(href) || element.hasAttribute('download'))) track('brochure_downloaded', { target_url: href, cta: label || 'download' });
    else if (element.dataset.intelligenceCta || /\bbtn\b|led-button/.test(element.className || '')) track('cta_clicked', { cta: label || text(element.textContent, 100), target_url: href || undefined });
  }, true);
  document.addEventListener('play', function (event) { if (event.target.tagName === 'VIDEO') track('video_played', { video_id: event.target.id || 'video', video_url: safeUrl(event.target.currentSrc || '') }); }, true);
  document.addEventListener('invalid', function (event) { track('form_invalid', { form_id: event.target.form && event.target.form.id || 'unnamed', field_type: event.target.type || 'unknown' }); }, true);
  window.addEventListener('error', function (event) {
    if (event.target !== window && event.target && /^(IMG|SCRIPT|LINK|VIDEO)$/.test(event.target.tagName || '')) reportError('broken_asset', { asset_url: safeUrl(event.target.src || event.target.href || ''), asset_type: event.target.tagName });
    else reportError('javascript_error', { error_message: text(event.message, 300), file: safeUrl(event.filename || ''), line: event.lineno || null });
  }, true);
  window.addEventListener('unhandledrejection', function (event) { reportError('unhandled_promise', { error_message: text(event.reason && event.reason.message || 'Unhandled async operation', 300) }); });
  document.addEventListener('visibilitychange', function () { heartbeat(document.hidden ? 'hidden' : 'visible'); if (document.hidden) flush(); });
  window.addEventListener('pagehide', function () { heartbeat('pagehide'); if (config && config.started && !config.completed) track('configurator_abandoned', { last_completed_step: config.last_step, abandonment_signal: 'pagehide', provisional: true }); flush(); });
  ['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method]; if (!original) return;
    history[method] = function () { var result = original.apply(this, arguments); try { if (enabled && safeUrl(location.href) !== pageUrl) pageView(); } catch (_) { /* Analytics cannot change native navigation results. */ } return result; };
  });
  window.addEventListener('popstate', function () { if (enabled && safeUrl(location.href) !== pageUrl) pageView(); });
  setInterval(function () { heartbeat('heartbeat'); }, 15000);
  function initialise() {
    try {
      if (window.SimworxCookieConsent && window.SimworxCookieConsent.getConsent) setConsent(window.SimworxCookieConsent.getConsent());
      else { var saved = savedConsent(); if (saved) setConsent(saved); }
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true }); else initialise();
})(window, document);
