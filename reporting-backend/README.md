# Simworx report snapshot memory repair — 16 November 2026

The deployed `simworx-intelligence` Edge Function version 7 assembled all reporting tables, including roughly 77 MB of event JSON, in memory before serializing the response. Supabase terminated that worker for memory exhaustion (HTTP 546). PIN login itself succeeded.

Version 8 changes only snapshot loading. Existing login, collection, arrival, lead-update, settings and logout handlers remain unchanged. Add `import { streamSnapshot } from './snapshot.mjs'` to the deployed index.ts and replace the old `if (body.action==='snapshot')` body with `return await streamSnapshot(db, CORS);`. Bundle this module alongside index.ts. Snapshot still requires the existing validated PIN session before that branch is reached.

The module reads compact ID/time manifests, then fetches full records in small batches and streams the same JSON shape to the existing frontend. Event order remains oldest-to-newest within the existing most-recent-record window. Other collections retain their previous order. Backpressure, cancellation and explicit incomplete-stream failure prevent unbounded buffering or silent partial reports. Query URLs are bounded as well as row batch sizes.

## Data preservation

No schema migration, cleanup, retention change, DELETE, TRUNCATE or UPDATE of analytics is part of this repair. The existing display limits (25,000 events; 10,000 rows for other collections) and truncation warning are unchanged; these are response limits, not data deletion. No website, tracker, login UI, frontend or Xyntra code was changed.

Before/after counts and full-content checksum comparisons matched for all ten reporting data/settings tables. Live session tests create and close only their own normal login session; historical analytics is untouched.

## Local test coverage

Seven tests passed: exact nine-collection payload and original ordering, empty collections, multi-page/long-ID reads, disclosed pre-existing response limits without deleting source rows, incomplete-read rejection, client cancellation, and an 82,093,903-byte synthetic report streamed in bounded chunks. The synthetic test's peak observed Node heap was 44,410,160 bytes; this is a local test measurement, not a production-memory measurement.

The temporary `simworx-reports-repair-check` endpoint exists only to verify live HTTP authentication and full-stream completion without publishing a PIN, token or customer records. It must be disabled after verification. The workflow on this branch performs no deployment and modifies no website files.
