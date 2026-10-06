# SIMWORX PRODUCTION SAFETY RULES

This repository contains a live commercial website. Production changes must follow these rules:

1. BEFORE ANY PRODUCTION WRITE, create and verify a complete backup of the current live /htdocs/ web root.
2. The existing public website is PROTECTED. Do not overwrite, sync, mirror, delete, or redeploy /htdocs/index.html, /htdocs/assets/, or any existing public page unless the user explicitly authorizes that exact path.
3. Support Portal work is isolated to /htdocs/admin/ only.
4. Admin deployments must use local source ./admin/ and remote destination /htdocs/admin/ only.
5. Never deploy the repository root to /htdocs/.
6. Never use a clean-slate or delete operation against /htdocs/.
7. Before and after an admin deployment, verify that the live homepage has not changed.
8. Stripe/private configuration outside /htdocs/ must not be touched.
9. If a deployment route cannot prove its write scope is /admin/ only, STOP and do not deploy.

Incident basis: on 2026-10-06 a whole-site FTP deployment overwrote the live site after the requested scope was explicitly limited to /admin/. These rules are mandatory safeguards against recurrence.
