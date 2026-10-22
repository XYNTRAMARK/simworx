# Guided projection planner update

Scope: update only the existing projection preview at
https://www.sim-worx.com/projection-screen-configurator-preview.html.

The workflow is now Room & budget → Screen → Cockpit → Find projectors → Review.
Screen and cockpit setup hide all projectors. The automatic layout search chooses
a matching two- or three-projector set with a shared lens height, checks room and
documented optical restrictions, and compares actual cockpit shadows against
screen visibility from the pilot eyepoints. Independent positioning is retained
inside a closed Advanced disclosure.

Results include a traffic light, pilot-visible coverage and shadows, whole-screen
coverage, shared mounting height, suggested next steps and lens-centre coordinates
from the room walls and floor. A printable mounting plan captures four views.
An optional smaller-screen search reports any screen dimension changes. Saved
files retain room, budget, preferences and transforms; restored layouts must be
recalculated. Custom cockpit dimensions remain collapsed; cockpit position
controls and original-size reset remain available.

## Limits

- The search is bounded and sampled. It reports the best tested arrangement,
  not a guaranteed global optimum or installation approval.
- Projector and complete-system selling prices remain unapproved. Unknown prices
  are never treated as free or a confirmed fit to the entered budget. Price bands
  and known-cost limits are ready for approved prices.
- Two catalogue profiles have documented ceiling-inverted mounting. LU960ST2 is
  excluded from automatic placement until its mounting orientation is documented.
- Brightness, focus, chassis datums, structural supports and material properties
  still require review. A green light concerns sampled geometry only.
- The cockpit stays at its chosen position. The search does not claim to jointly
  optimise every possible cockpit and room position.
- The offline preview does not send enquiries or customer emails. Its restrictive
  Content Security Policy remains unchanged.

## Validation

- 16 independent geometry, room, budget and matched-layout checks passed.
- 103 browser checks passed at widths 1440, 768, 390 and 320, including unit
  conversion, hidden pre-layout projectors, matched models/common height, missing
  prices, impossible rooms, unsupported mounting, save/load and mounting prints.
- 16 publisher checks passed, covering full backup verification, incomplete-read
  retries, retained encrypted backup requirements, concurrency changes, exact
  target replacement and unchanged protected files.
- Original optical engine, all CAD model modules, LED reference data, catalogue,
  pricing and VAT modules are byte-identical to the original preview payload.
- The standalone build is repeatable. Its final manifest and publication checksum
  are pinned in `.projection-deploy/`.

The one-page workflow verifies a full current live-site backup, encrypts and
retains it before writing, then checks the unchanged homepage, LED page, shared
header assets, visual-systems page, sitemap and robots. No other publisher is
triggered by these changed paths.
