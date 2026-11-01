import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, sourceFromUTM, toCSV } from '../reports/analytics.js';

const now = new Date('2026-10-25T12:00:00Z');
const event = (id, visitor, session, name, minute, properties = {}) => ({
  event_id: id, visitor_id: visitor, session_id: session,
  event_name: name, page_url: '/led-screen-configurator.html',
  timestamp: new Date(Date.parse('2026-10-24T10:00:00Z') + minute * 60000).toISOString(),
  properties: { source: 'LinkedIn', campaign: 'LINKEDIN-LED-01',
    configurator_type: 'led', simulator_category: 'Airliner', ...properties },
});

test('one normalized lead remains one captured email and high-intent lead across two browser IDs', () => {
  const events = ['a', 'b'].flatMap((suffix, index) => {
    const visitor = `visitor_${suffix}`, session = `session_${suffix}`;
    return ['page_view', 'led_configurator_opened', 'led_configurator_started',
      'configuration_completed', 'email_entered', 'configuration_emailed', 'enquiry_submitted']
      .map((name, minute) => event(`${suffix}_${minute}`, visitor, session, name,
        index * 30 + minute, { configuration_id: `CFG-${suffix}` }));
  });
  // The collector removes contact details from generic events. Linkage is supplied
  // exclusively through the normalized lead record, as in the real API snapshot.
  const leads = [{ id: 'lead_one', email: 'one@example.test',
    visitor_ids: ['visitor_a', 'visitor_b'], marketing_consent: true }];
  const report = buildReport({ events, leads }, { preset: 'Last 7 Days' }, now);
  assert.equal(report.metrics.visitors, 2);
  assert.equal(report.metrics.sessions, 2);
  assert.equal(report.leads.length, 1);
  assert.equal(report.metrics.leads, 1);
  assert.equal(report.metrics.highIntent, 1);
  assert.equal(report.metrics.subscribers, 1);
  assert.equal(report.subscribers.length, 1);
});

test('configuration email without marketing opt-in stays out of subscriber reports', () => {
  const events = [event('capture', 'v1', 's1', 'email_entered', 0),
    event('sent', 'v1', 's1', 'configuration_emailed', 1)];
  for (const consent of [false, undefined, 'false', 'true', 1]) {
    const report = buildReport({ events, leads: [{ id: 'l1',
      visitor_ids: ['v1'], marketing_consent: consent }] }, { preset: 'Last 7 Days' }, now);
    assert.equal(report.metrics.leads, 1);
    assert.equal(report.subscribers.length, 0);
    assert.equal(report.metrics.subscribers, 0);
  }
});

test('OpenAI paid campaigns and unpaid referrals are separate traffic sources', () => {
  assert.equal(sourceFromUTM('openai', 'cpc'), 'OpenAI Ads');
  assert.equal(sourceFromUTM('chatgpt', 'paid'), 'OpenAI Ads');
  assert.equal(sourceFromUTM('openai', 'referral'), 'Referral');
  assert.equal(sourceFromUTM('chatgpt', 'referral'), 'Referral');
});

test('CSV notes cannot introduce a formula after leading whitespace', () => {
  for (const note of ['=SUM(A1:A2)', '  =SUM(A1:A2)', '\n=SUM(A1:A2)', '\t+123']) {
    const csv = toCSV([{ notes: note }], ['notes']);
    const firstDataCell = csv.slice(csv.indexOf('\r\n') + 2);
    assert.ok(firstDataCell.startsWith('"\''), `Unsafe spreadsheet cell ${JSON.stringify(note)}`);
  }
});
