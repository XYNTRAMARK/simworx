/* Examples only. Do not include this file as a production script.
 * Place the appropriate call inside the EXISTING successful handler.
 */

// A committed LED step, using actual current catalogue values:
function exampleCommittedSimulatorSelection(actualCategory, actualModel) {
  window.SimworxIntelligence.step('simulator_model_selected', {
    simulator_category: actualCategory,
    simulator_model: actualModel
  });
}

// A successful save/completion, retaining this ID with the application's payload:
function exampleConfigurationSaved(actualConfiguration, actualMetadata) {
  return window.SimworxIntelligence.completeConfiguration(actualConfiguration, actualMetadata);
}

// Call ONLY after the existing server returns a confirmed successful send result.
function exampleConfirmedConfigurationEmail(serverResult, voluntarilySubmittedContact, configurationId) {
  if (!serverResult || serverResult.ok !== true) return;
  window.SimworxIntelligence.configurationEmailed({
    configuration_id: configurationId,
    contact: voluntarilySubmittedContact,
    delivery_reference: serverResult.reference || null
  });
}

// Separate marketing checkbox; do not infer this from requesting a configuration.
function exampleMarketingChoice(email, checked) {
  window.SimworxIntelligence.marketingConsent(checked, {
    email: email,
    consent_text_version: 'SWX-NEWS-20261025-v1',
    consent_text: 'Send me occasional Simworx product news and updates'
  });
}

// The existing form's success response is the trigger, never its submit button.
function exampleConfirmedEnquiry(serverResult, voluntarilySubmittedContact, configurationId) {
  if (!serverResult || serverResult.ok !== true) return;
  window.SimworxIntelligence.enquirySubmitted({
    configuration_id: configurationId,
    contact: voluntarilySubmittedContact,
    enquiry_reference: serverResult.reference || null
  });
}
