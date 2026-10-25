# Tracking-only activation review

The user authorized background tracking while preserving every page's content,
layout and existing operation. This review covers the activation code and
downloaded current public sources; it does not assert a completed deployment.

## Checks performed

- `footprint.test.mjs`: six passing independent SDK checks. The SDK does not
  change visible DOM/styles, replace business fetch/forms, read tracking state
  or send analytics before consent, cancel submissions/clicks, or invent
  successful email/enquiry conversions. Native history receiver, arguments,
  return values and exceptions are preserved; a telemetry failure cannot make
  a successful native navigation throw.
- `contact-tracking.test.mjs`: seven passing checks. Only a valid consented
  voluntary submit followed by the existing native completion event and success
  status captures a contact/enquiry. Initial `?sent=1`, failures, invalid forms,
  duplicate in-flight clicks, consent withdrawal and expired pending memory do
  not manufacture success. Message bodies, honeypots and tokens are not read.
  No newsletter choice is inferred or overwritten by an ordinary enquiry.
- `test_source_preservation.py`: three passing checks across downloaded live
  pages, including the large LED and projection HTML. The inserted tracking tag
  is confined to the existing head; removing that one block restores every
  original byte. The complete body source remains identical. UTF-8, CRLF,
  script strings and HTML comments retain their original source bytes.
- Publisher read review found fixed tracking asset names, exact public-page
  allowlists, a complete verified backup before writes, SHA checks immediately
  before atomic replacement, and rollback restricted to this transaction's
  own matching after-hashes. Independently changed files are preserved.

Existing essential analytics-consent preference reads are allowed before
analytics starts. Anonymous analytics IDs, session state, retry storage and
collection remain disabled until the existing valid analytics choice is true.

## Contact source contract

The reviewed current `assets/js/contact-form.js` SHA-256 is
`8baf7291cea7e46cd0a780e0f5940beaf074d35ae0cedc2abd096b0350afbc12`.
It already dispatches `simworx:submission-complete` after checking both the
HTTP response and its JSON `ok` result, setting either the existing success or
error status. The new observer listens to that existing result event and does
not replace fetch or modify the source handler. Its contact snapshot is held
only in temporary memory and is discarded on completion, withdrawal or expiry.

## Rendered verification companion

`browser-footprint.mjs` is prepared for the parent to run with its browser
permissions. It compares visible text, field values, geometry and computed
styles before/after loading the actual tracking assets on current source pages,
with and without existing consent. It mocks collection so these checks do not
write artificial production traffic. It saves before/after screenshots and
JSON under `quality/browser-results/`. Canvas/video/live regions are masked in
screenshots because existing rendering can animate; DOM/style assertions still
include their geometry.

This file records prepared checks separately from rendered results. Source
preservation proves the HTML changes themselves are invisible; the parent must
record any executed browser and remote collection results before final handoff.

## Preserved limitations

The inspected projection enquiry flow opens a mail client and downloads a
specification. This cannot prove successful email delivery or enquiry receipt;
tracking must record initiation only for that path. No historical traffic is
backfilled. New history consists of real observations after activation and
within the visitor's existing consent choice.
