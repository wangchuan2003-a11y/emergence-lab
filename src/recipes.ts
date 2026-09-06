import type { NetworkSettings } from "./physarum.js";

type RecipeBase = {
  id: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  seed: number;
  palette: "lagoon" | "ember" | "mono";
  /** Numerical model steps from the seeded initial state, without brush input. */
  steps: number;
  preview: string;
};

export type Recipe = RecipeBase &
  (
    | {
        kind: "reaction";
        preset: "coral" | "cells";
        feed: number;
        kill: number;
      }
    | { kind: "network"; preset: "physarum"; network: NetworkSettings }
  );

/** Preview images are rendered by scripts/render-recipes.mjs from these values. */
export const recipes: Recipe[] = [
  {
    id: "fluorescent-maze",
    titleZh: "荧光迷宫",
    titleEn: "Fluorescent maze",
    descriptionZh: "青绿色亮带围出不规则空环，显出反应扩散场的纹路。",
    descriptionEn:
      "Teal ridges surround irregular dark pockets in the reaction–diffusion field.",
    kind: "reaction",
    preset: "coral",
    seed: 42,
    palette: "lagoon",
    steps: 1200,
    feed: 0.0545,
    kill: 0.062,
    preview: new URL("./assets/recipes/fluorescent-maze.png", import.meta.url)
      .href,
  },
  {
    id: "amber-spots",
    titleZh: "琥珀斑点",
    titleEn: "Amber spots",
    descriptionZh: "琥珀色斑点散落在暗场中，部分相邻斑点相连。",
    descriptionEn:
      "Sparse amber spots punctuate the dark field, with a few joined pairs.",
    kind: "reaction",
    preset: "cells",
    seed: 71,
    palette: "ember",
    steps: 800,
    feed: 0.0367,
    kill: 0.0649,
    preview: new URL("./assets/recipes/amber-spots.png", import.meta.url).href,
  },
  {
    id: "silver-branches",
    titleZh: "银色分枝",
    titleEn: "Silver branches",
    descriptionZh: "粒子沉积与扩散形成银白色宽轨迹，汇合成分枝与闭环。",
    descriptionEn:
      "Particle deposition and diffusion form broad silver trails, branches, and loops.",
    kind: "network",
    preset: "physarum",
    seed: 42,
    palette: "mono",
    steps: 600,
    network: {
      count: 4000,
      sensorDistance: 18,
      sensorAngle: 22,
      turnAngle: 32,
      retention: 0.97,
    },
    preview: new URL("./assets/recipes/silver-branches.png", import.meta.url)
      .href,
  },
];

export function getRecipe(id: string): Recipe | undefined {
  return recipes.find((recipe) => recipe.id === id);
}
