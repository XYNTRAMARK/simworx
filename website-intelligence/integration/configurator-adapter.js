/* Optional staged adapter. Load after tracker.js on configurator pages only.
 * Exact projection selectors from repository projection/main.html and src/app.js.
 * LED success events require explicit application callbacks; no submit interception.
 */
(function (window, document) {
  'use strict';
  var script = document.currentScript, options = window.SimworxIntelligenceAdapterOptions || {};
  var type = script && script.dataset.configurator || options.configurator_type || (/projection/i.test(location.pathname) ? 'projection' : 'led');
  var version = script && script.dataset.configuratorVersion || options.configurator_version || 'source-unverified';
  var sdk = window.SimworxIntelligence;
  if (!sdk || !/^(led|projection)$/.test(type)) return;
  sdk.configure({ configurator_type: type, configurator_version: version });
  var completedFingerprint = '', observedResult = '', lastReview = false, opened = false;
  var defaults = {
    room: '[data-room],#projection-room-width,#projection-room-depth,#projection-room-height',
    category: '#led-simulatorCategory,[data-intelligence-field="simulator_category"]',
    model: '#led-simulatorType,[data-intelligence-field="simulator_model"]',
    position: '[data-led-range^="simulator"],[data-led-number^="simulator"]',
    geometry: '[name="projection-enclosure"],[name="led-shape"],[data-intelligence-field="screen_type"]',
    dimensions: '[data-led-range="diameter"],[data-led-number="diameter"],[data-led-range="viewableHeight"],[data-led-number="viewableHeight"],[data-led-range="screenBottom"],[data-led-number="screenBottom"]',
    fov: '[data-led-range="horizontalFov"],[data-led-number="horizontalFov"],[data-intelligence-field="vertical_fov"]',
    pitch: '[name="led-pitch"],[data-intelligence-field="pixel_pitch"]',
    projector: '#guided-model,#projection-channel-model,[data-intelligence-field="projector_type"]',
    projector_position: '[data-position],[data-aim],#projection-throw',
    mount: '#projection-placement-mode,#projection-mounting-kit,#guided-mount-drop,[data-intelligence-field="mount_type"]'
  };
  var selectors = Object.assign({}, defaults, options.selectors || {});
  function value(selector) {
    var element = document.querySelector(selector);
    if (!element) return null;
    if (element.type === 'checkbox') return !!element.checked;
    var raw = element.value;
    if (raw === '' || raw == null) return null;
    return element.type === 'number' || element.type === 'range' ? Number(raw) : String(raw).slice(0, 160);
  }
  function label(element) {
    return element && element.selectedOptions && element.selectedOptions[0] ? element.selectedOptions[0].textContent.trim() : element && element.value || null;
  }
  function categoryFor(model, element) {
    if (element && element.dataset.simulatorCategory) return element.dataset.simulatorCategory;
    var option = element && element.selectedOptions && element.selectedOptions[0];
    if (option && option.dataset.category) return option.dataset.category;
    if (option && option.parentElement && option.parentElement.tagName === 'OPTGROUP') return option.parentElement.label;
    if (options.modelCategories && options.modelCategories[model]) return options.modelCategories[model];
    // This mapping is an adapter convention; the report dimensions remain data-driven.
    if (/^(?:a3[0-9]{2}|b?7[0-9]{2}|boeing|airbus)/i.test(String(model || '').replace(/[ -]/g, ''))) return 'Airliner';
    if (/^(?:f16|f18|fa18|f35|eurofighter)/i.test(String(model || '').replace(/[\/-]/g, ''))) return 'Fighter';
    if (/^(?:da40|da42|da62|c172|cessna)/i.test(String(model || '').replace(/[ -]/g, ''))) return 'General Aviation / Piston';
    return model ? 'Other' : 'Not Selected';
  }
  function snapshot() {
    try {
      if (typeof options.snapshot === 'function') return options.snapshot() || {};
      if (type === 'projection' && window.SimworxProjection && typeof window.SimworxProjection.snapshot === 'function') return window.SimworxProjection.snapshot();
    } catch (_) { sdk.reportError('configuration_snapshot_failure', { configurator_type: type }); }
    return {};
  }
  function dimensions() {
    var raw = snapshot(), state = raw.configuration || {}, quote = raw.quote || {};
    var modelElement = document.querySelector(selectors.model), model = state.simulatorType || modelElement && modelElement.value || null;
    var room = state.room || { width: value('#projection-room-width'), depth: value('#projection-room-depth'), height: value('#projection-room-height') };
    return {
      configurator_type: type, configurator_version: version,
      simulator_category: value(selectors.category) || categoryFor(model, modelElement), simulator_model: model,
      simulator_model_label: label(modelElement), room_dimensions: { width: room.width, depth: room.depth, height: room.height },
      dimensions_unit: state.room ? 'm' : value('#led-dimension-unit') || 'metric',
      screen_type: state.geometry || value('[name="led-shape"]:checked') || 'curved',
      screen_enclosure: state.enclosure || value('[name="projection-enclosure"]:checked'),
      diameter: state.diameter != null ? state.diameter : value('#led-diameter'),
      screen_height: state.viewableHeight != null ? state.viewableHeight : value('#led-viewableHeight'),
      horizontal_fov: state.horizontalFov != null ? state.horizontalFov : value('#led-horizontalFov'),
      vertical_fov: state.verticalFov != null ? state.verticalFov : value('[data-intelligence-field="vertical_fov"]'),
      pixel_pitch: state.pixelPitch || state.pitch || value('[name="led-pitch"]:checked') || value('[data-intelligence-field="pixel_pitch"]'),
      projector_count: state.projectors ? state.projectors.length : value('#projection-count'),
      projector_models: state.projectors ? state.projectors.map(function (projector) { return projector.modelId; }) : [],
      throw_ratio: state.projectors && state.projectors[0] ? state.projectors[0].throwRatio : value('#projection-throw'),
      mount_type: state.placementMode || value('#projection-placement-mode'), mounting_kit: state.mountingKit != null ? state.mountingKit : value('#projection-mounting-kit'),
      estimated_price: typeof quote.total === 'number' ? quote.total : null,
      known_subtotal: typeof quote.knownSubtotal === 'number' ? quote.knownSubtotal : null,
      currency: state.currency || value('#projection-currency') || 'EUR', price_status: quote.status || 'unknown'
    };
  }
  function safeMatch(element, selector) { try { return element.matches(selector); } catch (_) { return false; } }
  function emitStep(name, extra) { sdk.step(name, Object.assign(dimensions(), extra || {})); }
  function onChange(event) {
    var element = event.target;
    if (!element || !element.matches || element.type === 'file' || /email|password|tel/.test(element.type || '')) return;
    var names = { room: 'room_dimensions_entered', category: 'simulator_category_selected', model: 'simulator_model_selected', position: 'simulator_positioned',
      geometry: type === 'projection' ? 'screen_geometry_selected' : 'screen_type_selected', dimensions: 'screen_dimensions_changed', fov: 'screen_fov_changed', pitch: 'pixel_pitch_selected',
      projector: 'projector_type_selected', projector_position: 'projector_position_adjusted', mount: 'mount_type_selected' };
    var matched = Object.keys(names).find(function (key) { return safeMatch(element, selectors[key]); });
    if (!matched) return;
    // Read state after the existing application handler has committed it.
    setTimeout(function () {
      if (!sdk.getContext().enabled) return;
      emitStep(names[matched], { control_id: element.id || element.dataset.intelligenceField || matched });
      if (matched === 'model') emitStep('simulator_category_selected', { category_source: 'configurator_catalogue_or_adapter_map' });
    }, 0);
  }
  function checkProjectionState() {
    if (type !== 'projection' || !sdk.getContext().enabled) return;
    var raw = snapshot(), state = raw.configuration;
    if (!state) return;
    var resultKey = state.layoutReady && !state.layoutDirty ? JSON.stringify([state.projectors, state.layoutSummary && state.layoutSummary.metrics]) : '';
    if (resultKey && resultKey !== observedResult) { observedResult = resultKey; emitStep('projector_spec_generated', { calculation_result: 'layout_ready' }); }
    var review = state.guidedStep === 4 && state.layoutReady === true && state.layoutDirty === false;
    if (review && !lastReview) {
      emitStep('price_or_spec_viewed', { pricing_review: true });
      var fingerprint = JSON.stringify([state.room, state.geometry, state.diameter, state.horizontalFov, state.viewableHeight, state.simulatorType, state.projectors]);
      if (fingerprint !== completedFingerprint) {
        if (completedFingerprint) sdk.newConfiguration();
        sdk.completeConfiguration(raw, dimensions()); completedFingerprint = fingerprint;
      }
    }
    lastReview = review;
  }
  function init() {
    if (!sdk.getContext().enabled) return;
    if (!opened) { opened = true; sdk.openConfigurator(); }
    checkProjectionState();
  }
  document.addEventListener('change', onChange, true);
  document.addEventListener('click', function (event) {
    var element = event.target.closest && event.target.closest('button,a,[data-intelligence-event]'); if (!element || !sdk.getContext().enabled) return;
    // Buttons report intent only. Delivery and enquiry conversion are explicit callbacks below.
    if (/^(guided-calculate|guided-recalculate|guided-budget-run|projection-suggest)$/.test(element.id) || element.hasAttribute('data-guided-objective')) emitStep('projector_calculation_started', { objective: element.dataset.guidedObjective || 'current' });
    if (element.id === 'guided-next' || element.hasAttribute('data-guided-go')) {
      sdk.startConfigurator(type, version);
      setTimeout(function () {
        var state = snapshot().configuration || {};
        if (state.guidedStep >= 2) emitStep('room_dimensions_entered', { validated_transition: true });
        if (state.guidedStep >= 3) emitStep('screen_configuration_completed', { validated_transition: true });
        checkProjectionState();
      }, 0);
    }
    if (/^(projection-enquiry|led-email|led-enquiry)$/.test(element.id)) sdk.trackEvent('email_form_opened', dimensions());
    if (element.dataset.intelligenceEvent && !/email_entered|configuration_completed|configuration_emailed|enquiry_submitted|marketing_consent/.test(element.dataset.intelligenceEvent)) emitStep(element.dataset.intelligenceEvent, { control_id: element.id || 'declared' });
  }, true);
  // Existing app code dispatches these only after its corresponding successful result.
  window.addEventListener('simworx:configuration-completed', function (event) {
    var data = event.detail || {}; if (data.configurator_type && data.configurator_type !== type) return;
    sdk.completeConfiguration(data.configuration || snapshot(), Object.assign(dimensions(), data.properties || {}));
  });
  window.addEventListener('simworx:configuration-emailed', function (event) { sdk.configurationEmailed(Object.assign({}, dimensions(), event.detail || {})); });
  window.addEventListener('simworx:enquiry-submitted', function (event) { sdk.enquirySubmitted(Object.assign({}, dimensions(), event.detail || {})); });
  window.addEventListener('simworx:lead-captured', function (event) { sdk.identify(event.detail || {}, dimensions()); });
  window.addEventListener('simworx:configurator-step', function (event) {
    var data = event.detail || {}; if (data.event_name && (!data.configurator_type || data.configurator_type === type)) emitStep(data.event_name, data.properties || {});
  });
  window.addEventListener('simworx:configurator-error', function (event) { var data = event.detail || {}; sdk.reportError(data.error_type || 'configurator_error', Object.assign({}, dimensions(), data.properties || {})); });
  window.addEventListener('simworx:intelligence-ready', init);
  window.addEventListener('simworx:intelligence-consent', function (event) { if (!event.detail.analytics) { opened = false; completedFingerprint = ''; observedResult = ''; lastReview = false; } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  // Bounded, read-only state observation; no replacement of configurator functions.
  setInterval(checkProjectionState, 2000);
})(window, document);
