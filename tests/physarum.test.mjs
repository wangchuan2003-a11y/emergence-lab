import test from "node:test";
import assert from "node:assert/strict";
import { Physarum, networkDefaults } from "../.test-build/physarum.js";

const settings = { ...networkDefaults, count: 500 };
const sum = (values) => values.reduce((total, value) => total + value, 0);
const state = (model) => ({
  x: model.x.slice(),
  y: model.y.slice(),
  heading: model.heading.slice(),
  field: model.field.slice(),
  time: model.time,
  settings: { ...model.settings },
});
const close = (actual, expected, tolerance = 1e-5) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

for (const [sensor, expected] of [
  ["forward", 0],
  ["left", (Math.PI * 7) / 4],
  ["right", Math.PI / 4],
]) {
  test(`a unique ${sensor} signal controls the next turn`, () => {
    const model = new Physarum(7, { ...settings, sensorDistance: 4 }, 32, 32);
    model.x.fill(16.5);
    model.y.fill(16.5);
    model.heading.fill(0);
    const probe = { forward: [20, 16], left: [19, 13], right: [19, 19] }[
      sensor
    ];
    model.field[probe[1] * 32 + probe[0]] = 9;
    model.step();
    for (const heading of model.heading) close(heading, expected);
  });
}

test("ties select only strongest directions and repeat without a random cursor", () => {
  const make = () => {
    const model = new Physarum(9, { ...settings, sensorDistance: 4 }, 32, 32);
    model.x.fill(16.5);
    model.y.fill(16.5);
    model.heading.fill(0);
    model.field[13 * 32 + 19] = model.field[19 * 32 + 19] = 9;
    return model;
  };
  const first = make(),
    second = make();
  first.step();
  second.step();
  assert.deepEqual(state(first), state(second));
  assert.ok(
    first.heading.every(
      (v) =>
        Math.abs(v - Math.PI / 4) < 1e-5 ||
        Math.abs(v - (Math.PI * 7) / 4) < 1e-5,
    ),
  );
  assert.ok(first.heading.some((v) => v < Math.PI));
  assert.ok(first.heading.some((v) => v > Math.PI));
});

test("empty-field ties include straight, left and right movement", () => {
  const model = new Physarum(12, settings, 32, 32);
  model.x.fill(16);
  model.y.fill(16);
  model.heading.fill(0);
  model.step();
  assert.equal(new Set(model.heading).size, 3);
});

test("both stronger flanks split exploration, and saturated sensors tie", () => {
  const model = new Physarum(12, { ...settings, sensorDistance: 4 }, 32, 32);
  model.x.fill(16.5);
  model.y.fill(16.5);
  model.heading.fill(0);
  model.field[13 * 32 + 19] = 8;
  model.field[19 * 32 + 19] = 9;
  model.step();
  assert.ok(model.heading.some((v) => v < Math.PI));
  assert.ok(model.heading.some((v) => v > Math.PI));
  assert.ok(model.heading.every((v) => v !== 0));

  model.field.fill(0);
  model.x.fill(16.5);
  model.y.fill(16.5);
  model.heading.fill(0);
  model.field[16 * 32 + 20] = 100;
  model.field[13 * 32 + 19] = 1000;
  model.step();
  // Both concentrations exceed the engineering sensor ceiling: greater absolute
  // concentration does not make the left track win every decision indefinitely.
  assert.ok(model.heading.some((v) => v === 0));
  assert.ok(model.heading.some((v) => v > Math.PI));
  assert.ok(model.heading.every((v) => v === 0 || v > Math.PI));
});

test("all particles sense the old field, regardless of earlier deposits", () => {
  const make = () => {
    const model = new Physarum(21, { ...settings, sensorDistance: 2 }, 32, 32);
    model.x.fill(20.5);
    model.y.fill(20.5);
    model.heading.fill(0);
    model.x[499] = 8.5;
    model.y[499] = 8.5;
    return model;
  };
  const distant = make(),
    nearby = make();
  // Earlier agents now deposit in the later agent's sensor region.
  nearby.x.fill(9.5, 0, 499);
  nearby.y.fill(8.5, 0, 499);
  distant.step();
  nearby.step();
  assert.equal(distant.heading[499], nearby.heading[499]);
  assert.equal(distant.x[499], nearby.x[499]);
  assert.equal(distant.y[499], nearby.y[499]);
  assert.notDeepEqual(distant.field, nearby.field);
});

