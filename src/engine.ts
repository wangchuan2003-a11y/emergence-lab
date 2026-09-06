export type Preset = "flock" | "orbit" | "swarm" | "coral" | "cells";
export interface Settings {
  preset: Preset;
  count: number;
  speed: number;
  cohesion: number;
  separation: number;
  seed: number;
}
export const defaults: Settings = {
  preset: "flock",
  count: 600,
  speed: 1.5,
  cohesion: 0.6,
  separation: 1.1,
  seed: 42,
};
export function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function parseSettings(hash: string): Settings {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const num = (key: string, fallback: number, min: number, max: number) => {
    const raw = q.get(key);
    const v = raw === null || raw.trim() === "" ? fallback : Number(raw);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  };
  return {
    preset: ["flock", "orbit", "swarm", "coral", "cells"].includes(
      q.get("preset") ?? "",
    )
      ? (q.get("preset") as Preset)
      : "flock",
    count: Math.round(num("count", 600, 100, 1400)),
    speed: num("speed", 1.5, 0.3, 3),
    cohesion: num("cohesion", 0.6, 0, 2),
    separation: num("separation", 1.1, 0, 2),
    seed: Math.round(num("seed", 42, 0, 999999)),
  };
}
export function serialize(s: Settings) {
  return new URLSearchParams(
    Object.entries(s).map(([k, v]) => [k, String(v)]),
  ).toString();
}
function validateSettings(settings: Settings) {
  if (
    !Number.isInteger(settings.count) ||
    settings.count < 1 ||
    settings.count > 1400 ||
    !Number.isFinite(settings.speed) ||
    settings.speed <= 0 ||
    settings.speed > 3 ||
    !Number.isFinite(settings.cohesion) ||
    settings.cohesion < 0 ||
    settings.cohesion > 2 ||
    !Number.isFinite(settings.separation) ||
    settings.separation < 0 ||
    settings.separation > 2
  )
    throw new RangeError("Invalid particle settings");
}
export class Simulation {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  private nextX: Float32Array;
  private nextY: Float32Array;
  private heads = new Int32Array(0);
  private links: Int32Array;
  time = 0;
  constructor(
    public settings: Settings,
    public readonly width = 1200,
    public readonly height = 760,
  ) {
    validateSettings(settings);
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 16384 ||
      height > 16384
    )
      throw new RangeError(
        "Particle dimensions must be integers in [1, 16384]",
      );
    const n = settings.count;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.nextX = new Float32Array(n);
    this.nextY = new Float32Array(n);
    this.links = new Int32Array(n);
    const rng = random(settings.seed);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2,
        r = Math.sqrt(rng()) * Math.min(width, height) * 0.42;
      this.x[i] = width / 2 + Math.cos(a) * r;
      this.y[i] = height / 2 + Math.sin(a) * r;
      this.vx[i] = Math.cos(a + Math.PI / 2) * 2;
      this.vy[i] = Math.sin(a + Math.PI / 2) * 2;
    }
  }
  step(pointer?: { x: number; y: number; repel: boolean }) {
    validateSettings(this.settings);
    const { count: n, speed, cohesion, separation, preset } = this.settings;
    if (n !== this.x.length)
      throw new RangeError("Recreate the simulation to change particle count");
    const radius = 55,
      cols = Math.max(1, Math.floor(this.width / radius)),
      rows = Math.max(1, Math.floor(this.height / radius)),
      cw = this.width / cols,
      ch = this.height / rows;
    if (this.heads.length !== cols * rows)
      this.heads = new Int32Array(cols * rows);
    this.heads.fill(-1);
    for (let i = 0; i < n; i++) {
      if (
        !Number.isFinite(this.x[i]) ||
        !Number.isFinite(this.y[i]) ||
        !Number.isFinite(this.vx[i]) ||
        !Number.isFinite(this.vy[i]) ||
        this.x[i] < 0 ||
        this.x[i] > this.width ||
        this.y[i] < 0 ||
        this.y[i] > this.height
      )
        throw new RangeError("Invalid particle state");
      const c =
        Math.min(cols - 1, Math.floor(this.x[i] / cw)) +
        Math.min(rows - 1, Math.floor(this.y[i] / ch)) * cols;
      this.links[i] = this.heads[c];
      this.heads[c] = i;
    }
    for (let i = 0; i < n; i++) {
      let ax = 0,
        ay = 0,
        sx = 0,
        sy = 0,
        dxSum = 0,
        dySum = 0,
        avx = 0,
        avy = 0,
        neighbors = 0;
      const cx = Math.floor(this.x[i] / cw),
        cy = Math.floor(this.y[i] / ch);
      // A wrapped axis with only one or two cells must visit each cell once.
      for (let oy = -1; oy <= Math.min(1, rows - 2); oy++)
        for (let ox = -1; ox <= Math.min(1, cols - 2); ox++) {
          const c =
            ((cx + ox + cols) % cols) + ((cy + oy + rows) % rows) * cols;
          for (let j = this.heads[c]; j !== -1; j = this.links[j]) {
            if (i === j) continue;
            let dx = this.x[j] - this.x[i],
              dy = this.y[j] - this.y[i];
            if (dx > this.width / 2) dx -= this.width;
            if (dx < -this.width / 2) dx += this.width;
            if (dy > this.height / 2) dy -= this.height;
            if (dy < -this.height / 2) dy += this.height;
            const d2 = dx * dx + dy * dy;
            if (d2 > radius * radius || d2 < 0.001) continue;
            neighbors++;
            dxSum += dx;
            dySum += dy;
            avx += this.vx[j];
            avy += this.vy[j];
            if (d2 < 400) {
              sx -= dx / (d2 + 1);
              sy -= dy / (d2 + 1);
            }
          }
        }
      if (neighbors) {
        ax +=
          (dxSum / neighbors) * 0.0025 * cohesion +
          (avx / neighbors - this.vx[i]) * 0.045;
        ay +=
          (dySum / neighbors) * 0.0025 * cohesion +
          (avy / neighbors - this.vy[i]) * 0.045;
      }
      ax += sx * separation * 1.7;
      ay += sy * separation * 1.7;
      if (preset === "orbit") {
        const dx = this.x[i] - this.width / 2,
          dy = this.y[i] - this.height / 2,
          d = Math.max(1, Math.hypot(dx, dy)),
          target = Math.min(this.width, this.height) * 0.28;
        ax += (-dy / d) * 0.06 - (dx / d) * (d - target) * 0.001;
        ay += (dx / d) * 0.06 - (dy / d) * (d - target) * 0.001;
      }
      if (preset === "swarm") {
        const a =
          Math.sin(this.x[i] * 0.008 + this.time * 0.008) *
          Math.cos(this.y[i] * 0.006 - this.time * 0.005) *
          Math.PI *
          2;
        ax += Math.cos(a) * 0.11;
        ay += Math.sin(a) * 0.11;
      }
      if (pointer) {
        const dx = pointer.x - this.x[i],
          dy = pointer.y - this.y[i],
          d = Math.max(1, Math.hypot(dx, dy));
        if (d < 220) {
          const f = (1 - d / 220) * (pointer.repel ? -0.9 : 0.24);
          ax += (dx / d) * f;
          ay += (dy / d) * f;
        }
      }
      let vx = this.vx[i] + ax,
        vy = this.vy[i] + ay;
      const v = Math.hypot(vx, vy),
        max = speed * 2,
        min = speed * 0.7;
      if (v > max) {
        vx = (vx / v) * max;
        vy = (vy / v) * max;
      } else if (v < min) {
        if (v < 1e-6) {
          vx = min;
          vy = 0;
        } else {
          vx = (vx / v) * min;
          vy = (vy / v) * min;
        }
      }
      this.nextX[i] = vx;
      this.nextY[i] = vy;
    }
    for (let i = 0; i < n; i++) {
      this.vx[i] = this.nextX[i];
      this.vy[i] = this.nextY[i];
      this.x[i] = (this.x[i] + this.vx[i] + this.width) % this.width;
      this.y[i] = (this.y[i] + this.vy[i] + this.height) % this.height;
      if (this.x[i] < 0) this.x[i] += this.width;
      if (this.y[i] < 0) this.y[i] += this.height;
      // Float32 rounding can turn a value just below the edge into the edge.
      if (this.x[i] === this.width) this.x[i] = 0;
      if (this.y[i] === this.height) this.y[i] = 0;
    }
    this.time++;
  }
}
