# Sim-Worx Project Hub — V0.4.0

**12 November 2026 · Local interactive demo — NOT production.** The header badge displays **V0.4.0**. Demo data is fictional. Incremental cost: **€0**. No production deployment, database, workflows or unrelated project modified.

## Run and explore

Download the branch source, serve `project-hub/` locally using `python3 -m http.server 8765`, and open `http://localhost:8765`. The standalone manufacturing acceptance preview is supplied separately; it deliberately does **not** contain the full V0.3 application.

## New in V0.4.0

- **Assembly & component workspace:** nest project-specific assemblies to arbitrary practical depth; add/edit/archive/restore; stable reusable part masters and **multiple occurrence BOM rows** with positions/quantities/make-buy.
- **Idempotent V0.3 migration:** existing work sections and V0.3 BOM records are imported into distinct V0.4 E-BOM entities without deleting or rewriting the historic V0.3 data. The existing spreadsheet Work Register, Gantt and CSV remain in the original application.
- **Drawing release states:** draft, in-review, released, superseded and withdrawn. Release freezes a separate M-BOM snapshot. A new revision has no inherited approval; downstream job links can warn about superseded instructions.
- **Production blockers:** link existing office/workshop jobs to an assembly and work-instruction revision; surface material gaps and unreleased drawings in the assembly view and project overview.
- **Engineering change records:** capture reason, owner and impact. Internal-only local demo; customer projection allowlist remains unmodified.

## Test scope

`node --test tests/manufacturing-v04.test.mjs` passed **10/10** in the isolated local manufacturing harness. Playwright in-memory browser smoke passed navigation, BOM editing, simulated drawing review/release and job linkage, with zero page errors. The previous V0.3 repository test suite **could not be rerun here** because the connected repository's complete working tree was not available locally; run `node --test tests/*.test.mjs` in a checkout before treating this as a verified integrated release.

## Boundaries

- All V0.3 storage remains under the same `simworx-project-hub-demo-v1` localStorage key; browser profiles are not shared or backed up.
- Legacy V0.3 BOM and the imported V0.4 E-BOM are separate demo registers; later legacy edits are not automatically synchronized. Do not use the project BOM readiness estimate for real purchasing.
- This version does **not** implement real multi-line PO receipts, atomic stock reservations, tenant-safe authentication, file uploads, QA holds or production customer access. No real financial, private customer, supplier or personnel information belongs in a public repository or local demo.
- Follow [release notes](docs/release-v04.md), [roadmap](docs/roadmap.md), [handover](docs/handover-v04.md) and [safety rules](docs/safety-and-architecture.md).
