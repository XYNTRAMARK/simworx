# Shared navigation font correction

This release corrects the Visual Systems dropdown typography on the LED
configurator. Its page-level button styling was overriding the shared navigation
font size and weight. The shared CSS now scopes the trigger rule through
`.global-nav` at each existing breakpoint and explicitly inherits the header font.
The menu script is unchanged. Header asset references receive a new version so
returning visitors receive the corrected styling.

## Exact deployment scope

The fixed allowlist contains 25 paths: the two shared header assets, the 22 public
HTML pages named in `header_references.py`, and `led-screen-configurator.html`.
`header-pages.json` records the observed source references for those pages; its
keys must match the fixed list. Seven observed legacy/redirect pages without the
shared header are excluded. No other HTML, admin or private configuration is
uploaded.

For each of the 23 pages, the publisher replaces only the quoted URL value of its
single shared-header CSS `href` and JavaScript `src`. Whitespace, quotes, other
attributes and every other page byte are preserved. The references receive
`?v=nav-20261022-2`. The current live page must match its reviewed before checksum,
and the result must match its reviewed after checksum in `manifest.json`.

The configurator already uses the shared header. All 23 catalog entries use
`references`, with their observed `nav-20261022-1` URLs as the reviewed source
values. This release updates only those two URL values on each page, including
the configurator. Every other page byte, including pricing, 3D functionality and
quotation logic, remains identical; reversing the two URL edits reproduces each
downloaded source exactly. All pages are derived from fresh verified public
snapshots; stale repository HTML is never used.

Future configurator builds should preserve the versioned shared references used
by the public page, or deliberately apply the same header integration before
publication.

## Backup and publication

The workflow validates the manifest and transformation tests, creates a complete
current `/htdocs` backup, verifies every archived file, encrypts the archive with
the existing hosting password and retains it as an artifact before any remote
write. Backups are retained for 14 days.

If a file changes or a transfer is incomplete during the initial copy, the backup
performs up to three bounded catch-up passes. It re-reads affected files against a
fresh inventory and accepts only a complete, stable snapshot with matching sizes
and checksums. Added, removed or type-changed paths stop the release. Authorised
navigation files must always match their reviewed before checksums. Diagnostics
report paths and byte counts without file contents or hosting credentials.

The publisher checks every allowed live file against its original checksum,
uploads and verifies temporary files, then atomically replaces CSS, JavaScript and
the catalogued HTML. It checks public HTTPS checksums, sitemap/robots contents and
all unrelated file inventory. Failure after a write attempts conditional rollback
from the verified backup; concurrent third-party edits are preserved. It never
synchronises the repository root or cleans a live directory.

This correction expects the preceding shared-header release to have succeeded.
The CSS entry pins the reviewed font correction; the JavaScript entry retains
equal before and after checksums.

## Future menu changes

When the dedicated Projection enclosures page exists, add its real link to the
Visual Systems entries in `assets/js/global-header.js`. Keep LED screens linked
directly to `/led-screen-configurator.html`.

For a subsequent authorised release, bump `NAV_VERSION` in `header_references.py`
and update the reviewed source references in `header-pages.json`. The now-external
configurator should use kind `references` with its actual CSS/JS URLs. Refresh the
manifest from the then-current public snapshots: every before checksum must match
the live file and every after checksum the reviewed header-only output. Unchanged
assets may keep equal checksums, but at least one file must intentionally change.
This gives all pages, including the configurator, the current menu without changing
other content. Changes to the page allowlist require an explicit reviewed edit to
the fixed list as well as the catalog and manifest.

Run `python3 .navigation-deploy/test_publish.py` and
`python3 .navigation-deploy/publish.py validate` from the repository root. The
workflow only runs for changes to the two assets or this deployment configuration
on `main`.

The encrypted archive can be decrypted with `openssl enc -d -aes-256-cbc -pbkdf2
-iter 200000` and the existing hosting password through a secure environment
variable. Never upload the plaintext backup to the public repository or website.
