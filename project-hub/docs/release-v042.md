# Sim-Worx Project Hub — V0.4.2 release notes
**16 November 2026 · Local single-browser demo · €0 incremental cost · no production deployment**

## User-requested changes
- Simplified the main **Projects** page. The selected project appears immediately; users can switch using a selector, expand the full portfolio on demand, and use focused tabs for Work breakdown, Work register, Gantt, Assemblies, Procurement and Budget. The old legacy BOM/forecast, Documents and Client publishing screens are retained under a More selector.
- **Material requirements are now editable at occurrence level** inside Project procurement. Create a requirement, change its selected part identity without changing other occurrences, edit quantity, position and make/buy, archive (remove) and restore it. Add a new part master or edit an existing master SKU/name in the same workflow. Historical released manufacturing snapshots are not modified.
- **Budget allocation** is now operational in the project workspace, with planned budget, previously recorded expenditures, previously committed amounts, tracked new PO receipts and unreceived commitments, automatic headroom/overrun and portfolio finance aggregation.
- **Ordering/dispatch** stages: projects show Needs ordering from assembly BOM shortfall and inventory/PO coverage; newly created purchase orders show Ordered; Purchasing delivery cells offer Ordered / Out for delivery. Part received and Received remain quantity-derived. Marking an order Out for delivery does NOT alter stock.
- Foreign-currency orders are flagged and excluded from EUR forecast until a user enters an EUR-per-currency-unit conversion rate in the project Budget tab.
- Preserves all V0.3 planning and V0.4 manufacturing features plus V0.4.1 purchasing, stock allocation, tracking number and local proof-document features.

## Budget calculation
- The original project \`budget\`, \`spent\` and \`committed\` fields are preserved. They provide the adjustable manual baseline.
- Orders made with the V0.4.1 or V0.4.2 multi-line purchasing engine are included separately, based on the engine-generated purchase line ids or explicit origin. **Legacy orders are excluded** to avoid counting the old manual commitments twice.
- EUR PO received quantities contribute to estimated actual costs; unreceived quantities contribute to outstanding commitments. Receipts shift values between buckets without increasing the total PO forecast.
- Budget headroom = budget − (manual spent + manual committed + converted new PO received cost + converted new PO outstanding cost). A negative figure is shown as over budget.
- This is a project-planning estimate, not actual-cost/receipt-to-invoice matching or audited accounting. Manual costs must not include the new PO amounts or that would double count.
- Non-EUR orders are omitted until a conversion rate is entered and their omission is explicitly flagged.

## Verification completed
- 58 / 58 domain test functions (9 original model, 7 CRUD, 6 V0.3 scheduling, 10 manufacturing, 13 materials, 13 V0.4.2) passed in a JavaScript test harness exercising the connected repository code.
- 32 / 32 full-app page, subpage and interaction checks passed in an emulated DOM, including budget editing, material identity change, archive/restore, order dispatch and partial receipt accounting.
- A real browser smoke script, \`tests/browser-projects-v042.py\`, has been committed but **has not been executed** in this environment. A literal \`node --test tests/*.test.mjs\` run on a full checkout also remains to be run.
- The full offline HTML is a self-contained version of the entire app; the downloadable ZIP includes the same HTML plus source, tests and documents.

## Safeguards and known limitations
- All files written exclusively in \`project-hub/\` on \`feature/project-hub-v0.4.2-projects-refinement\`. Never deploy or merge automatically.
- No production site, server, CI workflow, credentials, payment config, Supabase, email, DNS or paid resources changed.
- Still only a single-browser localStorage demonstration with demo data. No server-side authorization, transactional multi-user stock reservations, verified expense invoices, private cloud attachment storage or secure customer login.
- Browser file origins may isolate localStorage. Export a private full JSON workspace backup in Settings before changing versions, Chrome profiles or file locations.
- Please inspect the project screen and test changing a part identity, archiving/restoring a BOM line, setting a budget, and switching a PO from Ordered to Out for delivery without changing inventory.

## Candidate V0.5.0
Implement QA checklists, inspection hold points, rework/non-conformance workflows and controlled internal approval links. Secure multi-user data architecture remains a separate explicit authorization and cost-gated decision.