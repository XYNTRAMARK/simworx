# Sim-Worx Project Hub — V0.2.0 release notes

**Date:** 12 November 2026  
**Stage:** local interactive demonstration — not a live customer service.

### Added
- A permanent, highly visible **V0.2.0** version badge in the application's top-right header, alongside the demo status.
- Customer, project, section, department-job, stock-part, BOM-line, document-register and draft-update editing.
- Explicit archive operations with confirmation and a restore view in Settings. Historical stock movements and received purchase orders cannot be deleted.
- Nested work breakdown (`section → job → sub-job`) with editable parent jobs and predecessor validation.
- Exportable WBS CSV for Excel handoff.
- Client-view filtering of archived projects, members, files and updates.
- 7 additional domain tests and comprehensive browser interaction tests, with all original tests retained.

### Notes and limitations
- This is a **localStorage browser demo**, not authenticated multi-user software. Never put actual confidential customer data into it.
- Existing local demo data use the same V0.1 localStorage key intentionally so an upgrade does not discard manual demo changes.
- Version badge shows code version, not individual data snapshot or deployment proof.
- The 'remove' capability is archive/restore, not destructive deletion, to preserve traceability.
- Full purchase-order editing, stock accounting integration, advanced planning and secure customer backend remain pending.
- All user-visible example values are fictional demonstration records.

### Protected surfaces
Only new/modified files under `project-hub/` are part of this release. No changes to root website files, `.github/workflows`, admin, portal, production deployments or any Supabase resource.