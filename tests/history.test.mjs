import test from "node:test";
import assert from "node:assert/strict";
import { defaults } from "../.test-build/engine.js";
import { EditHistory } from "../.test-build/history.js";
import { encodeSnapshot } from "../.test-build/snapshot.js";

function snapshot(time = 0) {
  return {
    format: "emergence-lab",
    version: 1,
    kind: "particles",
    settings: { ...defaults, count: 100 },
    palette: "lagoon",
    time,
    pulseRemaining: 0,
    x: Array(100).fill(time),
    y: Array(100).fill(40),
    vx: Array(100).fill(0.5),
    vy: Array(100).fill(-0.5),
  };
}

test("empty history leaves a valid current checkpoint untouched", () => {
  const history = new EditHistory();
  const current = snapshot();
  assert.doesNotThrow(() => encodeSnapshot(current));
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
  assert.equal(history.undo(current), null);
  assert.equal(history.redo(current), null);
  assert.deepEqual(current, snapshot());
});

test("undo and redo restore complete checkpoints in edit order", () => {
  const history = new EditHistory();
  for (let time = 0; time < 3; time++) history.remember(snapshot(time));
  let current = snapshot(3);
  for (let time = 2; time >= 0; time--) {
    current = history.undo(current);
    assert.deepEqual(current, snapshot(time));
  }
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, true);
  assert.equal(history.undo(current), null);
  for (let time = 1; time <= 3; time++) {
    current = history.redo(current);
    assert.deepEqual(current, snapshot(time));
  }
  assert.equal(history.canUndo, true);
  assert.equal(history.canRedo, false);
  assert.equal(history.redo(current), null);
});

test("default history evicts the oldest edits after eight checkpoints", () => {
  const history = new EditHistory();
  for (let time = 0; time < 11; time++) history.remember(snapshot(time));
  let current = snapshot(11);
  for (let time = 10; time >= 3; time--) {
    current = history.undo(current);
    assert.equal(current.time, time);
  }
  assert.equal(history.undo(current), null);
});

test("custom limits are enforced and invalid limits are rejected", () => {
  for (const limit of [1, 2, 20]) {
    const history = new EditHistory(limit);
    for (let time = 0; time <= limit; time++) history.remember(snapshot(time));
    let current = snapshot(limit + 1);
    for (let time = limit; time >= 1; time--) {
      current = history.undo(current);
      assert.equal(current.time, time);
    }
    assert.equal(history.undo(current), null);
  }
  for (const limit of [0, -1, 21, 1.5, NaN, Infinity])
    assert.throws(() => new EditHistory(limit), RangeError);
});

test("a new edit after undo discards the abandoned redo branch", () => {
  const history = new EditHistory();
  history.remember(snapshot(0));
  history.remember(snapshot(1));
  const current = history.undo(snapshot(2));
  history.remember(current);
  assert.equal(history.canRedo, false);
  assert.equal(history.redo(snapshot(3)), null);
  assert.deepEqual(history.undo(snapshot(3)), snapshot(1));
  assert.deepEqual(history.undo(snapshot(1)), snapshot(0));
});

test("clear releases both directions and permits fresh edits", () => {
  const history = new EditHistory();
  history.remember(snapshot(0));
  history.remember(snapshot(1));
  history.undo(snapshot(2));
  history.clear();
  assert.equal(history.canUndo, false);
  assert.equal(history.canRedo, false);
  assert.equal(history.undo(snapshot(3)), null);
  assert.equal(history.redo(snapshot(3)), null);
  history.remember(snapshot(4));
  assert.deepEqual(history.undo(snapshot(5)), snapshot(4));
});

test("remember isolates nested settings and arrays from external mutation", () => {
  const history = new EditHistory();
  const original = snapshot(0);
  history.remember(original);
  history.remember(original);
  original.settings.seed = 99;
  original.x[0] = 99;
  const restored = history.undo(snapshot(1));
  assert.deepEqual(restored, snapshot(0));
  restored.settings.seed = 88;
  restored.vy[0] = 1;
  assert.deepEqual(history.undo(snapshot(1)), snapshot(0));
});

test("undo and redo isolate current checkpoints and returned objects", () => {
  const history = new EditHistory();
  const current = snapshot(1);
  history.remember(snapshot(0));
  const previous = history.undo(current);
  current.settings.seed = 99;
  current.x[0] = 99;
  const next = history.redo(previous);
  assert.deepEqual(next, snapshot(1));
  previous.settings.seed = 88;
  previous.y[0] = 88;
  assert.deepEqual(history.undo(next), snapshot(0));
  next.settings.seed = 77;
  next.vx[0] = 1;
  assert.deepEqual(history.redo(snapshot(0)), snapshot(1));
});
