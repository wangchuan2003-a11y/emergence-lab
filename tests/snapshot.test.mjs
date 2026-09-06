import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, defaults } from "../.test-build/engine.js";
import { ReactionDiffusion, reactions } from "../.test-build/reaction.js";
import {
  decodeSnapshot,
  encodeSnapshot,
  MAX_SNAPSHOT_BYTES,
} from "../.test-build/snapshot.js";
function particleSnapshot(s) {
  return {
    format: "emergence-lab",
    version: 1,
    kind: "particles",
    settings: { ...s.settings },
    palette: "lagoon",
    time: s.time,
    pulseRemaining: 0,
    x: Array.from(s.x),
    y: Array.from(s.y),
    vx: Array.from(s.vx),
    vy: Array.from(s.vy),
  };
}
test("particle checkpoint resumes the exact trajectory", () => {
  const original = new Simulation({ ...defaults, count: 100 });
  for (let t = 0; t < 40; t++) original.step();
  const data = decodeSnapshot(encodeSnapshot(particleSnapshot(original)));
  const restored = new Simulation(data.settings);
  for (const key of ["x", "y", "vx", "vy"]) restored[key].set(data[key]);
  restored.time = data.time;
  for (let t = 0; t < 20; t++) {
    original.step();
    restored.step();
  }
  assert.deepEqual(restored.x, original.x);
  assert.deepEqual(restored.vy, original.vy);
});
test("reaction checkpoint preserves inoculation and resumes exactly", () => {
  const original = new ReactionDiffusion("coral", 42);
  original.step(0.0545, 0.062, 50);
  original.inject(80, 45);
  const data = decodeSnapshot(
    encodeSnapshot({
      format: "emergence-lab",
      version: 1,
      kind: "reaction",
      settings: { ...defaults, preset: "coral" },
      palette: "ember",
      time: original.time,
      width: 256,
      height: 160,
      feed: 0.0545,
      kill: 0.062,
      rate: 8,
      a: Array.from(original.a),
      b: Array.from(original.b),
    }),
  );
  const restored = new ReactionDiffusion("coral", 42);
  restored.a.set(data.a);
  restored.b.set(data.b);
  restored.time = data.time;
  original.step(0.0545, 0.062, 20);
  restored.step(data.feed, data.kill, 20);
  assert.deepEqual(restored.b, original.b);
  assert.equal(restored.time, original.time);
});
test("bad versions, giant files, truncated arrays and nonfinite states fail", () => {
  const base = particleSnapshot(new Simulation({ ...defaults, count: 100 }));
  assert.throws(() => decodeSnapshot("{"));
  assert.throws(() => decodeSnapshot(" ".repeat(MAX_SNAPSHOT_BYTES + 1)));
  assert.throws(() => decodeSnapshot(JSON.stringify({ ...base, version: 99 })));
  assert.throws(() => decodeSnapshot(JSON.stringify({ ...base, x: [1] })));
  const invalid = structuredClone(base);
  invalid.x[0] = Infinity;
  assert.throws(() => encodeSnapshot(invalid));
});
test("mismatched mode and out-of-range data fail before model changes", () => {
  const base = particleSnapshot(new Simulation({ ...defaults, count: 100 }));
  assert.throws(() =>
    encodeSnapshot({
      ...base,
      settings: { ...base.settings, preset: "coral" },
    }),
  );
  assert.throws(() => encodeSnapshot({ ...base, pulseRemaining: -1 }));
  const outside = structuredClone(base);
  outside.x[0] = 1200;
  assert.throws(() => encodeSnapshot(outside));
});
test("unknown fields are stripped rather than retained as application state", () => {
  const base = particleSnapshot(new Simulation({ ...defaults, count: 100 }));
  const parsed = decodeSnapshot(JSON.stringify({ ...base, extra: "ignored" }));
  assert.equal(parsed.extra, undefined);
});
