# Coverage and measurement definitions

This is an analytics application implementation, not a claim that historical traffic data already exists. The build brief is the supplied “SIMWORX WEBSITE INTELLIGENCE SYSTEM / Full Build Brief”. The user's chat instruction selects PIN 260873, simple access, new HTML reports pages and preservation of existing live pages.

| Brief area | Implementation / activation boundary |
| --- | --- |
| Private reports, PIN, logout, no public links | HTML reports with PIN session, noindex/nofollow, no sitemap or navigation changes |
| Overview and daily activity | Derived event metrics and trend series, selectable metric, previous-period comparison |
| All date presets and custom range | Shared calendar controls; Europe/Paris reporting dates |
| Traffic, pages, entry/exit and devices | First-party page/session facts; page drilldowns and source/country/device breakdowns |
| Anonymous, returning and known visitors | Persistent consented browser identity; known contact links to prior anonymous identity |
| Journeys and live | Chronological event timelines and recent-observation view |
| LED and projection funnels | Versioned event architecture and ordered session funnels, drop-off session drilldowns |
| Simulator categories/models and preferences | Dimensions supplied by configurators; global category/model filters and saved specifications |
| Configurations and value | Stable configuration identifiers; original-currency potential configured value, not revenue |
| Leads, status and notes | Normalized email deduplication, editable commercial status/notes, attribution and linked history |
| Newsletter consent and exports | Separate explicit opt-in with timestamp/wording/version/source; separate lead and opted-in subscriber CSV |
| Campaigns and channel quality | UTM plus ref code, first/latest source, starts/completions/emails/enquiries and intent |
| Engagement, errors and performance | Consent-aware lightweight SDK events; observed problems and available timing fields |
| Scoring, insights and alerts | Editable scoring; rule-based findings on observed populations; optional alert rules disabled by default |
| Collection and retention | New append-only event IDs, idempotent transactional ingestion, private analytics tables, historical retention |
| Integration and production safety | All tracking/instrumentation source staged separately; no existing public file changed |

## Measurement limits

- Anonymous identity identifies a consented browser, not a verified person. Clearing browser storage or changing device creates another identifier. Known lead identity exists only after voluntary contact submission.
- New/returning classifications depend on recorded history. Analytics cannot recover unrecorded earlier visits.
- Funnels use ordered events within the same session/configurator context. Counts show their denominator and previous-step retention; missing events do not imply success.
- Analytics consent reduces observed coverage; reports represent tracked visitors, not necessarily all visitors.
- An active visitor is someone with a recent event. Browser visibility, network failure or consent withdrawal can change coverage.
- Geography comes from trustworthy coarse server-side metadata when supplied. Unknown geography remains unknown; no GPS or IP-to-person enrichment is added.
- Estimated configured value is not revenue and currencies are never silently added together.
- Demo records are generated fixtures. They do not describe actual Simworx customers, campaigns or conversion performance.
- Email delivery and enquiry submission must be recorded from successful underlying responses. The reporting project does not send configuration emails or marketing messages.
- Alert settings are stored rules for dashboard warnings. Outbound email/Slack alerts and future AI interpretation require separately connected delivery services.
- Current live configurators differ from checked-in source. The staged integration must be checked against the deployed version before activation.
- Snapshot responses disclose any safety limit. Large volumes should move aggregation server-side before that limit becomes material.
