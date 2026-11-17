# Sim-Worx Project Hub — V0.5.2 safety / attention release

**Date:** 17 November 2026  
**Repository:** `XYNTRAMARK/simworx`  
**Source branch:** `feature/project-hub-v0.5.1-evidence-and-guidance`  
**Work branch:** `feature/project-hub-v0.5.2-safety-attention`  
**Scope:** `project-hub/` ONLY; no production deployment, integrations, owner data, imported contracts or live supplier records touched.

> **Classification: OFFLINE OWNER-TESTING RELEASE; NOT APPROVED FOR HIGH-VALUE REAL PURCHASING.** The app is a local HTML/browser workspace. It has no authenticated financial authority, secure backend, independent approval, encrypted attachment store, accounting reconciliation or reliable multi-user record locking. A local 6-digit PIN is *not security*.

## Independent audit findings and changes

| Severity | V0.5.1 risk / finding | V0.5.2 disposition |
|---|---|---|
| Critical | POs on ordinary manually created projects bypassed controlled specification/owner-budget gate | New POs and adding order lines fail closed unless controlled purchasing is deliberately activated per project. Activation preserves historical orders and does not authorize them. Each future PO still requires exact technical review, sourcing, department allocations, project internal budget and separately recorded owner authorization |
| Critical | Historical uninspected bulk receipt path remained accessible for uncontrolled projects | Disabled the UI's generic `receive-po` action. Use original arrival and QA-acceptance workflow; **no goods are received from photos**. Server-side enforcement remains a prerequisite for production |
| High | Legacy supplier PO financial/product values could be overwritten | Recorded quantities, price, supplier SKU/quote and product identity can no longer be edited in place, whether project was previously controlled or not. Correct via documented close/amend/new authorized order; ETA/note changes retain revisions |
| High | JSON restores did not check evidence MIME, ownership or PO-line links | Recovery now validates MIME/signature, permitted data URLs, file sizes, duplicate IDs, project/job/material/PO-line links and FNV-1a checksums for newly added evidence. Old evidence without checksum is accepted after structural checks; checksum is NOT tamper-proof |
| High | Customer photo review could persist after technical specification/job revisions | Only per-image, owner-reviewed/redacted images on allowed work packages show in **local owner preview**; any related technical/work revision changes its compact fingerprint and removes it from projected view until re-approved |
| High | Actual PO evidence could be archived out of active records | PO-line-linked attachments now refuse archive; their historical references persist |
| High | Corrupt browser data silently loaded a blank workspace, risking overwrite | Startup holds unreadable stored data intact. After local PIN unlock, an emergency recovery screen offers private raw export and verified JSON restore. Saving is blocked until recovery |
| High | Local saving could store unvalidated attachment references | Every save now validates private backup integrity *before* writing local browser records; new operational forms update a cloned draft and roll back on failed saves |
| High | No consolidated actionable queue | New **Projects → Needs my attention** derives source-linked alerts (unassigned/overdue/blocked jobs, buy flags, missing model or quote, purchasing approval gate, budget/FX anomalies, missing supplier acknowledgement/invoices, late/rejected/awaiting-inspection deliveries, NCR and invoice/payment mismatches). Alerts are not copied into another register |
| High | No separation of supplier confirmation, invoice and payment | New manual registers under **Projects → Supplier finance & NCR**: PO acknowledgement reference; independently entered invoice per PO line; read-only three-way check of actual PO price/qty, net QA receipts and invoice; manually recorded external payments permitted only when matched and no open linked NCR. Nothing sends a bank transfer or places an order |
| Medium | No integrated quality/corrective-action register | NCR opened against exact job, optionally exact PO line; explicit corrective action, responsible owner and separate retest/closure evidence. Linked open NCR prevents new payment record |
| Medium | Missing explicit per-job completion criteria and effort | Work-plan job details include acceptance checklist, blocker and delay reason, current drawing revision, estimated/actual hours, revision history, read-only dependencies and conservatively reported QA-accepted material quantity |

**Intentional conservative boundary:** ordinary/source-unreviewed projects can still manage jobs and inspect old history, but cannot record *new* supplier orders until the owner manually enables strict controls. Activation is not an order, buyer signoff or quotation approval.

## Financial semantics

The local ordering workflow intentionally distinguishes:

