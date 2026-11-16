# Master technical handover — Sim-Worx Project Hub V0.4.3 internal staff workspace

**Prepared:** 16 November 2026
**Repository:** `XYNTRAMARK/simworx` (public; contains unrelated live production projects)
**Active development branch:** `feature/project-hub-v0.4.3-internal-workspace`
**Parent version branch:** `feature/project-hub-v0.4.3-focused-projects` @ `ed16d0f1784a2a42fd423918981152caa6b1bc28`
**Owner:** User (tests/audits); assistant (lead engineering and delivery). Cost ceiling remains **€0 additional**.

## Immutable safety constraints

Read `PRODUCTION-SAFETY.md` and `project-hub/docs/safety-and-architecture.md` first. Do **not** modify, merge, overwrite, deploy or sync any path outside `project-hub/`; do not touch root website, admin, workflows, DNS, Railway, Supabase production resources, Stripe, secrets, SMTP or existing simulator programs. New work only on a dedicated development branch. No real supplier/customer contracts or personal financial data may be committed to this public GitHub repository. Do not create billed resources.

## What is implemented in V0.4.3

From V0.1–V0.4.2: portfolio and company record CRUD; original nested WBS, Work Register, Gantt and dependencies/baselines; parts and assemblies, revisioned E-BOM/M-BOM; project-scoped procurement and shared workshop inventory; multi-line purchase orders, partial receiving, tracking numbers, local receipt proof documents; cost/budget forecast.

From current V0.4.3 focused project work:
- Opening a project goes straight to a dedicated `Project control` dashboard. Older functions remain in the More selector.
- Buyer list is one consolidated material list grouped by main project (NOAH etc.), not by assembly, with red/amber/green supply statuses.
- `+ New part identity` opens an inline part/SKU creation form that also adds the required quantity to the selected project. Existing requirement lines can be edited/archived/restored.
- Engineering sets required-by dates, lead times and safety buffers. Order-by dates are calculated. No automatic purchase order is sent.
- Users define 1–1000 manual progress steps, individual weights and completion percentages; not inferred from work register counts.
- External-work package records support laser cutting → internal incoming inspection → powdercoat → return, as well as composite subcontractors. Captures planned/promised dates, actual send/return/accept dates, wait time, delays, company notes and timestamped edit history. All are user-entered, not independent supplier fault verification.

Current internal workspace changes:
- First-run staff username and 12+ character password, encrypted browser IndexedDB state using PBKDF2-SHA256 / AES-GCM, automatic save after mutations, optional selected encrypted `.swphub` file mirror via File System Access, encrypted backup/export/recovery and visible save state.
- New staff workspace starts EMPTY: no sample projects or supplier records. Existing `simworx-project-hub-demo-v1` plaintext data remain **read-only** and are imported only if the owner explicitly checks the import box; unchecked is the default. No destructive reset action.
- Customer preview navigation and publishing actions are hidden/disabled for now. Companies remain an internal register.
- A Windows `RUN_PROJECT_HUB_WINDOWS.bat` runs Python's free localhost server on 127.0.0.1:8765 to keep a consistent browser origin. HTML remains available for standalone Chrome use, but file:// storage varies by browser.
- `SimWorx_Project_Hub_Complete_V0.4.3.html` contains the entire prior application, newer modules, CSS and staff login.
- No shared staff authentication server, no team sync, no automatic cloud backup and no production deployment. Avoid claiming this is a multi-user system.

## Current source layout

`project-hub/src/app.mjs` is the main integrated app. Domain modules:
`progress-v043.mjs`, `external-work-v043.mjs`, `procurement-planning-v043.mjs`, `projects-v042.mjs`, `materials-v041.mjs`, `manufacturing.mjs`.
UI modules:
`progress-ui-v043.mjs`, `external-ui-v043.mjs`, `planning-ui-v043.mjs`, `focus-ui-v043.mjs`, `materials-ui-v041.mjs`, `manufacturing-ui.mjs`.
Security:
`secure-workspace-v043.mjs`, `workspace-access-ui-v043.mjs`, `workspace-access-v043.css`.
Original `model.mjs`, `demo-data.mjs` retained as schema and opt-in legacy fixture.
Bundled release build assets in `project-hub/build/`. Do not edit these manually without rebuilding.

