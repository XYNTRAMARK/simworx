# Staged public-site tracking integration

These files are **not installed on the live website**. The reports application can be deployed independently. Public traffic remains empty until this SDK is deliberately added to the public pages and meaningful configurator callbacks are wired. No historical visitor activity is reconstructed.

## Files

- `tracker.js`: buildless first-party analytics SDK; no libraries, cookies, tracking pixels, geolocation prompts, or public read API.
- `configurator-adapter.js`: optional read-only control adapter and explicit application-success event bridge.
- `callbacks.example.js`: examples to place inside existing successful application handlers after source review.
- `consent.example.html`: standalone manual consent example for pages without the existing consent component.
- `tests/tracker.test.mjs`, `tests/configurator-adapter.test.mjs`: dependency-free Node tests using mocked browsers.

## Install later, after reviewing the live source

Keep the reporting files under `/reports/`. If public instrumentation is later approved, install the SDK assets under a dedicated path such as `/intelligence/`; do not load the public tracker on reports, admin or portal pages.

Add the SDK after the existing cookie-consent script on public pages. Use `defer` in both tags to preserve execution order:

```html
<script defer src="/assets/js/cookie-consent.js"></script>
<script defer src="/intelligence/tracker.js"
  data-endpoint="https://euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence"></script>
```

On a configurator add its type and an actual source/version identifier, then the adapter:

```html
<script defer src="/intelligence/tracker.js"
  data-configurator="projection"
  data-configurator-version="projection-v28-reviewed-SOURCE-SHA"></script>
<script defer src="/intelligence/configurator-adapter.js"
  data-configurator="projection"
  data-configurator-version="projection-v28-reviewed-SOURCE-SHA"></script>
```

For LED use `data-configurator="led"`. Do not claim a source version has been validated until it has. The adapter uses `source-unverified` if none is supplied.

The new `simworx-intelligence` function is isolated from the existing support portal functions. The SDK contains no database credential. Cross-origin POST collection requires the deployed function to allow the public website origin. It sends `{action:"collect", events:[...]}` in small batches. Public pages never receive analytics rows or lead records.

## Consent

The actual existing consent component exposes `window.SimworxCookieConsent.getConsent()` and dispatches `simworx:consentchange` with `{analytics:boolean,marketing:boolean,...}`. The SDK uses those exact APIs. It does not create/read its visitor/session/queue storage, enqueue analytics, or send analytics until `analytics === true`. Withdrawing analytics clears its own persisted IDs and retry queues and stops new collection. It does not alter the website's consent component.

For a different explicit analytics choice, call:

```js
SimworxIntelligence.setConsent({analytics: true});  // only after visitor opt-in
SimworxIntelligence.setConsent({analytics: false}); // visitor withdrawal
```

`setConsent` controls analytics only. Newsletter subscription is a separate action through `identify`/`marketingConsent`, with the actual displayed consent wording/version. Receiving a configuration does not subscribe anyone. Never infer newsletter consent from an email address or cookie marketing permission.

The standalone example demonstrates the API; it does not persist a consent choice. Production should use the existing consent manager's versioned choice and expiry rules.

## Identity, sessions, attribution, and transport

After consent, a random UUID in first-party `localStorage` identifies that browser. Active sessions share a `localStorage` record across tabs and expire after 30 minutes without user activity. Automatic heartbeats, errors and performance observations do not extend the inactivity timeout. Browser storage restrictions fall back to memory. IDs do not identify a person across devices or a cleared browser.

First touch is retained with the visitor. Latest acquisition touch is retained separately. Every event includes both, UTM source/medium/campaign/content/term, the Simworx `ref` identifier, available ad-click identifiers, source group, referrer URL/domain, device/browser/OS/viewport, and a page-view ID. Sensitive query fields and email-looking values are removed from URLs; other referrer details are preserved. `www.sim-worx.com` and `sim-worx.com` are treated as the same site. No GPS, IP lookup, precise location, fingerprint, or cross-site ID is collected by the SDK. Country must come from a reliable coarse server-side header; missing country remains unknown.

