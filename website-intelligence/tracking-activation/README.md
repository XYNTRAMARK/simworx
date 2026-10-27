# Background tracking activation

This change activates the existing Simworx reports without changing public page content, controls, styling or layout.

`activation.json` lists the exact 33 active public HTML files, four new tracking assets and two report calculation files. Archived projection versions, preview pages, the old homepage, immediate redirect stubs, admin/portal pages and private hosting configuration are excluded.

Each public page receives one deferred, non-rendered tracking loader in HEAD. The original BODY source is identical. Projection V37 also needs narrow HEAD-only policy permissions because its standalone source blocks every external script and connection: only the four tracking files and the owned collector endpoint are enabled. Removing those tracking additions restores every original byte.

The SDK uses the existing analytics consent choice. No visitor/session identifiers or analytics requests are created before valid opt-in. Standalone configurators silently honor the same existing preference; no new banner, message or dialog is added. Declining analytics leaves the website and configurators operating normally.

The current LED and Projection V37 source was inspected directly. Configuration progress uses actual committed controls and read-only snapshots. LED email/contact outcomes require the existing endpoint's accepted response. Projection's mail-client draft is recorded as preparation and voluntary email capture, never as confirmed delivery. Newsletter permission is separate and explicit. The standard contact form uses its existing successful-submission signal.

The two reports JavaScript adjustments update calculation compatibility for the real optional steps and branching actions. The reports HTML, CSS, layout and wording remain unchanged; the app change is one data accessor.

The GitHub workflow uses the existing FTPS secrets. It creates and verifies a complete live `/htdocs/` backup, encrypts and retains it before any write, checks exact source hashes, installs immutable assets, then atomically adds the reviewed HEAD hooks. It verifies unchanged original source outside the tracking additions and preserves independently changed files during conditional rollback. No repository-root mirror, private-file write or unrelated site deployment is used.

Validation includes SDK/loader/adapter/contact tests, source-restoration and deployment guards, local rendered comparisons, and a controlled deployed-SDK → collector → PIN-protected snapshot test. Controlled anonymous validation records are identified separately and removed after verification. Existing history cannot be reconstructed; genuine traffic history starts with activation.

Future configurator releases must retain the loader, update their source/version metadata, and review the event adapter if the real steps change.
