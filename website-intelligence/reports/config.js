// Public endpoint only. Admin access is protected by the PIN session on the server.
// No database key or service credential belongs in this file.
export const config = Object.freeze({
  endpoint: 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence',
  sessionKey: 'simworx_intelligence_session_v1',
  demoEditsKey: 'simworx_intelligence_demo_edits_v1',
  timezone: 'Europe/Paris',
  refreshInterval: 30000,
});
