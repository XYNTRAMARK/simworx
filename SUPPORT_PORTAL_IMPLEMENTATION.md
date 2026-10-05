# Simworx Support Portal

## Architecture

The portal is a protected static web application at `support-portal.html` backed by the dedicated Supabase project **SIMWORX SUPPORT PORTAL**.

- Front end: existing Simworx static HTML/CSS/JavaScript stack.
- Authentication: Supabase Auth (email/password) plus a per-user 4–8 digit portal PIN.
- Database: Supabase Postgres with Row Level Security on every exposed portal table.
- Media: private Supabase Storage bucket `support-attachments`; ticket images/video/documents are served with signed URLs.
- Realtime: ticket messages, tickets, time entries, approvals and ticket events.
- Public site integration: `assets/js/site.js` adds a Support Portal link to the existing header actions.

The browser uses only the Supabase **publishable** key. No service-role or secret key is stored in the repository.

## Applied Supabase migrations

The dedicated project records these migrations in its migration history:

1. `support_portal_core_schema`
2. `support_portal_pin_security`
3. `support_portal_realtime`
4. `harden_profile_privilege_updates`
5. `security_hardening_functions`
6. `secure_initial_admin_bootstrap`
7. `support_portal_query_indexes`
8. `support_portal_operational_hardening`

The project is intentionally data-driven. Contract allowances, first-line and second-line rates, second-line allowance multipliers, rollover rules, billing currency and overage approval behaviour are stored per support contract rather than hard-coded in the UI.

## Main data objects

- companies
- profiles
- company_users
- portal_invites
- projects
- support_contracts
- support_contract_projects
- support_categories
- support_periods
- tickets
- ticket_messages
- ticket_attachments
- ticket_events
- time_entries
- remote_sessions
- escalations
- approval_requests
- customer_files
- notification_records

## Usage control

Engineering time is stored as immutable-style time records with both actual minutes and allowance-equivalent minutes. A database trigger applies the correct rate snapshot and second-line conversion rule for the ticket's active contract.

When a new entry would exceed the permitted allowance, the database rejects it. A Simworx engineer must create an approval request. Only a designated company approver, company admin or Simworx staff member may approve it. Approved minutes are added to that support period; once consumed, the approval gate applies again.

## Initial administrator

The database has a one-time admin bootstrap token stored in the private schema. It is **not** committed to GitHub. To initialise the first administrator:

1. Open `support-portal.html?setup=1`.
2. Create/sign into the intended Simworx admin account.
3. Set the portal PIN.
4. Use **Initialise First Simworx Admin** and enter the separately supplied one-time bootstrap token.
5. The token is marked used and cannot bootstrap another admin.

Subsequent staff and customer access should be created from **Admin → Access & Invites**.

## Visual acceptance requirement

The approved portal mockup is a target, not a mood board. The implementation intentionally preserves its:
- dark fixed navigation rail,
- black / charcoal / gold Simworx visual system,
- white conversation workspace,
- WhatsApp-like customer/Simworx message bubbles,
- right-side request details / usage / attachments / history stack,
- compact status badges and engineering action controls.

Do not replace this with a generic dashboard design in later revisions.

## Development workflow

Feature branch: `feature/support-portal`

Pull request CI performs:
- JavaScript syntax validation,
- required asset checks,
- duplicate-ID / HTML smoke validation,
- packaging of a preview artifact for visual review.