Source groups are Google Organic, Google Ads, Bing, LinkedIn, Facebook, Instagram, OpenAI Ads, Email, Referral, Direct, and Other. OpenAI Ads requires explicit paid campaign tagging; an ordinary ChatGPT referral is not counted as an ad. Preserve original tags when adding campaign links.

Events are asynchronous and batched with `fetch(...,{keepalive:true})`. Failed delivery never blocks the website. The retry queue preserves `event_id` for backend deduplication, caps memory at 80 events and durable generic retries at 60 events/48 KB, and discards retries older than 24 hours. Contact-bearing events are memory-only, so emails/names are not written into the durable retry queue. That means a failed contact submission event may be lost when the tab closes; the existing contact delivery service must remain the authoritative lead source.

Generic event properties and configuration snapshots recursively remove contact/password/token fields and email strings. Do not pass raw forms, message bodies, HTML, screenshots, or full customer records into tracking. Contact data is sent only by explicit identity/success callbacks after the customer voluntarily submits it.

## Automatic website events

| Event | Trigger and interpretation |
|---|---|
| `page_view` | Initial public page, history navigation, or resumed activity in a new session; new `page_view_id` |
| `engagement` | Visible, recently active time, sampled every 15 seconds and on hide/navigation; `engagement_seconds` is **cumulative per page_view_id**, not a delta |
| `scroll_depth` | First crossing of 25/50/75/100 percent of scrollable page |
| `cta_clicked` | Declared `data-intelligence-cta`, existing `.btn` or `.led-button`; does not imply conversion |
| `brochure_downloaded` | PDF/download link selected; measures download initiation, not server delivery |
| `video_played` | HTML video play event |
| `form_invalid` | Browser invalid field event; captures field type/form ID, never field value |
| `website_error` | JS/resource/unhandled promise errors, capped at 20 per page; explicit integration errors can also use `reportError` |
| `page_performance`, `web_vitals` | Available navigation timing, LCP and CLS browser observations; unsupported observations are omitted |

Aggregate engagement by taking the maximum cumulative seconds for each `page_view_id`, then summing those page totals. Do not sum all heartbeat values. Hidden/idle time is excluded. `configurator_abandoned` on `pagehide` is a provisional exit signal: a tab can return. Final abandonment should be inferred after session timeout with no completion, not counted solely from that signal.

## Configurator source contract

Projection control IDs were inspected in repository `XYNTRAMARK/simworx` at commit `fc7d578d793015a343d0b35bb2ff5866bbf7795d`, in `projection/main.html`, `projection/src/app.js`, and `projection/src/guided-planner.js`. The latest published projection HTML is assembled separately by deployment workflows; its parity with these repository sources still requires live-source validation before installation.

| Source control / state | Event |
|---|---|
| `[data-room]`, `#projection-room-{width,depth,height}` committed changes | `room_dimensions_entered` |
| `#led-simulatorType` | `simulator_model_selected`, associated `simulator_category_selected` |
| `[data-led-range/number^="simulator"]` | `simulator_positioned` |
| `[name="projection-enclosure"]` | `screen_geometry_selected` |
| diameter/viewableHeight/screenBottom controls | `screen_dimensions_changed` |
| horizontalFov controls | `screen_fov_changed` |
| `#guided-model`, `#projection-channel-model` | `projector_type_selected` |
| `[data-position]`, `[data-aim]`, `#projection-throw` | `projector_position_adjusted` |
| `#projection-placement-mode`, mounting kit, mount-drop | `mount_type_selected` |
| calculate/recalculate/budget-run/suggest/objective controls | `projector_calculation_started`; click records calculation intent |
| `SimworxProjection.snapshot().configuration.layoutReady && !layoutDirty` | `projector_spec_generated`; records successful calculated state |
| Snapshot `guidedStep === 4 && layoutReady && !layoutDirty` | `price_or_spec_viewed` and canonical `configuration_completed`; the existing source validates this transition |
| `#projection-enquiry` | `email_form_opened` only |

