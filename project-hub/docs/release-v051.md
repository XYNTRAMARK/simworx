# Project Hub V0.5.1 — work-plan evidence, nested jobs & workflow audit

**Status:** owner-testing candidate, offline only. **Project data reset:** none. **Public repository:** generic source and synthetic test data only.
**Development branch:** `feature/project-hub-v0.5.1-evidence-and-guidance`; inspect live head and release artifacts rather than relying on a copied SHA.

## Changes implemented

- When **+ Sub-job** is clicked on an existing job or sub-job, the creation form appears directly after that row, with the selected parent fixed and its full work-package breadcrumb visible. Any-depth nested WBS remains supported.
- **Details** is highlighted whenever a job has substantive description, purchasing instructions, linked materials or job photographs/evidence. The Work Plan includes short hover/focus question-mark explanations of its core terms.
- A private **Photo / proof** link is available on a material in the job view. Job Details supports attaching photographs/screenshots/small PDFs as supporting evidence. The same material-specific attachment appears inside the purchasing requirement; it is not duplicated into a separate "shopping list".
- A document called an **order confirmation** or **receipt / supplier invoice** is accepted only if it is attached to a previously recorded supplier purchase-order line for the exact engineering material. Attaching evidence never marks the PO approved/paid, changes stock, or advances an order stage.
- **Customer preview:** private by default. To show one image, the owner must allow its work package, individually confirm the image is redacted, enter a reviewer and an appropriate customer-safe caption. Only the reviewed photo and safe caption appear in the local preview. No original PDFs, order amounts, internal filenames, invoice details, supplier names or private notes are projected. The approval can be revoked. **Customer login is not enabled; this is not actual publication.**
- Archived jobs/materials cannot orphan active job/material evidence; attachments can be archived with an auditable record. Existing project-photo gallery attachments remain accessible inside the related job as legacy photos.
- Stronger explanatory text and hover tooltips for work packages, technical specifications, job owners, budget envelopes, PO, QA, receipts and revision terminology.

## Business-process audit — industry patterns

We reviewed existing code for `src/workplan-v050.mjs`, `src/workplan-ui-v050.mjs`, `src/work-evidence-v051.mjs`, `src/procurement-workbench-v049.mjs`, `src/materials-v041.mjs`, `src/team-workspace-v048.mjs`, `src/app.mjs`, customer projection and private backup logic.

