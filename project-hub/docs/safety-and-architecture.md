# Isolation, architecture and release safeguards

## Immutable existing boundaries

Production repository: `XYNTRAMARK/simworx`, currently public. Existing website root, `admin/`, `portal/`, `assets/`, `projection/`, `reports/`, `.github/workflows/`, `PRODUCTION-SAFETY.md` and all other existing files remain unchanged. Never deploy repository root or sync/delete live `/htdocs/`. Existing website suffered an earlier whole-site FTP overwrite, documented in its `PRODUCTION-SAFETY.md`.

Project Hub is a self-contained `/project-hub/` application on a feature branch. Do not merge, deploy, edit CI, touch DNS, modify existing Supabase resources, create paid resources, or send emails without explicit authorisation. The static prototype has no credentials and no contact with external services at all. Store no real customer documents in public GitHub. Rollback is simply ignoring/deleting the separate feature branch and local folder; nothing in production changes.

### Workflow audit (read-only, 12 Nov 2026)

The repository contains 188 `.github/workflows/*.yml` files. Existing workflows were examined for triggers. Most have `workflow_dispatch` or `push` filtered by `main` and non-Project-Hub paths. Three known workflows do not restrict to `main`, but all have explicit path filters excluding `project-hub/**`: `base44-site-sync.yml`, `base44-sync-from-temp.yml`, and `projection-prune.yml`. There was no existing Project Hub path workflow in the scanned tree. This supports limited new-folder commits on a new feature branch. Re-check triggers if workflows change before any subsequent push.

### Before each commit

1. Confirm branch is `feature/project-hub-foundation` (never `main`).
2. Confirm all changed paths start `project-hub/` and no existing workflow path or root file changed.
3. Re-check trigger risk and sensitive data in the exact diff.
4. Run Node tests and JS checks. Verify linked application views manually in a local server.
5. Do not merge or deploy automatically.

## Logical tenant model for production

Use the following relationship as the basis for reviewed migrations, **only after the backend is approved**:

`customer_organisations -> customers_people -> scoped_org_roles` and `customer_organisations -> projects -> project_sections -> work_packages -> jobs`. Separate `project_memberships`, `customer_scope_grants` (org+project+section+action ceiling), `client_publications`, `client_approval_requests`, `client_approval_decisions`, `document_revisions`, `client_document_grants`, `conversations`, `message_recipients`, `audit_events`.

For manufacturing, `part_master -> project_bom_lines`, `suppliers`, `purchase_orders -> purchase_order_lines -> receipts`, `stock_locations`, `stock_movements`, `stock_reservations`, `job_material_issues`. For financials, `project_budget_versions`, `project_cost_entries`, `project_commitments` and currency assumptions. For onboarding and notifications, `invites`, `notifications`, `notification_preferences`, `email_outbox` (disabled until an approved provider is configured).

### Required authorization properties

- Customers see only rows where organisation + specific project membership + item disclosure grants all agree.
- Being a customer admin allows delegation only inside an explicit maximum permission ceiling; accepting an invitation revalidates current scope.
- Internal cost, supplier quote, budget, unpublished task, stock or audit data are never selected by customer APIs.
- Store published customer snapshots in separate allowlisted tables/views, not mixed internal rows with a client-visible boolean.
- Keep file content in private Storage with path-scoped policies and short lived signed URLs. Version and scan/validate uploads, never trust public object metadata.
- Revision changes invalidate prior approvals and force a new decision. Approval events are immutable audit records; not a qualified signature.
- Stock reservations and issues require atomic database transactions or server-side checks with locks; local JS guards are insufficient for simultaneous users.
- Enforce RLS on every exposed table, including update `USING`+`WITH CHECK`, valid authentication & matching owner/project scope. Never expose secret/service keys to the client or use user-writable JWT metadata as authorization.

### Cost/hosting decision

Current Supabase organization was read as Pro, with an existing `SIMWORX SUPPORT PORTAL` project. A separate Supabase compute project would produce an extra ongoing compute charge. Reusing the support database is not authorized and would share a failure domain. **V0.1 runs locally at €0 marginal cost**, and no resource mutations have been made. Before V1 live onboarding, review isolated schema plus separate buckets, Auth configuration, usage budgets and RLS risk; obtain express approval to make precise changes. Email requires an independently scoped sender, verified existing quota and no extra cost.

## Design rationale

Bespoke simulators are engineer-to-order builds; work breakdown and project-specific BOMs need revision traceability, not just a generic task list. Track roles for office/engineering, workshop, procurement/stores, QA, client approver and customer project lead. Source data is internal by default. Curated customer updates are a deliberate publishing event with a traceable reviewer, audience and revision.

## Security limitation of the demo

`clientProjection()` intentionally reduces the **rendered** customer data to an allowlisted structure and is covered by tests, but everything is stored in browser localStorage. A user who opens browser development tools could still inspect internal fictional data. Therefore the current app is a UI *simulation*, not a production security boundary. No actual customer access may be granted until server-side auth and RLS are implemented and tested.