import test from "node:test";
import assert from "node:assert/strict";
import { defaults } from "../.test-build/engine.js";
import { Physarum } from "../.test-build/physarum.js";
import { prepareRecipe } from "../.test-build/prepare.js";
import { ReactionDiffusion } from "../.test-build/reaction.js";
import { recipes } from "../.test-build/recipes.js";
import { decodeSnapshot, encodeSnapshot } from "../.test-build/snapshot.js";

const ready = {
  cancelled: () => false,
  yieldControl: async () => {},
};

for (const source of recipes) {
  test(`${source.id} preparation matches direct numerical steps and metadata`, async () => {
    const recipe = structuredClone({ ...source, steps: 32 });
    const before = structuredClone(recipe);
    if (recipe.kind === "network") Object.freeze(recipe.network);
    Object.freeze(recipe);
    const progress = [];
    let yields = 0;
    const result = await prepareRecipe(recipe, {
      ...ready,
      yieldControl: async () => {
        yields++;
      },
      onProgress: (completed, total) => progress.push([completed, total]),
    });

    assert.ok(result);
    assert.equal(result.kind, recipe.kind);
    assert.equal(result.time, recipe.steps);
    assert.equal(result.palette, recipe.palette);
    assert.equal(result.width, 256);
    assert.equal(result.height, 160);
    assert.deepEqual(result.settings, {
      ...defaults,
      preset: recipe.preset,
      seed: recipe.seed,
    });
    assert.notEqual(result.settings, defaults);
    assert.deepEqual(recipe, before);
    assert.deepEqual(decodeSnapshot(encodeSnapshot(result)), result);
    const batchSize = recipe.kind === "reaction" ? 16 : 8;
    assert.equal(yields, recipe.steps / batchSize);
    assert.deepEqual(
      progress,
      Array.from({ length: yields + 1 }, (_, index) => [
        index * batchSize,
        recipe.steps,
      ]),
    );

    if (recipe.kind === "reaction") {
      const model = new ReactionDiffusion(recipe.preset, recipe.seed);
      model.step(recipe.feed, recipe.kill, recipe.steps);
      assert.equal(result.feed, recipe.feed);
      assert.equal(result.kill, recipe.kill);
      assert.equal(result.rate, 8);
      assert.deepEqual(result.a, Array.from(model.a));
      assert.deepEqual(result.b, Array.from(model.b));
    } else {
      const model = new Physarum(recipe.seed, recipe.network);
      model.step(recipe.steps);
      assert.equal(result.showAgents, true);
      assert.deepEqual(result.network, recipe.network);
      assert.notEqual(result.network, recipe.network);
      for (const key of ["x", "y", "heading", "field"])
        assert.deepEqual(result[key], Array.from(model[key]));
    }
  });
}

for (const kind of ["reaction", "network"]) {
  const source = recipes.find((recipe) => recipe.kind === kind);
  const batchSize = kind === "reaction" ? 16 : 8;

  test(`${kind} cancellation after a yield discards the partial scene`, async () => {
    let cancelled = false;
    let yields = 0;
    const progress = [];
    const recipe = { ...source, steps: 32 };
    const before = structuredClone(recipe);
    const result = await prepareRecipe(recipe, {
      cancelled: () => cancelled,
      yieldControl: async () => {
        yields++;
        cancelled = true;
      },
      onProgress: (completed, total) => progress.push([completed, total]),
    });
    assert.equal(result, null);
    assert.equal(yields, 1);
    assert.deepEqual(progress, [
      [0, 32],
      [batchSize, 32],
    ]);
    assert.deepEqual(recipe, before);
  });

  test(`${kind} cancellation after the final yield still returns no snapshot`, async () => {
    let cancelled = false;
    const result = await prepareRecipe(
      { ...source, steps: batchSize },
      {
        cancelled: () => cancelled,
        yieldControl: async () => {
          cancelled = true;
        },
      },
    );
    assert.equal(result, null);
  });

  test(`${kind} zero steps returns the seeded initial state without yielding`, async () => {
    const progress = [];
    const result = await prepareRecipe(
      { ...source, steps: 0 },
      {
        ...ready,
        yieldControl: async () => assert.fail("zero steps must not yield"),
        onProgress: (completed, total) => progress.push([completed, total]),
      },
    );
    assert.ok(result);
    assert.equal(result.time, 0);
    assert.deepEqual(progress, [[0, 0]]);
    const model =
      kind === "reaction"
        ? new ReactionDiffusion(source.preset, source.seed)
        : new Physarum(source.seed, source.network);
    for (const key of kind === "reaction"
      ? ["a", "b"]
      : ["x", "y", "heading", "field"])
      assert.deepEqual(result[key], Array.from(model[key]));
  });

  test(`${kind} a final partial batch stops at the requested step`, async () => {
    const progress = [];
    let yields = 0;
    const result = await prepareRecipe(
      { ...source, steps: 17 },
      {
        ...ready,
        yieldControl: async () => {
          yields++;
        },
        onProgress: (completed, total) => progress.push([completed, total]),
      },
    );
    assert.ok(result);
    assert.equal(result.time, 17);
    assert.equal(yields, Math.ceil(17 / batchSize));
    assert.deepEqual(progress.at(-1), [17, 17]);
    const model =
      kind === "reaction"
        ? new ReactionDiffusion(source.preset, source.seed)
        : new Physarum(source.seed, source.network);
    if (kind === "reaction") model.step(source.feed, source.kill, 17);
    else model.step(17);
    const key = kind === "reaction" ? "b" : "field";
    assert.deepEqual(result[key], Array.from(model[key]));
  });
}

test("an already cancelled preparation performs no progress or yields", async () => {
  assert.equal(
    await prepareRecipe(
      { ...recipes[0], steps: 16 },
      {
        cancelled: () => true,
        yieldControl: async () => assert.fail("cancelled preparation yielded"),
        onProgress: () =>
          assert.fail("cancelled preparation reported progress"),
      },
    ),
    null,
  );
});

test("invalid step counts are rejected before any work", async () => {
  for (const steps of [-1, 0.5, 5001, NaN, Infinity, "16", null, undefined]) {
    await assert.rejects(
      prepareRecipe(
        { ...recipes[0], steps },
        {
          cancelled: () => assert.fail("invalid steps reached cancellation"),
          yieldControl: async () => assert.fail("invalid steps yielded"),
          onProgress: () => assert.fail("invalid steps reported progress"),
        },
      ),
      RangeError,
    );
  }
});