## Verification and open risks

Earlier V0.1–V0.4.3 domain model suite had 71/71 synchronous harness checks passing (not a literal Node CLI run). The completed focused staff integration has 32/32 emulated UI screen/action checks passing, including new part identity, manually generated steps, external route, purchaser list and staff sign-in gate.
- Actual Playwright Chrome browsing in this environment is BLOCKED BY ADMINISTRATOR (both file:// and localhost). Do not claim browser acceptance passed.
- Full Node `node --test tests/*.test.mjs` has not yet run on a source checkout. The new encrypted workspace tests are committed, but actual secure-storage behavior in Chrome remains an owner acceptance gate.
- Explicit user QA: start from blank, create staff login, company and project, add part/material plan and save, reload and log back in, verify records, set auto-save file, export encrypted backup, restore it in a different Chrome profile, ensure wrong password does not unlock, test failed save and emergency backup. Do not enter live contracts before backup/recovery passes.
- FileSystemAccess selected-file mirror may require renewed permission after reopening Chrome. Error must be visible; IndexedDB and file success are separate states.

## Critical pending task: ingest real NOAH contract

The user promised to attach an archive containing **two documents** for the real NOAH project, but neither appears in current conversation uploads or relevant file library results. **DO NOT INVENT ANY CONTRACT DATA.** Do not reuse old sample NOAH scope, values, milestones, material quantities, names or timelines.

When attachments arrive:
1. Inspect archive file list and identify both files, then read both completely (PDF pages/embedded scans, DOCX or spreadsheets as appropriate) and cross-reference annexes/exhibits.
2. Build a private contract-grounded requirements matrix. For each entry capture exact source file/page/section, the verbatim short source label, deliverable, acceptance criterion, scope/exclusion, quantity/unit, stated date, dependency, responsible party, procurement status and ambiguity.
3. Differentiate **contractual fact**, **reasonable implementation proposal** and **owner confirmation needed**. Distinguish contract price from internal build budget; do not invent supplier lead times, procurement dates, stock availability, stage weights or purchase order status.
4. Model a single NOAH company and custom NOAH project, with contract-specific sections, nested jobs, assembly/E-BOM occurrences, procurement deadlines and externally subcontracted work packages where evidence supports them. User-mentioned laser, powdercoat and composite suppliers are potential internal workflow stages, NOT automatically contractual suppliers.
5. Progress milestones should be prepared as draft steps with weights 0/unassigned until the owner chooses the percentages. Internal status should remain 'Not ordered' unless supported by real records.
6. Create a **private importable Project Hub JSON backup**, not a source-code demo seed. Format `{format:"simworx-project-hub-backup",schema:1,application:"V0.4.3",state:{version:1,organizations:[...],projects:[...],sections:[...],tasks:[...],parts:[...],bom:[...],orders:[],movements:[],audit:[],settings:{theme:"light"},...}}`. Use the actual exported schema and check model invariants. Put no real data in public GitHub.
7. Instruct the owner to use the staff login, Settings → Restore JSON backup; after confirming import, immediately export an encrypted `.swphub` backup. Give them a review sheet for all unknowns before purchasing.

## Next release priorities

1. Complete real Chrome QA and fix secure-storage edge cases before operational data entry.
2. Read the two NOAH contract files and generate a contract-specific private project dataset and source-referenced requirements matrix.
3. Refine project scheduling: link material required-by and purchase order delivery to downstream work without inventing dependency dates.
4. Tighten external-work evidence attachments and delay reason reporting; keep private until reviewed.
5. Improve local backup recovery UX; only explore multi-user private backend as a separate approved, zero-new-cost design.
6. After each milestone, deliver **complete** application ZIP and a refreshed handover prompt, never an isolated module preview.

## No-contract rule

The most important incomplete deliverable is **actual NOAH data population**. That cannot be performed safely before the two contract files appear. Current V0.4.3 new workspace deliberately starts empty and contains zero contractual NOAH records.
