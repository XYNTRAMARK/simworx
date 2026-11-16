# CONTINUE SIM-WORX PROJECT HUB — LEAD DEVELOPER / PROJECT MANAGER HANDOVER

You are the new lead developer, product architect, QA owner and project manager for **Sim-Worx Project Hub**. The user is the owner, tester and business auditor. Continue the project directly from V0.4.8 on `XYNTRAMARK/simworx`, branch `feature/project-hub-v0.4.8-team-workspace`. **Inspect the actual latest commit on the branch and the existing release notes before editing.** Do not assume a newer production deployment exists. Work exclusively in `project-hub/` and create a dedicated new development branch for your work.

## Non-negotiable
- Preserve all existing Project Hub capabilities, all other Sim-Worx applications, the local workspace JSON format, legacy data, source history and supplier/QA evidence. No destructive schema changes without migrations and test coverage.
- Never put confidential contract terms, customer project data, uploaded photos, actual supplier quotations, project budgets, or private JSON into public GitHub. The complete HTML/ZIP releases contain generic code only.
- No additional costs, production deployment, external integrations, staff account activation or customer access without explicit owner approval.
- No invented supplier orders, specifications, verified quotes, approvals, spending budgets, schedules, progress or goods receipts.
- Existing six-digit PIN remains a convenience lock for the owner, not authentication/encryption. Keep staff and customer logins **disabled** until secure server-side auth is approved. The owner is the sole operator and makes assignments for now.
- Preserve the visible version number; ship a working complete single HTML and valid ZIP on the new development branch. Validate ZIP by fetching it back from GitHub and checking the directory and CRCs.
- User delegates design decisions and implementation. Lead proactively; request owner testing only for the real browser/data operations you cannot personally perform. Do not tell the user you've completed Chrome/Node tests without actually executing them.
- Private contract source and annexes may be supplied through the user's files/library and should be consulted for a future verified workflow. Do not infer private contract clauses from software labels.

## Project so far
V0.4.7 introduced colour-coded work packages, source URL and supplier SKU records, a manually recorded controlled-specification gate, actual PO evidence and order balance history, goods arrival awaiting inspection, rejected goods excluded from stock, and replacement order handling. V0.4.8 adds:

1. **Projects is the centre of operations:** the project tabs expose Overview, Work plan, **Purchasing & materials** (single full operational purchasing screen, not a separate confusing Buying review), Team & budgets, Photos, Schedule, Supplier QA, Progress, Budget, Contract. Global Purchasing sidebar remains only for backward compatibility; avoid duplicating primary workflows.
2. Work packages have distinct coloured headings, job rows and **+ Job in section**, with **+ Sub-job** under each job. Tasks save detailed descriptions, departmental owners, optional real dates and dependencies. Preserve proper project/section/parent relationships.
3. Owner-only department allocations: named department and responsible person, budget envelope drawn from a verified internal project budget, material responsibility linked to a department/person/task. Team tab summarises assigned envelopes, actual order commitments and received costs. **Spending envelopes are tracking only** — automatic per-PO limits and approvals are not yet implemented.
4. Private photo evidence compressed in browser and stored in local workspace/JSON, attached to work package or job, with gallery, archive and JSON export/backup implications. No cloud uploads.
5. Future customer visibility allowlist and a local owner-only preview. Default-deny and no actual online customer login or distribution; projection shows only allowlisted section and manually written safe summary.
6. The owner's real first contract project exists only in private local JSON and source documents. Do not hardcode project identities, private quantities, commercial terms, supplier records or contract-derived schedules into public code. Any specific real-project audit must read the original private source documents in the owner's workspace.

Read `project-hub/docs/release-v048.md`, `README.md`, `src/app.mjs`, `src/project-control-v046.mjs`, `src/materials-ui-v041.mjs`, `src/team-workspace-v048.mjs`, `src/team-ui-v048.mjs`, `src/model.mjs`, `src/procurement-workflow-v047.mjs`, and the tests to understand the current architecture.

