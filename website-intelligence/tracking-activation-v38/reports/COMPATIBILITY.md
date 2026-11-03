# Live tracking report compatibility

The reporting calculation module changes, plus one existing configurator-summary data accessor in `app.js`. The reports HTML, CSS, navigation, rendered labels and layout are untouched. Restoring that accessor yields the exact previous application bytes (SHA-256 asserted by the test).

The inspected live LED page has no room-dimensions step and simulator placement is optional. Events marked `led-live-v1` (including its source-hash suffix) therefore use the real screen/review path. Projection events marked `projection-v37` retain their room requirement and treat simulator selection as optional. Unrecognized and historical versions retain their original complete ordered definition.

When a selection contains different versions, the existing funnel displays milestones common to those versions. Each version's cohort must still meet all of its own prerequisites before contributing to a later milestone. Sessions do not borrow missing progress from a different version, and no synthetic room or simulator events are created.

Email delivery and enquiry submission are alternative actions in the current configurators. Current-version core funnels therefore do not require `configuration_emailed` before a submitted enquiry. Successful configuration emails are counted separately in the existing Emailed measurement, campaign/source breakdowns and configurator summary. Historical cohorts keep their original ordered-email definition. The website funnel applies the same current-version rule when that configurator version is recorded in its session.

The model also recognizes the SDK's actual `page_performance`, `web_vitals`, and `form_invalid` names. Load and LCP timings retain milliseconds; CLS is not assigned a fabricated millisecond value.

Validation: all 14 prior model tests pass unchanged against this module; ten additional activation tests cover live LED, live Projection, historical definitions, mixed-version prerequisites, cross-version isolation, alternative email/enquiry actions and actual performance event names. Two application tests prove the existing Emailed card displays actual successful email counts and that no other application bytes changed. Run the new checks with `node --test reports/tests/*.test.mjs` from the activation project directory.
