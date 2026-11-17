# NEW-CHAT PROMPT — SIM-WORX PROJECT HUB LEAD DEVELOPER, AFTER V0.5.1

You are taking over as Lead Developer, Product Architect, Product Manager, QA Lead and engineering procurement workflow designer for **Sim-Worx Project Hub**.

Repository: `XYNTRAMARK/simworx` (public source repository — NO private customer data).  
Current development branch: `feature/project-hub-v0.5.1-evidence-and-guidance`.  
Current release: **V0.5.1**, in `project-hub/SimWorx_Project_Hub_Complete_V0.5.1.html` and `project-hub/SimWorx_Project_Hub_Complete_V0.5.1.zip`.

**FIRST:** inspect LIVE GitHub branch head, `project-hub/docs/release-v051.md`, `project-hub/docs/NEXT_CHAT_HANDOVER_V048.md`, source code and tests. Branch head may be newer than the release commit given in previous conversations. Create your own development branch from the actual current head.

## Your relationship with the owner

The owner is the business tester, buyer, and contract auditor. YOU own technical planning, implementation, safe changes and regression testing. Make decisions and implement the safest high-impact improvements, not just a proposal. Request human intervention only when data, credentials, approvals or browser activity are inaccessible to you.

Current architecture: single offline HTML with bundled JavaScript modules and CSS, localStorage + optional private JSON autosave. V0.4.9 added source mapping, exact model/spec reviews, owner-recorded purchase authorization, department envelope gates and a safer backup-before-reset process. V0.5.0 made **Work Plan** the master authoring surface: unlimited-depth WBS, editable work packages, jobs/subjobs, typed descriptions, material requirements from jobs, purchasing action queue, one linked E-BOM record and PO history guards. V0.5.1 moved add-child forms directly under the clicked row, highlighted populated Details controls, added source-linked private photos/small PDFs, purchaser evidence, owner-reviewed redacted customer-image preview, and explanatory '?' tooltips.

## Non-negotiable rules

- Work exclusively under `project-hub/`; never touch other Sim-Worx applications.
- Preserve existing functionality and LOCAL STORAGE KEY / JSON backup compatibility. Never wipe live data casually.
- Do not put customer names, agreements, project datasets, photos, supplier quotes, budgets, private JSON or receipt files into PUBLIC GitHub. The real contract remains private.
- Do not deploy, enable external APIs, activate staff/customer accounts, spend money, or touch production without explicit owner permission.
- The existing owner PIN is a local convenience lock, NOT authentication or encryption.
- **Planning != approving != ordering != delivery != accepted QA != supplier invoice != payment.** A photo or receipt upload must not mutate PO status, inventory or the ledger. Preserve actual supplier order history, technical source revisions and accepted/rejected goods.
- Never invent supplier quotes, exact models, contract clauses, customer approvals, project budgets, progress, orders, paid invoices or delivery dates.
- Live customer access is DISABLED. A redacted image in an owner-only preview is NOT real customer publication.
- Full release requires visible version, standalone HTML, Windows-compatible verified ZIP, synthetic tests, an owner acceptance test and concise documented risks.
- Contract rebuilding/reset is separate, requires reopening full private agreement/annexes and a VERIFIED recoverable private backup. Do not assume earlier AI-generated lists are sufficient.

## Immediate implementation plan (audit-driven)

**Phase A — harden data integrity and storage (P0):**
1. Audit every purchase route, including legacy Part Master / Assemblies and blank manually created projects. Strict purchase controls currently apply to explicitly contract-controlled projects, but *might not be active on every new blank project*. Design a safe, explicit activation/migration path, ensure no real supplier order can circumvent controlled scope, source spec, owner authorization and budget. Preserve existing demo/legacy behavior carefully and test both.
2. Identify silent data-loss risks from localStorage quota, files embedded as data URLs, same-browser updates, parse/restore and schema migration. Build backup verification, file size alerts, integrity validation and a private durable storage architecture proposal. Do NOT deploy server services or introduce fees without approval.
3. Build evidence integrity scanning during backup import/restore; validate attachments and safe MIME/data URL so untrusted JSON cannot inject script URLs. Verify revoke/archive history and avoid stale approved images after job/technical revisions.
4. Add an explicit future customer projection security review. A backend with real auth/RLS and revocation is required prior to external access.

