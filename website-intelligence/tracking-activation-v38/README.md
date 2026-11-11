# Current Projection V38 tracking

This separate additive follow-up adds tracking only to the V38 file published during preparation of the first rollout. The running rollout finishes unchanged; immutable v2 assets preserve all v1 assets. The workflow uses the same non-cancelling concurrency group to serialize writes.

The V38 snapshot and step contract match V37. Its add-on choices and displayed known total are read without changing controls. Only analytics uses native XHR because the standalone application has its own offline fetch handler. Exact tracking asset URLs and the collector are the only added policy permissions. No visible content, styles, controls or business handlers are rewritten.
