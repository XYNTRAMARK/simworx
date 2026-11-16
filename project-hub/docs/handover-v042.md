# Sim-Worx Project Hub — master handover V0.4.2
**16 November 2026.** Lead developer owns implementation; the user is the owner, auditor and tester.

## Branch and immutable constraints
- Repository: \`XYNTRAMARK/simworx\`. Release branch: \`feature/project-hub-v0.4.2-projects-refinement\`. Parent branch: \`feature/project-hub-v0.4.1-materials\` at \`a7d5e311c31a6128794eb1f6ad2b9d31ad9d40fa\`.
- This public repository also contains a commercial live website. Read root \`PRODUCTION-SAFETY.md\` and \`project-hub/docs/safety-and-architecture.md\` **before** any writes.
- Edit only \`project-hub/\` in a NEW dedicated development branch. Never merge to \`main\`, modify existing workflows, call deployment/FTP, change databases or authentication, use credentials or incur new costs without explicit authorization.
- Prior incident caused unintended FTP overwrite of the commercial website; all current work must avoid every live path.
- All work is a **single-browser demo** with fictional data. No real supplier or customer documents in the public repository. Browser-local proof attachments are not private server storage.

## What exists
- V0.3: multi-customer project structure, nested sections/jobs, spreadsheet Work register, dependencies, baselines and 16-week Gantt, CSV export and original local project BOM.
- V0.4: reusable parts and occurrences, nested assemblies, released E-BOM/M-BOM snapshots, drawing revisions, engineering change requests and workshop job readiness.
- V0.4.1: project procurement linked to assemblies, inventory ledger and reservations, multi-line PO/partial receipts/returns, tracking numbers/URLs and browser-local proof files, JSON backup/restore and visible version in the header.
- **V0.4.2:** compact focused Projects screen (project selector and collapsed portfolio), main Work/Engineering/Procurement/Budget tabs and a More selector preserving the legacy screens; requirement-level edit/part identity, archive/restore; project budget editor/forecast and FX warning; explicit Ordered/Out for delivery stage with strictly receipt-derived Part received/Received.

## Files to read first
- \`project-hub/src/app.mjs\` — complete original application plus V0.4.2 navigation, budget UI, form/event integration.
- \`project-hub/src/projects-v042.mjs\` — budget snapshot and update semantics; new tracked POs vs legacy, FX handling.
- \`project-hub/src/materials-v041.mjs\` — purchase order stages and receipt invariants.
- \`project-hub/src/materials-ui-v041.mjs\` — material requirements add/edit/archive/restore, order stage selector and all V0.4.1 purchasing features.
- \`project-hub/projects-v042.css\`, \`styles.css\`, \`materials-v041.css\`, \`manufacturing.css\` — responsive style.
- \`project-hub/SimWorx_Project_Hub_Complete_V0.4.2.html\` and ZIP — full self-contained owner deliverables, not an isolated mockup.
- \`project-hub/docs/release-v042.md\` and roadmap.
- \`project-hub/tests/projects-v042.test.mjs\` and \`browser-projects-v042.py\`; retain all original test files.

## Tests and caveats
- V0.1–V0.4.2 model tests: **58 passed** in an isolated JavaScript compatibility harness; 32 emulated UI/action/render checks passed.
- Not yet a real-browser full regression. The committed Python Playwright script and full Node CLI tests require execution on a downloaded checkout.
- Budget is a planning estimate: previously entered manual spent/committed + V0.4.1+ multi-line POs. PO receipts move received amounts from committed to actual but do not change total forecast; old historical orders excluded. Foreign currency excluded until EUR rate entered. Verify imported numbers with the owner before using beyond a demo.
- Original localStorage key remains unchanged \`simworx-project-hub-demo-v1\`. Never clear/reset an owner's existing demo data; offer JSON backup and verify restores before switching versions.
- A material's *occurrence identity* can be changed without editing a part master. Master edits affect every project and should be clearly distinguished.
- "Out for delivery" never changes warehouse inventory. Only posting an actual receipt does so.

## Suggested next engineering
Finish full browser testing in Chrome; review owner feedback on new project panel usability and material identity handling. Then plan V0.5.0 QA/inspection workflows. Preserve the entire app with every release ZIP, always supply a real ZIP download link (not a raw HTML GitHub link that appears as code).