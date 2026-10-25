# Verification

## Completed

- Applied the additive `simworx_website_intelligence` migration to the existing Simworx Supabase project. No existing tables or functions were altered.
- Deployed new `simworx-intelligence` Edge Function version 1 with its own PIN-session checks.
- Ran the collector assertions against the real database inside a rolled-back transaction: event retry deduplication, final configuration storage, normalized email deduplication, anonymous history linking, separate first/latest attribution, contact redaction, explicit opt-in, withdrawal and out-of-order consent handling, public role denial, engagement ownership and configurator session ownership.
- Node checks cover reporting calculations, API request validation/session/settings behavior, consent-aware SDK collection and independent integration contracts. Run `npm test` for the current result.
- Chromium desktop and 390px mobile checks passed for all ten report sections, simulator filters and responsive layout, with no page/console errors or horizontal overflow. Additional browser interactions passed for saved demo lead status/notes, opt-in newsletter CSV, scoring settings, page and drop-off detail drawers, custom dates, Logout and a rejected-PIN response.
- Applied the additive standalone-consent repair and reran the complete real-database rollback suite, including direct newsletter signup and withdrawal from another browser. No test analytics remained.
- The GitHub validation workflow passed the real deployed API checks: invalid PIN rejection, authenticated snapshot, event validation, Logout and rejected reuse of a revoked session. A follow-up database check confirmed zero analytics, lead and configuration test rows and zero active test login sessions.
- Supabase advisors checked the new tables: RLS is intentionally enabled with no public policies; browser-role table privileges are revoked. Only the server service role accesses them.

## Deployment boundary

The new HTML reports were uploaded through the existing GitHub/FTPS connection on 25 October 2026. All nine new `/htdocs/reports/` files matched the reviewed build in a separate read-only FTP check. The complete 316-file, 833,951,075-byte site backup was verified and retained as encrypted GitHub artifact `12604666004` before upload. The uploader's checks of existing-file metadata and protected homepage/header hashes completed before its subsequent HTTPS request timed out.

Verified public URL: `https://sim-worx.com/reports/`, PIN `260873`. HTTPS checks from GitHub and the execution environment confirmed the live HTML, JavaScript and stylesheet match the reviewed source, and the noindex/nofollow response header is present. The `www` hostname timed out during checks; no hosting or DNS configuration was changed. Automated live Chrome checks did not run reliably in the GitHub runner, so live browser automation is an explicitly optional follow-up. Local browser interaction checks and deployed API checks passed.

Validation comprises 47 JavaScript behavioral checks, 16 FTP-helper checks, desktop/mobile Chromium interactions, real API session checks, and rolled-back database assertions. The production upload workflow is now manual-only so future helper edits cannot trigger another first-deployment attempt.

No existing live website file, public configurator, sitemap, navigation, root robots file, support portal function or support portal table was modified. Demo records stay in the browser. Database test records were rolled back.

## Remaining activation

Tracking scripts are staged under `integration/` and are not loaded by existing public pages. Real activity starts only after that separate integration is activated. The checked-in configurator source differs from live versions, so adapter hooks must be reviewed against the deployed source before activation. In particular, the inspected projection enquiry action opens a mail client and downloads a specification; it cannot prove successful delivery or enquiry receipt.

The user selected the existing GitHub-to-FTP hosting route. The dedicated reports workflow creates and verifies a complete live backup, retains its encrypted archive, then uploads only the new `/htdocs/reports/` folder. Existing website files remain protected; source and review history are retained in the GitHub branch.
