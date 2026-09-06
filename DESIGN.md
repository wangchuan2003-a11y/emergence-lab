# Design

## Current visual language

A dark interactive exhibit: the live model leads, controls remain explicit, and scientific/model boundaries are readable. The original ivory prototype is historical; current decisions below describe the shipped navy/cyan/sage interface. Earlier changes remain in Git history and docs/iterations.md.

## Foundations

- Page #0b1118, stage #070f14, panel #111d25, pale sage accents #a7e8c9, light text with muted cyan secondary text.
- Self-hosted Manrope and JetBrains Mono; platform CJK sans fallback. Mono is reserved for measurements and compact technical metadata.
- 1600px maximum content width, 5vw desktop / 6vw mobile gutters; principal breakpoints 1000px and 720px.
- Desktop lab: 800px frame, independently scrollable controls, directly accessible stage pause/pulse/fullscreen actions. Mobile stacks stage and controls.
- Domain-preserving renderer: fit and pointer mapping share the same native coordinate transform. Letterboxing is intentional; high-resolution PNG export removes it.

## Interaction and presentation

Controls use semantic buttons, labels, aria-pressed state and visible focus. Only a focused canvas receives simulation shortcuts. Reduced-motion preference starts the model paused. Model previews are actual rendered data, not decorative generated art. Palette and relief lighting change the presentation rather than model evolution.

Recipes appear as a horizontal gallery on mobile and a three-column gallery on desktop. Preparation has a real progress indicator and cancellation. The old experiment remains intact until preparation succeeds. History, imports and recording are explicit states with bounded resources.

Language switching preserves the experiment and capture state. Static translations retain their source keys; dynamic status comes from the same dictionary. The offline indicator describes an available copy; the build link identifies the loaded bundle and can differ from the newest repository commit.

## Verification boundary

Desktop and 390px mobile surfaces have been inspected during implementation. Automated Chromium desktop/mobile and Firefox desktop cases verify the major workflows; this is not a claim of every device or assistive-technology configuration. Current evidence belongs in docs/verification.md, with historical screenshots/iterations clearly labelled.
