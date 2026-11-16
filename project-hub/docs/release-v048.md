# Sim-Worx Project Hub — V0.4.8 owner-managed project operations

Development branch: `feature/project-hub-v0.4.8-team-workspace`. Base: complete V0.4.7 release commit `a15be9cc9b4562512db3b6a790988fc1fe58d335`.
Scope: `project-hub/` only; no production deployment or integration. This is a full offline HTML + ZIP release.

## Implemented
1. Project tabs reorganised around **Overview / Work plan / Purchasing & materials / Team & budgets / Photos / Schedule / Supplier QA / Progress / Budget / Contract**. Removed duplicate top-level Buying review. Its historical route remains as an alias, while the full operational Purchasing renderer lives under the selected project. The global Purchasing sidebar still works for compatibility.
2. Work plan retains work package colours and nested tasks, and adds **+ Job in section** to each section header and **+ Sub-job** on each job. Description is saved on the task model and appears beneath its title. Department choices now include IT, Engineering, Electronics, Visual Systems, Mechanical alongside original Office, Workshop, Purchasing and Quality. Planned finish may be left blank.
3. Added private `departmentAllocations`: project-specific budget envelope, named internal person/role, department, notes and audit history. Allocation entries cannot exceed the verified internal project budget. Team tab shows allocations, recorded linked open PO commitments, receipt value, department workload and remaining envelope; currency conversion must be supplied to compare foreign currency POs. **This is tracking only, not enforced per-PO department authorization.**
4. Materials can be assigned to department, responsible person, and optional task of that department. Existing source specification and PO/receipt safety controls remain unchanged.
5. Added private `projectEvidence` records: uploaded images are compressed in Chrome (max 1000px and ~300KB encoded) and placed under a project work package/task. Gallery has section filter; owner can archive. Images are contained in localStorage/JSON backup (no cloud, costs or external hosting). Source photos should be kept separately.
6. Added `customerShareRules` per work-package and a local owner-only future customer preview; default is **nothing visible**. Preview projection emits only chosen section title, an owner-written safe summary and a withheld-progress placeholder. This is **not an operational client portal** and is not served over the internet. True customer account security requires server-side authenticated access and row-level authorization.
7. All editing remains behind the existing single-owner convenience PIN. Staff/customer accounts are **disabled** and no production account creation occurs.

## Focused verification
- V8 syntax checks passed for all changed modules before packaging.
- Synthetic in-memory integrated tests passed: described sub-job, hierarchy display, section Add job button, budget allocations and over-allocation block, IT responsibility link, team page costs, private photo attachment and gallery, customer preview with allowlist default-deny, and full Purchasing page inside a project.
- Added source-level Node regression file `tests/projects-v048.test.mjs`; it is not a claim of execution in a full Node checkout.
- Complete single-file HTML bundle will be compiled with updated modules + CSS; archive will be verified after upload to GitHub.
- Not yet tested in owner's real Chrome (including local storage recovery, photo persistence, multi-project tab switches or mobile layout).

## Important limitations / next engineering audit
- Department budget envelopes are not purchase authorisations: a PO can still be recorded without a departmental approval check. Implement approval and overspend gates after confirming decision authorities.
- Existing project-private records are in unencrypted browser storage and exported JSON. PIN is convenience access only.
- Compressed photos increase JSON size and can exceed localStorage quotas; enforce limits, display usage, and consider private local file references with lossless backup export.
- No secure cross-PC/multiuser concurrent editing, no server authentication, no real employee credentials, no customer portal. Do not misrepresent an offline preview as access control.
- Real order/QA status is derived from actual orders, shipment and inspection; no fabricated orders, supplier confirmation or accepted stock.
- Private contract requirements are local data, not copied into GitHub. Specification gate is staff-recorded comparison, not independently authenticated vendor compliance.
- Explore workflow and UX consistency in every project tab, particularly Work plan ↔ Purchasing ↔ Team budget ↔ Schedule ↔ Evidence ↔ QA ↔ Customer preview and whether a user can return to the same project without getting lost.
- Some old sidebar routes and legacy project tabs deliberately remain for backward compatibility; consolidate only after regression tests and no feature loss.
- Run full Node tests (not just syntax/in-memory), Chrome persisted-state tests, export/restore, archived records, multi-project isolation and employee/manager scenario checks.
