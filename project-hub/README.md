> **Current build V0.3.0** — local interactive demo only. See [`docs/release-v03.md`](docs/release-v03.md). No real authentication, storage or customer access.

# Sim-Worx Project Hub

**Current application version: V0.3.0** (12 November 2026)

Local interactive prototype for engineer-to-order simulator project and manufacturing management. The version is visible permanently in the top navigation bar.

## Preview

Open `index.html` using a local HTTP server (`python3 -m http.server 8765` inside this folder, then `http://localhost:8765`). You can also use the supplied single-file `SimWorx_Project_Hub_Interactive_Demo_V0.3.0.html` for offline preview.

The application is a fully isolated frontend demo using browser localStorage, not a live app. None of the sample projects or customers is a real customer data record. Customer access and approvals are simulated and do not provide production permissions or signature assurances.

## What works in V0.3.0

- Project portfolio, customer organisations, controlled customer preview and simulated invitations.
- Create/edit/archive/restore projects and customer organisations (subject to safeguards).
- Create/edit/archive/restore major project work sections, workshop/office jobs and nested sub-jobs.
- Single-predecessor validation, blocked task status changes and WBS CSV download for Excel.
- Create/edit/archive/restore stock parts and editable project BOM requirements.
- Stock receipts, issues and manual adjustments with basic available-stock checks.
- Simulated PO creation and receiving, with protected order archiving rules.
- Document metadata registration/editing, internal vs customer-view filtering, customer-facing draft creation/edit/publish/withdraw.
- Dark and light mode, activity history, demo-only notifications and explicit build-version badge.

## Tests

Run `node --test tests/*.test.mjs` for domain tests (16 passing). Optional browser tests require Python Playwright and a local Chromium executable at `/usr/bin/chromium`: `python tests/browser-smoke.py` and `python tests/browser-crud-v02.py`.

## Security and production isolation

- All source and documentation live in `project-hub/` only, within the existing public `XYNTRAMARK/simworx` repo. Never commit secrets, real customers, confidential costs, personnel data or actual contracts.
- Absolutely no modification to the existing website root, `admin/`, `portal/`, other software, deployment workflows, production resources or Supabase without separate explicit approval.
- The preview is **not suitable for real customer sign-in or upload**. Production requires isolated, approved database and private file storage with server-enforced access policies.
- Do **not** deploy this folder to `/htdocs/admin/`, `/htdocs/portal/` or publish root-level changes.

Read `docs/industry-audit-v02.md`, `docs/release-v02.md` and `docs/safety-and-architecture.md` before continuing.
