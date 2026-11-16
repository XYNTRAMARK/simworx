# Sim-Worx Project Hub — V0.4.3 local staff workspace
**16 November 2026 · Isolated development branch · €0 incremental expense · NOT deployed to production**

## What changed
1. A new local installation opens with a **clean workspace** (no fictitious customers, orders or invoices). Existing localStorage contents are preserved until a user explicitly imports or clears data. The old sample generator remains exclusively for automated tests.
2. Private **JSON workspace import** reuses the previous validated backup format and explicitly asks permission before replacing existing projects. Real customer contracts and prices must be prepared and transferred as private local files, NEVER committed in the GitHub repository.
3. A **local staff username/password gate** uses a salted PBKDF2 verifier and session-based unlock. It is an interface lock, NOT cloud authentication, encryption, tenant security or a substitute for proper server authorization.
4. Staff may connect a user-selected JSON file in Chrome/Edge; subsequent changes save to browser storage and queue writes to that file during the session. File permissions and the browser's File System Access API are required. The file must be re-linked after opening a different standalone HTML version. Browser-only JSON export/restore remains available everywhere.
5. A **project-focused dashboard** provides manual progress, consolidated procurement needs and current subcontractor handoffs. Projects show only the selected project, with other projects available from a switcher.
6. Staff may define 1–1,000 manually weighted progress steps per project. Percentages are NEVER inferred from Gantt status.
7. Procurement supports add/edit/archive/restore for material requirements, quick creation of a new part and linking it to the project, need-by dates, supplier lead days, buffers and order-by warning calculations.
8. Purchasing is grouped by the **main project**, with consolidated part quantity/stock/order status. The purchasing user does not need to enter an assembly designation.
9. External-work chains track laser cutting, workshop inspection, powder coating, composite subcontractors or any configurable supplier. Every handoff stores time, responsible company, promised date and actual return/acceptance date. The audit history preserves earlier promises when a stage is edited. CSV is exportable for internal factual delay review.
10. A new **Contract scope** tab reads contractual milestones, scope exclusions, readiness checks, source references and buyer-direct supplier prices from imported data only. It does not embed customer contracts in source. Contractual effective dates require staff verification; +12 months is calculated only from an entered date. Signed change orders and extensions are NOT auto-approved.
11. Customer portal navigation is hidden until the separate access/security project is authorized. Existing legacy component, Gantt, work register and financial functions remain in source.
12. Project tabs now render lazily to reduce unnecessary work and improve responsiveness.

## Safety boundaries
- Public repository: \`XYNTRAMARK/simworx\`; branch \`feature/project-hub-v0.4.3-focused-projects\`.
- All development edits exclusively within \`project-hub/\`. No changes to \`main\`, production sites, FTP/GitHub Actions, credentials, hosting, databases or integrations.
- No authentic customer contract/PDF, pricing, employee logins or private project data is committed.
- Single-device browser file storage is not a database, encryption at rest, shared collaboration or secure user management. Protect the PC and exported file with OS-level access controls, backup policy and at-rest encryption as appropriate.
- Never share the local JSON backup or use it for customer logins; financial milestones, purchasing and external supplier notes are internal.
- Switching standalone HTML paths may create separate browser localStorage. Maintain a user-selected JSON file and manual backups; relink it after changing versions.
- The app cannot independently verify vendor delay causation, payment completion, signed contract dates or legal extensions.

## Validation
- **79/79** original and new synchronous domain test functions executed successfully in a JavaScript compatibility harness using source fetched from the repository. This is not the literal Node CLI test runner.
- **34/34** full application render/form/action checks passed in an emulated DOM, including clean startup, returning user records, full old screens and the new functionality.
- Python checks confirm the private contract import is structurally compatible with the existing backup schema. It has only the one intended project and no invented order, stock, spending or task completion.
- Literal \`node --test tests/*.test.mjs\`, a complete Chromium browser and File System Access permissions have NOT been run in this GitHub-only environment; complete the attached browser smoke on an actual PC before critical use.

## Local test commands
\`\`\`bash
cd project-hub
node --test tests/*.test.mjs
python3 -m http.server 8765
# separate terminal; Playwright/Chromium:
python3 tests/browser-projects-v043.py
\`\`\`

## Current operational limitations
- No server-based authentication, recovery system or multi-employee concurrent transactions.
- No secure document vault, email automation, accounting integrations, actual supplier delivery verification or physical inventory reconciliation.
- No automatic contractor liability determination or legal remedy calculation.
- Some release functionality is dependent on the browser's file system API. Use manual JSON backups if not supported.

## Next recommended phase
V0.4.4: address real owner feedback from the imported contract setup, add evidence/document-link support locally, improve export formats and bulk editing; evaluate a private local-first database or isolated authenticated backend only after explicit architecture, security and cost approval.