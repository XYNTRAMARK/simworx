/* Simworx contact tracking v1.0.0. Observes the existing successful submission
 * event; never replaces fetch, changes forms, or manufactures delivery success.
 */
(function (window, document) {
  'use strict';
  if (window.SimworxIntelligenceContactV1 || /^\/(reports|admin|portal)(\/|$)/i.test(location.pathname)) return;
  window.SimworxIntelligenceContactV1 = Object.freeze({ version: '1.0.0' });
  var pending = null, installed = false;
  function context() {
    try {
      var sdk = window.SimworxIntelligence;
      return sdk && typeof sdk.getContext === 'function' ? sdk.getContext() : null;
    } catch (_) { return null; }
  }
  function field(form, name, limit) {
    var element = form.elements && (typeof form.elements.namedItem === 'function' ? form.elements.namedItem(name) : form.elements[name]);
    return element && typeof element.value === 'string' ? element.value.trim().slice(0, limit || 200) : '';
  }
  function isValid(form) {
    // checkValidity()/reportValidity() dispatch UI events. Read validity only.
    return !Array.prototype.some.call(form.elements || [], function (element) {
      return !element.disabled && element.willValidate !== false && element.validity && element.validity.valid === false;
    });
  }
  function install() {
    if (installed) return;
    var form = document.getElementById('contact-form'), status = document.getElementById('contact-form-status');
    if (!form || !status) return;
    installed = true;
    var button = form.querySelector('.ct-submit');
    form.addEventListener('submit', function () {
      try {
        var current = context();
        if (!current || current.enabled !== true || !isValid(form) || pending && button && button.disabled) return;
        var email = field(form, 'email', 254).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
        var contact = { email: email };
        var name = field(form, 'name'), company = field(form, 'organisation') || field(form, 'company');
        var telephone = field(form, 'phone') || field(form, 'telephone'), country = field(form, 'country', 80);
        if (name) contact.name = name;
        if (company) contact.company = company;
        if (telephone) contact.telephone = telephone;
        if (country) contact.country = country;
        // This form has no newsletter opt-in. Omit consent rather than changing
        // an existing lead's marketing preference during an ordinary enquiry.
        var attempt = { contact: contact, visitor_id: current.visitor_id, properties: { form_id: 'contact-form', submission_endpoint: 'contact-submit.php' } };
        var interest = field(form, 'interest', 160);
        if (interest && interest !== "I'm interested in...") attempt.properties.product_interest = interest;
        pending = attempt;
        setTimeout(function () { if (pending === attempt) pending = null; }, 120000);
        var sdk = window.SimworxIntelligence;
        if (typeof sdk.trackEvent === 'function') sdk.trackEvent('enquiry_started', attempt.properties);
      } catch (_) { /* Optional analytics must never affect an existing submit. */ }
    }, { capture: true, passive: true });
    form.addEventListener('simworx:submission-complete', function (event) {
      try {
        if (event.target !== form || !pending) return;
        var attempt = pending;
        pending = null;
        var current = context();
        if (!current || current.enabled !== true || attempt.visitor_id && current.visitor_id !== attempt.visitor_id) return;
        if (!/(?:^|\s)success(?:\s|$)/.test(status.className || '')) return;
        var sdk = window.SimworxIntelligence;
        if (typeof sdk.enquirySubmitted === 'function') sdk.enquirySubmitted(Object.assign({}, attempt.properties, { contact: attempt.contact }));
      } catch (_) { /* Existing success/failure UI and delivery remain untouched. */ }
    }, { passive: true });
  }
  window.addEventListener('simworx:intelligence-consent', function (event) {
    if (!event.detail || event.detail.analytics !== true) pending = null;
  });
  window.addEventListener('simworx:consentchange', function (event) {
    if (!event.detail || event.detail.analytics !== true) pending = null;
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(window, document);
