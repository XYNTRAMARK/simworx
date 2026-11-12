# Sim-Worx Project Hub — Development roadmap

**Current delivered milestone: V0.4.0 — isolated component/manufacturing slice (local demo).** All production writes are prohibited without explicit separate approval. The design is multi-customer from the start; NOAH is only a demo example.

## Delivered

- **V0.1:** Multi-customer management shells, project workspaces, workshop/office queues, inventory, purchasing, reporting, internal/customer preview and simulated publication.
- **V0.2:** Add/edit/archive/restore for core records, hierarchical work sections and jobs, predecessor rule, Excel WBS CSV export and visible version chip.
- **V0.3:** Spreadsheet-style work register, manual dated schedules, 16-week Gantt navigation, multiple predecessor links and cycle checks, opt-in schedule baseline, delay/conflict warnings, assembly-linked BOM and non-reserving material shortage estimates. 22 domain tests and browser checks passing.

## V0.4.0 delivered (isolated)

- Distinct reusable part master and repeated assembly BOM occurrence entities; nested engineering assemblies, imported V0.3 sections/BOM, roll-ups and basic manufacture readiness.
- Drawing revisions with review/release transitions and independent immutable-at-rest manufacturing BOM snapshots; engineering change register and linked job release/shortage warnings.
- Existing V0.3 screens retained; procurement/stock transactions and controlled live publishing explicitly **not** delivered yet.

## Next: V0.4.1 / V0.5 — deeper manufacturing controls (still isolated)

1. **Component / subassembly register:** engineering structure, multiple reusable occurrences of a part, make/buy classification, revision numbers, build state and required tests. Separate *engineering BOM* and *manufacturing BOM* versions.
2. **Change control:** immutable released drawing versions, formal change requests, impacts on materials/budget/schedule and release authorisation before workshop use.
3. **Procurement:** multi-line supplier orders, partial receiving, returns and purchases tied to the requested assembly; maintain correct currency, tax assumptions and audit history.
4. **Material allocation:** reservations scoped to project and warehouse with conservation checks; stock ledger, minimum/reorder and serial or lot references where appropriate.
5. **Planning:** milestones, configurable work calendars, dependency types/lag, clearer baseline comparison, critical path only after independently tested calculations.
6. **Day-to-day usability:** saved project register views, project search, sort and filters, owner dashboards, keyboard editing and optional bulk creation from verified import.

## Release architecture: explicit approval gate

After isolated resource feasibility review and approval, add a backend containing separate Project Hub schema/permissions/storage/identity. Require robust server-side multi-organisation and project-level authorization, negative cross-customer tests, customer-admin invitation ceilings, revision-linked approvals, audit log and safe publishing. Then add real file uploads and email only with a verified no-additional-charge route. All existing Sim-Worx, SimStarter and Xyntra systems stay unchanged.

## Not included yet

Server-side permissions, live customer sign-ins, real storage, transactional inventory, guaranteed cost reconciliation, full critical path/resource levelling, automatic emails. Time tracking and QR/barcode tracking remain deferred by the user.

## Safety rule

Never modify outside `project-hub/`, never edit root workflows or existing app/database resources, never merge to `main`, and never deploy the live website without explicit authorisation. Read `safety-and-architecture.md` before any future write.
