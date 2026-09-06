export type NetworkSettings = {
  count: number;
  sensorDistance: number;
  sensorAngle: number;
  turnAngle: number;
  retention: number;
};

export const networkDefaults: NetworkSettings = {
  count: 4000,
  sensorDistance: 9,
  sensorAngle: 45,
  turnAngle: 45,
  retention: 0.95,
};

const TAU = Math.PI * 2;
const radians = Math.PI / 180;
const wrap = (value: number, size: number) => ((value % size) + size) % size;

function validateSettings(settings: NetworkSettings) {
  if (
    !settings ||
    !Number.isInteger(settings.count) ||
    settings.count < 500 ||
    settings.count > 10000 ||
    !Number.isFinite(settings.sensorDistance) ||
    settings.sensorDistance < 2 ||
    settings.sensorDistance > 24 ||
    !Number.isFinite(settings.sensorAngle) ||
    settings.sensorAngle < 10 ||
    settings.sensorAngle > 90 ||
    !Number.isFinite(settings.turnAngle) ||
    settings.turnAngle < 10 ||
    settings.turnAngle > 90 ||
    !Number.isFinite(settings.retention) ||
    settings.retention < 0.85 ||
    settings.retention > 0.999
  )
    throw new RangeError("Invalid network settings");
}

/** A stateless random sample. Snapshot restoration needs no RNG cursor. */
function sample(seed: number, time: number, index: number, channel = 0) {
  let hash =
    seed ^
    Math.imul(index + 1, 0x9e3779b1) ^
    Math.imul(time >>> 0, 0x85ebca6b) ^
    Math.imul(Math.floor(time / 4294967296), 0xc2b2ae35) ^
    Math.imul(channel + 1, 0x27d4eb2d);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

/** Physarum-inspired chemotaxis, not a precise reproduction of a biology paper.
 * Angles in settings are degrees; particle headings are radians, with y down.
 * Particles read the old field, move one grid unit, and deposit one arbitrary
 * unit. A periodic 3x3 box average then diffuses and decays the combined field.
 * Particles may overlap. There is no exclusion, growth, or nutrient metabolism.
 */
export class Physarum {
  x: Float32Array;
  y: Float32Array;
  heading: Float32Array;
  field: Float32Array;
  time = 0;
  settings: NetworkSettings;
  private nextField: Float32Array;
  private deposit: Float32Array;

  constructor(
    public readonly seed: number,
    settings: NetworkSettings = networkDefaults,
    public readonly width = 256,
    public readonly height = 160,
  ) {
    validateSettings(settings);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
      throw new RangeError("Network seed must be an unsigned 32-bit integer");
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 1024 ||
      height > 1024
    )
      throw new RangeError("Network dimensions must be integers in [1, 1024]");
    this.settings = { ...settings };
    this.x = new Float32Array(settings.count);
    this.y = new Float32Array(settings.count);
    this.heading = new Float32Array(settings.count);
    this.field = new Float32Array(width * height);
    this.nextField = new Float32Array(width * height);
    this.deposit = new Float32Array(width * height);
    // An initially unstructured population makes its later reorganization visible.
    for (let i = 0; i < settings.count; i++) {
      this.x[i] = Math.fround(sample(seed, 0, i, 1) * width) % width;
      this.y[i] = Math.fround(sample(seed, 0, i, 2) * height) % height;
      this.heading[i] = Math.fround(sample(seed, 0, i, 3) * TAU) % TAU;
    }
  }

  /** A periodic brush adds a transient attractant, or erases the local field. */
  inject(x: number, y: number, erase = false, radius = 5) {
    if (!Number.isFinite(radius) || radius < 0)
      throw new RangeError("Brush radius must be finite and nonnegative");
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const cx = Math.round(wrap(x, this.width)) % this.width,
      cy = Math.round(wrap(y, this.height)) % this.height;
    for (let py = 0; py < this.height; py++)
      for (let px = 0; px < this.width; px++) {
        const dx = Math.min(Math.abs(px - cx), this.width - Math.abs(px - cx)),
          dy = Math.min(Math.abs(py - cy), this.height - Math.abs(py - cy)),
          distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const index = py * this.width + px;
        this.field[index] = erase
          ? 0
          : this.field[index] + 8 * (1 - distance / (radius + 1));
      }
  }

  step(iterations = 1) {
    validateSettings(this.settings);
    if (!Number.isInteger(iterations) || iterations < 0 || iterations > 10000)
      throw new RangeError("Iterations must be an integer in [0, 10000]");
    if (
      !Number.isSafeInteger(this.time) ||
      this.time < 0 ||
      !Number.isSafeInteger(this.time + iterations)
    )
      throw new RangeError(
        "Network time must remain a nonnegative safe integer",
      );
    const { count, sensorDistance, sensorAngle, turnAngle, retention } =
        this.settings,
      width = this.width,
      height = this.height;
    if (
      this.x.length !== count ||
      this.y.length !== count ||
      this.heading.length !== count ||
      this.field.length !== width * height
    )
      throw new RangeError(
        "Network array sizes must match dimensions and count",
      );
    for (let i = 0; i < count; i++)
      if (
        !Number.isFinite(this.x[i]) ||
        !Number.isFinite(this.y[i]) ||
        !Number.isFinite(this.heading[i]) ||
        this.x[i] < 0 ||
        this.x[i] >= width ||
        this.y[i] < 0 ||
        this.y[i] >= height
      )
        throw new RangeError("Invalid network particle state");
    if (this.field.some((value) => !Number.isFinite(value) || value < 0))
      throw new RangeError(
        "Network concentration must be finite and nonnegative",
      );

    const angle = sensorAngle * radians,
      turn = turnAngle * radians,
      // Finite sensor response prevents one dense track from attracting forever.
      // This is an engineering saturation rule in arbitrary concentration units.
      sensorCeiling = Math.max(
        0.5,
        (((count / (width * height)) * retention) / (1 - retention)) * 2,
      );
    for (let iteration = 0; iteration < iterations; iteration++) {
      const field = this.field;
      this.deposit.fill(0);
      for (let i = 0; i < count; i++) {
        const x = this.x[i],
          y = this.y[i],
          heading = this.heading[i];
        const sense = (direction: number) =>
          Math.min(
            sensorCeiling,
            field[
              Math.floor(
                wrap(y + Math.sin(direction) * sensorDistance, height),
              ) *
                width +
                Math.floor(
                  wrap(x + Math.cos(direction) * sensorDistance, width),
                )
            ],
          );
        const forward = sense(heading),
          left = sense(heading - angle),
          right = sense(heading + angle),
          maximum = Math.max(forward, left, right);
        // When both flanks exceed the forward signal, explore either branch.
        // Otherwise choose among the strongest sensors, including straight ahead.
        const bifurcate = forward < left && forward < right;
        const straightBest = forward === maximum ? 1 : 0,
          leftBest = left === maximum ? 1 : 0,
          rightBest = right === maximum ? 1 : 0;
        const choice = Math.floor(
          sample(this.seed, this.time, i) *
            (straightBest + leftBest + rightBest),
        );
        const direction = bifurcate
          ? sample(this.seed, this.time, i) < 0.5
            ? -1
            : 1
          : choice < straightBest
            ? 0
            : choice < straightBest + leftBest
              ? -1
              : 1;
        const nextHeading = wrap(heading + direction * turn, TAU);
        this.heading[i] = Math.fround(nextHeading) % TAU;
        // Float32 can round a value just below the extent up to the extent.
        this.x[i] = Math.fround(wrap(x + Math.cos(nextHeading), width)) % width;
        this.y[i] =
          Math.fround(wrap(y + Math.sin(nextHeading), height)) % height;
        const index = Math.floor(this.y[i]) * width + Math.floor(this.x[i]);
        this.deposit[index] += 1;
      }
      // The scratch buffer is fully rebuilt every step; it carries no snapshot state.
      for (let i = 0; i < field.length; i++) this.deposit[i] += field[i];
      for (let y = 0; y < height; y++) {
        const above = ((y + height - 1) % height) * width,
          row = y * width,
          below = ((y + 1) % height) * width;
        for (let x = 0; x < width; x++) {
          const left = (x + width - 1) % width,
            right = (x + 1) % width,
            values = this.deposit;
          this.nextField[row + x] =
            ((values[above + left] +
              values[above + x] +
              values[above + right] +
              values[row + left] +
              values[row + x] +
              values[row + right] +
              values[below + left] +
              values[below + x] +
              values[below + right]) /
              9) *
            retention;
        }
      }
      this.field = this.nextField;
      this.nextField = field;
      this.time++;
    }
  }

  /** Light is a display transform of concentration; rendering never evolves it. */
  pixels(
    target: Uint8ClampedArray,
    palette: "lagoon" | "ember" | "mono" = "lagoon",
  ) {
    if (target.length !== this.width * this.height * 4)
      throw new RangeError("Pixel buffer must match network dimensions");
    if (palette !== "lagoon" && palette !== "ember" && palette !== "mono")
      throw new RangeError("Invalid network palette");
    const low =
        palette === "ember"
          ? [215, 68, 25]
          : palette === "mono"
            ? [125, 153, 180]
            : [17, 177, 165],
      high =
        palette === "ember"
          ? [255, 231, 157]
          : palette === "mono"
            ? [238, 248, 255]
            : [208, 250, 191],
      background = [4, 10, 16];
    const expectedMean =
      ((this.settings.count / this.field.length) * this.settings.retention) /
      (1 - this.settings.retention);
    const exposure = Math.max(0.5, expectedMean * 2);
    for (let i = 0; i < this.field.length; i++) {
      const signal = Math.max(0, this.field[i]) / exposure,
        glow = 1 - Math.exp(-signal * 1.7),
        core = 1 - Math.exp(-Math.max(0, signal - 0.55) * 0.7);
      for (let c = 0; c < 3; c++)
        target[i * 4 + c] =
          background[c] +
          (low[c] - background[c]) * glow +
          (high[c] - low[c]) * core;
      target[i * 4 + 3] = 255;
    }
  }
}
