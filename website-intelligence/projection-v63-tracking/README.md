# Projection V63 tracking repair

The production Projection configurator advanced beyond the V37/V38 pages instrumented on 25 October. The current stable page and V63 were confirmed on live FTP without a tracking hook.

This scoped repair adds the existing V2 first-party tracking bootstrap to only:

- /htdocs/projection-screen-configurator.html
- /htdocs/projection-screen-configurator-v63.html

The transform inserts one deferred script before the real document </head>. Every other original byte must remain identical. Deployment is guarded by the exact live SHA-256 captured on 26 October, retains encrypted originals, aborts on concurrent changes, and rolls back only files it changed.
