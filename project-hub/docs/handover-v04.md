# Sim-Worx Project Hub — V0.4.0 handover / next iteration

Read `PRODUCTION-SAFETY.md` and `project-hub/docs/safety-and-architecture.md` first. **Never modify paths outside `project-hub/`**, never merge/deploy/use production services without specific approval, and keep marginal cost at €0. Public GitHub contains only fictitious demo data.

Base branch: `feature/project-hub-v0.4-manufacturing`; previous confirmed V0.3 base `37b36db62a2c34ac085b10d63316d8f440a70e05`. Current release: `V0.4.0` in top header.

Delivered: `src/manufacturing.mjs` immutable release snapshots and nested E-BOM/part occurrences; `src/manufacturing-ui.mjs` embedded in project assembly tab and own workspace; `manufacturing.css`; `tests/manufacturing-v04.test.mjs`. Existing V0.3 Work Register, Gantt, localStorage and customer projection are preserved. Release notes document exact limitations and unrun regression tests.

**Next recommended priority: V0.4.1 procurement and allocation simulation:** multi-line PO schema, per-line partial receipts, no overreceipts, backorders and audit entries; local single-browser reservation/issue ledger with nonnegative on-hand/available invariants; assembly-level shortage ETAs and job blockers. Before any new write, recheck HEAD and 188 workflow triggers. Build all models/tests locally first; include new user-facing control flows. Do not claim atomic multi-user inventory until server-side transactions are separately authorized.

Then complete QA holds and engineering-change impact propagation, strengthen migration reconciliation and run complete V0.3 regressions from a full checkout. When a backend is eventually proposed, present an isolated resource/quotas/costs threat model and get approval BEFORE any Supabase or hosting write.
