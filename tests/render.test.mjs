import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, defaults } from "../.test-build/engine.js";
import { ReactionDiffusion } from "../.test-build/reaction.js";
import { Physarum, networkDefaults } from "../.test-build/physarum.js";
import {
  createRenderer,
  fitView,
  getDomain,
  pointToDomain,
} from "../.test-build/render.js";

const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("model dimensions define the render domain without a browser", () => {
  const sources = [
    { kind: "particles", model: new Simulation({ ...defaults, count: 1 }) },
    { kind: "reaction", model: new ReactionDiffusion("coral", 42) },
    {
      kind: "network",
      model: new Physarum(42, { ...networkDefaults, count: 500 }),
      showAgents: true,
    },
  ];
  assert.deepEqual(sources.map(getDomain), [
    { width: 1200, height: 760 },
    { width: 256, height: 160 },
    { width: 256, height: 160 },
  ]);
  assert.deepEqual(
    getDomain({
      kind: "reaction",
      model: new ReactionDiffusion("cells", 1, 32, 24),
    }),
    { width: 32, height: 24 },
  );
  assert.equal(typeof createRenderer().paint, "function");
});

test("field fit preserves native aspect with letterboxing instead of stretching", () => {
  assert.deepEqual(fitView(1200, 760, 256, 160), {
    scale: 4.6875,
    x: 0,
    y: 5,
    width: 1200,
    height: 750,
  });
  assert.deepEqual(fitView(1200, 760, 1200, 760), {
    scale: 1,
    x: 0,
    y: 0,
    width: 1200,
    height: 760,
  });
});

test("fit and inverse work for portrait, wide, fullscreen and export canvases", () => {
  for (const [domainWidth, domainHeight] of [
    [1200, 760],
    [256, 160],
  ]) {
    for (const [canvasWidth, canvasHeight] of [
      [375, 640],
      [1800, 500],
      [1920, 1080],
      [1920, 1200],
      [3840, 2400],
    ]) {
      const view = fitView(
        canvasWidth,
        canvasHeight,
        domainWidth,
        domainHeight,
      );
      close(view.width / view.height, domainWidth / domainHeight);
      close(view.x * 2 + view.width, canvasWidth);
      close(view.y * 2 + view.height, canvasHeight);
      assert.ok(view.width <= canvasWidth + 1e-9);
      assert.ok(view.height <= canvasHeight + 1e-9);
      for (const [x, y] of [
        [0, 0],
        [domainWidth / 2, domainHeight / 2],
        [domainWidth - 0.1, domainHeight - 0.1],
      ]) {
        const mapped = pointToDomain(
          view,
          view.x + x * view.scale,
          view.y + y * view.scale,
        );
        close(mapped.x, x);
        close(mapped.y, y);
        assert.equal(mapped.inside, true);
      }
    }
  }
});

test("letterbox and right/bottom edges reject drawing without clamping coordinates", () => {
  const view = fitView(1200, 760, 256, 160);
  assert.deepEqual(pointToDomain(view, 0, 5), { x: 0, y: 0, inside: true });
  assert.equal(pointToDomain(view, 600, 2).inside, false);
  assert.equal(pointToDomain(view, 600, 758).inside, false);
  assert.equal(pointToDomain(view, 1200, 380).inside, false);
  assert.equal(pointToDomain(view, 600, 755).inside, false);
  assert.ok(pointToDomain(view, -1, 5).x < 0);
  assert.ok(pointToDomain(view, 1201, 380).x > 256);
  const sideBars = fitView(1920, 500, 256, 160);
  assert.equal(pointToDomain(sideBars, 0, 250).inside, false);
  assert.equal(pointToDomain(sideBars, 1919, 250).inside, false);
});

test("zero dimensions produce a finite empty view and cannot hit the domain", () => {
  for (let dimension = 0; dimension < 4; dimension++) {
    const sizes = [1200, 760, 256, 160];
    sizes[dimension] = 0;
    const view = fitView(...sizes);
    assert.equal(view.scale, 0);
    assert.equal(view.width, 0);
    assert.equal(view.height, 0);
    assert.ok(Object.values(view).every(Number.isFinite));
    assert.deepEqual(pointToDomain(view, view.x, view.y), {
      x: 0,
      y: 0,
      inside: false,
    });
  }
});

test("invalid dimensions fail explicitly and nonfinite pointer positions are ignored", () => {
  for (let dimension = 0; dimension < 4; dimension++) {
    for (const invalid of [-1, NaN, Infinity, -Infinity]) {
      const sizes = [1200, 760, 256, 160];
      sizes[dimension] = invalid;
      assert.throws(() => fitView(...sizes), RangeError);
    }
  }
  const view = fitView(1200, 760, 256, 160);
  assert.equal(pointToDomain(view, NaN, 0).inside, false);
  assert.equal(pointToDomain(view, 0, Infinity).inside, false);
});
