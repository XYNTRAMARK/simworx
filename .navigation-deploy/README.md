# Shared navigation release

This release implements the user's authorised Visual Systems dropdown. Its only
live destinations are `/htdocs/assets/css/global-header.css` and
`/htdocs/assets/js/global-header.js`. No public HTML, LED configurator, admin or
private configuration is deployed from this directory.

The workflow verifies the prepared asset hashes, makes a complete current
`/htdocs` backup, verifies every archived file, encrypts it with the existing
hosting password and retains the encrypted archive as a GitHub Actions artifact
before any remote write. Backups are retained for 14 days.

The publisher checks the current live asset hashes against `manifest.json`,
uploads checked temporary files in their existing asset directories, then uses
atomic rename to replace CSS followed by JavaScript. Existing HTML and unrelated
file inventory must remain unchanged. Failure after a write attempts a conditional
rollback from the verified backup; concurrent third-party changes are preserved.

## Future navigation edits

When the dedicated Projection enclosures page exists, add its real link to the
Visual Systems items in `assets/js/global-header.js`. Retain LED screens as the
direct link to `/led-screen-configurator.html`. Do not add a placeholder route.

For a subsequent authorised release, update both entries in `manifest.json`:
`before_sha256` must match the then-current live files, and `after_sha256` must
match the reviewed source files. One asset may keep the same checksum, so a future
menu-only edit can update JavaScript and the manifest without changing CSS or the
publisher. The same two-file allowlist still applies. Run
`python3 .navigation-deploy/publish.py validate` from the repository
root before committing. The workflow only runs for changes to these assets or
this deployment configuration on `main`.

The encrypted archive can be decrypted with `openssl enc -d -aes-256-cbc -pbkdf2
-iter 200000` and the existing hosting password through a secure environment
variable. Never upload the plaintext backup to the public repository or website.
