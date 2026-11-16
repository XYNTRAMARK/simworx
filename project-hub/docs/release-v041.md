# Sim-Worx Project Hub — V0.4.1 release notes

**Release:** V0.4.1 · 16 November 2026  
**Type:** full offline/local single-browser demonstration, not production  
**Branch:** \`feature/project-hub-v0.4.1-materials\`  
**Starting point:** V0.4.0 complete integrated delivery \`5b9aac3fdae2248f50858480d13ae16952695405\`  
**Production changes:** none · **Incremental costs:** €0 · **Protected:** all repository paths outside \`project-hub/\`, all existing GitHub workflows, deployments, secrets and backend resources.

## Built and integrated

1. **Project Procurement tab:** source and requirements linked directly to a project assembly. The tab adds editable E-BOM part occurrences, displays nested assembly roll-up, quantity required, reserved/issued stock, current available stock, other-project reservations, unassigned older reservations, incoming orders and quantity still needing sourcing.
2. **Shared workshop inventory:** internal global stock register displays on-hand, reserved, available, legacy/unattributed reservations and project allocations; keeps original stock-movement, part edit/archive and movement controls.
3. **Multi-line POs:** create orders with several lines and separate part/quantity/cost/assembly/ETA fields. Record partial deliveries line-by-line, backorders and supplier returns. Physical on-hand changes only when goods are received; over-receipt and negative availability are rejected.
4. **Material allocations:** reserve a part to a project/assembly, release remaining reservations, issue reserved goods to workshop and record consumption separately. Existing V0.3 aggregate reservations are preserved, not assigned to fictional projects.
5. **Order documents and tracking:** receipt/order-confirmation/proof attachments (up to four PDF/JPEG/PNG/WebP files, max 800 KB each), saved in the browser and included in JSON backups. Carrier, AWB/tracking code, HTTPS tracking link, ETA and delivery notes sit on the same PO.
6. **Full workspace backup/restore:** JSON export and validated import, confirmation before replacement and storage-failure guard. The exported JSON includes every demo record, including document bytes and internal illustrative financial fields.
7. **Preserved application:** dashboards, original Work Register, 16-week Gantt, manual dates, predecessors, baselines, projects, legacy BOM, documents, publication, customer preview, reports, financial pages, manufacturing E-BOM/M-BOM revisions and theme switching. V0.4.1 is visible in the main header.
8. **New project defaults:** creating a template-based new project automatically creates corresponding root assemblies, making the procurement tab usable immediately.

## Correctness and safety details

- The **assembly E-BOM is the source of requirements** for the new procurement tab. Historical V0.3 BOM is retained separately and labelled as such; changing an old BOM row does not silently edit a released M-BOM snapshot.
- A purchase order's outstanding quantity is never counted as on-hand stock. Availability is on-hand minus reservations across all projects and older reservations.
- Reservation/issue invariants are enforced for one browser only. This is not atomic multi-user inventory and must not be used for actual warehouse reconciliation.
- POs and reference costs are internal-only fields; customer projection is still an explicit allowlist, not a server-side security boundary. Customer preview does not receive supplier, tracking, attachment, quote or stock data.
- Proof files are base64 data in **localStorage**, subject to browser quota and browser-origin isolation; they are **not stored remotely**. Do not use this public repository or browser demo for actual confidential supplier/customer documentation.
- No version changes to any other project, no deployment, no secret access, no paid service, no Supabase or email configuration modifications.

## Verified in this development session

- Model / old releases: **45 out of 45** original V0.1–V0.4 and V0.4.1 model tests passed when executed as synchronous functions in an isolated JavaScript compatibility harness, including revision snapshots, Gantt, predecessor cycle safety, PO receipt/return reconciliation and client projection secrecy. This is **not** the literal Node CLI test command.
- App source: **30 out of 30** compile/render/route checks for the complete V0.4.1 app and all its old project tabs passed using an emulated DOM.
- Integrated flows: **10 out of 10** browser-interface action/form calls passed in a mocked DOM, including project requirements, reservation, multi-line PO, partial receipt, tracking, backup and client-publication negative check.
- The real Chromium browser tests and literal \`node --test tests/*.test.mjs\` have **not** been executed with a physical checkout in this session. Do not claim end-to-end production readiness.
- The committed standalone ZIP includes the entire combined application rather than only the new module. Extract the ZIP and open the included HTML in Chrome.

## Reproducible full checkout QA

From \`project-hub/\`:
\`\`\`bash
node --test tests/*.test.mjs
python3 -m http.server 8765
# in another terminal after server starts:
python3 tests/browser-smoke.py
python3 tests/browser-crud-v02.py
python3 tests/browser-planning-v03.py
python3 tests/browser-materials-v041.py
\`\`\`

Browser scripts need Playwright and Chromium. Do not use the public production website for acceptance testing.

## Deferred

- True simultaneous-user transactions, multi-warehouse accounting, warehouse bin ledger, lot/serial tracking, invoice reconciliation, tax accounting and refunds, business purchase-order email delivery.
- Secure private document storage, tenant RLS, permissions, verified engineering or client signatures, actual customer uploads/authentication, automatic notifications and real live integrations.
- A later BOM reconciliation UI for legacy V0.3 BOM and new assembly E-BOM without breaking revision snapshots.

## Recommended next release

**V0.5.0 — Quality, inspection and non-conformance:** QA plans, hold points, inspection evidence metadata, rework, assembly gates and controlled customer releases, while preserving all project and procurement links. Backend implementation remains approval-gated.