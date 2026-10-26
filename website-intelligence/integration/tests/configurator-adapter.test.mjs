import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const adapterSource = await readFile(new URL('../configurator-adapter.js', import.meta.url), 'utf8');

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    this.listeners.set(type, [...(this.listeners.get(type) || []), callback]);
  }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    for (const callback of this.listeners.get(event.type) || []) callback(event);
  }
}

function control(id, { value = '', type = 'select-one', category, text = value, dataset = {}, attributes = [] } = {}) {
  return {
    id, value, type, dataset, checked: false,
    selectedOptions: [{ textContent: text, dataset: category ? { category } : {}, parentElement: null }],
    hasAttribute: attribute => attributes.includes(attribute),
    closest() { return this; },
    matches(selector) {
      if (selector.includes(`#${id}`)) return true;
      if (dataset.room && selector.includes('[data-room]')) return true;
      return false;
    },
  };
}

function setup({ enabled = true, initial = {}, quote = { status: 'complete', total: 25000, knownSubtotal: 25000 } } = {}) {
  const window = new Target();
  const document = new Target();
  const timers = [], intervals = [], calls = [];
  let active = enabled;
  let configurationId = null;
  let configNumber = 0;
  const state = {
    guidedStep: 1, layoutReady: false, layoutDirty: true,
    room: { width: 7, depth: 6, height: 4 }, simulatorType: 'b737',
    geometry: 'curved', diameter: 5, horizontalFov: 180, viewableHeight: 2.4,
    projectors: [{ modelId: 'benq-lh600st', throwRatio: 0.72, position: [0, 3, 1] }],
    currency: 'EUR', placementMode: 'mounted', ...initial,
  };
  const model = control('led-simulatorType', { value: 'b737', text: 'Boeing 737' });
  const room = control('projection-room-width', { value: '7', type: 'number', dataset: { room: 'width' } });
  const elements = { model, room };
  document.currentScript = { dataset: { configurator: 'projection', configuratorVersion: 'projection_source_v1' } };
  document.readyState = 'complete';
  document.querySelector = selector => {
    if (selector.includes('#led-simulatorType')) return model;
    if (selector === '#projection-room-width') return room;
    return null;
  };
  const record = (method, ...args) => { if (active) calls.push({ method, args }); };
  const sdk = {
    configure: settings => calls.push({ method: 'configure', args: [settings] }),
    getContext: () => ({ enabled: active, configuration_id: configurationId }),
    step: (...args) => record('step', ...args),
    trackEvent: (...args) => record('trackEvent', ...args),
    startConfigurator: (...args) => record('startConfigurator', ...args),
    openConfigurator: (...args) => record('openConfigurator', ...args),
    newConfiguration() { if (active) { configurationId = null; record('newConfiguration'); } },
    completeConfiguration(raw, props) {
      if (!active) return null;
      configurationId ||= `CFG-test-${++configNumber}`;
      record('completeConfiguration', raw, { ...props, configuration_id: configurationId });
      return configurationId;
    },
    configurationEmailed: (...args) => record('configurationEmailed', ...args),
    enquirySubmitted: (...args) => record('enquirySubmitted', ...args),
    identify: (...args) => record('identify', ...args),
    reportError: (...args) => record('reportError', ...args),
  };
  window.SimworxIntelligence = sdk;
  window.SimworxProjection = { snapshot: () => ({ configuration: structuredClone(state), quote: structuredClone(quote) }) };
  const context = vm.createContext({
    window, document, location: new URL('https://www.sim-worx.com/projection-screen-configurator-v28.html'),
    setTimeout: callback => { timers.push(callback); return timers.length; },
    setInterval: callback => { intervals.push(callback); return intervals.length; },
    console,
  });
  vm.runInContext(adapterSource, context, { filename: 'configurator-adapter.js' });
  return {
    window, document, sdk, state, quote, calls, elements,
    tick() { intervals.forEach(callback => callback()); },
    commit() { while (timers.length) timers.shift()(); },
    setEnabled(value) { active = value; window.dispatchEvent({ type: value ? 'simworx:intelligence-ready' : 'simworx:intelligence-consent', detail: { analytics: value } }); },
    custom(type, detail) { window.dispatchEvent({ type, detail }); },
    events: method => calls.filter(call => call.method === method),
  };
}

test('does not complete invalid or dirty projection review state', () => {
  for (const initial of [
    { guidedStep: 4, layoutReady: false, layoutDirty: false },
    { guidedStep: 4, layoutReady: true, layoutDirty: true },
    { guidedStep: 3, layoutReady: true, layoutDirty: false },
  ]) {
    const b = setup({ initial });
    b.tick(); b.tick();
    assert.equal(b.events('completeConfiguration').length, 0);
  }
});

