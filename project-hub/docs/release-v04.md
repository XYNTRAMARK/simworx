# Sim-Worx Project Hub — V0.4.0 · Component & manufacturing control

**Date:** 12 November 2026. **Type:** single-browser simulated development release. **Production impact:** none. **Incremental costs:** €0.

### Implemented
- Assembly register with nested parent relationships, no circular links, repeatable part master occurrences and E-BOM rollup; cycle and project integrity validation.
- One-time, non-destructive V0.3 work-section/BOM import to separate assembly/BOM entities. No V0.3 storage key change.
- Local drawing revision workflow Draft → In review → Released, with preserved revision-specific M-BOM snapshots; superseded and withdrawn states, new revision never inherits release.
- Engineering change log, archive/restore, job-to-assembly/revision links and explicit material/drawing readiness warnings in assembly and project overview.
- Standalone manufacturing acceptance HTML and new tests; existing V0.3 pages unchanged in their code pathways except integration tabs/navigation.

### Verified tests
- `node --check src/manufacturing.mjs`, `node --check src/manufacturing-ui.mjs`: pass.
- `node --test tests/manufacturing-v04.test.mjs`: **10 pass / 0 fail** in local harness.
- Playwright in-memory markup smoke: **pass** for workspace navigation, repeated BOM add, drawing review/release, linked job and UI error monitoring. Both `file://` and localhost navigation were blocked by this test environment; this is **not** a full browser-origin regression.
- Original V0.3 `node --test tests/*.test.mjs` and V0.3 browser scripts were **not rerun** in this environment; integrated regression remains to be verified in a complete working checkout.

### Known gaps (do not represent as complete)
- Existing V0.3 legacy BOM still prevents duplicate part/project rows **in its own old tab**; new assembly BOM supports unlimited occurrences. Imported snapshot does not auto-sync later legacy BOM edits.
- Supplier purchase orders remain original one-line demo; no partial/multi-line receipts, returns, real stock reservation, physical location ledger, QA acceptance or actual MRP.
- Manufacturing ready/blocked is advisory only; it does not forcibly change existing task status or guarantee stock availability across projects.
- No actual file bytes, authenticated engineering signatures, private customer access, server-side auth, RLS, multi-user concurrency, email or deployment. Client preview allowlist remains unchanged, and is not a security boundary in localStorage.

### Files/safety
All modifications are exclusively under `project-hub/` on `feature/project-hub-v0.4-manufacturing`. No merge, workflow change, Supabase access, credential use or production deployment. Previous live-site FTP incident controls remain mandatory.
