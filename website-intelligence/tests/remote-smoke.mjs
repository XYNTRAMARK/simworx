// Optional read-only API contract check. Creates and revokes one temporary
// reports login session; does not create website events or change lead data.
import assert from 'node:assert/strict';

const endpoint = process.env.REPORTS_ENDPOINT || 'https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence';
const pin = process.env.SIMWORX_REPORTS_PIN || '260873';
async function request(body, token) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Reports-Session': token } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
  });
  return { status: response.status, data: await response.json() };
}
let token;
try {
  assert.equal((await request({ action: 'snapshot' })).status, 401);
  assert.equal((await request({ action: 'login', pin: 'invalid' })).status, 401);
  const login = await request({ action: 'login', pin });
  assert.equal(login.status, 200);
  assert.match(login.data.token, /^[a-f0-9]{64}$/);
  token = login.data.token;
  const snapshot = await request({ action: 'snapshot' }, token);
  assert.equal(snapshot.status, 200);
  for (const key of ['events', 'leads', 'configurations', 'visitors', 'sessions']) assert.ok(Array.isArray(snapshot.data[key]), key);
  assert.equal(snapshot.data.meta.demo, false);
  assert.equal((await request({ action: 'collect', events: [] })).status, 400);
  assert.equal((await request({ action: 'logout' }, token)).status, 200);
  assert.equal((await request({ action: 'snapshot' }, token)).status, 401);
  token = undefined;
  console.log('Remote API checks passed: PIN, private snapshot, validation, logout and revoked session. No analytics records created.');
} finally {
  if (token) await request({ action: 'logout' }, token).catch(() => {});
}