- **ERPNext:** Purchase Order, Purchase Receipt, Purchase Invoice and Payment Entry are distinct objects; inspection gates stock acceptance and rejected quantities stay outside usable stock. [ERPNext purchase receipt](https://docs.frappe.io/erpnext/purchase-receipt) and [inspection](https://docs.frappe.io/erpnext/quality-inspection)
- **Odoo:** three-way match between purchase order, goods receipt and supplier invoice is a distinct control before paying; an invoice should not be inferred from an order or an attached receipt image. [Odoo vendor bill controls](https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/purchase/manage_deals/manage.html)
- **Procore:** photos work best when attached to real project records (drawings, observations) and visibility is explicitly managed. [Procore photo documentation](https://www.procore.com/project-management/photos)
- **Practitioner feedback:** too many steps and data entered repeatedly produce poor software adoption, even when the tool has many features. Prefer one job-first source of truth and short paths to purchasing. See [construction managers discussing adoption](https://www.reddit.com/r/ConstructionManagers/comments/1l1ez8e/why_do_tools_like_procore_and_autodesk/) and [PM tool complexity discussion](https://www.reddit.com/r/projectmanagement/comments/1nssu4s/sick_of_pm_tools_bragging_about_features_nobody/).

### Priority risks and proposed next implementation

**P0 — production reliability and purchasing safeguards**
1. **Offline storage:** localStorage and unencrypted single-file JSON are not adequate as the sole system of record for six-figure purchases, dozens of photographs, several operators or live customer files. Design a private durable transaction store, immutable revisions, access logs, recovery drills and backup checks. Do NOT deploy cloud services or incur costs without owner consent.
2. **Purchase control on EVERY real project:** current strict technical/budget PO gate is activated for contract-controlled projects. Review and explicitly gate all new projects, including manually created projects, before allowing real supplier transactions. Existing demo/legacy records require careful migration to avoid false orders.
3. **Financial stage separation:** current evidence supports documentation but is NOT a verified supplier invoice register or payment ledger. Implement manual PO → confirmation → delivery → QA → invoice → three-way comparison → payment record, using evidence references and unmatched-exception alerts. No uploads should create financial statuses.
4. **Evidence retention:** attachments are embedded and size-limited, and may consume local browser quota quickly. Design a scalable private attachment store with hashes, durable originals and change/revocation history; maintain strict default-private sharing.

**P1 — engineering work and usability**
5. **Material shortages and blockers:** make job/sub-job dependency reflect whether its required approved component has been ordered, delivered and QA-accepted; do not mark a job ready if a required input is blocked. Add manual override with explanation, not automatic completion.
6. **Daily triage:** a single Project "Needs my attention" feed for unassigned jobs, unconverted buy flags, pending owner approvals, overdue materials, rejected deliveries, mismatched supplier products and overdue tasks, each linking to its source record.
7. **Quality and changes:** add explicit NCR (nonconformance) / rework action records tied to inspection, responsible owner, corrective action, retest and sign-off. Add formal drawing revision/change requests preserving the contractual specification.
8. **Task criteria:** configurable acceptance checklist (what Done means), estimated work hours vs actual, optional milestone and schedule dependency details; no fabricated estimates.
9. **Real customer publication:** retain disabled until access control, authenticated identity, per-document share permissions, revocation and a server-side sanitised projection are built and approved. Local preview is not customer access.

**P2 — operator quality of life**
10. Context-specific inline "?" help, a central searchable glossary, keyboard-friendly add-child flows, collapsible WBS trees, batch task editing and optional templates for quote review, receiving QA and SAT/FAT.
11. Consistent project tabs, warnings with direct resolutions, and fewer duplicate entries across Inventory, Materials and Project pages. Preserve one engineering requirement identity.

## Testing performed

Synthetic in-memory JavaScript scenarios executed for: nested subjob form under the clicked parent, populated Details highlight, job/material evidence, no fake purchase or stock movements, enforced actual PO reference for supplier order confirmation, double opt-in customer preview with redaction, original private metadata excluded from projection, revocation, archived-material safety, and JSON backup/restore. Test source: `tests/work-evidence-v051.test.mjs`.

**Not completed:** Windows Chrome/Edge end-to-end test with real local files, complete CI/Node test suite, large-file storage/quota tests, all upstream legacy regression tests, external customer access or live purchasing approval. Never claim the app production ready based on these synthetic checks.

## Owner acceptance

1. Download and **Extract All** from the complete ZIP, open HTML and verify V0.5.1.
2. Privately backup the existing workspace before switching files. Test on a disposable project or backup copy, not the real contract.
3. Click + Sub-job on MIP: the form must say it is a child of MIP. Save. Click + Sub-job on that new child: the next child must appear at a deeper WBS number.
4. Add a detailed job description, confirm Details highlights. Add a screenshot to a job and a specific material, then open Purchasing and find that same attachment.
5. Flag a job for buying: Purchasing should show the need but zero new POs. Add a specific material and see it in the buying list.
6. Attempt to attach an order confirmation without a real PO; it must refuse. For a disposable **actual recorded** synthetic PO, attach order evidence to the correct line, confirm stock and paid status remain unchanged.
7. Confirm images default to private. Allow the work package in Customer preview, review a REDACTED photo and its safe caption; confirm it appears in **owner-only preview**. Revoke and verify it disappears. PDFs must not be eligible.
8. Export a new private backup, restore into a separate disposable copy and verify job hierarchy, photos and customer preview flags survived.

> Do not import confidential source documents or reset the live project without a verified private backup. Never treat the offline PIN as real staff authentication.
