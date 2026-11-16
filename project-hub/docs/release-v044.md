# Sim-Worx Project Hub V0.4.4 — internal offline build

**Development-only.** Branch `feature/project-hub-v0.4.4-durability-qa`. Based on V0.4.3 release `02071b42ca2d530ea6ba54c6b640f35adf8a6093`. Only `project-hub/` changed. No production deployment, external integrations, paid services, or confidential records committed.

## Changes
1. Settings: **Verify saved file matches browser** reads the selected local JSON back from Chrome/Edge's file-handle API. It compares backup content without volatile `createdAt`. A mismatch, permission issue, or oversized file raises a visible error.
2. A restored JSON backup **detaches an existing linked autosave file** before saving the new browser workspace. This prevents accidentally writing imported content to the previous project's file.
3. Buying schedule CSV: read-only occurrence-level export with order-by calculation, supplier/lead review flags and spreadsheet-formula safe quoting.
4. QA-gated external handoffs: accepted or rejected returns require notes, named reviewer, evidence reference; rejected work blocks downstream work until reworked, returned and accepted. All inspection decisions are retained in the stage history and in the supplier CSV.
5. Offline complete HTML bundle generated from current source modules. Legacy source modules and all previous app screens preserved. Header identifies V0.4.4.

## Verified here
- Exact V0.4.3 branch release SHA before branching and reviewed `PRODUCTION-SAFETY.md`.
- Modified modules pass V8 parsing checks with imports removed; no syntax errors from transformed functions.
- Synthetic file-handle test: write/readback succeeds; generated timestamp differences are ignored; a state mismatch is rejected.
- Supplier state transition test: return → reject → downstream blocked → resend → return → accept; inspection history and exported evidence references checked.
- Synthetic purchasing schedule: export has CRLF, flags unconfirmed zero-day leads, escapes spreadsheet formulas and does not create purchases.
- Offline bundle re-generated with 19 local modules, with all relative module imports present and no known private source-data markers.

## NOT verified / do not assume
- Real `file://` Chromium file-picker permissions, autosave under interrupted sessions, actual disk recovery after closing Chrome, and re-linking after moving to another HTML path.
- Full literal `node --test tests/*.test.mjs` suite and Playwright browser suite in a clean checkout. Prior 79/79 tests belong to the V0.4.3 baseline, not this release.
- Customer-specific private import in the owner's Chrome session. Private import file is delivered separately and **must never be committed to the public repository**.
- The evidence reference is metadata; no real document is attached by the supplier QA changes. Staff must retain source files offline.

## Owner Chrome recovery test (with test copy)
1. Export a backup of any existing workspace. Use a throwaway working file rather than the sole real project JSON.
2. Extract V0.4.4 ZIP. Open the full HTML in current Chrome/Edge; complete first-run staff login. Load the private JSON through Settings → Restore JSON backup and confirm the project and known counts without changing real statuses.
3. Settings → Create & link autosave file; save to a controlled private folder. Edit a test task. Click Verify saved file matches browser and record whether it passes.
4. Close and reopen the same HTML. Re-open the previously saved JSON through Open existing workspace file. Confirm edited task, private contract metadata, progress and purchasing rows still exist.
5. Open the same HTML copied to a *different* folder. Explicitly re-link the saved file and repeat the readback test. File permissions are origin-scoped and may need a new grant.
6. Test a **different** JSON restore while an autosave file is linked: the old file must remain unchanged. After restore the app should say no file linked.
7. If any result fails, stop using the file as the sole source of truth; export a separate private backup and capture the precise error.

## Pending design review
- Confirm vendor/quote/lead-time evidence for each actual procurement line, including whether a line is a purchased component or package; do not infer unit lead-time from 0.
- Associate approved task dependencies and required-by dates only after real planning is accepted.
- Keep an actual inspection document/photo in the chosen private folder and enter its unique reference; file bytes are not included by the new QA form.
- Assign progress weights manually. Do not infer date, payment, supplier delay entitlement, or approved internal budget from contract revenue.
