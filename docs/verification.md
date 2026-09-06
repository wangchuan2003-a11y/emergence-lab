# Verification

This report distinguishes tested software behavior from scientific/model validity. It is a record of bounded checks, not a claim that every browser, device or possible numerical state has been tested.

## Latest completed compatibility checkpoint

[Commit b467abf](https://github.com/wangchuan2003-a11y/emergence-lab/commit/b467abf) was built and deployed by [Actions run 34053004139](https://github.com/wangchuan2003-a11y/emergence-lab/actions/runs/34053004139). The run passed **104 core tests** and **63 browser cases**, spanning Chromium desktop, Chromium mobile viewport and Firefox desktop.

| Area               | Evidence                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Particle motion    | Seeded trajectories, independent small-grid neighbor reference, periodic bounds and invalid-state handling                        |
| Reaction diffusion | Independent stencil calculation, uniform equilibrium, bounded seeded evolution, active default fields and rendering non-mutation  |
| Trail networks     | Sensor steering, stateless random continuation, field/deposit checks, periodic behavior and snapshot recovery                     |
| Snapshots          | Complete validation, Float32 conversion boundaries, resumed array equality, stale-import cancellation and browser file roundtrips |
| Interaction        | Mode controls, pause/step, focused keyboard shortcuts, brush history, edge-entry strokes, language and recipe cancellation        |
| Rendering/export   | Native-aspect view geometry, pointer inverse, PNG dimensions and filename races, actual decoding of exported video frames         |
| Offline shell      | Scope isolation, immutable version pairs, CORS/Vary regression and real offline reopening in a fresh browser page                 |

## Deliberate limitations

- Models are educational approximations and artistic presentations. These checks do not validate coral biology, cell division, organism behavior, intelligence or shortest-path optimality.
- Network and reaction fields use a fixed numerical grid. Larger PNGs increase image dimensions, not model resolution.
- Same-runtime numerical restoration is tested. Floating-point transcendental functions can vary across platforms.
- The mobile tests use browser viewports. They are not a physical-device, battery, screen-reader or all-assistive-technology certification.
- Recording support depends on available browser codecs. The app falls back to image export when recording is unsupported.
- An offline copy can be older than the newest network page; the app does not forcibly reload an active experiment.

## Reproduce

```sh
npm ci
npm test
npm run build
npx playwright install --with-deps chromium firefox
npx playwright test
```

The build generates the offline worker. Browser checks use the production preview rather than the development server. Failed CI browser runs retain a trace and screenshot artifact for seven days; these tests use only synthetic model data.

Preview generation is optional: run `npm test` first, then use `node scripts/render-recipes.mjs` or `node scripts/render-preview.mjs` with ffmpeg available. Generated assets are derived from the documented numerical settings, not from a video-generation model.

## Deployed readback and interface captures

The final dependency-cleanup build was reloaded from the public site and displayed **Build b467abf**. The interface captures below record build **02bf7c2**. The fluorescent-maze recipe completed at numerical step **1200** and remained paused as requested by the current playback state. At a 390px browser viewport, document scroll width and client width were both **375px**, and recipe cards fit within their intended horizontal gallery.

Selected current views, captured from the deployed app:

- [Desktop overview, 1440×1000](release-desktop.png)
- [Scene gallery and explanations](release-gallery.png)
- [Mobile overview, 390×844](release-mobile.png)

These screenshots show those particular viewports and model states. They supplement the interaction tests; they do not substitute for every device or visual condition.
