/* Simworx first-party configurator observations. No content, styles, controls,
 * original handlers, network methods, or configurator state are replaced. */
(function (window, document) {
  'use strict';
  var sdk = window.SimworxIntelligence;
  if (!sdk || window.SimworxIntelligenceConfiguratorInstalled) return;
  var script = document.currentScript;
  var settings = window.SimworxIntelligenceAdapterOptions || {};
  var path = window.location.pathname;
  var type = script && script.dataset.configurator || settings.configurator_type || (/projection-screen-configurator/i.test(path) ? 'projection' : /led-screen-configurator/i.test(path) ? 'led' : '');
  if (!/^(led|projection)$/.test(type)) return;
  window.SimworxIntelligenceConfiguratorInstalled = true;
  var context = sdk.getContext();
  var version = script && script.dataset.configuratorVersion || settings.configurator_version || context.configurator_version || (type === 'led' ? 'led-live-v1' : 'projection-' + ((path.match(/-v(\d+)\.html/i) || [])[1] ? 'v' + path.match(/-v(\d+)\.html/i)[1] : 'live-v1'));
  sdk.configure({ configurator_type: type, configurator_version: version });
  var completedFingerprint = '', lastReview = false, resultFingerprint = '', openedSession = '', currentConfigurationId = null;
  var inputTimers = {}, lastObservedStep = null;
  var changedValues = {}, acceptedRoom = false, acceptedScreen = false, pendingForm = null, lastMailtoCapture = '', observedSimulatorPosition = '', observedProjectorPositions = '';
  var own = Object.prototype.hasOwnProperty;
  function node(id) { return document.getElementById(id); }
  function text(id) { var element = node(id); return element ? String(element.textContent || '').trim() : ''; }
  function enabled() { try { return sdk.getContext().enabled === true; } catch (_) { return false; } }
  function observe(callback) { try { if (enabled()) callback(); } catch (_) { /* Tracking never interrupts the configurator. */ } }
  function clone(value) { try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; } }
  function pick(value, keys) { var output = {}; keys.forEach(function (key) { if (value && own.call(value, key) && value[key] !== undefined) output[key] = clone(value[key]); }); return output; }
  function input(id) { var element = node(id); return element && element.value != null ? String(element.value).trim() : ''; }
  function selectedLabel(element) { return element && element.selectedOptions && element.selectedOptions[0] ? String(element.selectedOptions[0].textContent || '').trim() : ''; }
  function snapshot() {
    try {
      if (typeof settings.snapshot === 'function') return settings.snapshot() || {};
      var api = type === 'projection' ? window.SimworxProjection : window.SimworxLED;
      return api && typeof api.snapshot === 'function' ? api.snapshot() || {} : {};
    } catch (_) { return {}; }
  }
  function proposalOptions() {
    if (type !== 'projection' || !node('v37-proposal-total')) return null;
    var result = { delivery_destination: input('v37-destination') || null, customer_type: input('v37-customer-type') || null };
    ['onsite','gantry','full-enclosure','custom-enclosure','warranty','crate'].forEach(function (key) { var element = node('v38-' + key); if (element) result[key.replace(/-/g, '_')] = element.checked === true; });
    return result;
  }
  function knownConfiguration(state) {
    var output = pick(state, ['geometry','diameter','horizontalFov','viewableHeight','overallHeight','screenBottom','screenClearance','upperCoverage','lowerCoverage','pixelPitch','hardware','spares','customSpares','warranty','installation','warpFile','warpSoftware','warpSupport','servicePlan','currency','application','showSimulator','simulatorType','simulatorWidth','simulatorDepth','simulatorHeight','simulatorX','simulatorY','simulatorZ','simulatorYaw','pilotEyes','enclosure','material','materialGain','projectorCount','supplyStatus','mountingKit','mountingStyle','placementMode','manualPlacement','manualLayout','layoutReady','layoutDirty']);
    if (state.room) output.room = pick(state.room, ['enabled','width','depth','height','screenFromLeft','screenFromFront']);
    if (Array.isArray(state.projectors)) output.projectors = state.projectors.map(function (projector) { return pick(projector, ['id','modelId','profileId','position','yaw','pitch','roll','throwRatio','lensShiftX','lensShiftY','resolution','lumens']); });
    var proposal = proposalOptions();
    if (proposal) output.commercial_options = proposal;
    return output;
  }
  function safeConfiguration(raw) {
    var output = { configuration: knownConfiguration(raw.configuration || {}), configurator_type: type, configurator_version: version };
    if (raw.dimensions) output.dimensions = pick(raw.dimensions, ['diameter','radius','area','arcLength','viewableHeight','overallHeight','screenBottom','upperAngle','lowerAngle','resolution','pixelWidth','pixelHeight','moduleLayout']);
    if (raw.pricing) output.pricing = pick(raw.pricing, ['total','currency','quoteOnly','priceBasis','status','knownSubtotal']);
    if (raw.quote) output.quote = pick(raw.quote, ['reference','date','total','knownSubtotal','currency','status','catalogueVersion','lineItems']);
    return output;
  }
  function modelProperties(state) {
    var element = node('led-simulatorType');
    var rawId = state.simulatorType || element && element.value || '';
    var label = selectedLabel(element);
    if (!(state.showSimulator === true || (state.showSimulator === undefined && node('led-showSimulator') && node('led-showSimulator').checked))) return { simulator_category: 'Not Selected', simulator_model: null, simulator_model_id: null };
    var option = element && element.selectedOptions && element.selectedOptions[0];
    var category = option && option.dataset && option.dataset.category || settings.modelCategories && settings.modelCategories[rawId];
    var hint = String(rawId + ' ' + label).toLowerCase();
    if (!category) category = /helicopter|rotor|h135|bell|robinson/.test(hint) ? 'Helicopter' : /fighter|f[\s/-]?(?:16|18|35)|eurofighter/.test(hint) ? 'Fighter' : /airliner|airbus|boeing|a3\d\d|737|777|787/.test(hint) ? 'Airliner' : /light.twin|general.aviation|piston|cessna|c172|da(?:40|42|62)/.test(hint) ? 'GA / Piston' : /business.jet|citation|gulfstream|learjet/.test(hint) ? 'Business Jet' : /racing|automotive|car/.test(hint) ? 'Racing / Automotive' : 'Other';
    var specific = label.match(/\(([^)]+)\)/);
    return { simulator_category: category, simulator_model: specific ? specific[1] : label || rawId, simulator_model_id: rawId, simulator_model_label: label || null };
  }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
  function displayedProposalValue() {
    var value = text('v37-proposal-total');
    // The reviewed V37 proposal formats amounts using en-GB Intl.NumberFormat.
    if (!value || /confirm|quotation|—/i.test(value)) return null;
    var match = value.match(/(?:€|£|US\$|\$|EUR\s*|GBP\s*|USD\s*)([\d,]+(?:\.\d+)?)/);
    return match ? Number(match[1].replace(/,/g, '')) : null;
  }
  function dimensions(raw) {
    raw = raw || snapshot();
    var state = raw.configuration || {}, pricing = raw.pricing || raw.quote || {};
    var proposal = type === 'projection' && node('v37-proposal-total');
    var unknownItems = proposal && /quoted\/POA items/i.test(text('v37-proposal-total'));
    var data = Object.assign({ configurator_type: type, configurator_version: version, screen_type: state.geometry || null, diameter: finite(state.diameter), screen_height: finite(state.viewableHeight), horizontal_fov: finite(state.horizontalFov), vertical_fov: finite(state.verticalFov), pixel_pitch: state.pixelPitch || null, currency: state.currency || pricing.currency || null, estimated_price: proposal ? displayedProposalValue() : finite(pricing.total), known_subtotal: finite(pricing.knownSubtotal), price_status: unknownItems ? 'partial_known_total_excludes_quoted_items' : pricing.status || (pricing.quoteOnly ? 'quotation_required' : 'unknown'), price_basis: proposal ? node('v38-onsite') ? 'displayed_known_total_excludes_delivery_and_unpriced_items' : 'displayed_proposal_before_delivery' : pricing.priceBasis || 'displayed_configurator_estimate' }, modelProperties(state));
    if (proposal) data.commercial_options = proposalOptions();
    if (state.room) data.room_dimensions = pick(state.room, ['width','depth','height']);
    if (state.room) data.dimensions_unit = 'm';
    else data.dimensions_unit = 'm'; // Reviewed LED state stores metres independently of its display unit.
    if (raw.dimensions) data.resolution = raw.dimensions.resolution || null;
    if (Array.isArray(state.projectors)) {
      data.projector_count = state.projectors.length;
      data.projector_models = state.projectors.map(function (p) { return p.modelId || p.profileId || null; });
      data.throw_ratio = state.projectors.length ? finite(state.projectors[0].throwRatio) : null;
    }
    data.mount_type = state.mountingStyle || state.placementMode || null;
    data.screen_enclosure = state.enclosure || null;
    return data;
  }
  function open() {
    if (!enabled()) return;
    var id = sdk.getContext().session_id || 'active';
    if (openedSession !== id) { openedSession = id; acceptedRoom = false; acceptedScreen = false; sdk.openConfigurator(type, version); }
  }
  function step(name, extra) { open(); sdk.step(name, Object.assign(dimensions(), extra || {})); }
  function validScreen(state) { return finite(state.diameter) > 0 && finite(state.horizontalFov) > 0 && finite(state.viewableHeight) > 0; }
  function fingerprint(raw) { var configuration = knownConfiguration(raw.configuration || {}); ['layoutReady','layoutDirty','manualPlacement','manualLayout'].forEach(function (key) { delete configuration[key]; }); return JSON.stringify(configuration); }
  function markEditing(raw) {
    if (completedFingerprint && completedFingerprint !== fingerprint(raw)) { sdk.newConfiguration(); completedFingerprint = ''; currentConfigurationId = null; }
  }
  function completed(raw, basis) {
    var state = raw.configuration || {};
    if (!validScreen(state)) return null;
    var key = fingerprint(raw);
    if (completedFingerprint === key) return currentConfigurationId;
    if (completedFingerprint) sdk.newConfiguration();
    step('screen_configuration_completed', { completion_basis: basis });
    if (type === 'projection') step('price_or_spec_viewed', { review_basis: basis });
    else step('price_viewed', { review_basis: basis });
    currentConfigurationId = sdk.completeConfiguration(safeConfiguration(raw), Object.assign(dimensions(raw), { completion_basis: basis }));
    completedFingerprint = key;
    return currentConfigurationId;
  }
  function currentStep(state) {
    var selected = document.querySelector('[data-guided-go][aria-current="step"]');
    return selected ? Number(selected.dataset.guidedGo) : Number(state.guidedStep || 1);
  }
  function checkProjectionState() {
    observe(function () {
      open();
      var raw = snapshot(), state = raw.configuration;
      if (type === 'projection') {
        var visibleStep = currentStep(state || {});
        if (lastObservedStep !== null && visibleStep !== lastObservedStep) {
          step('configurator_step_viewed', { step_number: visibleStep, previous_step: lastObservedStep, observation_source: 'visible_step_change' });
          if (visibleStep > lastObservedStep && visibleStep >= 2 && !acceptedRoom) { acceptedRoom = true; step('room_dimensions_entered', { validated_transition: true }); }
          if (visibleStep > lastObservedStep && visibleStep >= 3 && !acceptedScreen) { acceptedScreen = true; step('screen_configuration_completed', { validated_transition: true }); }
        }
        lastObservedStep = visibleStep;
      }
      if (!state || !validScreen(state)) return;
      var position = JSON.stringify([state.showSimulator,state.simulatorType,state.simulatorX,state.simulatorY,state.simulatorZ,state.simulatorYaw]);
      if (observedSimulatorPosition && observedSimulatorPosition !== position && state.showSimulator) { markEditing(raw); step('simulator_positioned', { observation_source: 'committed_configurator_state' }); }
      observedSimulatorPosition = position;
      if (type !== 'projection') return;
      var projectorPositions = JSON.stringify(state.projectors || []);
      if (observedProjectorPositions && observedProjectorPositions !== projectorPositions && (state.manualPlacement || state.manualLayout)) { markEditing(raw); step('projector_position_adjusted', { observation_source: 'committed_manual_layout' }); }
      observedProjectorPositions = projectorPositions;
      var ready = state.layoutReady === true && Array.isArray(state.projectors) && state.projectors.length > 0;
      var nextResult = ready ? JSON.stringify([state.projectors, state.layoutSummary && state.layoutSummary.metrics]) : '';
      if (nextResult && nextResult !== resultFingerprint) { resultFingerprint = nextResult; step('projector_spec_generated', { calculation_result: state.layoutDirty ? 'current_manual_layout' : 'calculated_layout' }); }
      var review = currentStep(state) === 4 && ready;
      if (review && (!lastReview || completedFingerprint !== fingerprint(raw))) completed(raw, 'observed_proposal_step');
      lastReview = review;
    });
  }
  var fields = [
    ['room_dimensions_entered', '[data-room],#projection-room-width,#projection-room-depth,#projection-room-height'],
    ['simulator_model_selected', '#led-simulatorType,[data-intelligence-field="simulator_model"]'],
    ['simulator_category_selected', '#led-showSimulator,[data-intelligence-field="simulator_category"]'],
    ['simulator_positioned', '[data-led-range^="simulator"],[data-led-number^="simulator"],[data-position],[data-aim]'],
    [type === 'projection' ? 'screen_geometry_selected' : 'screen_type_selected', '[name="projection-enclosure"],[name="led-geometry"],[name="led-shape"]'],
    ['screen_dimensions_changed', '[data-led-range="diameter"],[data-led-number="diameter"],[data-led-range="viewableHeight"],[data-led-number="viewableHeight"],[data-led-range="screenBottom"],[data-led-number="screenBottom"],[data-led-edge],[data-led-edge-range],#v34-height'],
    ['screen_fov_changed', '[data-led-range="horizontalFov"],[data-led-number="horizontalFov"],[data-led-range="upperCoverage"],[data-led-number="upperCoverage"],[data-led-range="lowerCoverage"],[data-led-number="lowerCoverage"],[data-intelligence-field="vertical_fov"]'],
    ['pixel_pitch_selected', '[name="led-pixelPitch"],[name="led-pitch"],[data-led-select="pixelPitch"],[data-led-choice="pixelPitch"],[data-led-option="pixelPitch"],[data-intelligence-field="pixel_pitch"]'],
    ['projector_type_selected', '#guided-model,#projection-channel-model,#guided-count,#guided-mode,#guided-band'],
    ['projector_position_adjusted', '#projection-throw,#v25-throw,#v25-x,#v25-y,#v25-z,#v25-yaw,#v25-pitch,#v25-roll'],
    ['mount_type_selected', '#projection-placement-mode,#projection-mounting-kit,#projection-mounting-style,#guided-mount-drop,#v34-lens-height,#v34-ceiling-drop,[name="projection-mount"]'],
    ['configuration_option_selected', '[data-led-select="hardware"],[data-led-select="spares"],[data-led-select="warranty"],[data-led-select="installation"],[data-led-select="warpSoftware"],#v38-onsite,#v38-gantry,#v38-full-enclosure,#v38-custom-enclosure,#v38-warranty,#v38-crate,#v37-destination,#v37-customer-type']
  ];
  function changed(event) {
    var element = event.target;
    if (!element || !element.matches || /email|password|tel|text|textarea|file/.test(String(element.type || ''))) return;
    var entry = fields.find(function (item) { try { return element.matches(item[1]); } catch (_) { return false; } });
    if (!entry) return;
    setTimeout(function () { observe(function () {
      var raw = snapshot();
      markEditing(raw);
      var value = JSON.stringify([entry[0], element.type === 'checkbox' ? element.checked : element.value, fingerprint(raw)]);
      if (changedValues[element.id || entry[0]] === value) return;
      changedValues[element.id || entry[0]] = value;
      step(entry[0], { control_id: element.id || entry[0], observation_source: raw.configuration ? 'committed_configurator_state' : 'observed_control_change' });
      if (type === 'led' && /^(screen_dimensions_changed|screen_fov_changed|pixel_pitch_selected)$/.test(entry[0])) step('screen_configuration_completed', { completion_basis: 'screen_control_changed', control_id: element.id || entry[0] });
      if (entry[0] === 'simulator_model_selected') step('simulator_category_selected', { category_source: 'selected_configurator_model' });
      checkProjectionState();
    }); }, 0);
  }
  document.addEventListener('change', changed, true);
  // Observe numeric input without replacing existing handlers or values.
  document.addEventListener('input', function (event) {
    var element = event.target;
    if (!element || !/^(range|number)$/.test(element.type || '')) return;
    var key = element.id || 'numeric';
    if (inputTimers[key]) clearTimeout(inputTimers[key]);
    inputTimers[key] = setTimeout(function () { delete inputTimers[key]; changed({ target: element }); }, 250);
  }, true);
  document.addEventListener('click', function (event) {
    var element = event.target && event.target.closest && event.target.closest('button,a');
    if (!element || !enabled()) return;
    observe(function () {
      if (type === 'projection' && (/^(guided-calculate|guided-recalculate|guided-budget-run|projection-suggest|v33-optimise)$/.test(element.id) || element.hasAttribute('data-guided-objective'))) step('projector_calculation_started', { control_id: element.id || 'guided_objective' });
      var transition = type === 'projection' && (element.id === 'guided-next' || element.hasAttribute('data-guided-go'));
      if (transition) {
        var previous = currentStep(snapshot().configuration || {});
        sdk.startConfigurator(type, version);
        setTimeout(function () { observe(function () {
          var raw = snapshot(), state = raw.configuration || {}, next = currentStep(state);
          if (next !== previous) { step('configurator_step_viewed', { step_number: next, previous_step: previous }); lastObservedStep = next; }
          if (next > previous && next >= 2 && !acceptedRoom) { acceptedRoom = true; step('room_dimensions_entered', { validated_transition: true }); }
          if (next > previous && next >= 3 && !acceptedScreen) { acceptedScreen = true; step('screen_configuration_completed', { validated_transition: true }); }
          checkProjectionState();
        }); }, 0);
      }
      var href = element.getAttribute('href');
      if (type === 'led' && /^#led-(controls|preview|review)$/.test(href || '')) step('configurator_step_viewed', { step_name: href.slice(5), observation_source: 'section_navigation' });
      if (type === 'led' && href === '#led-review' && !snapshot().configuration) step('price_viewed', { review_basis: 'review_section_selected' });
      var quoteAction = element.dataset && element.dataset.quoteAction;
      if (type === 'led' && (element.getAttribute('href') === '#led-review' || quoteAction)) {
        setTimeout(function () { observe(function () { var raw = snapshot(); if (raw.configuration) completed(raw, quoteAction ? 'quote_action_selected' : 'review_configuration_selected'); }); }, 0);
      }
      if (quoteAction || /^(projection-enquiry|v37-email-proposal)$/.test(element.id)) sdk.trackEvent('email_form_opened', dimensions());
      if (/^(v37-request-quote|projection-enquiry)$/.test(element.id)) sdk.trackEvent('enquiry_started', Object.assign(dimensions(), { delivery_method: 'mailto' }));
      if (element.id === 'v37-email-send') {
        var address = node('v37-email-address');
        var contact = { email: input('v37-email-address'), name: input('v37-email-name') };
        if (!address || !address.validity || !address.validity.valid || !contact.email) return;
        setTimeout(function () { observe(function () {
          if (!/Proposal downloaded\. Opening your email application/i.test(text('v37-email-status'))) return;
          var id = completed(snapshot(), 'proposal_email_prepared');
          var key = id + ':' + contact.email.toLowerCase();
          if (key === lastMailtoCapture) return;
          lastMailtoCapture = key;
          contact.configuration_id = id;
          sdk.identify(contact, Object.assign(dimensions(), { delivery_method: 'mailto', delivery_confirmed: false }));
          sdk.flush();
        }); }, 0);
      }
    });
  }, true);
  // Contact capture observes deliberate, valid submissions, never email typing.
  var contactRequests = {}, contactSequence = 0;
  function captureContact(action, contact, statusId, successPattern) {
    if (!enabled() || !contact || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email || '')) return;
    open();
    var requestId = type + '-' + Date.now() + '-' + (++contactSequence);
    var data = Object.assign(dimensions(), { contact_action: action, contact_request_id: requestId, outcome: 'requested' });
    sdk.identify(contact, data);
    sdk.trackEvent('configuration_copy_requested', data);
    if (statusId) contactRequests[requestId] = { contact: contact, data: data, statusId: statusId, success: successPattern, started: Date.now(), initial: text(statusId), seenProgress: false };
    sdk.flush();
  }
  function checkContactResults(event) {
    observe(function () {
      Object.keys(contactRequests).forEach(function (key) {
        var pending = contactRequests[key], result = text(pending.statusId);
        if (Date.now() - pending.started > 600000) { delete contactRequests[key]; return; }
        if (result !== pending.initial || (event && event.target && event.target.id === 'v48-email-form')) pending.seenProgress = true;
        if (!pending.seenProgress || !pending.success.test(result)) return;
        delete contactRequests[key];
        var data = Object.assign({}, pending.data, { outcome: 'confirmed', delivery_confirmed: true });
        if (pending.data.contact_action === 'email') sdk.configurationEmailed(Object.assign(data, { contact: pending.contact, delivery_method: 'projection_quote_submit_php' }));
        else sdk.trackEvent('configuration_downloaded', data);
        sdk.flush();
      });
    });
  }
  document.addEventListener('click', function (event) {
    var element = event.target && event.target.closest && event.target.closest('button');
    if (!element || element.id !== 'v65-save-confirm' || type !== 'projection') return;
    var email = node('v65-save-email');
    if (!email || !email.validity || !email.validity.valid) return;
    captureContact('download', { email: input('v65-save-email') }, 'v65-save-status', /^PDF saved\.$/);
  }, true);
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || !enabled()) return;
    if (type === 'projection' && form.id === 'v48-email-form') {
      var email = node('v37-email-address');
      if (!email || !email.validity || !email.validity.valid) return;
      captureContact('email', { email: input('v37-email-address'), name: input('v37-email-name') }, 'v37-email-status', /^Proposal .+ sent successfully to /);
    }
    if (type === 'led' && form.id === 'led-quote-form') {
      var email = node('led-email');
      if (!email || !email.validity || !email.validity.valid) return;
      var action = input('led-quote-action');
      captureContact(action === 'email' ? 'email' : action === 'contact' ? 'enquiry' : 'download', { email: input('led-email'), name: input('led-name'), company: input('led-company'), telephone: input('led-phone'), country: input('led-country') });
    }
  }, true);
  setInterval(checkContactResults, 1000);
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (type !== 'led' || !form || form.id !== 'led-quote-form' || !enabled()) return;
    observe(function () {
      var address = node('led-email');
      if (!address || !address.validity || !address.validity.valid || !input('led-email')) { pendingForm = null; return; }
      var newsletter = node('led-newsletter'), wording = newsletter && newsletter.closest && newsletter.closest('label');
      var contact = { email: input('led-email'), name: input('led-name'), company: input('led-company'), telephone: input('led-phone'), country: input('led-country') };
      if (newsletter && newsletter.checked && wording) { contact.marketing_consent = true; contact.consent_text_version = 'led-updates-v1'; contact.consent_text = String(wording.textContent || '').trim().slice(0, 500); }
      pendingForm = { action: input('led-quote-action'), contact: contact, timestamp: Date.now(), configuration_id: completed(snapshot(), 'valid_quote_form_submitted') };
    });
  }, true);
  document.addEventListener('simworx:submission-complete', function (event) {
    var form = event.target;
    if (type !== 'led' || !form || form.id !== 'led-quote-form' || !pendingForm) return;
    var pending = pendingForm; pendingForm = null;
    observe(function () {
      var dialog = node('led-quote-dialog'), result = text('led-action-result');
      if (!dialog || dialog.open !== false || Date.now() - pending.timestamp > 600000) return;
      var expected = pending.action === 'email' ? /^Quote .+ has been sent to / : pending.action === 'contact' ? /^Simworx has received quote .+ and your contact request\.$/ : /^Quote .+ is ready to print\.$/;
      if (!expected.test(result)) return;
      var data = Object.assign(dimensions(), { configuration_id: pending.configuration_id, contact: pending.contact, delivery_confirmed: true, delivery_method: 'led_quote_submit_php', quote_action: pending.action });
      if (pending.action === 'email') sdk.configurationEmailed(data);
      else if (pending.action === 'contact') sdk.enquirySubmitted(data);
      else sdk.identify(Object.assign(pending.contact, { configuration_id: pending.configuration_id }), data);
      sdk.flush();
    });
  }, true);
  document.addEventListener('simworx:submission-complete', checkContactResults, true);
  window.addEventListener('simworx:intelligence-ready', open);
  window.addEventListener('simworx:intelligence-consent', function (event) { if (!event.detail || !event.detail.analytics) { openedSession = ''; completedFingerprint = ''; pendingForm = null; lastMailtoCapture = ''; acceptedRoom = false; acceptedScreen = false; } });
  window.addEventListener('simworx:configuration-emailed', function (event) { observe(function () { sdk.configurationEmailed(Object.assign(dimensions(), event.detail || {})); }); });
  window.addEventListener('simworx:enquiry-submitted', function (event) { observe(function () { sdk.enquirySubmitted(Object.assign(dimensions(), event.detail || {})); }); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', open, { once: true }); else open();
  setInterval(checkProjectionState, 2000);
})(window, document);
