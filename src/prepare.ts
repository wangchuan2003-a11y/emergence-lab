import { defaults } from "./engine.js";
import { Physarum } from "./physarum.js";
import { ReactionDiffusion } from "./reaction.js";
import type { Recipe } from "./recipes.js";
import type { Snapshot } from "./snapshot.js";

/** Build a complete scene locally, yielding between cancellable model batches. */
export async function prepareRecipe(
  recipe: Recipe,
  options: {
    cancelled: () => boolean;
    yieldControl: () => Promise<void>;
    onProgress?: (completed: number, total: number) => void;
  },
): Promise<Snapshot | null> {
  const { steps, seed, preset, palette } = recipe;
  if (!Number.isInteger(steps) || steps < 0 || steps > 5000)
    throw new RangeError("Recipe steps must be an integer in [0, 5000]");
  if (options.cancelled()) return null;

  const common = {
    format: "emergence-lab" as const,
    version: 1 as const,
    settings: { ...defaults, preset, seed },
    palette,
    time: steps,
    width: 256 as const,
    height: 160 as const,
  };
  let batchSize: number;
  let step: (iterations: number) => void;
  let snapshot: () => Snapshot;
  if (recipe.kind === "reaction") {
    const { feed, kill } = recipe;
    const model = new ReactionDiffusion(recipe.preset, seed);
    batchSize = 16;
    step = (iterations) => model.step(feed, kill, iterations);
    snapshot = () => ({
      ...common,
      kind: "reaction",
      feed,
      kill,
      rate: 8,
      a: Array.from(model.a),
      b: Array.from(model.b),
    });
  } else {
    const model = new Physarum(seed, recipe.network);
    batchSize = 8;
    step = (iterations) => model.step(iterations);
    snapshot = () => ({
      ...common,
      kind: "network",
      showAgents: true,
      network: { ...model.settings },
      x: Array.from(model.x),
      y: Array.from(model.y),
      heading: Array.from(model.heading),
      field: Array.from(model.field),
    });
  }

  options.onProgress?.(0, steps);
  for (let completed = 0; completed < steps;) {
    if (options.cancelled()) return null;
    const iterations = Math.min(batchSize, steps - completed);
    step(iterations);
    completed += iterations;
    if (options.cancelled()) return null;
    options.onProgress?.(completed, steps);
    await options.yieldControl();
    if (options.cancelled()) return null;
  }
  if (options.cancelled()) return null;
  return snapshot();
}
