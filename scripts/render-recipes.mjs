/** Rebuild the real model previews: npm test && node scripts/render-recipes.mjs.
 * Requires the existing ffmpeg installation on PATH. No browser or AI images.
 * Models retain their native 256x160 domain; only the PNG display is 512x320.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ReactionDiffusion } from "../.test-build/reaction.js";
import { Physarum } from "../.test-build/physarum.js";
import { recipes } from "../.test-build/recipes.js";

const directory = new URL("../src/assets/recipes/", import.meta.url);
await mkdir(directory, { recursive: true });

function encodePng(pixels, width, height, output) {
  return new Promise((resolve, reject) => {
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
        `${width}x${height}`,
        "-i",
        "pipe:0",
        "-vf",
        "scale=512:320:flags=bilinear",
        "-frames:v",
        "1",
        "-pix_fmt",
        "rgb24",
        "-compression_level",
        "9",
        "-update",
        "1",
        "-y",
        output,
      ],
      { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] },
    );
    let errors = "";
    encoder.stderr.on("data", (chunk) => {
      errors = (errors + chunk).slice(-4000);
    });
    encoder.on("error", reject);
    encoder.stdin.on("error", reject);
    encoder.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(errors || `ffmpeg exited ${code}`)),
    );
    encoder.stdin.end(Buffer.from(pixels));
  });
}

for (const recipe of recipes) {
  const model =
    recipe.kind === "reaction"
      ? new ReactionDiffusion(recipe.preset, recipe.seed)
      : new Physarum(recipe.seed, recipe.network);
  if (recipe.kind === "reaction")
    model.step(recipe.feed, recipe.kill, recipe.steps);
  else model.step(recipe.steps);
  assert.equal(model.time, recipe.steps);

  const field = recipe.kind === "reaction" ? model.b : model.field;
  let minimum = Infinity,
    maximum = -Infinity,
    total = 0;
  for (const value of field) {
    assert.ok(Number.isFinite(value) && value >= 0);
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
    total += value;
  }
  assert.ok(maximum - minimum > 0.01, `${recipe.id}: concentration is flat`);

  const pixels = new Uint8ClampedArray(model.width * model.height * 4);
  model.pixels(pixels, recipe.palette);
  const output = fileURLToPath(new URL(`${recipe.id}.png`, directory));
  await encodePng(pixels, model.width, model.height, output);
  console.log(
    JSON.stringify({
      id: recipe.id,
      steps: model.time,
      seed: recipe.seed,
      modelSize: [model.width, model.height],
      previewSize: [512, 320],
      concentration: { minimum, maximum, mean: total / field.length },
      pixelsSha256: createHash("sha256").update(pixels).digest("hex"),
      output,
    }),
  );
}