test('completes valid review once and preserves completed raw configuration', () => {
  const b = setup({ initial: { guidedStep: 4, layoutReady: true, layoutDirty: false } });
  b.tick(); b.tick();
  b.state.guidedStep = 3; b.tick();
  b.state.guidedStep = 4; b.tick();
  const completions = b.events('completeConfiguration');
  assert.equal(completions.length, 1);
  assert.equal(completions[0].args[0].configuration.simulatorType, 'b737');
  assert.equal(completions[0].args[1].simulator_category, 'Airliner');
  assert.equal(completions[0].args[1].estimated_price, 25000);
  assert.equal(completions[0].args[1].configurator_version, 'projection_source_v1');
  assert.equal(b.events('step').filter(call => call.args[0] === 'projector_spec_generated').length, 1);
});

test('creates a new configuration after leaving review and completing a changed design', () => {
  const b = setup({ initial: { guidedStep: 4, layoutReady: true, layoutDirty: false } });
  b.state.guidedStep = 2; b.state.layoutDirty = true; b.tick();
  b.state.room.width = 9;
  b.state.guidedStep = 4; b.state.layoutDirty = false; b.tick();
  const completions = b.events('completeConfiguration');
  assert.equal(completions.length, 2);
  assert.equal(b.events('newConfiguration').length, 1);
  assert.notEqual(completions[0].args[1].configuration_id, completions[1].args[1].configuration_id);
});

test('clicking or submitting email and enquiry forms reports no successful conversion', () => {
  const b = setup();
  for (const id of ['projection-enquiry', 'led-email', 'led-enquiry']) {
    b.document.dispatchEvent({ type: 'click', target: control(id) });
  }
  b.document.dispatchEvent({ type: 'submit', target: control('projection-enquiry-form') });
  assert.equal(b.events('configurationEmailed').length, 0);
  assert.equal(b.events('enquirySubmitted').length, 0);
  assert.equal(b.events('identify').length, 0);
  assert.equal(b.events('trackEvent').filter(call => call.args[0] === 'email_form_opened').length, 3);
});

test('explicit successful delivery and enquiry callbacks preserve configuration IDs', () => {
  const b = setup();
  b.custom('simworx:configuration-emailed', { configuration_id: 'CFG-server-100', contact: { email: 'owner@example.com', marketing_consent: false } });
  b.custom('simworx:enquiry-submitted', { configuration_id: 'CFG-server-100', enquiry_id: 'enquiry-100' });
  b.custom('simworx:lead-captured', { email: 'owner@example.com', marketing_consent: false });
  assert.equal(b.events('configurationEmailed')[0].args[0].configuration_id, 'CFG-server-100');
  assert.equal(b.events('configurationEmailed')[0].args[0].contact.marketing_consent, false);
  assert.equal(b.events('enquirySubmitted')[0].args[0].enquiry_id, 'enquiry-100');
  assert.equal(b.events('identify').length, 1);
});

test('reads model category and room state after the original application commits a change', () => {
  const b = setup();
  b.document.dispatchEvent({ type: 'change', target: b.elements.model });
  assert.equal(b.events('step').length, 0);
  b.state.simulatorType = 'f16';
  b.state.room.width = 9;
  b.elements.model.value = 'f16';
  b.elements.model.selectedOptions[0].textContent = 'F-16';
  b.commit();
  const model = b.events('step').find(call => call.args[0] === 'simulator_model_selected');
  assert.equal(model.args[1].simulator_model, 'f16');
  assert.equal(model.args[1].simulator_category, 'Fighter');
  assert.equal(model.args[1].room_dimensions.width, 9);
  assert.equal(model.args[1].simulator_model_label, 'F-16');
  assert.ok(b.events('step').some(call => call.args[0] === 'simulator_category_selected'));
  b.document.dispatchEvent({ type: 'change', target: b.elements.room }); b.commit();
  const room = b.events('step').find(call => call.args[0] === 'room_dimensions_entered');
  assert.equal(room.args[1].room_dimensions.width, 9);
});

test('ignores email typing and stops callback effects after analytics consent is revoked', () => {
  const b = setup();
  b.document.dispatchEvent({ type: 'change', target: control('projection-contact-email', { type: 'email', value: 'private@example.com' }) });
  b.commit();
  assert.equal(b.events('step').length, 0);
  b.setEnabled(false);
  const before = b.calls.length;
  b.state.guidedStep = 4; b.state.layoutReady = true; b.state.layoutDirty = false;
  b.tick();
  b.custom('simworx:configuration-emailed', { configuration_id: 'CFG-no-consent', email: 'private@example.com' });
  b.custom('simworx:enquiry-submitted', { configuration_id: 'CFG-no-consent' });
  b.custom('simworx:lead-captured', { email: 'private@example.com' });
  assert.equal(b.calls.length, before);
});
