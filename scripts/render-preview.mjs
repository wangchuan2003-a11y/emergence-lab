/** Optional developer artifact. Run npm test first; ffmpeg must be on PATH. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ReactionDiffusion } from "../.test-build/reaction.js";
import { Physarum } from "../.test-build/physarum.js";

const output = fileURLToPath(
  new URL("../docs/emergence-preview.gif", import.meta.url),
);
await mkdir(new URL("../docs/", import.meta.url), { recursive: true });
const coral = new ReactionDiffusion("coral", 42),
  network = new Physarum(42);
coral.step(0.0545, 0.062, 240);
network.step(120);
const left = new Uint8ClampedArray(256 * 160 * 4),
  right = new Uint8ClampedArray(left.length),
  frame = new Uint8Array(512 * 160 * 4);
const encoder = spawn(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "rawvideo",
    "-pixel_format",
    "rgba",
    "-video_size",
    "512x160",
    "-framerate",
    "15",
    "-i",
    "pipe:0",
    "-filter_complex",
    "[0:v]split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a",
    "-loop",
    "0",
    "-y",
    output,
  ],
  { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] },
);
let errors = "";
encoder.stderr.on("data", (chunk) => {
  errors = (errors + chunk).slice(-4000);
});
const completed = new Promise((resolve, reject) => {
  encoder.on("error", reject);
  encoder.on("exit", (code) =>
    code === 0
      ? resolve()
      : reject(new Error(errors || `ffmpeg exited ${code}`)),
  );
});
for (let i = 0; i < 45; i++) {
  coral.pixels(left, "ember");
  network.pixels(right, "lagoon");
  for (let y = 0; y < 160; y++) {
    frame.set(left.subarray(y * 1024, (y + 1) * 1024), y * 2048);
    frame.set(right.subarray(y * 1024, (y + 1) * 1024), y * 2048 + 1024);
  }
  if (!encoder.stdin.write(Buffer.from(frame)))
    await once(encoder.stdin, "drain");
  coral.step(0.0545, 0.062, 32);
  network.step(8);
}
encoder.stdin.end();
await completed;
console.log("Wrote 45-frame preview: docs/emergence-preview.gif");
