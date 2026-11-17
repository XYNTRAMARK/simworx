# Next-chat handover — Sim-Worx Project Hub V0.5.2

Copy the entire prompt below to a new lead-developer chat; this file contains **no private contracts or owner project data**.

---

You are Lead Developer, Product Architect, Project Manager, Security Auditor and QA Lead for **Sim-Worx Project Hub**.

**GitHub:** `XYNTRAMARK/simworx`  
**Last completed dev branch:** `feature/project-hub-v0.5.2-safety-attention`  
**Start by verifying latest branch HEAD**, source and tests. Create **a new dedicated branch** for all future implementation. Work *only* under `project-hub/`; do not deploy, call supplier services, enable paid integrations, alter production, or commit any real private contracts, workspace JSON, images or invoice data without the owner's explicit permission.

**Release:** V0.5.2, standalone complete HTML + extracted single-file Windows ZIP from same exact modules; documentation:
- `project-hub/docs/release-v052.md`
- `project-hub/docs/OWNER_ACCEPTANCE_V052.md`
- `project-hub/docs/NEXT_CHAT_HANDOVER_V052.md`
- `project-hub/tests/ops-v052.test.mjs`
Read the prior `docs/release-v051.md`, `NEXT_CHAT_HANDOVER_V051.md` and source too.

## Product purpose

We are building a dependable work breakdown/engineering material/procurement/receipts/QA/finance action hub for Sim-Worx. The owner audits real-world process and tests Windows; you own implementation and technical choices. Ultimately the owner wants to administer purchases worth several hundred thousand euros, but the present offline localStorage architecture is **NOT production-safe**. The contract and private data must remain outside public GitHub.

**Single source of work truth:** Work Plan jobs, nested sub-jobs, linked assembly/BOM requirements, technical reviews, supplier sourcing, owner approvals, order lines, QA receipts, work/evidence, invoices, recorded bank payments and NCRs. Avoid duplicate copies/shopping lists and false inferred events.

## V0.5.2 changes already committed

1. Strict fail-closed new-supplier PO gate across all projects. Uncontrolled manually created projects require an explicitly documented future-purchasing activation and then still need exact controlling source, technical review, supplier quote, reviewer, budget envelope and owner authorization. Historic POs remain accessible but are **not retroactively approved**. Existing generic bulk receipt path disabled.
2. Locked historic PO financial and product identity fields against direct edits, including legacy. Existing explicit order-balance closure history must be used for corrections, and proper formal PO amendment documents should be designed next.
3. Backup import validates evidence MIME/dataURL and project/job/material/PO-line linkage and locally recorded FNV checksum. Existing PO-linked evidence cannot be archived. Local customer preview approval becomes stale on job/spec/revision or evidence changes; no customer login activated.
4. Browser corruption no longer silently resets user's workspace; unrecoverable local JSON triggers private recovery hold with raw export and verified backup import. Mutations now integrity-check before browser save. New operations forms use cloned-state rollback on failed save.
5. New **Needs my attention** queue is derived from existing source records: job blockers, buying flags, quote/model gaps, budget/FX, owner holds, supplier acknowledgements, invoice evidence, late/rejected/awaiting-inspection delivery, open NCR and three-way/payment exceptions.
6. New **Supplier finance & NCR** tab keeps actual PO, supplier confirmation, QA acceptance, supplier invoice and externally recorded payments distinct; three-way matching gates later payment recording. Contains NCR/corrective/retest register. No external bank/API actions.
7. Job detail carries acceptance criteria, delay blockers, drawing revision reference and estimated/actual hours + history. Read-only dependency and QA-accepted material readiness.
8. `ops-v052.mjs` and `ops-ui-v052.mjs`, `ops-v052.css`, new Node synthetic tests and release docs added.

## Testing and caveats

- The previous lead ran **26** synthetic assertions against actual source functions using an in-tool JavaScript V8 harness with injected import dependencies; all passed. Syntax of modified JS modules checked. These results are not a full Node or browser test.
- A repeatable Node test suite is included: run `node --test tests/*.test.mjs` and `node --check src/*.mjs` from a checkout of `project-hub/`. A real Windows Chrome/Edge offline and ZIP/restore test is essential. Never claim they passed without running them.
- No private data modified or deployed; no external integrations added.

## Highest priority tasks next

1. Validate the full V0.5.2 branch and run *real* Node tests and browser/Windows QA. Fix compatibility and data restoration risks first. Investigate historic data that may fail strict validation and provide non-destructive guided migration tools, never silently rewrite source records.
2. Conduct an **actual owner acceptance session** with fictional test data and checked-off `OWNER_ACCEPTANCE_V052.md`; gather blocked flow/screenshots and usability friction.
3. Design secure durable storage with encrypted/transactional backend or an approved local database, backup/restore drills, append-only event trails and 2-person review. Do not incur cost or deploy until owner approves architecture.
4. Expand supplier finance for genuine multi-line invoices, partial invoices, deposits, credit notes, tax/multi-currency reconciliation, allocations and payment proof. Do not mistake manually keyed references for independently verified events.
5. Add formal purchase amendments, PO line lock snapshots, approval separation, revision approvals, real QA checklists, exception resolution, NCR dispositions and traceable engineering changes.
6. Add collapsible WBS with preserved filters/context, better keyboard access and quick source actions. Confirm these reduce clicks, not add fields users won't maintain.
7. Prepare secure customer projections; **no external customer accounts, public sharing, user roles or customer publishing** before formal approval.

## Engineering discipline

- Inspect before editing, run meaningful isolated tests, and write a detailed audit with observed failure cases and precisely what is implemented vs still missing.
- Preserve existing local storage schema and records. No forced data reset or overwriting original backups. All examples/tests must be fictional.
- Never present a supplier file, order photo, planned job, order confirmation, or customer-visible status as a paid transaction/received stock without the separate factual entries.
- Publish complete self-contained HTML and Windows-compatible extractable ZIP in project-hub/ on a dedicated branch, with exact version badge, notes, owner acceptance checklist, handover prompt.
- Keep the project genuinely useful for engineering contracts, not just a dashboard.
