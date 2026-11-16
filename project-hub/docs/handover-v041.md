# Sim-Worx Project Hub — V0.4.1 master handover

**Prepared:** 16 November 2026  
**Current branch:** \`feature/project-hub-v0.4.1-materials\`  
**V0.4.1 base branch/commit:** \`feature/project-hub-v0.4-integrated-delivery\` @ \`5b9aac3fdae2248f50858480d13ae16952695405\`. The previous V0.3 and V0.4 branches and \`main\` are retained unmodified.  
**Release type:** Complete interactive local single-browser HTML + reproducible source. Not deployed, not a safe live multi-user system.

## Absolute safety gates

- The public repo \`XYNTRAMARK/simworx\` contains a LIVE website, support portal, projector systems and ~188 GitHub workflows. Root \`PRODUCTION-SAFETY.md\` records a historic dangerous whole-site FTP overwrite. NO root or unrelated path writes.
- All development changes confined to **\`project-hub/\`** on a feature branch. No \`main\` merge, production deployment, secret, DNS, Stripe, marketing site, Supabase or app integrations. Verify active workflow triggers before any future push. Production rule outranks feature velocity.
- No additional costs. No purchased hosting/compute, SMTP, billed API, service or new database resource without resource-specific authorization.
- Demo data only; no actual confidential contracts, supplier proof, financials or customer documents in public GitHub.
- File attachments are browser-local data URLs; \`localStorage\` is neither secure storage nor a shared database. Customer preview projection isn't authentication. Real data requires approved isolated backend and RLS.

## What currently works — V0.4.1

Retains ALL V0.3/V0.4 screens and pathways:
- Project portfolio; customers; nested sections/jobs and spreadsheet Work Register; 16-week manual Gantt, predecessors, cycle checks and baselines; CSV; workshop/office queues; legacy project BOM/materials estimates; inventory/PO seed data; internal costing; customer publication preview/approvals/invites; activity, themes and visible version badge.
- Integrated V0.4 assemblies, part master versus multiple E-BOM occurrences, nested subassemblies, drawing revision release snapshots and engineering changes.

New:
- **Project Procurement tab** in each project. Add requirements by selecting assembly and reusable part; roll up assembly E-BOM; see free stock vs on-hand, reserved project/other project/legacy, issued, incoming, shortage and create order.
- **Shared warehouse inventory** with one stock source, stock movements, legacy reservations kept, allocations per project and original edit/archives.
- **Multi-line purchasing** with quantity/cost/assembly attribution, ETA and currency/tax assumption; partial receipts, returns and backorders, guarded against over-receipt/negative stock.
- **Order tracking and proof:** carrier, tracking number/AWB, HTTPS URL, ETA, delivery notes, plus max 4 local PDF/JPEG/PNG/WebP attachments per PO (max 800 KB each); nothing uploaded.
- **Reservation ledger:** allocate, release, issue and consume; on-hand decreases on receipt return/stock issue (and increases when physically received), not on mere purchasing. Consumption doesn't decrease on-hand a second time.
- **Settings workspace JSON backup/restore**, including attachments, with source validation and explicit replace confirmation.
- On new simulator project creation, template sections also create matching root assemblies. Original V0.3 BOM remains a separate historical register, labelled as such.

## Source map

- \`project-hub/src/app.mjs\`: complete original UI, V0.4.1 imports/nav/project tabs, data persistence and backup controls.
- \`project-hub/src/materials-v041.mjs\`: purchasing, reservation, receipts, returns, shipments, attachments, backup/restore domain functions.
- \`project-hub/src/materials-ui-v041.mjs\`: integrated project procurement, global purchasing, shared inventory interactive controls and order tracking UI.
- \`project-hub/materials-v041.css\`: responsive themed styles.
- \`project-hub/src/model.mjs\`: existing V0.3 domain; keep unmodified.
- \`project-hub/src/manufacturing.mjs\` and \`manufacturing-ui.mjs\`: V0.4 domain/revision workspace. Sub-workspace version updated to V0.4.1.
- \`project-hub/tests/materials-v041.test.mjs\`: new tests. \`tests/browser-materials-v041.py\`: browser smoke script for full source checkout.
- \`project-hub/index.html\` imports all three styles and app module. The standalone combined \`SimWorx_Project_Hub_Complete_V0.4.1.html\` runs offline via blob-module loader.
- \`project-hub/SimWorx_Project_Hub_Complete_V0.4.1.zip\` contains the complete combined HTML and source (not an isolated demo).

## What is verified vs remaining

Verified by reading and executing actual GitHub source:
- **45/45** V0.1–V0.4.1 domain test functions passed in an isolated JavaScript harness. This includes 22 V0.3 tests, 10 V0.4 manufacturing tests, 13 new V0.4.1 tests.
- **30/30** complete UI module/page/project-tab rendering checks in an emulated DOM.
- **10/10** integrated UI form/action sequences through the app: E-BOM requirement, reservation, PO with two lines, partial receipt, shipment tracking, proof/backup, client-data negative checks, Gantt continuity.
- Exact repo file diffs and branch safety to be confirmed after final artifact commit.

Not yet verified with physical browser:
- Literal \`node --test tests/*.test.mjs\` and Playwright Chromium tests in a full downloaded working tree; original browser smoke scripts may require real local HTTP origin.
- No actual networked server, real user identity, transaction concurrency, private document storage or production deployment.

## Owner role

Owner should download the entire V0.4.1 ZIP, extract, open the complete HTML in Chrome, and test project procurement → add requirement → stock availability → reserve → create PO → partial receipt → tracking and proof → workspace backup/restore. All operations modify local demonstration records in the current browser only. Files/downloaded backup stay private and aren't synchronised across browser/file origins.

## Product direction for V0.5

Add QA, inspection hold points, nonconformances and rework linked to assemblies and work orders; build an operational material/drawing/QA gate for production release; then controlled reviewed customer publication. True auth/RLS/private storage/backend is a gated later stage: cost, isolation, security design and explicit owner approval required before touching Supabase or live sites.

## Mandatory next-chat playbook

1. Read root \`PRODUCTION-SAFETY.md\`, \`project-hub/docs/safety-and-architecture.md\`, this file and V0.4.1 release notes.
2. Verify \`feature/project-hub-v0.4.1-materials\` HEAD and changed files; do not overwrite newer work.
3. Confirm workflow path filters and branch before writing; no changes outside \`project-hub/\` and no production actions.
4. Continue to implement real working features rather than mockups, run tests available, and always deliver the **complete** application ZIP (the previous isolated manufacturing preview caused owner to fear loss of earlier work).
5. Be transparent about what is browser-only simulation and what was actually verified; zero unapproved costs.