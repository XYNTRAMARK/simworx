# Guided projection preview publication

This publisher updates only the existing, owner-requested
`/htdocs/projection-screen-configurator-preview.html`. It never synchronises
directories or deploys navigation, LED functionality, shared assets or server
configuration. The previous live page and the new payload are pinned by SHA-256.

Editable application sources are in `projection/`. Rebuild the standalone HTML
and its manifest with `python3 tools/build-projection-guided.py`. The publisher's
reviewed `PAYLOAD` and manifest digest must also match the final build; changing
source after review invalidates the prepared release.

Local checks, without credentials or remote writes:

```sh
node --experimental-loader ./tests/projection/loader.mjs tests/projection/layout-planner.mjs
python3 .projection-deploy/test_publish.py
python3 .projection-deploy/publish.py validate
```

The workflow uses the existing FTP secrets over certificate-verified FTPS with
protected data connections. Before any upload it downloads every live `/htdocs`
file, including hidden files, checks for a stable inventory, and verifies every
file inside a complete archive. It then encrypts the archive, verifies decryption
against the original, and retains the encrypted backup as a GitHub artifact for
14 days. Publication requires the artifact's retention receipt.

Immediately before uploading, the publisher rechecks the complete live inventory
and the previous preview's bytes. It stages exactly one reviewed HTML payload,
verifies its checksum, rechecks the old target, and atomically renames the staged
file over that exact target. It verifies the hosted HTML and the protected
homepage, LED page, visual-systems page, shared header CSS/JS, sitemap and robots.
Any unexpected concurrent change stops publication. Uncertain uploads are left
for inspection; protected files are never restored or overwritten.

The workflow shares the `simworx-navigation-production` concurrency queue with
navigation publication, using `queue: max` and `cancel-in-progress: false`.
Do not invoke the navigation, portal or Base44 publishers for this change.

The page remains an isolated, noindex, offline preview. New product prices are
unapproved, and its estimate/enquiry functions do not send customer messages.
