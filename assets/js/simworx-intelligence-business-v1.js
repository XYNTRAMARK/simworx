/* SIMWORX Website Intelligence business-event adapter v1.
   Adds non-visual, consent-aware product/configurator/software events through the existing SDK. */
(function (window, document) {
  'use strict';
  if (window.__simworxBusinessIntelligenceV1) return;
  window.__simworxBusinessIntelligenceV1 = true;

  var sdk = window.SimworxIntelligence;
  if (!sdk) return;

  var path = (location.pathname || '/').toLowerCase();
  var cockpitMap = {
    '/a320-full-cockpit.html': { simulator_category: 'Airliner', simulator_model: 'A320 Full Cockpit', product_variant: 'A320 Full Cockpit' },
    '/a320-single-seat.html': { simulator_category: 'Airliner', simulator_model: 'A320 Single Seat', product_variant: 'A320 Single Seat' },
    '/a320-supershort.html': { simulator_category: 'Airliner', simulator_model: 'A320 Supershort', product_variant: 'A320 Supershort' },
    '/f16-frames.html': { simulator_category: 'Fighter', simulator_model: 'F16 Frames', product_variant: 'F16 Frames' }
  };
  var cockpit = cockpitMap[path] || null;
  var cockpitVersion = 'cockpit-live-v1';
  var opened = false, started = false, modelSent = false;

  function cleanText(value, limit) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit || 160);
  }
  function targetPath(element) {
    try { return new URL(element.href || element.getAttribute('href') || '', location.href).pathname.toLowerCase(); } catch (_) { return ''; }
  }
  function productForPath(target) {
    return cockpitMap[target] || null;
  }
  function base(extra) {
    return Object.assign({
      product_family: 'cockpit',
      simulator_category: cockpit && cockpit.simulator_category || null,
      simulator_model: cockpit && cockpit.simulator_model || null,
      product_variant: cockpit && cockpit.product_variant || null
    }, extra || {});
  }
  function enabled() {
    try { return sdk.getContext().enabled === true; } catch (_) { return false; }
  }
  function openCockpit() {
    if (!cockpit || opened || !enabled()) return;
    sdk.configure({ configurator_type: 'cockpit', configurator_version: cockpitVersion });
    sdk.openConfigurator('cockpit', cockpitVersion);
    sdk.trackEvent('product_configurator_opened', base());
    opened = true;
    sdk.flush();
  }
  function ensureStarted() {
    if (!cockpit || !enabled()) return null;
    openCockpit();
    var id = sdk.startConfigurator('cockpit', cockpitVersion);
    if (!started) {
      sdk.trackEvent('product_configurator_started', base());
      started = true;
    }
    if (!modelSent) {
      sdk.step('simulator_model_selected', base());
      modelSent = true;
    }
    return id;
  }
  function selectedLabel(input) {
    if (!input) return '';
    var label = input.closest && input.closest('label');
    return cleanText(label ? label.textContent : input.value, 160);
  }
  function cockpitSnapshot() {
    var selections = {};
    ['mip-package','side-box','f16-package'].forEach(function (name) {
      var input = document.querySelector('input[name="' + name + '"]:checked');
      if (input) selections[name.replace(/-/g, '_')] = selectedLabel(input);
    });
    var region = document.getElementById('framecfg-region');
    var customer = document.querySelector('input[name="framecfg-customer-type"]:checked');
    return {
      product_family: 'cockpit',
      simulator_category: cockpit && cockpit.simulator_category || null,
      simulator_model: cockpit && cockpit.simulator_model || null,
      product_variant: cockpit && cockpit.product_variant || null,
      selections: selections,
      delivery_region: region ? cleanText(region.value, 80) : null,
      customer_type: customer ? cleanText(customer.value, 40) : null
    };
  }
  function softwareName(element) {
    var current = element;
    for (var i = 0; current && i < 7; i++, current = current.parentElement) {
      var heading = current.querySelector && current.querySelector('h3');
      var value = heading && cleanText(heading.textContent, 100);
      if (/^(QTG Pro|SimStarter Pro|GameBoost|Certification Pro)$/i.test(value || '')) return value;
    }
    var text = cleanText(element.textContent, 120);
    var href = targetPath(element);
    if (/simstarter/i.test(text + ' ' + href)) return 'SimStarter Pro';
    if (/certification/i.test(text + ' ' + href)) return 'Certification Pro';
    if (/gameboost|free trial/i.test(text)) return 'GameBoost';
    if (/qtg|demo/i.test(text)) return 'QTG Pro';
    return 'Software';
  }

  if (cockpit) {
    window.addEventListener('simworx:intelligence-ready', openCockpit);
    setTimeout(openCockpit, 0);

    document.addEventListener('change', function (event) {
      var input = event.target;
      if (!input || !enabled()) return;
      if (input.matches('input[name="mip-package"],input[name="side-box"],input[name="f16-package"]')) {
        ensureStarted();
        sdk.step('product_option_selected', base({
          option_name: cleanText(input.name, 80),
          option_value: cleanText(input.value, 80),
          option_label: selectedLabel(input)
        }));
        sdk.flush();
        return;
      }
      if (input.id === 'framecfg-region') {
        ensureStarted();
        sdk.step('product_delivery_selected', base({
          delivery_region: cleanText(input.value, 80),
          delivery_label: cleanText(input.selectedOptions && input.selectedOptions[0] && input.selectedOptions[0].textContent, 120)
        }));
        sdk.flush();
        return;
      }
      if (input.name === 'framecfg-customer-type') {
        ensureStarted();
        sdk.step('product_customer_type_selected', base({ customer_type: cleanText(input.value, 40) }));
        sdk.flush();
      }
    }, true);

    document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest && event.target.closest('button');
      if (!button || !enabled()) return;
      var map = {
        'framecfg-buy': 'product_purchase_started',
        'framecfg-quote': 'product_quote_started',
        'framecfg-more-info': 'product_more_info_started',
        'framecfg-ask-question': 'product_question_started'
      };
      var name = map[button.id];
      if (!name) return;
      ensureStarted();
      sdk.step(name, base({ cta: button.id }));
      if (name === 'product_quote_started' || name === 'product_purchase_started') {
        sdk.trackEvent('product_configuration_snapshot', base({ configuration: cockpitSnapshot(), intent: name }));
      }
      sdk.flush();
    }, true);

    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (!form || !enabled() || !/^(framecfg-buy-form|framecfg-sales-question-form)$/.test(form.id || '')) return;
      ensureStarted();
      var eventName = 'product_enquiry_started';
      sdk.step(eventName, base({ form_id: form.id, configuration: cockpitSnapshot() }));
      sdk.flush();
    }, true);
  }

  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest && event.target.closest('a[href]');
    if (!link || !enabled()) return;
    var target = targetPath(link);
    var product = productForPath(target);
    if (product) {
      sdk.trackEvent('product_configurator_selected', {
        product_family: 'cockpit',
        simulator_category: product.simulator_category,
        simulator_model: product.simulator_model,
        product_variant: product.product_variant,
        target_path: target,
        cta: cleanText(link.textContent, 120)
      });
      sdk.flush();
      return;
    }
    if (target === '/software.html' && path !== '/software.html') {
      sdk.trackEvent('software_section_clicked', { target_path: target, cta: cleanText(link.textContent, 120) });
      sdk.flush();
      return;
    }
    if (path === '/software.html' || /^(\/simstarter(?:-pro-software)?\.html|\/certification-pro\.html)$/.test(target)) {
      var productName = softwareName(link);
      if (path === '/software.html' || productName !== 'Software') {
        sdk.trackEvent('software_product_clicked', {
          software_product: productName,
          target_path: target || null,
          cta: cleanText(link.textContent, 120)
        });
        sdk.flush();
      }
    }
  }, true);
})(window, document);
