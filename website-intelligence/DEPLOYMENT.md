# Deployment and activation

## Scope

The destination for the HTML application is `/htdocs/reports/` only. The source directory is `reports/` only. Never sync the repository root, never use `--delete`, and never upload to `/htdocs/assets/`, `/htdocs/admin/`, `/htdocs/portal/` or an existing public page as part of reports deployment.

The public website repository's `PRODUCTION-SAFETY.md` requires a verified full `/htdocs/` backup before any production write. These instructions do not waive that requirement. A reports upload is a separate operation from enabling tracking.

## Backend

The backend uses the existing Simworx Supabase project `euttubfvsrgkeiescsdm`. All new tables use the `wi_` prefix. Existing support portal tables/functions are outside this project's scope.

1. Apply `supabase/schema.sql` as the additive `simworx_website_intelligence` migration.
2. Deploy the new `simworx-intelligence` Edge Function with JWT verification disabled at the gateway: the collector accepts anonymous events and dashboard actions check their own reports session. Never disable checks inside the dashboard API.
3. The function uses Supabase's injected `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only on the server. No extra secret, email verification, authentication user or paid project is needed.
4. Verify a rejected invalid PIN, successful PIN entry, empty snapshot, collection idempotency, denied anonymous reads, lead deduplication, separate consent and revoked logout session before enabling collection.
5. Keep `reports/config.js` pointed at the deployed function URL.

## HTML application

1. Record the live homepage checksum and confirm the live `/reports/` folder does not already contain another application.
2. Download and verify a complete backup of `/htdocs/`; preserve a manifest and archive before writing anything.
3. Upload the files inside `reports/` to the new `/htdocs/reports/` directory, without modifying any pre-existing remote file. For later updates, explicitly scope the upload to reports files and preserve the prior reports version.
4. Check `https://www.sim-worx.com/reports/` and enter PIN `260873`. Verify all navigation, mobile layout, dates, CSV exports and Logout.
5. Verify the homepage checksum and existing public file manifest are unchanged.

Do not add a public navigation link, sitemap entry or internal search result. The application includes robots meta tags and Apache `X-Robots-Tag` settings. Its own `robots.txt` applies when hosted as a standalone preview; on a subdirectory, search engines use the domain-root robots file, so the HTML and response tags provide the reports-page indexing instruction without editing the existing root file.

## Collection, separately staged

`integration/` contains the SDK and adapter source, plus exact examples. Review the currently deployed configurator source before connecting it: the GitHub repository and live configurator versions differ.

Load tracking only after analytics consent using the existing consent interface. Add successful completion/email/enquiry callbacks to existing application actions. Do not rebuild the configurators or count button clicks as completed actions.

The instruction to leave existing live files unchanged means these tracking changes remain staged until separately enabled. Report pages work with demo data and an empty real snapshot before activation.

## Rollback

For a first reports-only deployment, remove only the newly created `/htdocs/reports/` folder. For an update, restore only its archived prior reports version. Disable the added SDK load to stop future collection. Never restore the whole website merely to roll back this separate reports application. Historical intelligence data is retained unless an owner deliberately removes it.
