# Reports test-visit filter

Exclude the two controlled deployment-check sessions from all report calculations, while retaining the original analytics records. Future checks must carry all four dedicated validation UTM values and the expected campaign marker to qualify. A campaign prefix alone does not hide a visit, and later ordinary sessions from the same browser remain visible.

Only `/htdocs/reports/analytics.js` is replaced. No database requests or writes are part of deployment or verification. The public website, tracking assets and reporting layout are unchanged.

The workflow verifies a complete current hosting backup, encrypts it and retains it before a hash-guarded atomic replacement of the single reporting file. Publication checks the homepage hash, unrelated file metadata and the served calculation module. Tests cover the report surfaces, comparison periods, legitimate similar campaigns, original input preservation and existing configurator funnels.
