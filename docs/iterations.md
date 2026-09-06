# Iteration log

## 2026-09-07 · Reproducible experiments and resilient export

Purpose: preserve an interesting evolved field and resume it, improve touch/keyboard interaction, and make video exports trustworthy while controls or viewport change.

- Added versioned JSON checkpoints for all five current modes. Reaction fields and particle positions/velocities are saved as exact JavaScript numbers; restore validates the complete file before replacing a live experiment and pauses on the restored numerical step. Pointer position and rendered trail pixels are deliberately outside the checkpoint.
- Added seed/erase brush buttons, brush-size adjustment, pointer capture and interpolated strokes. Mobile painting no longer competes with vertical page scrolling; the surrounding page remains scrollable.
- Extracted video capture into a lifecycle controller: locked filename, bounded countdown, final-data collection, empty-output rejection, error cleanup. Mode/reset/import controls are disabled during capture; canvas resize waits for it to finish.
- Audited numerical APIs and found small-grid duplicate-neighbor updates and invalid-input hangs. Narrow fixes and independent regression tests are being integrated.
- Added skip navigation, canvas keyboard shortcuts and disabled live announcements for the fast-changing numerical step counter.

Verified and deployed: commit dfaa937; GitHub Actions run 34044542251 passed build, 43 core tests and 12 browser cases. The published checkpoint entry was opened and the browser reported no console errors. No claim about biological validity is implied.

Next prioritized investigation: Physarum-inspired trail networks, based on the source and uncertainty report in research-next.md. GPU migration remains conditional on measured bottlenecks.

## 2026-09-07 · Trail networks

Added a sixth mode with three-sensor chemotaxis and diffusing/decaying trail feedback. Controls cover density, sensor geometry, turn amplitude and retention. Agent locations can be shown over the field. The network participates in parameter links, pause/single-step, painting, recording and full JSON checkpoints, including public heading/field arrays and numerical time.

Default-pattern review rejected a collapse-to-single-band prototype. A disclosed saturating sensor response and stateless split rule now produce the actual network comparison captured in physarum-evolution.png. This remains an independent engineering model rather than a precise Jones (2010) reproduction.

Core validation: 61 tests passed locally, including steering, independent stencil/quantity checks, seeded continuation and imported network checkpoints. Browser and deployment checks succeeded in GitHub Actions run 34045241950 for cdb069b (14 browser cases).

## 2026-09-07 · Native rendering and safe asynchronous actions

Added a reusable renderer that works in each model's native coordinate system. This removes the small 256×160 → 1200×760 aspect mismatch, aligns painting with the displayed domain and supports 1920/3840-pixel PNG exports without viewport letterboxing. Larger image output does not add simulation cells or scientific detail.

The export filename is captured before asynchronous PNG encoding. Checkpoint reads use a request sequence so a stale read cannot replace a later scene choice/import. Keyboard shortcuts now require actual canvas focus. Network checkpoints include the agent overlay setting and reject coordinates that become out-of-domain after Float32 conversion. Unexpected numerical errors pause the model while keeping the animation scheduler and reset controls available.

Core checks: 68 passed locally including fit/inverse mapping and Float32 import regressions. Added browser cases for PNG dimensions and filename races, stale import reads, body keyboard behavior and overlay restoration. GitHub Actions run 34046006958 passed and deployed 2f3e9c9, including 20 browser cases.

## 2026-09-07 · English interface

Added an EN/中文 switch with source-key translations for static controls, dynamic status messages, scientific descriptions, tooltips and accessibility labels. Language selection updates URL settings without resetting the model; sharing includes the current language. Recording controls keep their live state across a language switch. The simulation and snapshot data are language-independent.

The translation dictionary is coverage-checked against the marked HTML and snapshot/capture errors. English desktop and phone layouts were manually inspected; browser regression cases check language/state preservation and switching during recording. Verified/deployed: 7f42a52, GitHub Actions 34047069541, 73 core and 24 browser cases passed.

## 2026-09-07 · Offline shell and model-generated preview

Production builds now emit a content-versioned service worker. It precaches only the app's static shell, isolates caches by application scope, and leaves user snapshots/third-party requests alone. Network-first navigation does not overwrite the pinned offline index, so an old worker never mixes new HTML with uncached new bundles. No forced reload or skipWaiting is used; readiness means a usable offline copy, not necessarily the newest network version.

Generated a 45-frame, 512×160 looping GIF directly from reaction and network arrays for the GitHub README. The optional generator uses ffmpeg; normal builds/runtime remain dependency-free beyond the existing web toolchain.

Verification so far: 79 Node tests and build passed; GIF stream metadata confirms 45 frames at the intended size. Production-browser offline reopening is included in CI for desktop and mobile. Deployment pending.
