import type { Settings } from "./engine.js";
import type { NetworkSettings } from "./physarum.js";

export type Palette = "lagoon" | "ember" | "mono";
interface CommonSnapshot {
  format: "emergence-lab";
  version: 1;
  settings: Settings;
  palette: Palette;
  time: number;
}
export interface ParticleSnapshot extends CommonSnapshot {
  kind: "particles";
  pulseRemaining: number;
  x: number[];
  y: number[];
  vx: number[];
  vy: number[];
}
export interface ReactionSnapshot extends CommonSnapshot {
  kind: "reaction";
  width: 256;
  height: 160;
  feed: number;
  kill: number;
  rate: number;
  a: number[];
  b: number[];
}
export interface NetworkSnapshot extends CommonSnapshot {
  kind: "network";
  width: 256;
  height: 160;
  network: NetworkSettings;
  x: number[];
  y: number[];
  heading: number[];
  field: number[];
}
export type Snapshot = ParticleSnapshot | ReactionSnapshot | NetworkSnapshot;
export const MAX_SNAPSHOT_BYTES = 3_000_000;
const presets = ["flock", "orbit", "swarm", "coral", "cells", "physarum"];
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function number(
  value: unknown,
  min: number,
  max: number,
  integer = false,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))
  );
}
function array(
  value: unknown,
  length: number,
  min: number,
  max: number,
): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((v) => number(v, min, max))
  );
}
/** Validate before mutating the live model. Unknown properties are not retained. */
export function decodeSnapshot(text: string): Snapshot {
  if (text.length > MAX_SNAPSHOT_BYTES)
    throw new Error("快照超过 3 MB，请选择本实验室导出的 JSON 文件。");
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error("文件不是有效的 JSON 快照。");
  }
  if (
    !object(input) ||
    input.format !== "emergence-lab" ||
    input.version !== 1 ||
    !object(input.settings)
  )
    throw new Error("不支持此快照格式或版本。");
  const s = input.settings;
  if (
    !presets.includes(String(s.preset)) ||
    !number(s.count, 100, 1400, true) ||
    !number(s.speed, 0.3, 3) ||
    !number(s.cohesion, 0, 2) ||
    !number(s.separation, 0, 2) ||
    !number(s.seed, 0, 999999, true)
  )
    throw new Error("快照参数不完整或超出支持范围。");
  if (
    !["lagoon", "ember", "mono"].includes(String(input.palette)) ||
    !number(input.time, 0, Number.MAX_SAFE_INTEGER - 10000, true)
  )
    throw new Error("快照影调或时间无效。");
  const common: CommonSnapshot = {
    format: "emergence-lab",
    version: 1,
    settings: {
      preset: s.preset as Settings["preset"],
      count: s.count,
      speed: s.speed,
      cohesion: s.cohesion,
      separation: s.separation,
      seed: s.seed,
    },
    palette: input.palette as Palette,
    time: input.time,
  };
  if (input.kind === "network") {
    const n = input.network;
    if (
      common.settings.preset !== "physarum" ||
      input.width !== 256 ||
      input.height !== 160 ||
      !object(n) ||
      !number(n.count, 500, 10000, true) ||
      !number(n.sensorDistance, 2, 24) ||
      !number(n.sensorAngle, 10, 90) ||
      !number(n.turnAngle, 10, 90) ||
      !number(n.retention, 0.85, 0.999)
    )
      throw new Error("网络参数或尺寸无效。");
    if (
      !array(input.x, n.count, 0, 256) ||
      !array(input.y, n.count, 0, 160) ||
      input.x.some((v) => v >= 256) ||
      input.y.some((v) => v >= 160) ||
      !array(input.heading, n.count, 0, Math.fround(Math.PI * 2)) ||
      !array(input.field, 40960, 0, 3.4028234663852886e38)
    )
      throw new Error("网络浓度或粒子数据损坏。");
    return {
      ...common,
      kind: "network",
      width: 256,
      height: 160,
      network: {
        count: n.count,
        sensorDistance: n.sensorDistance,
        sensorAngle: n.sensorAngle,
        turnAngle: n.turnAngle,
        retention: n.retention,
      },
      x: input.x,
      y: input.y,
      heading: input.heading,
      field: input.field,
    };
  }
  if (input.kind === "reaction") {
    if (
      !["coral", "cells"].includes(common.settings.preset) ||
      input.width !== 256 ||
      input.height !== 160 ||
      !number(input.feed, 0.01, 0.08) ||
      !number(input.kill, 0.045, 0.075) ||
      !number(input.rate, 1, 16, true) ||
      !array(input.a, 40960, 0, 1) ||
      !array(input.b, 40960, 0, 1)
    )
      throw new Error("反应场数据损坏、尺寸错误或参数无效。");
    return {
      ...common,
      kind: "reaction",
      width: 256,
      height: 160,
      feed: input.feed,
      kill: input.kill,
      rate: input.rate,
      a: input.a,
      b: input.b,
    };
  }
  if (input.kind === "particles") {
    if (
      !["flock", "orbit", "swarm"].includes(common.settings.preset) ||
      !number(input.pulseRemaining, 0, 90, true) ||
      !array(input.x, s.count, 0, 1200) ||
      !array(input.y, s.count, 0, 760) ||
      !array(input.vx, s.count, -6.001, 6.001) ||
      !array(input.vy, s.count, -6.001, 6.001) ||
      input.x.some((v) => v >= 1200) ||
      input.y.some((v) => v >= 760)
    )
      throw new Error("粒子数据损坏、数量不一致或位置超出范围。");
    return {
      ...common,
      kind: "particles",
      pulseRemaining: input.pulseRemaining,
      x: input.x,
      y: input.y,
      vx: input.vx,
      vy: input.vy,
    };
  }
  throw new Error("未知的模拟类型。");
}
export function encodeSnapshot(snapshot: Snapshot): string {
  const text = JSON.stringify(snapshot);
  // Export and import share a contract, so a broken state never becomes a claimed checkpoint.
  decodeSnapshot(text);
  return text;
}
