import test from "node:test";
import assert from "node:assert/strict";
import { ReactionDiffusion, reactions } from "../.test-build/reaction.js";
test("Gray Scott uniform equilibrium remains unchanged", () => {
  const r = new ReactionDiffusion("coral", 42, 32, 24);
  r.a.fill(1);
  r.b.fill(0);
  r.step(0.0545, 0.062, 10);
  assert.ok(r.a.every((v) => v === 1));
  assert.ok(r.b.every((v) => v === 0));
});
test("one update agrees with independent periodic stencil calculation", () => {
  const r = new ReactionDiffusion("coral", 3, 8, 8);
  r.a.fill(0.8);
  r.b.fill(0.1);
  r.b[0] = 0.7;
  const A = Array.from(r.a),
    B = Array.from(r.b);
  const lap = (v, i) => {
    const x = i % 8,
      y = Math.floor(i / 8);
    let result = 0;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const j = ((y + oy + 8) % 8) * 8 + ((x + ox + 8) % 8);
        result +=
          v[j] *
          (ox === 0 && oy === 0 ? -1 : ox === 0 || oy === 0 ? 0.2 : 0.05);
      }
    return result;
  };
  r.step();
  for (let i = 0; i < 64; i++) {
    const ab2 = A[i] * B[i] * B[i];
    assert.ok(
      Math.abs(
        r.a[i] -
          Math.max(
            0,
            Math.min(1, A[i] + lap(A, i) - ab2 + 0.0545 * (1 - A[i])),
          ),
      ) < 1e-6,
    );
    assert.ok(
      Math.abs(
        r.b[i] -
          Math.max(
            0,
            Math.min(1, B[i] + 0.5 * lap(B, i) + ab2 - (0.062 + 0.0545) * B[i]),
          ),
      ) < 1e-6,
    );
  }
});
for (const preset of ["coral", "cells"])
  test(`${preset} seeded fields reproduce and remain bounded`, () => {
    const a = new ReactionDiffusion(preset, 41, 48, 32),
      b = new ReactionDiffusion(preset, 41, 48, 32);
    a.step(reactions[preset].feed, reactions[preset].kill, 500);
    b.step(reactions[preset].feed, reactions[preset].kill, 500);
    assert.deepEqual(a.b, b.b);
    assert.ok(a.a.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
    assert.ok(a.b.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
  });
test("inoculation and erase work at boundaries", () => {
  const r = new ReactionDiffusion("coral", 42, 32, 24);
  r.inject(0, 0, false, 2);
  assert.ok(r.b[0] > 0.7);
  r.inject(0, 0, true, 2);
  assert.equal(r.b[0], 0);
  assert.equal(r.a[0], 1);
});
test("palette rendering is opaque and does not change the model", () => {
  const r = new ReactionDiffusion("coral", 1, 32, 24),
    before = r.b.slice(),
    data = new Uint8ClampedArray(32 * 24 * 4);
  for (const palette of ["lagoon", "ember", "mono"]) r.pixels(data, palette);
  assert.ok(data.every((v, i) => i % 4 !== 3 || v === 255));
  assert.deepEqual(r.b, before);
});
test("invalid parameters fail explicitly", () => {
  const r = new ReactionDiffusion("coral", 1);
  assert.throws(() => r.step(NaN, 0.062), RangeError);
  assert.throws(() => r.step(0.1, -1), RangeError);
});

test("display-size default colonies remain active after growth", () => {
  for (const preset of ["coral", "cells"]) {
    const r = new ReactionDiffusion(preset, 42);
    r.step(reactions[preset].feed, reactions[preset].kill, 740);
    assert.ok(r.b.some((v) => v > 0.2));
  }
});