test("a preceding particle's new deposit cannot override a weaker old forward signal", () => {
  const model = new Physarum(
    21,
    {
      ...settings,
      sensorDistance: 2,
      sensorAngle: 90,
      turnAngle: 90,
    },
    32,
    32,
  );
  model.x.fill(25);
  model.y.fill(25);
  model.heading.fill(0);
  model.x[0] = 11.25;
  model.y[0] = 12.25;
  model.x[1] = 10.25;
  model.y[1] = 12.25;
  model.heading[1] = -Math.PI / 2;
  model.field[12 * 32 + 13] = 4;
  model.field[10 * 32 + 10] = 0.5;
  model.step();
  close(model.x[0], 12.25);
  close(model.y[0], 12.25);
  close(model.x[1], 10.25);
  close(model.y[1], 11.25);
});

test("one diffusion step agrees with an independent periodic box stencil", () => {
  const model = new Physarum(3, { ...settings, retention: 0.9 }, 8, 6);
  model.field[0] = 8;
  model.field[27] = 3;
  const old = model.field.slice();
  model.step();
  const combined = Float32Array.from(old);
  for (let i = 0; i < model.x.length; i++)
    combined[Math.floor(model.y[i]) * 8 + Math.floor(model.x[i])]++;
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 8; x++) {
      let average = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          average += combined[((y + dy + 6) % 6) * 8 + ((x + dx + 8) % 8)] / 9;
      close(model.field[y * 8 + x], average * 0.9);
    }
});

test("existing uniform concentration decays by retention independently of deposit", () => {
  const empty = new Physarum(9, settings, 32, 24),
    filled = new Physarum(9, settings, 32, 24);
  filled.field.fill(10);
  empty.step();
  filled.step();
  assert.deepEqual(empty.x, filled.x);
  assert.deepEqual(empty.heading, filled.heading);
  for (let i = 0; i < filled.field.length; i++)
    close(filled.field[i] - empty.field[i], 9.5);
  close(sum(empty.field), settings.count * settings.retention, 0.001);
  const mass = sum(filled.field);
  filled.step();
  close(sum(filled.field), (mass + settings.count) * settings.retention, 0.001);
});

test("sensors, movement and brushes wrap around both periodic edges", () => {
  const make = (x, y) => {
    const model = new Physarum(1, { ...settings, sensorDistance: 4 }, 16, 16);
    model.x.fill(x);
    model.y.fill(y);
    model.heading.fill(0);
    model.field[Math.floor(y) * 16 + ((Math.floor(x) + 4) % 16)] = 10;
    return model;
  };
  const inside = make(7.5, 8.5),
    edge = make(15.5, 8.5);
  inside.step();
  edge.step();
  assert.deepEqual(inside.heading, edge.heading);
  assert.ok(edge.x.every((value) => value === 0.5));
  edge.field.fill(0);
  edge.inject(0, 0, false, 1);
  assert.ok(edge.field[15] > 0 && edge.field[15 * 16] > 0);
  edge.inject(16, 16, true, 1);
  assert.ok(edge.field.every((value) => value === 0));
  const tiny = new Physarum(2, settings, 1, 1);
  tiny.step(20);
  assert.ok(tiny.x.every((value) => value >= 0 && value < 1));
  assert.ok(tiny.y.every((value) => value >= 0 && value < 1));
});

test("Float32 rounding at the right edge still stores a canonical coordinate", () => {
  const model = new Physarum(1, { ...settings, sensorDistance: 2 }, 256, 16);
  model.x.fill(255);
  model.y.fill(5);
  model.heading.fill(0.0001);
  model.field[5 * 256] = 10;
  model.step();
  assert.ok(model.x.every((value) => value === 0));
  assert.ok(model.y.every((value) => value >= 5 && value < 6));
});

