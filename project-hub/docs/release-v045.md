# Sim-Worx Project Hub V0.4.5 — local six-digit staff access

**Branch:** `feature/project-hub-v0.4.5-six-digit-pin`. Based on V0.4.4 release `d0298a18ac8fc2ff479943e34e98accca6652f48`.

## Update
- Replace the first-run username/password and subsequent login forms with a six-digit PIN field and a single Unlock button.
- No username creation, password confirmation, remote accounts or external identity service.
- The former username/password localStorage entry is not deleted; project records, contract metadata, purchases, scheduled tasks and linked autosave files are not migrated or modified by this change.
- Uses a salted PBKDF2-SHA256 verifier. The actual six-digit PIN is supplied to authorized staff separately, not written as plaintext in this public repository.
- Maintains the visible V0.4.5 header and ships a complete offline HTML ZIP. No deployment or changes outside `project-hub/`.

## Explicit limitations
The verifier is included in public browser-delivered source, and a six-digit code is inherently brute-forceable. This is a **convenience lock**, not encrypted storage, protected multi-user sign-in, secure control of confidential contracts, or a defense against anyone with access to the local files. Restrict access to the PC and working JSON using OS permissions and encrypted drives.

This version has not been proven with live Chrome file-permission recovery on the owner's computer. Do not use the local PIN as the only security control for sensitive customer material.

## Owner test
1. Back up your existing workspace file and extract the V0.4.5 ZIP.
2. Open the complete HTML in Chrome and enter the separately supplied six-digit PIN.
3. Confirm Dashboard, Projects, Materials, Procurement, External Work and Settings show V0.4.4 data with a V0.4.5 header.
4. Re-link the local JSON autosave file if needed, then test Verify saved file matches browser and re-open a test copy after restarting Chrome.
5. Sign out in Settings and confirm the PIN prompt returns; a mistyped code must stay locked.
