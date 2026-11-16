# Sim-Worx Project Hub — V0.4.9 engineering procurement audit and release notes
**Development build. Public generic code only. No real contract details or customer records in GitHub.**

## Release integrity and source
- Based on original `feature/project-hub-v0.4.8-team-workspace` head `b8a3fbb01368c721e482139fd10f4138e5df53d3` (not older release snapshot).
- Implemented solely under `project-hub/`; no production deployment, accounts, external services or new costs.
- New dedicated branch: `feature/project-hub-v0.4.9-purchasing-controls`.
- Complete offline HTML and accompanying Windows-compatible ZIP created from the updated 26-module dependency graph. Each module parsed in a JavaScript runtime before bundle generation; no missing dependencies.
- The ZIP uses standard ZIP store entries with checked local header, central directory, EOCD, file size and CRC-32. GitHub tree metadata confirms the committed ZIP SHA and size. **Not tested on a physical Windows PC or in an interactive browser session.**

## User journey
Project → Purchasing & materials → select contract-backed engineering requirement → controlled source and responsibility → supplier and quote → engineer technical comparison → department/owner and purchasing authority → actual PO → dispatched → arrived → QA acceptance/rejection → allocation and completion.
- One project-level workbench replaces the former competing sourcing tables. Historical actual purchase orders and linked receiving/returns are retained.
- Engineering requirement source can record controlling document, exact clause/drawing, revision and binding/indicative/provisional/pending/excluded classification. Any change invalidates the old technical review.
- Source responsibility includes Sim-Worx make, internal buy, buyer-direct payment while Sim-Worx integrates, customer-supplied, subcontracted and unresolved.
- No automatically inferred supplier agreement, quotation, order, warehouse receipt, invoice, budget or spend.
- In a contract-controlled project, an owner-entered purchasing authorization needs a current exact technical match, matching quote/supplier/model, approved project budget, assigned department/person envelope, maximum quantity, unit price and exchange-rate/tax assumption. Source/quote revisions invalidate approval fingerprint.
- Actual purchase-order creation checks authorization and project-wide open-sourcing quantities, price/quote/model matching, duplicate authorized amounts, total commitments and department budgets. Historical PO identity/price changes require a corrected order pathway rather than rewriting previously committed goods.
- Receiving continues to require explicit arrival and QA evidence; rejected goods do not enter stock; partial accepted receipts and supplier returns are preserved.
- Clear workspace now demands a **real read-back of a private matching backup** and a typed destructive confirmation; the previously linked autosave is detached before clearing. Local workspace reset was **not executed** by development.

