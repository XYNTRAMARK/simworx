# Sim-Worx Project Hub — industry benchmarking and gap audit

**Build assessed:** V0.1 → V0.2.0 (12 November 2026)  
**Scope:** engineer-to-order flight/simulator systems: Office, Workshop, Procurement, Stores, QA, Commissioning and controlled external customer portal.

## Source-backed design lessons

| Reference | Relevant practice | Sim-Worx implementation / gap |
|---|---|---|
| Oracle Primavera P6, Activities | Work breakdown structure, predecessor/successor relationships, resources, status and baselines | V0.2 adds editable WBS and predecessor rules; Gantt, critical path and frozen baselines remain pending. |
| Odoo Manufacturing 19, Work Centers | Job routing, work order planning and work-center capacity | V0.2 maps jobs to departments; capacity loading, calendars, shifts and material-ready gates remain pending. |
| Odoo Manufacturing 19, Work Order Dependencies | Jobs can be blocked by unfinished operations | V0.2 prevents moving dependent jobs to ready/in progress/inspection/done before their predecessor is done; advanced dependency graph pending. |
| Odoo PLM, Engineering Change Orders | BOM revisions and formal approval before applying changes | Draft/issued/revised drawing records and ECO workflows still require a dedicated controlled workflow. |
| Autodesk Vault, BOMs | Assemblies/subassemblies, part quantities, revision comparison, Excel/CSV export | V0.2 adds editable project BOM and WBS CSV. Indented multi-level assembly BOM/revision comparison remains pending. |

## Key findings from V0.1 (checked against source)

1. **CRUD coverage was insufficient:** adding a project/customer/job existed, but editing and removal were mostly absent. V0.2 provides editing for customers, projects, major work sections, nested department jobs, stock parts, BOM lines, document metadata and unpublished customer updates; archive/restore for eligible records. No destructive deletion is provided.
2. **Structure depth was limited:** V0.1 primarily had section → job. V0.2 supports job → sub-job hierarchies; cycle protection and WBS export. Future data schema must support arbitrary assembly depth, discipline packages, operations and template revision control.
3. **Scheduling lacked dependencies:** V0.2 provides one-predecessor job gating. A genuine Primavera-class engine needs calendars, multiple predecessor types, lag, start/finish, baseline snapshots, float, critical path, manpower loading and what-if forecasts.
4. **Inventory requires transactional records:** current demo keeps on-hand/reserved figures locally; multi-user stock reservations, receiving, picking, adjustments, serial/lot tracking, landed costs and accounting reconciliation require verified database transactions.
5. **Costing needs rigorous bookkeeping:** current numbers are illustrative. Actual costs, commitments, accruals, purchase receipts and invoices must be reconciled once, preserving currency/FX/tax assumptions and audit trail.
6. **Client access is only a demo:** no authentication or private file store exists. Real customers must never be onboarded until tenant- and project-scoped access tests, storage path rules and approval rights pass server-side checks.
7. **Document control must improve:** revision register exists as metadata; drawing revision immutability, supersession, transmittals, controlled publishing, release-to-manufacture sign-off and evidence file storage remain pending.
8. **Usability:** V0.2 header exposes build version, sections are editable, jobs can be nested, archived records are recoverable, and legacy Excel-style workflows can export WBS CSV.

## Next implementation phases — in priority order

**V0.3: operational planning**
- Expandable tree/table WBS with drag reorder, numbering, job-level start/finish, duration, multiple dependencies and milestone Gantt.
- In-line editing, advanced filters, saved views and bulk updates, Undo/history, CSV import with preview, validation and rollback.
- Non-destructive project templates including King Air/DA62/bespoke subsystems, reusable approved package revisions.

**V0.4: engineering & supply-chain control**
- Multi-level assembly and BOM model, drawings linked to versioned parts, make/buy, product routes and work centres.
- Purchase requisition → RFQ → approved PO → partial receipts, QA → project reservation → issue, shortage alerts.
- Change control: ECO, drawing release, impact analysis and client sign-offs; non-conformance and rework.

**V0.5: backend and security (requires explicit approval of safe isolated resources)**
- Secure multi-organisation / multi-project authentication and row-level data isolation, account invitation ceiling, private storage and signed URLs, audit history.
- Immutable revision approvals, configurable publishing, customer admin role delegation and notification integration.
- Full testing of cross-customer isolation and link-based bypass attempts before public use.

**V0.6: commercial oversight and delivery**
- Cost codes, baselines, budget vs commitment vs actuals, forecast-at-completion, change orders and margin.
- Factory acceptance test checklist, quality gates, installation, shipping, snag lists, handover and warranties.
- Live operational dashboards, exceptions, KPI reports and customer milestone packages.

## Comparison references

- Oracle Primavera P6 activities: https://docs.oracle.com/en/industries/construction-engineering/primavera-p6-project/26/p6-help/89935.html
- Odoo 19 Manufacturing work centres: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/advanced_configuration/using_work_centers.html
- Odoo 19 work-order dependencies: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/advanced_configuration/work_order_dependencies.html
- Odoo 19 engineering change orders: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/plm/manage_changes/engineering_change_orders.html
- Autodesk Vault 2026 BOMs: https://help.autodesk.com/cloudhelp/2026/ENU/Vault-General/files/GUID-86373139-0500-4B28-A5C3-DE80A53D1AF6.htm

## Safety and costs

- `XYNTRAMARK/simworx` **main** and every application path other than `project-hub/` are protected.
- Branch only; no production deployment, no Supabase mutations and no customer data in source.
- The repository is public. Only fictional sample data is included in the demonstration.
- No new services, hosting, domains or subscriptions are provisioned for this release.