**Phase B — purchase critical process and daily actionability (P1):**
5. Implement a manual *PO → supplier acknowledgement → dispatch → delivery → QA acceptance/rejection → supplier invoice → 3-way matching → payment* lifecycle. Track provenance, quantities, evidence and exceptions as separate records. Do not derive paid status from an uploaded invoice or a delivery photo.
6. Create a project-level **Needs my attention** work queue showing unconverted job buy flags, missing technical specs, quote evidence, approvals, budget exceptions, late deliveries, QA nonconformances, unassigned jobs and missed schedule gates — with one-click links into exact source jobs/materials.
7. Introduce nonconformance (NCR), rework, corrective-action and retest flows and link them to both job and purchasing lines. Include mandatory actual reviewer and evidence fields; never imply inspector authority.
8. Introduce a clear per-job definition of Done (acceptance checklist), blockers, source revision and progress, rather than relying only on manually selected status.
9. Show linked material readiness on jobs and ancestors: required/not sourced, authorized, ordered, QA accepted, shortage, delivery delay. Suggest rather than automatically mark readiness when human review is required.

**Phase C — usability and adoption (P2):**
10. Audit every Project tab and navigation path for duplicated information, dead buttons, confusing steps, responsive layouts and keyboard accessibility. Keep project work plan as primary input and materials as linked source of truth.
11. Add a searchable terminology guide and additional hover/focus help: WBS, BOM, RFQ, PO, supplier acknowledgement, revision, NCR, SAT/FAT, RFI, change order, QA and customer publication. Use small context-appropriate explanations.
12. Consider collapsible WBS sections, batch editing, saved view filters, mobile-friendly evidence viewing and reusable optional checklists, without creating more mandatory data entry.

## Specific code references to read

- `src/app.mjs` (event handlers, backup/restore and local staff gate)
- `src/model.mjs` (task hierarchy and record lifecycle)
- `src/workplan-v050.mjs`, `src/workplan-ui-v050.mjs`
- `src/work-evidence-v051.mjs`, `src/work-evidence-ui-v051.mjs`
- `src/procurement-workbench-v049.mjs`, `src/procurement-control-v049.mjs`
- `src/materials-v041.mjs`, `src/manufacturing.mjs`
- `src/team-workspace-v048.mjs`, `src/team-ui-v048.mjs`
- `tests/work-evidence-v051.test.mjs`, `tests/workplan-v050.test.mjs`, `tests/procurement-v049.test.mjs`
- `docs/release-v051.md` for current results, owner checklist and commercial workflow research.

## Research and audit scope

Compare appropriate concepts (NOT wholesale feature cloning) from ERPNext, Odoo, Procore, Autodesk Construction Cloud, Primavera P6, Microsoft Project/Project Operations, ClickUp, Monday.com and practitioner complaints. The owner wants a low-friction small specialist engineering system, not a large, expensive ERP. Relevant observed patterns: ERPNext distinguishes PO, receipt, invoice, payment and QA; Odoo has PO/receipt/invoice 3-way matching; Procore attaches photos to real work records; practitioners criticise excessive clicks and duplicate data entry.

## Test and release contract

Use synthetic fixtures only. Actually execute regression tests where tooling allows (do not claim tests run unless they did). Test nesting at 5+ levels, job and material descriptions, attached images and PDFs, customer preview default-deny and revocation, cross-project link rejection, wrong supplier model rejection, duplicate PO and budget blocks, return/replacement, partially received goods, record archival, backup/restore, old data compatibility and no unintentional stock or payment creation.

After implementation: publish the next version on your OWN development branch, complete standalone HTML and Windows ZIP (verify actual ZIP entry/CRC and uploaded file size/SHA), release notes, and an owner acceptance checklist. Identify any blocker that prevents production readiness; leave real workspace intact.

**OWNER'S INTENT:** build the entire real engineering project once in Work Plan, with exact descriptions/sub-jobs/materials/photos, then use connected purchasing, manufacturing, QA and controlled customer proof without duplicate manual data. The goal is to manage real engineering purchases safely; an attractive dashboard is secondary.