## External industry review and borrowed patterns
1. **ERPNext** separates supplier quotation, PO, accepted/rejected physical receipt, supplier invoice and payment. Model these as separate documents and never count uninspected arrivals as usable stock: https://docs.frappe.io/erpnext/purchase-receipt
2. **Odoo** uses PO/receipt/vendor-bill matching; retain order, accepted quantity and invoice as distinct checkpoints: https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/purchase/manage_deals/control_bills.html
3. **Procore** presents project-specific supplier commitments, status, change orders and invoice information: https://support.procore.com/products/online/user-guide/project-level/commitments
4. **Microsoft Dynamics 365 Project Operations** links subcontract orders with product receipts and vendor invoice records: https://learn.microsoft.com/en-us/dynamics365/project-operations/pro/subcontracting/subconpurchaseorders
5. **Autodesk Build/Construction Cloud** centralizes documents, RFIs, submittals, quality, issues, drawings and project financial changes: https://help.autodesk.com/cloudhelp/ENG/Build-About/files/What_is_Build.html
6. **Oracle Primavera P6** supports resource-loaded logic schedules, leveling and multiple critical paths: https://docs.oracle.com/cd/G48902_01/English/User_Guides/p6_pro_user/leveling_resources.htm
7. **monday.com** has nested subitems, cross-level dependencies and Gantt; use selective depth and no redundant screens: https://support.monday.com/hc/en-us/articles/29810815287570-Multiple-levels-of-subitems-on-monday-com
8. **ClickUp** provides deep task hierarchies and adaptable management views; keep complexity below engineering procurement workflows and avoid nested-table overload: https://help.clickup.com/
9. **Community criticism is anecdotal:** some Procore users report expensive page reloads and dense interfaces (https://www.reddit.com/r/ConstructionManagers/comments/1ge1z4e/); some ClickUp users report difficult subtask reordering/performance (https://www.reddit.com/r/clickup/comments/1umoabi/issues/). An initial Procore thread complains of clutter/performance (https://www.reddit.com/r/ConstructionTech/comments/1gpduna/absolutely_done_with_procore/). They inform speed and navigation priorities, not market-wide claims.

## Test evidence (synthetic only)
Executed direct JavaScript domain-module scenarios against V0.4.9 source via a module loader in the GitHub development environment:
- unauthorized PO rejected;
- approved PO persisted with authority reference;
- duplicate sourcing/order rejected;
- post-order price rewrite rejected;
- wrong-model arrival rejected without stock increase;
- partial receipt added to available stock only after QA inspection evidence;
- full JSON workspace backup generated and parsed into equivalent order/receipt state;
- redesigned purchasing workbench rendered with linked requirement.
All eight operations above observed the expected results. A permanent `node --test` regression source file is included at `tests/procurement-v049.test.mjs`, but **the Node test suite has not been executed in an available Node runtime**. Full browser accessibility, Windows unzip, and long-session persistence checks remain outstanding.

## Unresolved purchase-critical risks (do not approve production use)
- Offline localStorage+optional JSON autosave has no authoritative server, immutable audit trail, transactional concurrent writes, strong permissions, or regulated access controls. A PIN is not a real staff/customer login.
- Owner authorizations are manually entered local records, **not cryptographic signatures or real supplier-issued purchase orders**.
- Full PO change-order and invoice/three-way-matching workflows, vendor-credit and supplier invoice reconciliation, multi-currency realized FX/settlement, tax/duties and actual spend ledger need separate work.
- Technical comparisons rely on accountable manual evidence, not automatic manufacturer datasheet validation.
- CAD drawing/version control, source image management, document hash verification, test evidence signoff, signed contractual variations, project RFI register and complete schedule critical path need more work.
- Actual user workspace is browser-local and was not accessible to the developer; a backup **cannot be claimed** until the owner exports and verifies it. Private contract and Annex 16 require source review outside the public repository. No project data reset/import executed.
- Imported private draft BOMs must be individually engineering-released. Indicative hardware references can overlap higher-level packages and are never automatic PO requirements.

## Next implementation gates
**P0 / before first real order:** owner Chrome/Edge acceptance, backup exported/read-back and off-device retention, final signed agreement/annexes, supplier quotes and approved drawings, real internal budget envelope, PO-document output, independent purchase approver check and source revision QA. Local prototype should not authorize high-value actual purchases.

**P1 / operational correctness:** transactional private server/database, append-only versioned order/change ledger, goods-received-not-invoiced, supplier invoice 3-way match, returns/credits/replacements, line-level cost center commitments, partial deliveries/serials, QA evidence and supplier/stock reports.

**P2 / scale:** strongly authenticated employee permissions, customer publication allowlist enforced server-side, private encrypted file store, recoverable backups and restore drills, issue/RFI registers, constraints/critical path, API integration only with approval.

## Owner acceptance quick path
1. Open V0.4.9 HTML on a copied/test browser profile; check version badge and preserve original V0.4.8 and original JSON backups.
2. In Projects → Purchasing, select one synthetic requirement and map the controlled source. Changing its source must invalidate prior technical match.
3. Assign responsible department/person in Team & budgets; set a **test-only** project purchasing budget and IT envelope.
4. Enter synthetic supplier/quote/model, evidence comparison and owner authorization. Verify rejection of wrong supplier, exceeded amount/quantity or unapproved spec.
5. Record test PO and physical arrival; reject wrong goods; accept only a matching inspected quantity. Check stock and outstanding balance.
6. Export private backup, choose the actual downloaded file and verify it in Settings. Confirm reset is blocked before verification; **do not actually clear the live workspace**.
7. Verify project/navigation, make-vs-buy, work hierarchy/sub-jobs, evidence, historic orders and stock returns.
