# Sim-Worx Project Hub — V0.3.0

**12 November 2026 · Interactive local demo, not production software.** The version badge `V0.3.0` is always displayed in the top bar.

A safely isolated engineer-to-order simulator manufacturing and project-management prototype. It lives wholly under `project-hub/` in the public `XYNTRAMARK/simworx` repository. All demo people, budgets and project details are illustrative, including the NOAH example; **do not enter genuine contracts or other confidential information**.

## How to run

1. Simplest: download the supplied single-file `SimWorx_Project_Hub_Interactive_Demo_V0.3.0.html` and open it in Chrome on your PC.
2. From source: run `python3 -m http.server 8765` inside `project-hub/`, and open `http://localhost:8765`.
3. Demo changes are saved in the current browser's localStorage. They are *not* synchronised across devices, and clearing browser data will remove them.

## Working features

- Multi-customer project overview; project, customer, section and workshop/office job creation, editing, archiving and restoration.
- Nested work breakdowns with job owners, priorities and status controls.
- **V0.3:** Excel-like work register for in-cell edits; manual start/finish scheduling; multi-predecessor checks and cycle prevention; 16-week Gantt view; schedule baselines and delay warnings; CSV export with planned dates and predecessors.
- Project-specific BOM entries, stock management, supplier order records and a new **material readiness forecast** showing potential shortages. BOM entries can be attributed to a project section.
- Internal costing overview, customer publication drafts/withdrawals, simulated customer portal and approvals, demo invitations and activity history.
- Working light/dark themes and persistent visible release number.

## Test commands

- `node --test tests/*.test.mjs` — 22 domain tests passing.
- `python tests/browser-smoke.py` — original navigation, customers and inventory workflows.
- `python tests/browser-crud-v02.py` — create/edit/archive regression checks.
- `python tests/browser-planning-v03.py` — Gantt, work register, validation, baseline, materials and Excel CSV checks.

Python browser checks require Playwright and Chromium at `/usr/bin/chromium` in the test environment.

## Current limitations

The application is deliberately a **local demo** with no trusted multi-user identity, backend storage, server permissions, private file upload or email delivery. It does not safely support real customer accounts or real purchasing/stock accounting. The Gantt highlights dependency overlaps but does not auto-reschedule or calculate a validated critical path. Material readiness is an estimate and does not reserve stock. For a complete list see [`docs/release-v03.md`](docs/release-v03.md).

## Absolute project isolation

- Keep changes under `project-hub/` and on a dedicated development branch.
- Do not change live site root files, `admin/`, `portal/`, `.github/workflows/`, other project files, shared Supabase resources, DNS or production configuration without separate explicit approval.
- Do not merge or deploy to production without an explicit user approval and independent isolation verification.
- This public repository must never contain credentials, confidential contracts, supplier prices or personal data from real customers.

Continue with [`docs/roadmap.md`](docs/roadmap.md), [`docs/release-v03.md`](docs/release-v03.md), and [`docs/safety-and-architecture.md`](docs/safety-and-architecture.md).
