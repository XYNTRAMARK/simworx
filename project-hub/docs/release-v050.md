# Sim-Worx Project Hub — V0.5.0 Work Plan as the source of project operations

**Branch:** `feature/project-hub-v0.5.0-workplan-integration`  
**Base:** latest V0.4.9 development branch, *not* the older V0.4.8 release SHA.  
**Scope:** `project-hub/` only; complete offline HTML/ZIP, no production deployment, no costs, no private customer records in public source.

## What changed

1. **Work Plan is the primary project-building tool.** Work packages contain jobs, jobs can contain child jobs, and children can contain further descendants. A proper WBS number (e.g. `1.2.3.4`) and indentation make the hierarchy visible. Every level offers Details, Edit, Add child, and Add material.
2. **Inline editable job detail** replaces reliance on pop-up buttons in the project Work Plan. Owner enters a precise title, long description, department, responsible person, priority, status, optional dates, and an optional “Purchasing action required” flag with written instructions. Existing job predecessors are preserved on edit. A parent cannot be marked Done while live children are incomplete.
3. **Work package administration:** Create a blank project with no invented work packages; manually create and edit packages directly in Work Plan. Existing template projects and their sections continue to work. Project creation does not prefill a fictional delivery date. Navigation goes straight to Work Plan on save.
4. **One linked engineering material record:** From any job, Add material or buying item with description, internal part identity, exact quantity/unit, technical requirements and MAKE / Sim-Worx BUY / customer-supplied / subcontracted / unresolved responsibility. The operation creates a *planning* E-BOM occurrence in a dedicated work-plan assembly under the section, linked to the job. It does **not** fabricate supplier SKUs, real quotations, authorization, prices, purchase orders, shipments or goods receipts.
5. **Purchasing follows the job:** The same requirement appears in Project → Purchasing & materials, initially blocked for source mapping and technical owner approval. Click its Purchasing / QA action from the job to open its record; click Open job in Purchasing to return to the originating sub-job.
6. **Unresolved buying actions visible:** A job flagged for purchasing but lacking a specific Sim-Worx material becomes an actionable queue item inside Purchasing. Entering and linking a real draft requirement resolves this queue item; the material itself becomes the single purchasing source.
7. **No duplicate BOM entries:** Jobs can attach an already imported engineering requirement without cloning the material. Multiple items can link to the same job. Work-plan-created requirements record history when their drafts change. An item linked to real POs cannot be overwritten or archived from Work Plan. A material with an active owner authorization cannot be archived before its authorization is revoked.
8. **Safe job archival:** The new Work Plan can archive a job only after dependent children, dependencies and material references are addressed; the archived job remains in private workspace history.
9. **Legacy-editor purchasing guard:** Editing or archiving an E-BOM occurrence linked to an actual supplier PO is blocked even through the older Assemblies view; editing the ordered part identity (code, name or unit) through Part Master is also blocked. Corrections require auditable purchasing/change management, not rewriting the original order.

## Operating workflow

- Projects → Create project → select **Blank project (manual work packages)** or an existing template.
- Work Plan → **+ Work package** → enter the section name; create a top-level job.
- Use **+ Sub-job** on any level; the selected parent's section/project is retained and the nesting remains visible.
- Enter specific manufacturing, purchasing and QA actions as children; flag purchases that still need sourcing information.
- From job Details choose **+ Add material / buying item** for each specific component. Enter the quantity, unit and technical description; no stock or order state changes.
- Click **Purchasing / QA** on the item to map the contract source, review manufacturer/model and quote, record real owner approval within the verified internal budget, and only then record an actual supplier PO.
- Record delivery arrival separately from QA acceptance; wrong goods are rejected without entering stock.

## Verification scope and limitations

- Executed synthetic in-memory JavaScript scenarios during development (multi-level WBS, cross-job linking, demand queue, a single E-BOM occurrence in Purchasing, spec/source holds, archive prevention, JSON export/import, and cycle rejection).
- V0.5.0 Node test source is included at `tests/workplan-v050.test.mjs`; this record does **not** claim a complete Node CLI test suite or real Chrome/Edge interaction has run.
- The original project workspace in the owner's browser is private and inaccessible to GitHub. **No live-data reset or migration was performed.** The older schema remains compatible; new job and demand fields are optional.
- The browser-local workspace and six-digit convenience PIN are neither purchase-critical-grade persistence nor secure multi-user authentication. Protect the private JSON backup and test export/reopening before relying on the application for real purchases. No staff/customer accounts are enabled.
- Contract-controlled specification matching, owner approval and existing PO/QA controls are retained from V0.4.9. Manual work-plan requirements start unverified and do not waive those gates.
- Full acceptance on the owner's Windows browser is still required before this is considered working for the real project, especially persistence across standalone HTML version upgrades and UI forms/links at multiple depths.

## Owner's concise acceptance checks

1. Extract the ZIP to a permanent folder (never run from the ZIP preview). Open `SimWorx_Project_Hub_Complete_V0.5.0.html` in current Chrome/Edge. Confirm **V0.5.0** at the top.
2. Before any real-work edits, Settings → Download JSON backup to a protected private folder. Test any reset/restore **only against a copy**.
3. Create a disposable Blank project (or choose a disposable copy of an existing project). Add a work package, rename it, and create a job with a typed description.
4. Add child → grandchild → great-grandchild, and confirm the WBS numbers increase their depth. Edit their descriptions and owners. Confirm parent cannot be Done with incomplete children.
5. On a child job check Purchasing required. Open Purchasing: verify the unconverted job action appears, with no new PO.
6. Return to the job and add a clearly synthetic purchasing material with quantity 2, an unverified specification and no supplier quote. Verify one requirement appears in Purchasing and **no supplier order** is created.
7. Test linking an existing requirement; the engineering occurrence count must not increase. Edit the draft quantity and check history, then archive a disposable unapproved draft.
8. Download a new private backup. Open it as a candidate restore in a second copy of the app, verify job hierarchy and material link, then confirm no customer portal/public access is active.

**Do not use V0.5.0 to authorize or manage real six-figure purchasing until browser acceptance, backup read-back and source-to-contract verification are independently completed.**
