# Simworx Website Intelligence

Standalone HTML reports for `https://www.sim-worx.com/reports/`, backed by an isolated first-party event collector. This project adds no links to the public navigation or sitemap and does not replace public pages, configurators, assets, portal code, or existing Supabase functions.

## Open the reports

Use PIN **260873**. There is no email verification or user registration. The real-data PIN is checked by the reports endpoint and creates an eight-hour session; Logout revokes it. Demo mode contains generated fictional activity and `example.test` contacts. Demo changes stay in the browser.

The dashboard is plain HTML, CSS and JavaScript. There is no dependency installation or frontend build:

```sh
python3 -m http.server 8765 --directory reports
```

Open `http://localhost:8765/`. A web server is needed because the browser loads JavaScript modules.

## Contents

| Location | Purpose |
| --- | --- |
| `reports/` | The entire uploadable HTML reports application |
| `integration/` | Tracking SDK, configurator adapters and integration instructions; staged separately |
| `supabase/schema.sql` | Additive `wi_` tables and transactional collection logic |
| `supabase/functions/simworx-intelligence/` | New reports/collection API; existing functions are not changed |
| `tests/` | Automated checks and review notes |
| `DEPLOYMENT.md` | Narrow deployment and activation procedure |
| `REQUIREMENTS.md` | Requirement coverage and measurement limits |

## What the reports measure

Overview, Traffic, Funnels, Configurators, Leads, Campaigns, Journeys, Live, Insights and Settings share date and segment controls. The data model retains anonymous browser and session identifiers, source/campaign parameters, versioned configurator events, saved configurations, voluntary contact details, and separately recorded newsletter consent.

Reporting uses observed events, with explicit denominators. Potential Configured Value is a configuration estimate in its original currency, never sales revenue. Unavailable engagement, location or specification information stays unavailable. Live means recent observed activity, not an open browser guarantee.

## Activation boundary

Publishing `/reports/` alone does not add tracking to the public website. Real traffic begins only after the staged SDK is loaded on public pages and configurator success callbacks are connected. There is no historical backfill from anonymous visits that were never recorded. This separation preserves the instruction to leave the live website unchanged.

Use the existing analytics-consent mechanism. Identifying a lead requires a visitor's voluntary successful submission; typing in a form or clicking an email button is not a successful delivery. Sending the configuration and opting into newsletters remain separate actions.

## Checks

```sh
npm test
```

Backend, browser and remote verification results are recorded in `VERIFICATION.md`. No private Supabase key belongs in `reports/` or `integration/`. The only browser API setting is the public function URL.
