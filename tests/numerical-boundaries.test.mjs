import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, defaults } from "../.test-build/engine.js";
import { ReactionDiffusion } from "../.test-build/reaction.js";

test("small periodic grids count each neighboring particle only once", () => {
  for (const [width, height] of [
    [100, 100],
    [110, 110],
    [100, 165],
    [165, 100],
  ]) {
    const sim = new Simulation(
      { ...defaults, count: 2, speed: 3, cohesion: 0, separation: 1 },
      width,
      height,
    );
    sim.x.set([50, 60]);
    sim.y.set([50, 50]);
    sim.vx.set([3, 3]);
    sim.vy.fill(0);
    sim.step();
    // One neighbor 10 units away contributes separation = 10 / (10^2 + 1).
    assert.ok(Math.abs(sim.vx[0] - (3 - (10 / 101) * 1.7)) < 1e-6);
    assert.ok(Math.abs(sim.vx[1] - (3 + (10 / 101) * 1.7)) < 1e-6);
  }
});

test("periodic particle interactions agree across an edge and in the interior", () => {
  const create = (xs) => {
    const sim = new Simulation({ ...defaults, count: 2 }, 220, 165);
    sim.x.set(xs);
    sim.y.fill(80);
    sim.vx.fill(2);
    sim.vy.fill(0);
    sim.step();
    return sim;
  };
  const middle = create([100, 110]),
    edge = create([215, 5]);
  assert.deepEqual(edge.vx, middle.vx);
  assert.deepEqual(edge.vy, middle.vy);
});

test("particles wrap even when a timestep crosses a tiny world more than once", () => {
  const sim = new Simulation({ ...defaults, count: 1, speed: 3 }, 1, 1);
  sim.vx[0] = -4;
  sim.vy[0] = -3;
  for (let step = 0; step < 10; step++) {
    sim.step();
    assert.ok(sim.x[0] >= 0 && sim.x[0] <= 1);
    assert.ok(sim.y[0] >= 0 && sim.y[0] <= 1);
  }
});

test("invalid particle allocation parameters fail before allocating or stepping", () => {
  for (const count of [0, -1, 1.5, NaN, Infinity, 1e12])
    assert.throws(() => new Simulation({ ...defaults, count }), RangeError);
  for (const dimension of [0, -1, 1.5, NaN, Infinity, 1e12]) {
    assert.throws(() => new Simulation(defaults, dimension, 100), RangeError);
    assert.throws(() => new Simulation(defaults, 100, dimension), RangeError);
  }
});

test("Float32 rounding cannot leave particles on the excluded upper boundary", () => {
  const sim = new Simulation({ ...defaults, count: 1, speed: 3 });
  sim.x[0] = 1196;
  sim.y[0] = 756;
  sim.vx[0] = 3.99999;
  sim.vy[0] = 3.99999;
  sim.step();
  assert.equal(sim.x[0], 0);
  assert.equal(sim.y[0], 0);
});

test("changed counts and invalid particle state fail before entering linked neighbors", () => {
  const sim = new Simulation({ ...defaults, count: 2 });
  sim.settings.count = 3;
  assert.throws(() => sim.step(), RangeError);
  sim.settings.count = 2;
  sim.x[0] = NaN;
  assert.throws(() => sim.step(), RangeError);
  assert.equal(sim.time, 0);
});

test("invalid movement settings cannot poison a trajectory", () => {
  for (const setting of [
    { speed: NaN },
    { speed: -1 },
    { cohesion: Infinity },
    { separation: NaN },
  ])
    assert.throws(
      () => new Simulation({ ...defaults, ...setting }),
      RangeError,
    );
  const sim = new Simulation({ ...defaults });
  sim.settings.speed = Infinity;
  assert.throws(() => sim.step(), RangeError);
  assert.equal(sim.time, 0);
});

test("reaction dimensions reject fractional, empty and excessive allocations", () => {
  for (const dimension of [0, -1, 8.5, NaN, Infinity, 1e12]) {
    assert.throws(
      () => new ReactionDiffusion("coral", 1, dimension, 8),
      RangeError,
    );
    assert.throws(
      () => new ReactionDiffusion("coral", 1, 8, dimension),
      RangeError,
    );
  }
  for (const [width, height] of [
    [1, 1],
    [1, 8],
    [8, 1],
    [8, 8],
  ]) {
    const sim = new ReactionDiffusion("coral", 1, width, height);
    sim.a.fill(1);
    sim.b.fill(0);
    sim.step();
    assert.ok(sim.a.every((v) => v === 1));
    assert.ok(sim.b.every((v) => v === 0));
  }
});

test("reaction iteration validation leaves the current field untouched", () => {
  const sim = new ReactionDiffusion("coral", 1, 8, 8),
    before = sim.b.slice();
  for (const iterations of [-1, 0.5, NaN, Infinity, 1e12])
    assert.throws(() => sim.step(undefined, undefined, iterations), RangeError);
  sim.step(undefined, undefined, 0);
  assert.equal(sim.time, 0);
  assert.deepEqual(sim.b, before);
});

test("reaction brushes reject invalid radii and clip large finite brushes to the field", () => {
  const sim = new ReactionDiffusion("coral", 1, 8, 8);
  for (const radius of [-1, NaN, Infinity])
    assert.throws(() => sim.inject(0, 0, false, radius), RangeError);
  sim.inject(0, 0, true, 1e12);
  assert.ok(sim.a.every((v) => v === 1));
  assert.ok(sim.b.every((v) => v === 0));
});
