# Sim-Worx Project Hub — V0.4.2

**16 November 2026 · Local interactive demo — NOT production.** The header badge displays **V0.4.2**. Demo data is fictional. Incremental cost: **€0**. No production deployment, database, workflows or unrelated project modified.

## Run and explore

**Owner's simplest route:** download `SimWorx_Project_Hub_Complete_V0.4.2.zip`, extract it, and double-click `SimWorx_Project_Hub_Complete_V0.4.2.html` in Chrome. This is the **entire application**, including all original project, planning, customer, inventory, finance and manufacturing screens—not a separate procurement preview. Developers can also serve this directory locally with `python3 -m http.server 8765` and visit `http://localhost:8765`.

## New in V0.4.2 — focused Projects workspace, materials and order stages

- **Concise project workspace:** show one project at a time with a project switcher and optional full portfolio. Keep the Work breakdown, spreadsheet Work register, Gantt, assemblies, procurement and Budget as prominent tabs. Legacy BOM, legacy material forecast, documents and client publishing remain available under **More**.
- **Edit and remove project materials:** project procurement displays individual E-BOM occurrence lines. Change the part identity only for that occurrence, quantity, reference and make/buy; archive or restore lines non-destructively. Separate "Edit part master" changes its SKU/description for every project; "New part identity" creates a master and returns to the project.
- **Project budget:** allocate a budget, edit previously recorded cost and manual commitment baselines; forecast actual receipts and outstanding commitments from new tracked purchase orders without double-counting legacy imported PO balances. View per-project overspend/remaining budget and global financial summary. Non-EUR POs require an explicit manual EUR conversion rate before they count toward the EUR budget.
- **Ordering states:** a material shortfall without enough inventory/POs shows **Needs ordering**; creating a purchase order shows **Ordered**. The Purchasing delivery column has an immediate **Ordered / Out for delivery** selector. **Part received / Received** are computed from received quantities and cannot be falsified by changing dispatch status. Future goods never increase on-hand stock.
- **Safety and continuity:** all prior project, workshop, inventory, manufacturing and customer workflows remain. All browser records stay on the unchanged \`simworx-project-hub-demo-v1\` localStorage key. Download a full JSON backup before switching browser origins.

**Tests:** 58/58 existing and new domain test functions and 32/32 complete-application UI/action cases passed in an isolated JavaScript compatibility harness. The literal Node CLI tests and full Playwright Chromium run still need a complete local checkout and are not claimed as passed. See \`docs/release-v042.md\`.

## Retained from V0.4.1 — integrated procurement and stock

- **Inside each project:** new `Project procurement` tab. Add required materials to a specific project assembly, see the nested E-BOM quantities, check available workshop stock, see reservations to other projects, reserve available units, track workshop issues/consumption and create a linked purchase order.
- **Global purchasing:** multi-line purchase orders with supplier, currency and tax assumption, per-line assembly assignment, estimated arrival, partial goods receipts, backorders and controlled supplier returns.
- **Tracking & proof:** carrier, tracking/AWB code, HTTPS tracking URL, expected delivery and notes, plus **up to four PDF/JPG/PNG/WebP proof attachments per order (max 800 KB each)**. Attachment bytes remain in browser localStorage and are copied into exported JSON backups, **never pushed to GitHub or any server**.
- **Workshop inventory:** shared on-hand/reserved/available balances, allocations by project, preserved legacy reservations, stock-movement history and the original add/edit/archive controls. Outstanding supplier orders do not count as received stock.
- **Backup/restore:** Settings offers a complete JSON workspace download and a validated restore-with-confirmation. Save backups privately; browser localStorage may be lost or isolated by origin. No server backup is implied.
- **Continuity:** the original V0.3 Work Register, Gantt/baselines, project management, documents, customer preview and financial screens remain. All original V0.4 assembly/revision controls remain. Legacy V0.3 BOM is labelled as historical; the assembly E-BOM is authoritative for the new procurement workflow.

**Safety:** all V0.4.1 actions are single-browser simulations. No live purchasing, secure multi-user allocations, authenticated customer access, private server storage, SMTP, Supabase modifications or production deployment. Only synthetic/demo data belongs in the public repository.

**Test coverage:** 45 original + new domain tests were executed in an isolated JavaScript compatibility harness, **45 passed**. The same harness checked 30 application screen/render cases and 10 integrated action/form flows, all passing. Full Chromium-on-HTTP browser regression and the literal Node CLI suite should still be run in a complete checkout. Commands: `node --test tests/*.test.mjs` and `python3 tests/browser-materials-v041.py` (with local HTTP server running). See `docs/release-v041.md`.

## Retained from V0.4.0

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
- This version implements local demonstration multi-line PO receipts and limited browser-local proof files, but does **not** provide live multi-user atomic stock transactions, tenant-safe authentication, secure remote file storage, QA holds or production customer access. No real financial, private customer, supplier or personnel information belongs in a public repository or local demo.
- Follow [V0.4.2 release notes](docs/release-v042.md), [roadmap](docs/roadmap.md), [V0.4.2 handover](docs/handover-v042.md) and [safety rules](docs/safety-and-architecture.md).
