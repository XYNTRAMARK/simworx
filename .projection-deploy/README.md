# Projection preview publication

This helper adds only `projection-screen-configurator-preview.html` at the same
path under live `/htdocs`. It never synchronises directories or edits existing
pages, menus, assets, LED functionality or server configuration.

The reviewed manifest has exactly these fields:

```json
{"schemaVersion":1,"path":"projection-screen-configurator-preview.html","sha256":"<64 lowercase hex characters>","size":123}
```

The payload must match its SHA-256 and byte count and include both a robots
`noindex` meta and `<meta name="simworx-projection-build" content="static-preview">`.

Run from the separate deployment checkout:

```sh
python3 .projection-deploy/test_publish.py
python3 .projection-deploy/publish.py validate
python3 .projection-deploy/publish.py publish
```

Publication uses the existing `FTP_HOST`, `FTP_USERNAME` and `FTP_PASSWORD`
environment secrets through certificate-verified FTPS with protected data
connections. Credentials and raw connection errors are never printed.

An existing different target is refused. An identical target is verified without
writing. A new upload is staged under a unique name, retrieved and checked, then
the final target is checked again before rename. The HTTPS result must match the
reviewed bytes. Homepage, LED page, visual-systems page, shared header CSS/JS,
sitemap and robots hashes must match their pre-publication baseline.

On failure, cleanup only deletes this attempt's staged or newly created preview
if its current bytes still match the reviewed upload. Existing targets and
concurrent edits are preserved. A corrupt/partial staging upload or an uncertain
rename outcome is deliberately left for inspection. Protected files are never
restored or overwritten. Do not enable shell tracing or print secret variables.

The workflow should be separately scoped to this helper and the preview payload.
Do not invoke the navigation, portal or Base44 sync publishers for this task.

The dedicated workflow shares the existing `simworx-navigation-production`
concurrency group with navigation publication and sets `queue: max` with
`cancel-in-progress: false`. This queues the preview without cancelling another
release, and avoids adding a file during a navigation backup or inventory check.
GitHub documents this queue behaviour at
https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax.
