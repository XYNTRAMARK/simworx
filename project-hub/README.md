# Sim-Worx Project Hub — V0.4.3 staff workspace

**16 November 2026 | Isolated candidate release | Cost: €0 | Production deployment: none**

This development branch adds a **staff-only, single-computer working application** with encrypted local saves. It is not a shared online database or a public customer portal. No real NOAH contract files are stored in the repository.

## Start on your Windows computer

1. Extract the **entire** `SimWorx_Project_Hub_Complete_V0.4.3.zip`.
2. Prefer to double-click `RUN_PROJECT_HUB_WINDOWS.bat`. It uses free Python 3 (if installed) to serve this app at the same local URL every time: `http://127.0.0.1:8765/SimWorx_Project_Hub_Complete_V0.4.3.html`. Close prior Project Hub server windows before starting a newer build.
3. Alternatively open the standalone HTML directly in Chrome. Browser storage on `file://` is not guaranteed to be consistent across file locations, so the launcher is the recommended route.
4. At first setup, create a local staff username and password (at least 12 characters). **By default the workspace is empty**: older demo records are **not** imported unless you deliberately tick the import checkbox.
5. Under **Settings → Staff access & automatic data saving**, select an encrypted workspace file on your computer and export an independent encrypted `.swphub` backup. Save the password in your password manager. If browser saving fails, use *Emergency encrypted backup of current edits* before closing.
6. Add a company (NOAH) to the internal Companies register first, then its contract-specific project. No contractual obligations should be created until the uploaded contract has been reviewed.

## Operational features included

- Dedicated Project control view showing material status and manual completion; the large portfolio is collapsed by default.
- Engineering project structure, Work register, Gantt, assembly revisions and editable materials.
- Project-wide Purchasing list grouped by main project, red = to order; amber = ordered/in transit; green = received/allocated.
- Material required-by dates, lead times and safety buffers, with calculated latest order-by dates and overdue notices.
- External work package handoffs: laser cutting → incoming inspection → powder coating → back to Sim-Worx, with separate supplier, promised-return and actual-return dates, delay history and export.
- 1–1000 manually weighted progress steps per project with completion recorded by staff.
- Internal budget tracking, inventory reservations, partial receipts, tracking numbers and local proof documents.
- Password-unlocked encrypted IndexedDB saves after every changed record, optional selected encrypted-file mirror, encrypted backup/import and manual recovery controls.
- Original Work Register and manufacturing features retained. Customer publication and customer-facing navigation are disabled/hidden for this internal release.

## Data safety

- The old `simworx-project-hub-demo-v1` localStorage key is **read-only for explicit migration**, not used for new saves. Old sample data are retained until the user separately decides to delete that plaintext copy.
- The new records are encrypted in browser storage with PBKDF2-SHA256 + AES-GCM, not sent to GitHub or any server.
- A local password is **not** multi-user authentication. Project Hub is usable from this device/browser only. File-based backups or synchronisation must not be edited simultaneously from multiple PCs.
- No password recovery server exists. Password and encrypted backup must both be retained.
- No external purchases are triggered by changing an order's status. Supplier delay notes are user-entered and should be evidence-reviewed before customer communication.
- Public repository changes remain confined to `project-hub/` on the dedicated feature branch.
- This development environment cannot perform full real Chrome acceptance testing; run the supplied browser tests and user acceptance flow before relying on it for confidential contracts or material orders. The source and 32 emulated interaction screens were checked, not a production security audit.

## NOAH contract import — pending documents

The user said two contract documents would be attached but they were **not present** in the current conversation's uploaded file list or retrievable library at release preparation. No real NOAH data were inferred or generated.

When the documents arrive, inspect both, extract contractual scope, deliverables, exclusions, prices, stages, acceptance terms, procurement/long-lead parts, milestones, dependencies, warranties, revision references and client approvals. Distinguish contractual facts from project-manager suggestions and missing data. Never use the customer contract price as an internal project budget without separate confirmation.

Generate an importable **private JSON workspace backup**, not a committed GitHub seed. The owner will import it into the signed-in workspace and make a fresh encrypted backup; the contract files never enter the public repository.

For full release QA and next steps see `docs/handover-v043-internal.md`.
