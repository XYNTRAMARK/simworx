# Quality review

The reporting subsystem was reviewed against the supplied Simworx build brief. The public website and configurator files were not edited during this review.

## Verification

- Pure report calculations: calendar periods including the Europe/Paris daylight-saving change; event de-duplication; ordered session funnels; scoped filters; returning visitors; configuration date boundaries; page revisit engagement; separate currencies; inactivity-based abandonment; configurable scoring; and synthetic-data classification.
- Independent integration contracts: one normalized lead across multiple browser identifiers, strict newsletter opt-in, paid versus referral OpenAI traffic, and formula-safe CSV fields with leading whitespace.
- SDK simulations: no tracking storage or collection before analytics consent, consent withdrawal, shared visitor/session state between tabs, inactivity expiration, retry event identity, private-page exclusion, first/latest attribution, contact redaction, stable configuration IDs, bounded queues, and no invented email/enquiry success from button clicks.
- API simulations: public collection versus protected reads, simple PIN login and expiring token hash, bounded snapshot disclosure, validated lead changes/settings, and logout revocation.
- `backend-transaction.sql` exercises the actual database collector inside a rolled-back transaction, including idempotency, normalized leads, linking earlier anonymous configurations, attribution, consent changes, PII redaction, public-role grants, and cross-session ownership constraints. The parent task records the remote execution result.

Run local suites with:

```sh
node --test tests/*.test.mjs integration/tests/*.test.mjs
```

## Findings repaired during review

Screen setup no longer counts as final configuration completion. Configuration rows obey the selected date range. Conversion pairs require chronological progression within one session. Repeated views of the same URL use their own engagement intervals. Unified leads are not counted twice merely because two browsers supplied the same email. Unpaid OpenAI referrals remain separate from OpenAI advertising. CSV exports neutralize leading whitespace before formula characters. Collector ownership checks constrain updates to the correct visitor/session.

## Practical limits

The SDK and configurator adapters are staged integration files. Loading them into the public site and wiring successful email/enquiry responses require a separate live-site change. No historical activity is invented or backfilled. Demonstration records are fictional and isolated from the live database.

Snapshots currently load at most 25,000 recent events and 10,000 rows per supporting entity. The API declares truncation and the interface shows a warning; totals, historical comparisons, and distinct-visitor classification can be incomplete when that limit is reached. Configurator controls that are absent from the available repository need validation against the deployed configurator before activation.

Local API tests mock the Supabase HTTP layer. Browser rendering and deployed API/database checks are tracked by the parent task and must not be inferred from the local test result. Optional alert settings do not configure an external notification service.
