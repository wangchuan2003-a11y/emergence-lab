import { random } from "./engine.js";

export type BioPreset = "coral" | "cells";
export const reactions = {
  coral: { feed: 0.0545, kill: 0.062 },
  cells: { feed: 0.0367, kill: 0.0649 },
};

/** Gray–Scott, explicit Euler dt=1, DA=1, DB=.5.
 * Periodic boundary; nine-point Laplacian (-1, .2, .05).
 * Two buffers ensure every cell reads the same simulation timestep.
 * This is a chemical pattern model, not biological cell simulation.
 */
export class ReactionDiffusion {
  a: Float32Array;
  b: Float32Array;
  private nextA: Float32Array;
  private nextB: Float32Array;
  private left: Int32Array;
  private right: Int32Array;
  private above: Int32Array;
  private below: Int32Array;
  time = 0;
  constructor(
    public preset: BioPreset,
    seed: number,
    public width = 256,
    public height = 160,
  ) {
    const size = width * height;
    this.a = new Float32Array(size).fill(1);
    this.b = new Float32Array(size);
    this.nextA = new Float32Array(size);
    this.nextB = new Float32Array(size);
    this.left = Int32Array.from(
      { length: width },
      (_, x) => (x + width - 1) % width,
    );
    this.right = Int32Array.from({ length: width }, (_, x) => (x + 1) % width);
    this.above = Int32Array.from(
      { length: height },
      (_, y) => ((y + height - 1) % height) * width,
    );
    this.below = Int32Array.from(
      { length: height },
      (_, y) => ((y + 1) % height) * width,
    );
    const rng = random(seed);
    // Multiple seeded inoculations make growth observable across the field.
    for (let i = 0; i < 24; i++)
      this.inject(
        width * (0.12 + rng() * 0.76),
        height * (0.12 + rng() * 0.76),
        false,
        2 + rng() * 3,
      );
  }
  inject(x: number, y: number, erase = false, radius = 5) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    for (let oy = -Math.ceil(radius); oy <= radius; oy++)
      for (let ox = -Math.ceil(radius); ox <= radius; ox++) {
        if (ox * ox + oy * oy > radius * radius) continue;
        const px = Math.round(x) + ox,
          py = Math.round(y) + oy;
        if (px < 0 || py < 0 || px >= this.width || py >= this.height) continue;
        const i = py * this.width + px;
        this.a[i] = erase ? 1 : 0.5;
        this.b[i] = erase ? 0 : 0.8;
      }
  }
  step(
    feed = reactions[this.preset].feed,
    kill = reactions[this.preset].kill,
    iterations = 1,
  ) {
    if (
      !Number.isFinite(feed) ||
      !Number.isFinite(kill) ||
      feed < 0 ||
      feed > 0.1 ||
      kill < 0 ||
      kill > 0.1
    )
      throw new RangeError("Invalid reaction parameters");
    for (let t = 0; t < iterations; t++) {
      const a = this.a,
        b = this.b,
        na = this.nextA,
        nb = this.nextB,
        w = this.width;
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x,
            l = y * w + this.left[x],
            r = y * w + this.right[x],
            u = this.above[y],
            d = this.below[y];
          const la =
            -a[i] +
            0.2 * (a[l] + a[r] + a[u + x] + a[d + x]) +
            0.05 *
              (a[u + this.left[x]] +
                a[u + this.right[x]] +
                a[d + this.left[x]] +
                a[d + this.right[x]]);
          const lb =
            -b[i] +
            0.2 * (b[l] + b[r] + b[u + x] + b[d + x]) +
            0.05 *
              (b[u + this.left[x]] +
                b[u + this.right[x]] +
                b[d + this.left[x]] +
                b[d + this.right[x]]);
          const reaction = a[i] * b[i] * b[i];
          na[i] = Math.max(
            0,
            Math.min(1, a[i] + la - reaction + feed * (1 - a[i])),
          );
          nb[i] = Math.max(
            0,
            Math.min(1, b[i] + 0.5 * lb + reaction - (kill + feed) * b[i]),
          );
        }
      this.nextA = a;
      this.nextB = b;
      this.a = na;
      this.b = nb;
      this.time++;
    }
  }
  /** Render concentration as a relief surface, preserving the underlying field. */
  pixels(
    target: Uint8ClampedArray,
    palette: "lagoon" | "ember" | "mono" = "lagoon",
  ) {
    const low =
      palette === "ember"
        ? [195, 73, 42]
        : palette === "mono"
          ? [150, 170, 185]
          : [25, 153, 148];
    const high =
      palette === "ember"
        ? [255, 219, 149]
        : palette === "mono"
          ? [235, 247, 255]
          : [204, 242, 183];
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x,
          v = this.b[i],
          level = Math.min(1, v * 2.5);
        const gradient =
          (this.b[y * this.width + this.left[x]] -
            this.b[y * this.width + this.right[x]]) *
            2.4 +
          (this.b[this.above[y] + x] - this.b[this.below[y] + x]) * 3.2;
        const light = Math.max(0.25, Math.min(1.6, 0.85 + gradient));
        const edge = Math.max(0, 1 - Math.abs(level - 0.43) * 8) * 0.32;
        for (let c = 0; c < 3; c++)
          target[i * 4 + c] = Math.min(
            255,
            (low[c] + (high[c] - low[c]) * level) * level * light +
              edge * high[c] +
              [7, 15, 20][c] * (1 - level),
          );
        target[i * 4 + 3] = 255;
      }
  }
}