1. **Engineering requirement** and purchasing flag — need, not authority.
2. **Technical comparison** and controlled source revision — proposed compliant specification, not an order.
3. **Separate owner approval** — internally recorded authority bounded by supplier/quote/price/quantity/budget, not supplier acceptance.
4. **Supplier PO** — locally recorded actual order; no transmission.
5. **Supplier acknowledgement** — actual supplier confirmation recorded separately, not derived from PO or upload.
6. **Physical arrival and QA** — only explicit accepted receipt contributes to stock/net accepted quantities.
7. **Supplier invoice** — actual document entered separately, can be *unmatched*. No accounts payable or tax posting occurs.
8. **Three-way comparison** — conservative price/tax/currency/quantity check, no automated bank action.
9. **Recorded external payment** — owner-entered reference of a real independently verified transfer; no banking integration or payment execution.
10. **NCR/corrective/retest** — exception control, not an implied replacement shipment.

This reflects the independent separation of PO, receipt, invoice and payment used by ERPNext and Odoo's three-way matching. References: 
- https://docs.frappe.io/erpnext/purchase-receipt
- https://docs.frappe.io/erpnext/buying
- https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/purchase/manage_deals/control_bills.html

## Real operator friction research

Engineering/field software users complain about excessive clicks, repeated updates, loss of filter or scroll context, and slow-to-enter data. We therefore place alerts, work criteria and supplier records *inside the existing project*, point alert actions at underlying source records and keep manual intervention on factual events only; we did not add a second disconnected shopping list.
- https://www.reddit.com/r/ConstructionManagers/comments/1kpy1s8/
- https://www.reddit.com/r/ConstructionManagers/comments/1ge1z4e
- https://www.reddit.com/r/agile/comments/1l6lnao/whats_your_infuriating_moments_in_jira_linear/

## Technical QA executed / limits

- **Executed:** 26 synthetic source-function assertions in JavaScript V8 (module bodies compiled with injected imports) before final review. All 26 passed: strict gate activation, duplicate confirmations/invoices/payments, three-way mismatch/accepted returns, NCR payment hold, QA-only quantity, backup evidence ownership/malformed MIME, customer photo approval and invalidation, source-linked attention/operations markup. See `tests/ops-v052.test.mjs` for repeatable Node tests.
- **Executed:** JavaScript syntax compilation of modified V0.5.2 modules; passed at audit time. Final standalone bundle/module dependency and ZIP byte-level structural verification described in packaging results.
- **Not executed here:** `node --test tests/*.test.mjs` (no checked-out GitHub repo in a Node-capable runtime in this tool session), Playwright/real Chrome browser, Windows local HTML opening, actual file-system picker, restored private owner's real data, external supplier reconciliation, production penetration/security tests. Owner should not treat missing runs as passes.
- **Private data:** none committed; all test names/images are synthetic only.

## Known residual blockers for live purchasing — severity Critical

1. Browser `localStorage` and manually selected JSON file are **not a transactional, encrypted, access-controlled database**; system is single-computer, vulnerable to deletion/storage quota/corruption; no multi-user conflict resolution.
2. One client-side PIN is not authorization. Need real named login, least-privilege roles, independent approver and server-enforced immutable controls.
3. The UI labels manually recorded owner approval and payment truthfully but **cannot verify who approved or whether supplier/bank events actually happened**. No digital signatures, externally verified PO delivery or bank settlement.
4. Supplier invoice register currently supports **one invoice reference per PO line**, not multi-line vendor bills, deposits, service invoices, credit notes or complex tax allocation; do not use as a statutory accounting ledger.
5. Historical POs created prior to stricter gates remain visible but are not retroactively verified. Each must be reconciled against supplier originals and actual accepted stock before relying on it.
6. Evidence remains limited to compressed images / very small PDFs with per-project limits; FNV checksum catches accidental alteration but does not authenticate a document.
7. Actual browser/Windows ZIP acceptance and full Node test suite still require execution. Test your own backups on a separate copy before relying on any new release.
8. Source and delivery links here are in a **public repository**; NEVER upload owner workspace backups, contracts, invoices, IDs, pricing, credentials or real photographs to the repo.

## Next engineering priorities

1. Migrate safely to a local/encrypted database or properly authenticated backend (needs owner approval on architecture/costs). Create immutable event/audit records, actual append-only PO amendments, named roles, distinct financial signatories and backups with retention plus restore drills.
2. Model multi-line supplier invoices, credit notes, payment allocations and reconciled currency/tax totals; do not confuse self-recorded transfers with verified bank settlement.
3. Harden work-package acceptance gates, QA retest vs receipt, material allocations and supplier lead-time forecasting; add dedicated exception approval histories.
4. Improve collapsible WBS, keyboard navigation, preserved scroll/filter context, bulk review actions and actual workflow usability tests on Windows.
5. Design separate customer data projection + secure permission-bound portal only after explicit owner approval.

See `OWNER_ACCEPTANCE_V052.md` before any replacement of your existing workspace.
