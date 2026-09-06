import test from "node:test";
import assert from "node:assert/strict";
import { getRecipe, recipes } from "../.test-build/recipes.js";

test("three recipes have unique addresses and complete bilingual metadata", () => {
  assert.equal(recipes.length, 3);
  assert.equal(new Set(recipes.map((recipe) => recipe.id)).size, 3);
  for (const recipe of recipes) {
    assert.match(recipe.id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.equal(getRecipe(recipe.id), recipe);
    for (const key of [
      "titleZh",
      "titleEn",
      "descriptionZh",
      "descriptionEn",
    ]) {
      assert.equal(typeof recipe[key], "string");
      assert.ok(recipe[key].trim().length > 0);
    }
    // Inspect only the URL contract; Node never imports or decodes PNG assets.
    assert.ok(
      new URL(recipe.preview).pathname.endsWith(
        `/assets/recipes/${recipe.id}.png`,
      ),
    );
  }
  assert.equal(getRecipe("unknown-scene"), undefined);
  assert.equal(getRecipe(""), undefined);
});

test("recipe parameters fit their model and reproduction step contracts", () => {
  assert.equal(
    recipes.filter((recipe) => recipe.kind === "reaction").length,
    2,
  );
  assert.equal(recipes.filter((recipe) => recipe.kind === "network").length, 1);
  for (const recipe of recipes) {
    assert.ok(Number.isInteger(recipe.seed));
    assert.ok(recipe.seed >= 0 && recipe.seed <= 999999);
    assert.ok(["lagoon", "ember", "mono"].includes(recipe.palette));
    assert.ok(Number.isInteger(recipe.steps));
    assert.ok(recipe.steps > 0 && recipe.steps <= 10000);
    if (recipe.kind === "reaction") {
      assert.ok(["coral", "cells"].includes(recipe.preset));
      assert.ok(Number.isFinite(recipe.feed));
      assert.ok(recipe.feed >= 0 && recipe.feed <= 0.1);
      assert.ok(Number.isFinite(recipe.kill));
      assert.ok(recipe.kill >= 0 && recipe.kill <= 0.1);
      assert.equal("network" in recipe, false);
    } else {
      assert.equal(recipe.kind, "network");
      assert.equal(recipe.preset, "physarum");
      const settings = recipe.network;
      assert.ok(Number.isInteger(settings.count));
      assert.ok(settings.count >= 500 && settings.count <= 10000);
      for (const [key, minimum, maximum] of [
        ["sensorDistance", 2, 24],
        ["sensorAngle", 10, 90],
        ["turnAngle", 10, 90],
        ["retention", 0.85, 0.999],
      ]) {
        assert.ok(Number.isFinite(settings[key]));
        assert.ok(settings[key] >= minimum && settings[key] <= maximum);
      }
      assert.equal("feed" in recipe, false);
      assert.equal("kill" in recipe, false);
    }
  }
});
