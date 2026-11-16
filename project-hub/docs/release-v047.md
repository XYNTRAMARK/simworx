# Sim-Worx Project Hub V0.4.7 — staff-only offline release

**Base release:** V0.4.6 commit `eb48fa5c81ef86ac3b40c3ad146cf99e27def895`.
**Development branch:** `feature/project-hub-v0.4.7-order-spec-workflow`. **No production deployment or merge.**

## Owner-reported usability defects addressed
- Work-section headings blended into task rows. Distinct palette accents, tinted backgrounds, numbering and stronger borders now separate each work package.
- Purchasing did not provide understandable live transitions. Each material requirement now has an Action control and can be dragged into a **planning** lane with a required reason. Planned stages are separate from facts: an order requires a real PO; delivery requires actual evidence; accepted stock requires a receipt.
- Wrong items must be rejected or replaced without erasing history. Physical arrivals now enter an inspection queue with no stock increment. Rejection records inspector, reason and evidence, retains the original PO and flags replacement. Accepted arrivals record a receipt, adding stock only then.
- Supplier-agreed cancellation of outstanding PO quantities closes the **unreceived balance**, preserving original order and receipts, with a required reason and reference; it restores purchasing demand. Closed balances may be reopened with a second supplier confirmation. Replacing a product with a new vendor/model requires another PO after spec check.
- Browser file URL indicated temporary ZIP extraction; the application now warns users to run from a stable extracted directory.

## Specification safeguard — intended limits
Imported contract-projects are detected from existing `dataProvenance.type='contract-initialization'`. The software displays locally retained part master notes, engineering requirement notes and source references, and **refuses a new internal PO** until staff record the exact proposed model, a matching-specification decision, reviewer and evidence reference. It blocks deviations, unverified purchasing ownership, source changes, supplier mismatch and purchases exceeding uncovered requirement quantities.

**The code cannot read or authenticate the signed PDF, approved drawings or a manufacturer's datasheet from a remote site.** Its specification check is a deliberate **manual gate with traceable evidence**, not an automated engineering certification, legal assurance or substitute for customer approval. Do not mark it passed without comparing critical performance and compatibility criteria to the controlled original documents and approved drawing revisions. Genuine deviations require the separate contractual change order/engineering review process before resetting the specification baseline.

The private NOAA PDFs, supplier data, project JSON and customer commercial terms are **not bundled or committed**. Only user-entered generic application source is public.

## Workflow rules
1. **Research / RFQ / Quote / Hold / Change requested / Replacement requested** — planning actions are auditable and may be moved backwards; no real supplier orders or stock implied.
2. **Ordered** — requires an explicit real PO, own purchasing responsibility, contract spec review when controlled, and supplier/URL/SKU match. A confirmation dialog warns that the supplier order must truly exist.
3. **In transit** — an existing PO must have a recorded shipment; no inventory change.
4. **Arrived** — actual delivery reference and count recorded in incoming inspection, no stock change.
5. **Accepted** — requires arrival/QA inspector/evidence on a contract controlled project, then updates the existing receipt and stock ledger.
6. **Rejected** — inspection evidence and reason required; no stock change; replacement requested. If already physically accepted, record a real supplier return when shipped out; never erase the receipt.
7. **PO closed balance** — used only when the supplier has confirmed cancellation/non-delivery. It changes uncovered demand, not historic received stock, and is not sent to the supplier by this offline app.

## Tests
- Synthetic V8 integrated source tests checked contract PO block, source evidence, verified PO, duplicate over-order prevention, no stock on arrival, wrong-goods rejection, supplier balance closure, replacement spec invalidation, corrected PO and accepted receipt. Work-package colour classes, status actions and drop-lanes render in the project control HTML.
- Additional Node test source: `tests/projects-v047.test.mjs`. Full literal Node tests and real Chrome persistence **still require checkout and owner's browser acceptance**.
- Complete offline HTML/ZIP built exclusively inside `project-hub/`, PIN and original modules retained. Archive is verified from GitHub before owner release.

## First-run acceptance (owner)
1. Save a private JSON backup from V0.4.6. Extract the new ZIP fully to a permanent directory, not to a temporary ZIP viewer.
2. Open V0.4.7 HTML, unlock with same PIN, load/relink your private JSON. Do not put it in public GitHub.
3. Projects → Work plan: confirm clear coloured work package bands around all imported jobs.
4. Purchasing → choose project. Open a test requirement, verify the controlled spec notes and mark the test candidate as non-compliant to see the order action blocked; do **not** falsely mark a real part compliant.
5. On a disposable copy only: enter a fictional research quote and test moving a line to RFQ and back by Action/drop lane with reason. Ensure no PO appears.
6. Simulate a *synthetic* verified PO, arrival, rejection and corrective PO; check inventory changes **only** when a genuinely accepted receipt is entered. Do not record fictional supplier orders in the actual live NOAA project workspace.
7. Settings: download/verify saved workspace and re-open in Chrome after closing tab; this remains an unverified owner-side acceptance step.

## Deferred
- Real supplier integrations, approval signatures, automatic product-versus-PDF technical extraction, graphical line rearrangement, account roles and secure database sync require explicit future scope and verified data; none have been fabricated or deployed.
