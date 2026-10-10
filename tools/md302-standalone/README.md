# Simworx MD302 Standalone — Stages 1–2

Stage 1 proves the standalone display architecture before any X-Plane or NXi integration is added.

## What this stage does

- Runs as an independent Windows executable.
- Creates no X-Plane popup window.
- Has no dependency on the NXi provider.
- Opens borderless on a selected Windows monitor.
- Loads the supplied Aerobask MD302 horizontal popup artwork.
- Scales the artwork to the target monitor while preserving aspect ratio.
- Stays on top if configured.
- ESC closes the test application.

## Required asset

Copy the supplied Aerobask file:

`md302_popup_h.png`

into:

`tools/md302-standalone/assets/md302_popup_h.png`

The application also accepts an explicit path:

`SimworxMD302.exe --asset "C:\path\to\md302_popup_h.png"`

This means the prototype can point directly at the extracted DA62 asset without copying it.

## Monitor setup

Edit `appsettings.json`:

```json
{
  "monitorIndex": 1,
  "borderless": true,
  "alwaysOnTop": true,
  "assetPath": "assets\\md302_popup_h.png"
}
```

Monitor numbering is zero-based in this first-stage prototype:

- 0 = first Windows display
- 1 = second Windows display
- 2 = third Windows display

Persistent hardware-ID monitor selection will be added before production deployment.

## Build

Install the .NET 8 SDK on the development PC, then from this folder:

```powershell
dotnet build -c Release
```

Run:

```powershell
dotnet run -c Release
```

or run the generated `SimworxMD302.exe` from the Release output folder.

## Stage 1 acceptance test

Stage 1 passes when:

1. The application starts without X-Plane running.
2. It appears only on the selected standby display.
3. It is borderless with a black background.
4. The MD302 artwork is centred and scaled correctly.
5. NXi can be started/restarted without affecting the MD302 window.
6. X-Plane can be started/restarted without closing the MD302 window.

No live attitude data is intentionally implemented in Stage 1.

## Next stage

Stage 2 replaces the static centre artwork with separate MD302 horizon, ladder, bank-scale and symbol layers and adds test controls for pitch and roll before connecting live X-Plane datarefs.


Stage 2 implementation in progress: layered attitude rendering test harness.


## Stage 2 attitude test

Stage 2 adds a standalone layered attitude renderer using the supplied MD302 artwork.

Test controls:

- Up / Down: increase or decrease pitch by 1 degree
- Left / Right: change roll by 2 degrees
- R or Home: reset pitch and roll to zero
- ESC: exit

Stage 2 remains intentionally independent of X-Plane and NXi. Its purpose is to verify layer alignment, clipping, pitch translation and bank rotation before live datarefs are connected.

Required Stage 2 assets in the `assets` folder:

- `md302_horizon.png`
- `md302_ladder.png`
- `md302_att_mask.png`
- `md302_roll_scale.png`
- `md302_roll_index.png`
- `md302_symbol_trad.png`
- `md302_chevrons.png`
- `md302_hline.png`
