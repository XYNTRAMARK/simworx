# Verification

## Completed

- Applied the additive `simworx_website_intelligence` migration to the existing Simworx Supabase project. No existing tables or functions were altered.
- Deployed new `simworx-intelligence` Edge Function version 1 with its own PIN-session checks.
- Ran the collector assertions against the real database inside a rolled-back transaction: event retry deduplication, final configuration storage, normalized email deduplication, anonymous history linking, separate first/latest attribution, contact redaction, explicit opt-in, withdrawal and out-of-order consent handling, public role denial, engagement ownership and configurator session ownership.
- Node checks cover reporting calculations, API request validation/session/settings behavior, consent-aware SDK collection and independent integration contracts. Run `npm test` for the current result.
- Chromium desktop and 390px mobile checks passed for all ten report sections, simulator filters and responsive layout, with no page/console errors or horizontal overflow. Additional browser interactions passed for saved demo lead status/notes, opt-in newsletter CSV, scoring settings, page and drop-off detail drawers, custom dates, Logout and a rejected-PIN response.
- Applied the additive standalone-consent repair and reran the complete real-database rollback suite, including direct newsletter signup and withdrawal from another browser. No test analytics remained.
- Supabase advisors checked the new tables: RLS is intentionally enabled with no public policies; browser-role table privileges are revoked. Only the server service role accesses them.

## Deployment boundary

No existing live website file, public configurator, sitemap, navigation, root robots file, support portal function or support portal table was modified. Demo records stay in the browser. Database test records were rolled back.

## Remaining activation

Tracking scripts are staged under `integration/` and are not loaded by existing public pages. Real activity starts only after that separate integration is activated. The checked-in configurator source differs from live versions, so adapter hooks must be reviewed against the deployed source before activation. In particular, the inspected projection enquiry action opens a mail client and downloads a specification; it cannot prove successful delivery or enquiry receipt.

The separate HTML preview and GitHub branch provide a reviewable build. The requested `/reports/` production path remains a separate reports-only upload unless explicitly selected; the existing website's complete-backup requirement applies before that upload.
