# Sim-Worx Project Hub V0.5.2 — Windows owner acceptance checklist

**Owner-only offline TEST release. Do not use to authorize or pay actual high-value orders.** Do all steps using fictional test data or a **separate copy** of your private workspace.

## Before launch / data protection
- [ ] Download `SimWorx_Project_Hub_Complete_V0.5.2.zip` from the V0.5.2 branch, choose **Extract All** in Windows and move the extracted HTML to a **permanent folder**. Do not run out of a ZIP preview / Downloads temp directory.
- [ ] Launch the HTML in current Chrome or Microsoft Edge and verify the visible top build label says **V0.5.2**.
- [ ] Keep the previous V0.5.1 HTML/ZIP. Don't overwrite old backups.
- [ ] In V0.5.1, download an unchanged **private JSON backup** from Settings. Save an independent copy offline/in an access-controlled location; never put it on public GitHub or send it in chat.
- [ ] In V0.5.2, use the existing Settings restore/relink controls; if you choose a file, verify it is the intended backup *before* confirming replacement. Use a copy initially.
- [ ] After restore, inspect 3–5 actual known work packages, orders, revisions, evidence files and stock figures against original records; no real data should disappear.
- [ ] Use Settings' local file read-back/recovery verification, if your browser supports it, and export an additional post-test backup.
- [ ] Simulate an invalid local copy on a **separate browser profile**, not your actual profile; confirm the recovery hold prevents a silent reset and accepts a valid restore.

## Work plan and source links
- [ ] Create a work package → job → sub-job → grandchild; the new editor appears under the correct parent.
- [ ] Add descriptions, exact technical materials, buying flags, drawings/spec revisions; open linked item through the Purchasing desk without retyping it.
- [ ] Confirm **Needs my attention** shows an unresolved buy flag until the linked real engineering item is entered.
- [ ] Open a job → acceptance/checklist panel, record exact acceptance tests, blocker/reason for delay, technical revision, estimated/actual hours. Repeat with a revised drawing and check history.
- [ ] Check predecessor readiness and material QA counts; an **ordered** item must not be treated as physically accepted.
- [ ] Confirm Done/ready work still requires actual human inspection and should not be inferred from optimistic status alone.

## Procurement, budgets and protection
- [ ] On a **fictional** new blank project, attempt to create a supplier order. Confirm the new PO is **blocked** pending strict purchasing activation.
- [ ] Under **Needs my attention**, record the owner migration review reference, explicitly activate strict future purchasing, then confirm a PO is *still blocked* without exact technical/source, model, supplier quote, budget and owner authorization.
- [ ] Enter an authorized fictional supplier order with a separate approval; repeat identical PO or exceed quantity/cost budget and confirm it is blocked.
- [ ] Try changing an existing PO's ordered quantity, price, SKU or quote directly; confirm the original purchase history is protected.
- [ ] Record supplier confirmation reference as its own event; it must neither create stock receipt nor invoice/payment.
- [ ] Record physical arrival and reject it in the QA step. No on-hand stock should increase from arrival/rejection alone.
- [ ] Record a separate valid accepted QA receipt; check accepted line quantity and outstanding delivery.
- [ ] Record an actual invoice reference with **wrong** unit price or higher quantity than net QA received. The three-way status must show an **unmatched exception**, not a paid invoice.
- [ ] Enter an invoice that matches the real recorded PO + net accepted QA receipt. Record a **fictional external** payment and verify no purchase or bank transfer occurs.
- [ ] Attempt duplicate invoice number, duplicate payment reference and overpayment; confirm validation stops them.
- [ ] Open an NCR on that PO line; the app should refuse further payment recording until a corrective action and retest are actually recorded.
- [ ] Verify budget, overdue delivery, missing invoice, rejected arrival, missing supplier confirmation, unresolved supplier quote, and NCR alerts appear in Needs my attention.

## Evidence & customer safety
- [ ] Upload a small private screenshot/PDF to a job. Open it again after a saved reload and a JSON backup/restore into a separate workspace.
- [ ] Upload a supplier order confirmation only against an **existing** matching engineering material + recorded PO line.
- [ ] Confirm an actual PO-line document cannot be archived away from historical purchasing evidence.
- [ ] Intentionally tamper with a **test** exported backup's evidence reference/checksum; restore should reject it without replacing the current workspace.
- [ ] Customer preview must remain **owner only**. Confirm no customer can log in.
- [ ] Individually allow a work package, review and redact a test photo, approve it for local preview. Change the job's technical revision; the photo must disappear until re-reviewed.

## Final go/no-go
- [ ] Run `node --test tests/*.test.mjs` in a trusted Node runtime from `project-hub/`. Record actual results, do not assume success.
- [ ] Confirm no browser console errors when switching between Work Plan, Purchasing, Supplier finance & NCR, Needs my attention, Settings and owner customer preview.
- [ ] Verify opening HTML directly from extracted file works without network; test offline browser and closing/reopening in the same permanent folder.
- [ ] Treat this as **NOT GO for live purchases** until secure auth, durable backed-up database, approval/signature controls, accountant-verified invoice/payment flow and genuine Windows test acceptance exist.
- [ ] Report any issue with the exact steps, expected/actual outcome, browser version and **fictional** example values; keep owner/project data private.

**Stop immediately if** a real prior record goes missing, a supplier payment or purchase is inferred without explicit human entry, an unauthorized PO succeeds, a modified invoice appears paid, an evidence reference changes or your test backup cannot be restored. Keep the original private backup unchanged.
