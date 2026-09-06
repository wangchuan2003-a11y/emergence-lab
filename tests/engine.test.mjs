import test from "node:test";
import assert from "node:assert/strict";
import {
  Simulation,
  defaults,
  parseSettings,
  serialize,
  random,
} from "../.test-build/engine.js";
test("seeded RNG reproduces a stream", () => {
  const a = random(42),
    b = random(42);
  assert.deepEqual(
    Array.from({ length: 100 }, a),
    Array.from({ length: 100 }, b),
  );
});
test("same inputs reproduce trajectories", () => {
  const a = new Simulation({ ...defaults, count: 100 }),
    b = new Simulation({ ...defaults, count: 100 });
  for (let i = 0; i < 100; i++) {
    a.step();
    b.step();
  }
  assert.deepEqual(a.x, b.x);
  assert.deepEqual(a.vy, b.vy);
});
test("different seeds change the initial world", () => {
  assert.notDeepEqual(
    new Simulation(defaults).x,
    new Simulation({ ...defaults, seed: 43 }).x,
  );
});
for (const preset of ["flock", "orbit", "swarm"])
  test(`${preset}: positions stay bounded and speeds stay finite`, () => {
    const sim = new Simulation({ ...defaults, preset, count: 100 });
    for (let t = 0; t < 500; t++)
      sim.step(t % 2 ? { x: 600, y: 380, repel: true } : undefined);
    for (let i = 0; i < 100; i++) {
      assert.ok(sim.x[i] >= 0 && sim.x[i] < 1200);
      assert.ok(sim.y[i] >= 0 && sim.y[i] < 760);
      const v = Math.hypot(sim.vx[i], sim.vy[i]);
      assert.ok(
        Number.isFinite(v) &&
          v <= defaults.speed * 2 + 1e-5 &&
          v >= defaults.speed * 0.7 - 1e-5,
      );
    }
  });
test("share link roundtrip preserves every setting", () => {
  const s = {
    preset: "orbit",
    count: 900,
    speed: 2.1,
    cohesion: 1.2,
    separation: 0.4,
    seed: 123,
  };
  assert.deepEqual(parseSettings("#" + serialize(s)), s);
});
test("malformed share links are clamped safely", () => {
  const s = parseSettings(
    "#count=Infinity&speed=-7&cohesion=NaN&preset=script&seed=-99&separation=100",
  );
  assert.deepEqual(s, { ...defaults, speed: 0.3, seed: 0, separation: 2 });
});
test("empty settings use defaults", () =>
  assert.deepEqual(parseSettings(""), defaults));
test("pointer changes trajectory", () => {
  const a = new Simulation({ ...defaults, count: 100 }),
    b = new Simulation({ ...defaults, count: 100 });
  a.step();
  b.step({ x: 600, y: 380, repel: true });
  assert.notDeepEqual(a.vx, b.vx);
});
