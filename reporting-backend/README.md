# Simworx report snapshot memory repair — 16 November 2026

## Current deployment

`simworx-intelligence` version 9 is deployed. Its bundle hash is `d7b9fb5220f9edd2fa9b853424d386463a32297826e27a5851888613c0ed0b3a`. This branch's `snapshot.mjs` matches that deployed module. Browser acceptance is still pending; do not describe this as a fully verified end-to-end repair yet.

Version 7 assembled all reporting tables, including roughly 77 MB of event JSON, in memory before serializing the response. The worker was terminated for memory exhaustion (HTTP 546). PIN login itself succeeded.

The repair changes only snapshot loading. Existing login, collection, arrival, lead-update, settings and logout handlers remain unchanged. Add `import { streamSnapshot } from './snapshot.mjs'` to the existing deployed index.ts and replace the old snapshot branch body with `return await streamSnapshot(db, CORS);`. Bundle the module alongside index.ts. The existing validated PIN-session check remains before that branch.

The module reads compact ID/time manifests, fetches full records in bounded batches, and streams the original JSON shape. Version 9 fetches at most six bounded batches concurrently. Event and collection ordering, full record fields and existing response limits are preserved. Cancellation, backpressure, URL-size bounds and explicit incomplete-stream failure are included. No frontend, tracker, menu, login UI or Xyntra code was changed.

## Data preservation: verified

No schema migration, cleanup, retention change, DELETE, TRUNCATE or UPDATE of analytics is part of the repair. Existing response limits remain 25,000 events and 10,000 rows per other collection, with the original truncation warning; those limits do not delete stored records.

Full-content checksums matched before and after deployment for all ten reporting data/settings tables. The original 17,515 events, 2,844 arrivals, 9 leads, 16 configurations, 632 visitors, 758 sessions, 520 configurator sessions, 1,613 page views, 750 attribution rows and settings record were intact. A further arrival was recorded during testing; the checksum of the original 2,844 arrivals was separately rechecked and still matched.

## Tests and limitations

Seven local tests passed against version 9: exact nine-collection payload and original order; empty collections; paged long-ID datasets; disclosed response limits without deleting source rows; incomplete-read rejection; cancellation; and an 82,093,925-byte synthetic report. The latest synthetic run observed approximately 51 MB peak Node heap. This is a local measurement, not a production peak.

A live version 8 check authenticated normally, confirmed unauthenticated report requests return 401, and consumed the complete 78,403,300-byte response with all nine counts exact and no truncation. It took 119.428 seconds, which is too slow for the existing frontend timeout. Version 9 introduced bounded parallel fetching to address that latency.

The version 9 live check did not complete because the temporary diagnostic checker itself exhausted its CPU allowance while repeatedly decoding the response. Logs attributed the CPU shutdown to the diagnostic function, not the main reporting function. The main function's client connection consequently closed. Final version 9 response completion/timing and browser dashboard rendering have not been independently confirmed.

The temporary diagnostic `simworx-reports-repair-check` has now been disabled: version 2 requires JWT verification and performs no login, database or report operations. It returns HTTP 410. The workflow is retained as historical diagnostic evidence only; its endpoint is no longer active for verification. No PINs, session tokens or customer rows were committed to this repository.
