# Sim-Worx Project Hub — working local demo (V0.1)

**Status:** Feature branch / isolated standalone prototype. Not deployed. Not connected to any production customer data, login system or live database.

An interactive manufacturing project hub for Sim-Worx, designed around multi-customer projects, engineering/workshop jobs, component BOMs, purchasing and inventory, internal financial oversight, curated customer project updates and approval workflows.

## Run locally

Zero npm packages or build service required. From inside `project-hub/` run:

```bash
python -m http.server 8765
```

Open `http://localhost:8765`. Any ordinary static-file server will work. Browser `localStorage` retains demo actions until reset; browser storage is not a secure database. No source needs to be copied outside this directory.

## Test

```bash
node --test tests/*.test.mjs
node --check src/app.mjs
```

## What works in V0.1

- Responsive light/dark application shell with original navy / violet Sim-Worx theme.
- Multiple independent customers and projects; new customer and template-based project setup.
- Work breakdown by section; create jobs, assign a department/person, change workflow status in board or list views.
- Bills of materials, parts, reservations, stock-on-hand, purchase orders, receipts, adjustments and movement history (single-user demo logic).
- Internal fictional contract value, budget, spending, commitment and projected headroom screens.
- Curated project update drafting then explicit publication to a customer-facing preview.
- Separate customer portal projection with customer-scoped projects, published part/milestone updates, revision-labelled approvals, document metadata, messages and team lists.
- Demo client invitations with project scoping, no actual invitation email.
- In-app notifications, audit samples, theme preferences and resettable local demonstration data.

**Intentionally not live yet:** email sending, real authentication, secure uploads/downloads, server-enforced multi-tenant permissions, persistence between users, transactional inventory concurrency, real supplier ordering, integrated payment/ERP, e-signature, QR/barcodes, time logging, deployed hosting. No real passwords or personal/customer information should be entered in this demo.

## Safety boundary

The entire app lives under `project-hub/` in `XYNTRAMARK/simworx`. No existing path or deployment workflow is modified. The repository is public, so use only synthetic information and no secrets. Read `docs/safety-and-architecture.md` before making backend or hosting changes.

## Architecture

- `index.html`: isolated static entry
- `styles.css`: responsive theme system
- `src/app.mjs`: browser UI with delegated events, local demo persistence, sections and views
- `src/demo-data.mjs`: **fictional** seed dataset
- `src/model.mjs`: pure domain logic, customer allowlist projection and invariants
- `tests/`: Node test runner smoke/domain checks
- `docs/`: isolation plan, roadmap and production gates

The real product should add an approved isolated Supabase backend with row-level security and separate client/publication views before any customer is allowed to log in.