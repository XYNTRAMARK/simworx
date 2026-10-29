/* SIMWORX first-party intelligence loader. No rendered elements or UI changes. */
(function (window, document) {
  'use strict';
  if (window.__simworxIntelligenceBootstrapped || /^\/(reports|admin|portal)(\/|$)/i.test(location.pathname)) return;
  window.__simworxIntelligenceBootstrapped = true;
  var owner = document.currentScript;
  var data = owner && owner.dataset || {};
  var type = data.configurator || '';
  var pathname = location.pathname.toLowerCase();
  if (!type && /(?:led[^/]*configurator|configurator[^/]*led)/.test(pathname)) type = 'led';
  if (!type && /(?:projection[^/]*configurator|configurator[^/]*projection)/.test(pathname)) type = 'projection';
  var projectionVersion = pathname.match(/projection[^/]*-v(\d+)/);
  var version = data.configuratorVersion || (type === 'led' ? 'led-live-v1' : type === 'projection' ? 'projection-' + (projectionVersion ? 'v' + projectionVersion[1] : 'live-v1') : '');
  var base = owner && owner.src || location.origin + '/assets/js/simworx-intelligence-bootstrap-v2.js';

  function load(filename, attributes, done) {
    try {
      var script = document.createElement('script');
      script.src = new URL(filename, base).href;
      script.async = false;
      script.defer = true;
      if (owner && owner.nonce) script.nonce = owner.nonce;
      Object.keys(attributes || {}).forEach(function (key) { if (attributes[key]) script.dataset[key] = attributes[key]; });
      if (done) script.onload = function () { try { done(); } catch (_) {} };
      script.onerror = function () { /* Analytics loading must not change the website. */ };
      (document.head || document.documentElement).appendChild(script);
    } catch (_) { /* Analytics failure never prevents the existing page operating. */ }
  }

  function addObservers() {
    var sdk = window.SimworxIntelligence;
    if (!sdk) return;
    if (type === 'led' || type === 'projection') {
      try { sdk.configure({ configurator_type: type, configurator_version: version }); } catch (_) {}
      load('simworx-intelligence-configurator-v2.js', { configurator: type, configuratorVersion: version });
    }
    if (document.getElementById('contact-form')) load('simworx-intelligence-contact-v2.js');
  }

  if (window.SimworxIntelligence) addObservers();
  else load('simworx-intelligence-tracker-v2.js', {
    endpoint: data.endpoint || 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence',
    configurator: type, configuratorVersion: version
  }, addObservers);
})(window, document);
