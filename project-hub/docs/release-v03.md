# Sim-Worx Project Hub — V0.3.0 (engineering planning)

**Release type:** Local interactive demo only. **Production impact:** None. **Incremental cost:** €0.

## Delivered

1. **Engineering work register:** worksheet-like WBS view, with inline editing of assignee, department, start/finish dates, status and priority; section bands and nested WBS codes; detailed modal for hierarchy and dependency editing.
2. **Gantt planning:** horizontally scrollable 16-week timeline, four-week pagination, dates manually entered or seeded as fictional examples, start/finish bars, finish-only markers, completed/blocked colouring and a current-date marker.
3. **Dependency integrity:** multiple predecessor jobs; same-project checks, self/circular link protection, prevents transition to active/done statuses while predecessors are incomplete; highlights date overlaps. This is a **finish-to-start warning** model, not a full automatic scheduling engine.
4. **Schedule baselines:** opt-in baseline captures immutable-at-rest snapshot of dated tasks until specifically rebaselined; displays original schedule and later finish-date variance. Baseline overwrite requires confirmation in UI.
5. **Materials readiness:** combines project BOM remaining requirement, global available stock estimate and outstanding project PO quantities to flag potential sourcing gaps. The result is a **non-transactional estimate**, and intentionally does not reserve stock.
6. **Assembly assignment:** BOM lines can be assigned to a project's section, including validation against accidental cross-project assignment.
7. **Exports:** WBS CSV includes planned start, planned finish and all named predecessors; compatible with opening in Excel.
8. **V0.2 continuity:** local browser records use the same storage key. A new opt-in action can populate *illustrative* seven-day dates for older demo jobs missing start dates; it never runs automatically.
9. **Visible version:** `V0.3.0` on the top navigation header.

## Tests

- `node --test tests/*.test.mjs` (22 passing domain tests).
- `python tests/browser-smoke.py` (original user workflows).
- `python tests/browser-crud-v02.py` (existing CRUD regression).
- `python tests/browser-planning-v03.py` (sheet editing, date validation, baseline, Gantt, material readiness, BOM section assignment, CSV download).

## Limits, safeguards and honest scope

- All records still live in *one browser's localStorage*. Do not use for a production contract, purchasing or actual customer data.
- No real accounts, tenant isolation on a server, Supabase database, uploads, outbound emails or live publishing.
- Gantt conflicts are shown, but no calendar logic, auto-rescheduling, resource levelling or verified CPM/critical-path output yet.
- Material availability is an estimate; the same stock may be tentatively counted for multiple projects. No automatic stock reservations or invoice matching.
- Current BOM allows a part only once per project. Multi-level repeatable assemblies and revisioned manufacturing BOMs are planned, not represented as complete.
- Existing data from V0.2 is retained in the browser; localStorage is not a durable cross-device store. CSV export is not a full database backup.
- Keep all code within `project-hub/`; do not merge or deploy to the live site without explicit authorization. Never modify `admin/`, `portal/`, root website, workflow or shared Supabase resources.

## Research inputs used for feature selection

- [OpenProject Gantt and work packages](https://www.openproject.org/docs/user-guide/gantt-chart/) — hierarchical scheduling and predecessors.
- [OpenProject work package relations](https://www.openproject.org/docs/user-guide/work-packages/work-package-relations-hierarchies/) — hierarchy versus dependency.
- [Microsoft Project task linking](https://support.microsoft.com/en-US/project/link-tasks-in-a-project) — connected schedules.
- [Odoo manufacturing operations](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/manufacturing.html) — multi-level BOM, work orders and stock workflows.

## Next build priorities

1. Internal component/assembly workspace with revision-aware BOM, multiple line occurrences of a part and approved alternatives.
2. Procurement requests, multi-line POs, partial receipts, separate project allocations, serial/lot tracking where relevant and internal change order history.
3. Production operations planning and QA hold-points; approved engineering releases before manufacture.
4. *After resource isolation and approval:* persistent backend, authenticated users, project-scoped grants, private storage, controlled client publication and audit trails with negative permission tests.