The source exposes `SimworxProjection.snapshot()` with `configuration`, `quote`, projector count and optical results. The adapter uses this read-only method for metre-based room dimensions, simulator/model, geometry/FOV, projector model/count/throw/mount, quote amount/status/currency, and full sanitized configuration. Partial commercial estimates retain a null total and a separate known subtotal.

Simulator category is read from an explicit control, selected-option category/optgroup, or a configurable model mapping, with a small fallback mapping for known aircraft identifiers. Unknown models remain `Other`; models are not restricted in the database or report.

The LED live HTML was not available in the repository. LED supports the same explicit step/completion/success bridge and configurable selectors, without claiming unverified live success hooks. It recognizes declared `data-intelligence-field` controls and shared source controls where present. Validate selectors against the actual LED version, set a real version, and supply its snapshot function:

```js
window.SimworxIntelligenceAdapterOptions = {
  configurator_type: 'led',
  configurator_version: 'YOUR-REVIEWED-LED-VERSION',
  selectors: {
    category: '#your-category-control',
    model: '#your-model-control',
    pitch: '#your-pixel-pitch-control'
  },
  modelCategories: { 'your-model-id': 'Business Jet' },
  snapshot: () => YOUR_EXISTING_READ_ONLY_SNAPSHOT()
};
```

Set this object **before** loading `configurator-adapter.js`. Do not copy that placeholder as executable production code.

## Completion, email and enquiry success

`completeConfiguration(configuration, properties)` returns a stable `CFG-...` ID for that configurator attempt. Repeated completion callbacks return the same ID. Call `newConfiguration()` for an intentional new configuration. Keep that ID with the existing application's saved/email payload and supply it on subsequent email/enquiry success callbacks.

The bridge accepts these custom events with `detail` payloads:

- `simworx:configurator-step`: `{event_name,configurator_type,properties}` for a committed meaningful step.
- `simworx:configuration-completed`: `{configurator_type,configuration,properties}` after successful completion/save.
- `simworx:lead-captured`: `{email,name,company,telephone,country,configuration_id,...}` after a successful voluntary contact submission.
- `simworx:configuration-emailed`: `{configuration_id,contact:{email,...},delivery_reference}` after server-confirmed delivery/accepted send result.
- `simworx:enquiry-submitted`: `{configuration_id,contact:{email,...},enquiry_reference}` after the existing enquiry endpoint confirms success.
- `simworx:configurator-error`: `{error_type,properties}` for caught model/API/email/calculation failures; never pass the customer's message or raw server response.

The direct SDK API can be used instead; do not call both bridge and direct method for the same result. See `callbacks.example.js`.

**Source limitation:** the inspected projection enquiry handler downloads a specification and opens a `mailto:` URL. Opening an email client cannot establish that an email was sent or an enquiry received. This adapter therefore emits no `configuration_emailed`, `email_entered`, or `enquiry_submitted` for that form automatically. Those conversions require a genuine server-confirmed delivery path or an authoritative existing endpoint response. Button clicks, typed email, opening a dialog, download initiation and `mailto:` launch are not successful conversions.

The SDK does not replace `fetch`, forms, mail delivery, checkout, pricing, 3D rendering, model loading, or navigation handlers.

## Validate before installing

Run `node integration/tests/tracker.test.mjs` and `node integration/tests/configurator-adapter.test.mjs` from the project root. All 23 tests pass. The automated checks cover consent/no-storage defaults, withdrawal, shared tab sessions, idle expiry, retry IDs, private-page exclusion, generic PII redaction, source attribution, stable configuration IDs, queue bounds, actual committed control values, valid review completion, and explicit success callbacks. They are mocked-browser checks, not validation of the current live configurator.

In a staging copy of each actual source version: reject analytics and confirm no SDK IDs/network events; opt in and verify one page/open/start sequence; perform each meaningful step; verify the payload's actual chosen values and units; complete twice and confirm one configuration ID; simulate delivery failure and confirm no success conversion; confirm marketing remains off unless its separate checkbox was chosen with recorded wording/version; verify all existing configurator operations still work when collection is unreachable. Keep live public pages unchanged until that installation is explicitly authorized.
