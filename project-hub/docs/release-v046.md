# Sim-Worx Project Hub — V0.4.6 release notes

**Type:** complete offline HTML + ZIP; development branch only.
**Based on:** V0.4.5 verified ZIP commit `5b9deaef0e55ed4963cdf714592b16a9b8ce46bc`.
**Development branch:** `feature/project-hub-v0.4.6-usable-project-control`.

## Decision rationale (industry and practical feedback)
- Microsoft Dynamics Project Operations uses a Work Breakdown Structure with tasks, owners, dependencies, start/finish and Gantt as the core project planning structure: https://learn.microsoft.com/en-us/dynamics365/project-operations/psa/schedule-project-work-breakdown-structure
- ERPNext separates Material Requests, RFQs, Supplier Quotations, POs and Receipts to avoid confusing planned demand with committed or received purchases: https://docs.frappe.io/erpnext/procurement-cycle-overview
- Odoo stores vendor product codes, supplier-specific pricing, and lead times against the product/vendor record and carries sourced references into purchasing: https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/purchase/products/pricelist.html
- Purchasing users describe trouble finding old closed PO prices/lead times, navigating many tabs, and reconciling supplier emails with orders: https://www.reddit.com/r/procurement/comments/17ab0w3/what_sucks_about_the_current_erp_system_that_your/

## Implemented
1. **Project Overview** redesigned as a four-stage command centre that puts task count, unassigned work, purchasing review, actual orders and manual progress up front. Zero-value internal budgets are labelled "Not allocated" rather than implying approved €0 purchasing authority.
2. **Work plan** primary project tab: all live tasks grouped under work packages; owner, status, start, due, editable actions, search and status/work-package filters. Existing Gantt and full work breakdown tools remain accessible.
3. **Buying review** primary project tab: engineering requirement rows with make/buy classification, supplier research, website URL, vendor SKU, quote reference, purchasing owner, notes, required-by, lead days and safety buffer. Editing saves locally with audit records. No automatic PO, stock, invoice, payment or project progress changes.
4. **Purchasing page**: conspicuous active-project heading, large selector, optional project cards, a clear sourcing-to-order process, supplier research list and actual purchase register.
5. **Purchasing responsibility** explicitly unverified until staff set it to Sim-Worx, customer-direct or subcontractor. The one-click PO preparation shortcut is only present for explicitly Sim-Worx-owned buying lines. Customer-direct items are never assumed to be an internal purchasing commitment.
6. **Supplier product URLs**: HTTPS-only, no embedded login credentials. Saved on individual requirement lines. Original links and vendor references can be carried into actual PO lines; PO links are independent snapshots so subsequent source edits do not rewrite order history.
7. **Per-line editing**: supplier source editor for every requirement, and actual PO line editor for quantity, unit cost, ETA, product URL, vendor SKU, quote reference, notes. Requires a factual amendment reason; preserves before/after revisions and refuses reductions below physically received quantity or rewriting a received unit price.
8. **Actual PO confirmation**: form reminds the user that clicking Record actual supplier PO means the order was genuinely placed/approved. PO creation still does not mark goods received.

## Data compatibility and privacy
- No schema breaking change. New optional `purchaseSource`, `purchaseSourceHistory` on requirements; `sourceOccurrenceId`, `productUrl`, `vendorSku`, `quoteRef`, `revisions` on PO lines.
- Existing records stay intact. Current private NOAA JSON import remains supported without regeneration. Imported requirements start as purchasing-owner "Unverified" unless specifically recorded.
- No credentials, customer agreement terms, customer name, actual money amounts or private project files committed to this public repository.
- All source changes confined to `project-hub/`. No hosting or other Sim-Worx app changes.

## Verification performed
- All affected JS modules parsed using V8, and a synthetic in-memory integrated workflow exercised task visibility, ownership separation, safe HTTPS URLs, independent supplier research, PO creation without receipt, line edit history and actual PO editing UI.
- Prior V0.4.5 signed in with owner PIN. This development work **does not** prove the new V0.4.6 runs on the owner's Chrome or recover a real workspace after restarting Chrome.
- V0.4.6 synthetic Node tests are committed for a clean checkout: `node --test project-hub/tests/*.test.mjs`. If not executed in a genuine Node checkout, do not claim a full regression pass.

## Owner acceptance test
1. **Back up** the existing browser workspace (Settings → Download JSON backup) before switching HTML versions.
2. Extract V0.4.6 ZIP to a normal, stable folder; **do not open HTML from within ZIP**, which creates a temporary extraction path.
3. Open V0.4.6 HTML in Chrome, unlock with existing six-digit PIN. If the NOAA project is not present in this file origin, restore the private JSON backup; verify you have only the intended real project, with no invented orders.
4. Projects → Work plan: confirm all imported tasks appear under their work packages, search a task, and try Edit without saving fictitious changes.
5. Purchasing: verify the large active project selector; inspect a line under Buying review, open Edit line. Save a trial source URL/quote on an expendable test copy, not on the sole real project. Check Open product website, then change supplier/URL and inspect source revision history.
6. Ensure saving a source line **did not create an actual purchase order**; confirm real POs remain at 0 until an actual supplier purchase is recorded.
7. On an isolated synthetic copy only, record an actual PO, edit its line with amendment reason, confirm its own website/quote persists, then record a partial receipt and verify receipt counters update only after that action.
8. Settings: save/verify disk file; close/reopen and relink, confirming planned source data persists.

## Known limitations / next iteration
- Offline single-user local browser storage is not secure multi-user auth, encrypted backup, cloud sync, or an ERP accounting ledger.
- Material requirement quantities are occurrence-level, while the uncovered stock figure may be part-wide across all occurrences; the UI explicitly warns not to sum repeated gaps.
- Vendor research links are staff-entered, **not supplier confirmations, available inventory, or approved quotes**.
- A recorded "actual PO" is a user record, not proof that an external supplier has received it. The app does not transmit orders.
- Rich quote comparison, approval gates, package UOM conversion, customer-direct responsibility from a verified signed contract, and automatic task-to-material date propagation are potential next phases requiring confirmed business policy.
