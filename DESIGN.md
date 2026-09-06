# Design

## Visual system
An interactive exhibit: warm ivory page, dark simulation stage, restrained sage controls and three particle colors. The live algorithm is the visual centerpiece. Desktop places controls next to the stage; mobile puts them below it.

## Tokens
- Page: #f3f2ea; ink: #202927; stage: #111718.
- Particles: #d9f87e, #a3dad3, #efb88d.
- Self-hosted Manrope and JetBrains Mono; Chinese falls back to the platform's CJK sans.
- Main container: 1600px maximum, 5vw gutters, 6vw on mobile.
- Breakpoints: 1000px and 720px; simulation aspect ratio is preserved through letterboxing.

## Interaction
Local controls update the simulation immediately. The active preset uses a tinted fill and aria-pressed. Seeds and shared URLs preserve initial parameters. Motion is user-controlled and initially paused with reduced-motion preference. Semantic buttons, labelled controls and focus rings support keyboard access.

## Verification
Desktop and 390px mobile manually inspected in the browser. Controls, seed and share behavior are also covered by Playwright tests. A bounded final review inspected the source and saved screenshots: `docs/desktop.png` shows the ordinary desktop viewport with an undistorted orbit; `docs/mobile.png` shows the mobile controls at a scrolled position. These images establish visible layout only, not full-page coverage or live interaction. The fullscreen minimum-height fix was confirmed in CSS, without a separate fullscreen device test. This final review did not rerun Playwright or audit its test coverage. These checks cover this release, not every device or assistive technology.
