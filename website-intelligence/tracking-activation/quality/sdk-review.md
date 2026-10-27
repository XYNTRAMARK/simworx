# SDK footprint review

Read-only review of the staged SDK and adapter at `simworx-intelligence/integration/` before live activation. The current deployed configurator source must still be validated by the activation owner.

## Behavior and privacy

- The SDK does not create visible DOM, styles, popups, consent controls, or page content. The adapter reads existing controls/state and does not set values or call existing business handlers.
- Analytics identity, session and durable retry storage are read or written only after explicit analytics consent. The tracker respects `SimworxCookieConsent.getConsent()` and `simworx:consentchange`; withdrawal clears its own keys/queue and stops collection.
- `/reports/`, `/admin/`, and `/portal/` are excluded. The installation manifest must additionally avoid including those private paths, rather than relying solely on runtime exclusion.
- Document listeners observe interactions and do not prevent defaults, stop propagation, submit forms, invoke checkout, or send customer email. Failed telemetry fetches are caught and do not control existing application promises.
- Generic properties recursively redact contact-like fields and email-looking strings. Explicit contact events are memory-only retries; they do not enter the durable generic queue.
- Delivery and enquiry success are explicit callbacks. `mailto:` launch, email typing, opening a form, and button clicks are not treated as successful delivery or receipt.

## Fixes requested

1. Wrap the telemetry work after native `history.pushState`/`replaceState` in a catch boundary. The native navigation result and native thrown exception must remain unchanged even if telemetry fails.
2. Count the capped error budget only while tracking is enabled. Otherwise early, unconsented asset errors can consume the budget and suppress later consented errors.

These findings were sent to the SDK owner. This review did not alter shared source or live files.

## Activation checks

- The injected script block must be removable to restore the exact original HTML bytes.
- New scripts may install observers/listeners only; they must not append visible DOM or change existing controls/state.
- Actual live controls and validated state transitions must determine completion; the old staged adapter is not evidence of current live compatibility.
- Run consent rejection/acceptance/withdrawal checks and deliberate collection failure while exercising existing navigation and configurator actions.
