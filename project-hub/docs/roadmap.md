> Current baseline: **V0.3.0**. See `release-v03.md`.

> Current baseline: **V0.2.0**. See `industry-audit-v02.md` and `release-v02.md`.

# Development roadmap

**V0.1 (current):** visual interactive local/demo-first platform with multi-customer, work, inventory, cost and customer projection modules. All data fictional. Email/storage/auth disabled.

**V0.2:** UI review; template editor, subassemblies and component workspaces, task dependencies, milestones, per-project timelines, richer filters, project-specific material requests and revision workflows. Fix browser issues found in cross-device testing. Still no production data.

**V0.3:** seek approval for an isolated backend; create reviewed project-hub-only migrations, granular RLS, Auth, scoped customer invitations, private files, server-side stock movements, publication review, immutable approval revisions, audit records. Full negative-role tests required.

**V0.4:** complete multi-line purchase orders, partial receipts, reservations, cost reconciliation and customer dashboard access; implement real document upload validation, preview-as-role tool and notifications. Email only if a no-extra-cost dedicated sending route is verified and authorised.

**V1:** browser E2E, role isolation, load, concurrent stock, revocation, backups, data retention, deployment diff and security checks. Explicit approval required for any production hosting path or merge.

Deferred after V1: job time tracking, QR/barcodes.

## Do not infer readiness

The pages in V0.1 are not a replacement for real authentication, multi-tenant permissions, customer onboarding or production manufacturing accounting. The demo is useful for product design, not for commercial data entry.