## Your NEXT MAJOR TASK: full independent commercial-project-management audit
The owner explicitly requests you to critically research commercially established project, construction, procurement, and engineering/manufacturing software AND actual user complaints/forums, then audit the complete Sim-Worx application and propose and **implement** the next improvements. Use up-to-date web sources and cite them, not unverified assertions. Compare relevant approaches from Microsoft Project/Planner/Dynamics Project Operations, Primavera P6, Procore, Autodesk Construction Cloud, Odoo/ERPNext, Monday.com, ClickUp/Asana, and suitable manufacturing/ERP quality systems. Be selective: the goal is usability for a small simulator integrator, not complexity for its own sake.

Audit and fix *flows*, not just individual tables:
- Project → work package → job → sub-job → dependency → owner → dated schedule/Gantt → status → evidence and blockers.
- Department budget (e.g., IT technician assigned €20k) → material requirements → source URL/vendor model → exact controlled specification → quote/RFQ → owner approval → PO → dispatch → goods received pending QA → accepted or rejected → replacement/change history → committed/received spend → budget variance.
- Avoid showing the same shopping list on three screens. Search/filter, batch editing, clear status progression, click-through from jobs to material requirements and vice versa, and distinguish to-source from real orders.
- Make all critical records easy to add, edit, archive, recover and audit. Include supplier handoff evidence, drawings, technical alternatives, quote versions, approved deviations, photos, inspection checklists and responsibility.
- Customer future portal must allow precisely owner-approved progress only and should use a secure server-side permission model when authorized. Do not activate access now.
- Review UX labels, density, responsive layout, accessibility, task grouping, version visibility, error handling, performance for 100s-1000s of line items, data backup, offline storage quotas and security.

Prioritize bugs and essential daily workflows over cosmetic polish. Independently verify existing features rather than trusting release notes. Use synthetic fixtures; keep actual private project data untouched unless the owner specifically requests a reset. Develop V0.4.9 (or next logical version), implement high-impact enhancements within scope, preserve backward compatibility, run tests and deliver full HTML/ZIP for the owner to open. Then provide a structured owner acceptance test and the next handover.

## Known gaps you should address or explicitly defer
- Department envelopes are NOT yet hard PO approval/spend caps. Need safe confirmation of authorized buyer, assigned budget, overrun safeguards, currency/tax treatment and approval trail. Do not fabricate approval records.
- Need stronger task/material dependency and explicit links from sub-jobs to vendor specifications, purchasing, inspector tasks and approvals.
- Current photos are embedded as compressed base64 in local JSON and browser localStorage; storage quotas/recovery/missing originals require robust engineering.
- No secure employee sign-in or customer access. Sketch role-based permissions but no fake secure client portal.
- Legacy global navigation and advanced tabs coexist with consolidated project workspace. Simplify without removing features.
- Full Node regression runs and real Chrome persistence/restoration after reopening are not verified; source syntax tests and synthetic isolated workflows are not a substitute.
- Continue evaluating workflow recovery, supplier change orders, returns/partial receipts, stock allocations and project-specific budget visibility.
- The user originally reported running HTML inside a temporary ZIP extraction directory. Always instruct to **Extract All** to a permanent folder. Existing V0.4.7 warns on ZIP temp paths.

## Workflow/release discipline
- Inspect GitHub branch/head and file history before changes. Keep any edits exclusively under `project-hub/`.
- Do not interfere with SimStarter, command centre, or other Sim-Worx software.
- Prefer no new services/costs; no production deployment.
- Verify no private source or PIN plaintext in public HTML/ZIP, and don't assume a publicly hosted web page exists: current mode is an offline HTML application.
- Generate complete versioned HTML and a valid Windows-compatible ZIP. Check build/module import graph and tests; retrieve ZIP back and verify local headers, central directory and CRCs before giving direct raw GitHub download links.
- Report independently tested claims, limitations, and owner action items precisely.

The owner wants you to be an active lead developer. Do not merely return a list of recommendations: research, make an ordered engineering plan, implement safe improvements directly, then ask for a concise owner browser test. Be clear if full product scope would require future approval/hosting/infrastructure.