test("same seed reproduces long runs and defaults remain finite", () => {
  const first = new Physarum(42),
    second = new Physarum(42);
  assert.notDeepEqual(first.x, new Physarum(43).x);
  first.step(500);
  second.step(500);
  assert.deepEqual(state(first), state(second));
  assert.equal(first.time, 500);
  assert.ok(first.field.every((v) => Number.isFinite(v) && v >= 0));
  assert.ok(first.field.some((v) => v > 1));
  assert.ok(first.x.every((v) => v >= 0 && v < first.width));
  assert.ok(first.y.every((v) => v >= 0 && v < first.height));
});

test("copying public arrays, settings and time restores exact continuation", () => {
  const first = new Physarum(42, settings, 48, 32);
  first.step(37);
  first.inject(4, 7);
  first.settings.sensorAngle = 67;
  // Force ambiguous probes at restoration; hidden random state would diverge.
  first.field.fill(0);
  const restored = new Physarum(
    first.seed,
    first.settings,
    first.width,
    first.height,
  );
  for (const key of ["x", "y", "heading", "field"])
    restored[key].set(first[key]);
  restored.time = first.time;
  first.step(25);
  for (let i = 0; i < 25; i++) restored.step();
  assert.deepEqual(state(first), state(restored));
});

test("parameters, dimensions, iteration counts and changed array sizes reject invalid input", () => {
  for (const invalid of [
    { count: 499 },
    { count: 10001 },
    { count: 500.5 },
    { count: NaN },
    { sensorDistance: 1 },
    { sensorDistance: 25 },
    { sensorDistance: Infinity },
    { sensorAngle: 9 },
    { sensorAngle: 91 },
    { sensorAngle: NaN },
    { turnAngle: 9 },
    { turnAngle: 91 },
    { turnAngle: Infinity },
    { retention: 0.849 },
    { retention: 1 },
    { retention: NaN },
  ])
    assert.throws(
      () => new Physarum(1, { ...settings, ...invalid }),
      RangeError,
    );
  for (const bad of [0, -1, 1.5, 1025, NaN, Infinity]) {
    assert.throws(() => new Physarum(1, settings, bad, 8), RangeError);
    assert.throws(() => new Physarum(1, settings, 8, bad), RangeError);
  }
  for (const bad of [-1, 1.5, NaN, Infinity, 4294967296])
    assert.throws(() => new Physarum(bad, settings), RangeError);
  const model = new Physarum(4, settings, 32, 24),
    before = state(model);
  for (const bad of [-1, 0.5, NaN, Infinity, 10001])
    assert.throws(() => model.step(bad), RangeError);
  model.step(0);
  assert.deepEqual(state(model), before);
  for (const bad of [-1, NaN, Infinity])
    assert.throws(() => model.inject(0, 0, false, bad), RangeError);
  model.settings.count = 501;
  assert.throws(() => model.step(), RangeError);
  assert.equal(model.time, 0);
  model.settings.count = 500;
  model.settings.retention = NaN;
  assert.throws(() => model.step(), RangeError);
  model.settings.retention = settings.retention;
  model.time = Number.MAX_SAFE_INTEGER;
  assert.throws(() => model.step(), RangeError);
});

test("invalid restored state fails before modifying any particle", () => {
  for (const key of ["x", "y", "heading", "field"]) {
    const model = new Physarum(2, settings, 16, 16);
    model[key][model[key].length - 1] = NaN;
    const before = state(model);
    assert.throws(() => model.step(), RangeError);
    assert.deepEqual(state(model), before);
  }
});

test("all palettes produce opaque distinct pixels without changing state", () => {
  const model = new Physarum(12, settings, 48, 32);
  model.step(30);
  const before = state(model),
    images = [];
  for (const palette of ["lagoon", "ember", "mono"]) {
    const target = new Uint8ClampedArray(model.field.length * 4);
    model.pixels(target, palette);
    images.push(target);
    assert.ok(target.every((value, i) => i % 4 !== 3 || value === 255));
    assert.deepEqual(state(model), before);
  }
  assert.notDeepEqual(images[0], images[1]);
  assert.notDeepEqual(images[1], images[2]);
  assert.throws(() => model.pixels(new Uint8ClampedArray(4)), RangeError);
});
