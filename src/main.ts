import "./style.css";
import { registerOffline } from "./offline";
import { translate, applyTranslations, type Language } from "./i18n";
import {
  createRenderer,
  getDomain,
  fitView,
  pointToDomain,
  type RenderSource,
  type View,
} from "./render";
import { Physarum, networkDefaults, type NetworkSettings } from "./physarum";
import { createCaptureController } from "./capture";
import {
  decodeSnapshot,
  encodeSnapshot,
  MAX_SNAPSHOT_BYTES,
  type Snapshot,
} from "./snapshot";
import { Simulation, parseSettings, serialize, type Preset } from "./engine";
import { ReactionDiffusion, reactions, type BioPreset } from "./reaction";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("world"),
  ctx = canvas.getContext("2d")!;
let network: Physarum | null = null,
  networkSettings: NetworkSettings = { ...networkDefaults };
const networkKeys = {
  "network-count": "count",
  "sensor-distance": "sensorDistance",
  "sensor-angle": "sensorAngle",
  "turn-angle": "turnAngle",
  retention: "retention",
} as const;
$("network-controls").after($("brush-controls"));
let language: Language =
  new URLSearchParams(location.hash.slice(1)).get("lang") === "en"
    ? "en"
    : "zh";
const renderer = createRenderer();
let view: View = { scale: 0, x: 0, y: 0, width: 0, height: 0 };
let settings = parseSettings(location.hash),
  sim = new Simulation(settings),
  bio: ReactionDiffusion | null = null;
let paused = matchMedia("(prefers-reduced-motion: reduce)").matches,
  pulseUntil = 0;
let feed = 0.0545,
  kill = 0.062,
  bioSpeed = 8,
  palette: "lagoon" | "ember" | "mono" = "lagoon";
let pointer: { x: number; y: number; repel: boolean } | undefined;
let brushErase = false,
  brushRadius = 5,
  lastPaint: { x: number; y: number } | undefined;
let offlineReady = false;
let importRequest = 0;
let importedSnapshot = false,
  showAgents = true;
let pendingResize = false,
  pendingHash = false;
const scenes: Record<Preset, [string, string]> = {
  physarum: [
    "路径，记住了来者",
    "粒子留下轨迹，轨迹引导粒子。网络从局部反馈中形成。",
  ],
  flock: ["群体的直觉", "每个个体只看邻居，群体却形成了方向。"],
  orbit: ["围绕一个未知", "向心力与切向运动，共同维持流动的环。"],
  swarm: ["看不见的河流", "同一片流场，把独立个体编织成纹理。"],
  coral: ["让一片珊瑚生长", "两种虚拟物质，生成持续演变的分枝与迷宫。"],
  cells: ["一个，变成很多个", "斑点生长、拉伸与分裂：化学模式中的细胞幻象。"],
};
const capture = createCaptureController(canvas, {
  onState: (state, secondsLeft) => {
    const busy = state !== "idle";
    document
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>(
        "[data-preset], #seed, #reset, #new-seed, #count, #checkpoint-load, #fullscreen, #network-count",
      )
      .forEach((control) => (control.disabled = busy));
    $("record").textContent = tr(
      state === "recording"
        ? "停止并保存"
        : state === "stopping"
          ? "正在保存…"
          : "录制 8 秒",
    );
    $<HTMLButtonElement>("record").disabled = state === "stopping";
    $("record-progress").textContent =
      state === "recording" ? `${secondsLeft}s` : "";
    if (state === "idle") {
      if (pendingHash) {
        pendingHash = false;
        settings = parseSettings(location.hash);
        readBioHash();
        reset();
        applyLanguage();
      }
      if (pendingResize) {
        pendingResize = false;
        resize();
      }
    }
  },
  onMessage: report,
  onComplete: download,
});
document.querySelector<HTMLAnchorElement>(".skip-link")!.onclick = (event) => {
  event.preventDefault();
  canvas.focus();
  canvas.scrollIntoView({ block: "center" });
};
function tr(text: string, values: Record<string, string | number> = {}) {
  return translate(text, language, values);
}
function applyLanguage() {
  document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  applyTranslations(document, language);
  $("language-toggle").textContent = language === "en" ? "中文" : "EN";
  $("language-toggle").setAttribute(
    "aria-label",
    language === "en" ? "Switch to Chinese" : "切换为英文",
  );
  const lead = document.querySelector<HTMLElement>("h1>.i18n-fragment");
  if (lead && language === "en") lead.append(" ");
  if (language === "en")
    document
      .querySelectorAll(".intro p>.i18n-fragment")
      .forEach((node, index) => {
        if (index) node.prepend(" ");
      });
  sync();
  $("record").textContent = tr(
    capture.state === "recording"
      ? "停止并保存"
      : capture.state === "stopping"
        ? "正在保存…"
        : "录制 8 秒",
  );
}
$("language-toggle").onclick = () => {
  language = language === "zh" ? "en" : "zh";
  const url = new URL(location.href),
    params = new URLSearchParams(url.hash.slice(1));
  if (language === "en") params.set("lang", "en");
  else params.delete("lang");
  url.hash = params.toString();
  history.replaceState(null, "", url);
  applyLanguage();
};
function report(s: string) {
  $("status").textContent = tr(s);
}
function isNetwork() {
  return settings.preset === "physarum";
}
function isFieldMode() {
  return isBio() || isNetwork();
}
function renderSource(): RenderSource {
  if (bio) return { kind: "reaction", model: bio };
  if (network) return { kind: "network", model: network, showAgents };
  return { kind: "particles", model: sim };
}
function currentTime() {
  return bio?.time ?? network?.time ?? sim.time;
}
function isBio() {
  return settings.preset === "coral" || settings.preset === "cells";
}
function readBioHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  language = q.get("lang") === "en" ? "en" : "zh";
  const bounded = (key: string, fallback: number, min: number, max: number) => {
    const s = q.get(key),
      n = s === null ? NaN : Number(s);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  const preset = isBio() ? (settings.preset as BioPreset) : "coral";
  feed = bounded("feed", reactions[preset].feed, 0.01, 0.08);
  kill = bounded("kill", reactions[preset].kill, 0.045, 0.075);
  bioSpeed = Math.round(bounded("rate", 8, 1, 16));
  networkSettings = {
    count: Math.round(
      bounded("networkCount", networkDefaults.count, 500, 10000),
    ),
    sensorDistance: bounded(
      "sensorDistance",
      networkDefaults.sensorDistance,
      2,
      24,
    ),
    sensorAngle: bounded("sensorAngle", networkDefaults.sensorAngle, 10, 90),
    turnAngle: bounded("turnAngle", networkDefaults.turnAngle, 10, 90),
    retention: bounded("retention", networkDefaults.retention, 0.85, 0.999),
  };
  showAgents = q.get("agents") !== "0";
  const color = q.get("palette");
  palette = color === "ember" || color === "mono" ? color : "lagoon";
}
function resize() {
  if (capture.state !== "idle") {
    pendingResize = true;
    return;
  }
  const rect = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const domain = getDomain(renderSource());
  view = fitView(canvas.width, canvas.height, domain.width, domain.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#070f14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
  draw(true);
}
function draw(clear = false) {
  renderer.paint(ctx, renderSource(), palette, clear);
  $("step-count").textContent = String(currentTime());
}
function sync() {
  for (const key of ["count", "speed", "cohesion", "separation"] as const) {
    $<HTMLInputElement>(key).value = String(settings[key]);
    $(key + "-value").textContent = String(settings[key]);
  }
  $<HTMLInputElement>("seed").value = String(settings.seed);
  document
    .querySelectorAll<HTMLButtonElement>("[data-preset]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.preset === settings.preset),
      ),
    );
  $("scene-title").textContent = tr(scenes[settings.preset][0]);
  $("scene-caption").textContent = tr(scenes[settings.preset][1]);
  $("pause").textContent = tr(paused ? "继续实验" : "暂停实验");
  $("stage-pause").textContent = tr(paused ? "继续" : "暂停");
  $("state").textContent = tr(paused ? "已暂停" : "运行中");
  if (paused) $("fps").textContent = "PAUSED";
  document.querySelector(".live")?.classList.toggle("paused", paused);
  canvas.classList.toggle("drawing-enabled", isFieldMode());
  $("particle-controls").hidden = isFieldMode();
  $("bio-controls").hidden = !isBio();
  $("network-controls").hidden = !isNetwork();
  $("brush-controls").hidden = !isFieldMode();
  for (const [id, key] of Object.entries(networkKeys)) {
    const value = networkSettings[key];
    $<HTMLInputElement>(id).value = String(value);
    $(id + "-value").textContent =
      key === "retention"
        ? value.toFixed(3)
        : String(value) +
          (key === "sensorAngle" || key === "turnAngle" ? "°" : "");
  }
  $("pointer-hint").textContent = tr(
    isFieldMode() ? "按住播种 · Shift 按住擦除" : "移动吸引 · 按住排斥",
  );
  $("model-name").textContent = isNetwork()
    ? "TRAIL NETWORK"
    : isBio()
      ? "GRAY–SCOTT"
      : "PARTICLE SYSTEM";
  $("checkpoint-state").textContent = tr(
    importedSnapshot ? "已恢复快照，可继续演化" : "保存当前状态，稍后接着演化",
  );
  for (const [id, v] of [
    ["feed", feed],
    ["kill", kill],
    ["rate", bioSpeed],
  ] as const) {
    $<HTMLInputElement>(id).value = String(v);
    $(id + "-value").textContent = id === "rate" ? `${v}×` : v.toFixed(4);
  }
  $<HTMLSelectElement>("palette").value = palette;
  $<HTMLInputElement>("show-agents").checked = showAgents;
  $("offline-state").textContent = tr(
    offlineReady ? "离线副本已就绪" : "浏览器本地计算",
  );
}
function reset() {
  importRequest++;
  importedSnapshot = false;
  sim = new Simulation(settings);
  bio = isBio()
    ? new ReactionDiffusion(settings.preset as BioPreset, settings.seed)
    : null;
  if (bio) bio.step(feed, kill, 240);
  network = isNetwork() ? new Physarum(settings.seed, networkSettings) : null;
  if (network) network.step(120);
  pointer = undefined;
  pulseUntil = 0;
  resize();
  sync();
}
for (const key of ["count", "speed", "cohesion", "separation"] as const)
  $(key).addEventListener("input", () => {
    importRequest++;
    settings[key] = Number($<HTMLInputElement>(key).value);
    if (key === "count") reset();
    else sync();
  });
for (const [id, key] of Object.entries(networkKeys))
  $(id).addEventListener("input", () => {
    importRequest++;
    networkSettings[key] = Number($<HTMLInputElement>(id).value);
    if (key === "count") reset();
    else {
      if (network) network.settings = { ...networkSettings };
      sync();
    }
  });
for (const key of ["feed", "kill", "rate"])
  $(key).addEventListener("input", () => {
    importRequest++;
    const v = Number($<HTMLInputElement>(key).value);
    if (key === "feed") feed = v;
    else if (key === "kill") kill = v;
    else bioSpeed = v;
    sync();
  });
document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach(
  (b) =>
    (b.onclick = () => {
      settings.preset = b.dataset.preset as Preset;
      if (isBio()) {
        feed = reactions[settings.preset as BioPreset].feed;
        kill = reactions[settings.preset as BioPreset].kill;
      }
      reset();
    }),
);
$("stage-pause").onclick = () => $("pause").click();
$("pause").onclick = () => {
  paused = !paused;
  sync();
};
$("reset").onclick = () => {
  reset();
  report(
    isNetwork()
      ? "已重置；从 120 步网络状态开始。"
      : isBio()
        ? "已重置；从 240 步预生长状态开始。"
        : "已用当前种子重新开始。",
  );
};
$("new-seed").onclick = () => {
  settings.seed = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  reset();
};
$("seed").addEventListener("change", () => {
  const v = Number($<HTMLInputElement>("seed").value);
  settings.seed = Number.isFinite(v)
    ? Math.round(Math.max(0, Math.min(999999, v)))
    : 42;
  reset();
});
$("pulse").onclick = () => {
  importRequest++;
  const field = bio ?? network;
  if (field) {
    field.inject(128, 80, brushErase, brushRadius);
    draw();
    report(
      brushErase
        ? "已擦除中心的反应物。"
        : "已在中心播种；继续运行可观察扩散。",
    );
  } else {
    pulseUntil = sim.time + 90;
    if (paused) {
      sim.step({ x: 600, y: 380, repel: true });
      draw();
    }
  }
};
$("step").onclick = () => {
  importRequest++;
  paused = true;
  if (bio) bio.step(feed, kill, bioSpeed);
  else if (network) network.step();
  else sim.step();
  draw();
  sync();
};
$("show-agents").onchange = () => {
  importRequest++;
  showAgents = $<HTMLInputElement>("show-agents").checked;
  draw(true);
};
$("palette").onchange = () => {
  importRequest++;
  palette = $<HTMLSelectElement>("palette").value as typeof palette;
  draw(true);
};
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector(".stage")!.requestFullscreen();
  } catch {
    report("此浏览器不支持全屏，请使用浏览器缩放。");
  }
};
function download(blob: Blob, name: string) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("save").onclick = () => {
  const filename = `emergence-${settings.preset}-${settings.seed}.png`;
  const requestedWidth = Number($<HTMLSelectElement>("export-width").value);
  let output = canvas;
  if (requestedWidth === 1920 || requestedWidth === 3840) {
    const source = renderSource(),
      domain = getDomain(source);
    output = document.createElement("canvas");
    output.width = requestedWidth;
    output.height = Math.round((requestedWidth * domain.height) / domain.width);
    const context = output.getContext("2d");
    if (!context) {
      report("无法创建导出画布。");
      return;
    }
    context.fillStyle = "#070f14";
    context.fillRect(0, 0, output.width, output.height);
    const scale = output.width / domain.width;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    renderer.paint(context, source, palette, true);
  }
  output.toBlob((blob) => {
    if (blob) {
      download(blob, filename);
      report(
        requestedWidth
          ? tr("已导出宽 {width} 像素的 PNG。", { width: requestedWidth })
          : "当前画布已导出 PNG。",
      );
    } else report("导出失败，请重试。");
  });
};
$("record").onclick = () => {
  importRequest++;
  if (capture.state === "recording") capture.stop();
  else if (capture.state === "idle")
    capture.start(`emergence-${settings.preset}`);
};
function checkpoint(): Snapshot {
  const common = {
    format: "emergence-lab" as const,
    version: 1 as const,
    settings: { ...settings },
    palette,
    time: currentTime(),
  };
  if (network)
    return {
      ...common,
      kind: "network",
      showAgents,
      width: 256,
      height: 160,
      network: { ...network.settings },
      x: Array.from(network.x),
      y: Array.from(network.y),
      heading: Array.from(network.heading),
      field: Array.from(network.field),
    };
  return bio
    ? {
        ...common,
        kind: "reaction",
        width: 256,
        height: 160,
        feed,
        kill,
        rate: bioSpeed,
        a: Array.from(bio.a),
        b: Array.from(bio.b),
      }
    : {
        ...common,
        kind: "particles",
        pulseRemaining: Math.max(0, pulseUntil - sim.time),
        x: Array.from(sim.x),
        y: Array.from(sim.y),
        vx: Array.from(sim.vx),
        vy: Array.from(sim.vy),
      };
}
$("checkpoint-save").onclick = () => {
  try {
    const text = encodeSnapshot(checkpoint());
    download(
      new Blob([text], { type: "application/json" }),
      `emergence-${settings.preset}-${currentTime()}.json`,
    );
    report("快照已保存，包含当前状态与笔触；不包含屏幕拖尾。");
  } catch (error) {
    report(error instanceof Error ? error.message : "保存失败。");
  }
};
$("checkpoint-load").onclick = () =>
  $<HTMLInputElement>("checkpoint-file").click();
$("checkpoint-file").addEventListener("change", async () => {
  const input = $<HTMLInputElement>("checkpoint-file"),
    file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const request = ++importRequest;
  if (file.size > MAX_SNAPSHOT_BYTES) {
    report("文件超过 3 MB，请选择本实验室导出的快照。");
    return;
  }
  try {
    const text = await file.text();
    if (request !== importRequest) return;
    const restored = decodeSnapshot(text);
    // Build a replacement model completely before touching the running state.
    const nextSim = new Simulation(restored.settings);
    let nextBio: ReactionDiffusion | null = null;
    let nextNetwork: Physarum | null = null;
    if (restored.kind === "reaction") {
      nextBio = new ReactionDiffusion(
        restored.settings.preset as BioPreset,
        restored.settings.seed,
      );
      nextBio.a.set(restored.a);
      nextBio.b.set(restored.b);
      nextBio.time = restored.time;
    } else if (restored.kind === "network") {
      nextNetwork = new Physarum(restored.settings.seed, restored.network);
      nextNetwork.x.set(restored.x);
      nextNetwork.y.set(restored.y);
      nextNetwork.heading.set(restored.heading);
      nextNetwork.field.set(restored.field);
      nextNetwork.time = restored.time;
    } else {
      nextSim.x.set(restored.x);
      nextSim.y.set(restored.y);
      nextSim.vx.set(restored.vx);
      nextSim.vy.set(restored.vy);
      nextSim.time = restored.time;
    }
    if (capture.state !== "idle")
      throw new Error("正在录制，请保存录像后再打开快照。");
    settings = restored.settings;
    sim = nextSim;
    bio = nextBio;
    network = nextNetwork;
    if (restored.kind === "network") {
      networkSettings = { ...restored.network };
      showAgents = restored.showAgents;
    }
    palette = restored.palette;
    if (restored.kind === "reaction") {
      feed = restored.feed;
      kill = restored.kill;
      bioSpeed = restored.rate;
    }
    pulseUntil =
      sim.time + (restored.kind === "particles" ? restored.pulseRemaining : 0);
    pointer = undefined;
    lastPaint = undefined;
    paused = true;
    importedSnapshot = true;
    const cleanUrl = new URL(location.href);
    cleanUrl.hash = language === "en" ? "lang=en" : "";
    history.replaceState(null, "", cleanUrl);
    resize();
    sync();
    report(
      tr("已恢复第 {step} 步并暂停。点击继续实验即可接着演化。", {
        step: restored.time,
      }),
    );
  } catch (error) {
    if (request !== importRequest) return;
    report(
      error instanceof Error ? error.message : "快照读取失败；当前实验未改变。",
    );
  }
});
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-brush]",
))
  button.onclick = () => {
    brushErase = button.dataset.brush === "erase";
    document
      .querySelectorAll("[data-brush]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(
            (b as HTMLElement).dataset.brush ===
              (brushErase ? "erase" : "seed"),
          ),
        ),
      );
  };
$("brush-radius").addEventListener("input", () => {
  brushRadius = Number($<HTMLInputElement>("brush-radius").value);
  $("brush-radius-value").textContent = String(brushRadius);
});
$("share").onclick = async () => {
  const url = new URL(location.href);
  const q = new URLSearchParams(serialize(settings));
  if (language === "en") q.set("lang", "en");
  q.set("palette", palette);
  if (bio) {
    q.set("feed", String(feed));
    q.set("kill", String(kill));
    q.set("rate", String(bioSpeed));
  }
  if (network) {
    q.set("agents", showAgents ? "1" : "0");
    q.set("networkCount", String(network.settings.count));
    q.set("sensorDistance", String(network.settings.sensorDistance));
    q.set("sensorAngle", String(network.settings.sensorAngle));
    q.set("turnAngle", String(network.settings.turnAngle));
    q.set("retention", String(network.settings.retention));
  }
  url.hash = q.toString();
  history.replaceState(null, "", url);
  try {
    await navigator.clipboard.writeText(url.href);
    report("参数链接已复制；恢复初始条件，不保存当前图案或笔触。");
  } catch {
    report("参数已写入地址栏，请复制浏览器地址分享。");
  }
};
window.addEventListener("hashchange", () => {
  if (capture.state !== "idle") {
    pendingHash = true;
    capture.stop();
    return;
  }
  settings = parseSettings(location.hash);
  readBioHash();
  reset();
  applyLanguage();
});
function updatePointer(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  const position = pointToDomain(
    view,
    ((e.clientX - rect.left) * canvas.width) / rect.width,
    ((e.clientY - rect.top) * canvas.height) / rect.height,
  );
  if (!position.inside) {
    pointer = undefined;
    lastPaint = undefined;
    return;
  }
  pointer = { x: position.x, y: position.y, repel: e.buttons > 0 };
  const field = bio ?? network;
  if (field && e.buttons) {
    importRequest++;
    const point = { x: position.x, y: position.y },
      from = lastPaint ?? point;
    const distance = Math.hypot(point.x - from.x, point.y - from.y),
      count = Math.min(
        128,
        Math.max(1, Math.ceil(distance / Math.max(1, brushRadius * 0.5))),
      );
    for (let i = 1; i <= count; i++)
      field.inject(
        from.x + ((point.x - from.x) * i) / count,
        from.y + ((point.y - from.y) * i) / count,
        brushErase || e.shiftKey,
        brushRadius,
      );
    lastPaint = point;
    draw();
  }
}
canvas.addEventListener("pointermove", updatePointer);
canvas.addEventListener("pointerdown", (e) => {
  lastPaint = undefined;
  if (isFieldMode()) canvas.setPointerCapture(e.pointerId);
  updatePointer(e);
});
canvas.addEventListener("pointerup", (e) => {
  lastPaint = undefined;
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  if (e.pointerType === "mouse") updatePointer(e);
  else pointer = undefined;
});
canvas.addEventListener("pointerleave", () => {
  pointer = undefined;
  if (!canvas.matches(":active")) lastPaint = undefined;
});
canvas.addEventListener("pointercancel", () => {
  pointer = undefined;
  lastPaint = undefined;
});
document.addEventListener("keydown", (e) => {
  if (document.activeElement !== canvas) return;
  const target = e.target as HTMLElement;
  if (
    target.closest("input,select,textarea,button,summary,a") ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    $("pause").click();
  }
  if (e.code === "ArrowRight") {
    e.preventDefault();
    $("step").click();
  }
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) capture.stop();
  else capture.dispose();
});
readBioHash();
reset();
applyLanguage();
registerOffline({
  enabled: !import.meta.env.DEV,
  onReady: () => {
    offlineReady = true;
    $("offline-state").textContent = tr("离线副本已就绪");
  },
  onError: () => {
    offlineReady = false;
    $("offline-state").textContent = tr("浏览器本地计算");
  },
});
new ResizeObserver(resize).observe(canvas);
resize();
let last = performance.now(),
  acc = 0,
  frames = 0,
  fpsStart = last;
function frame(now: number) {
  try {
    const elapsed = Math.min(now - last, 100);
    last = now;
    if (!paused && !document.hidden) {
      acc += elapsed;
      let steps = 0;
      const cap = isFieldMode() ? 2 : 5;
      while (acc >= 1000 / 60 && steps < cap) {
        if (bio) bio.step(feed, kill, bioSpeed);
        else if (network) network.step();
        else
          sim.step(
            pointer ??
              (sim.time < pulseUntil
                ? { x: 600, y: 380, repel: true }
                : undefined),
          );
        acc -= 1000 / 60;
        steps++;
      }
      if (steps === cap) acc = Math.min(acc, 1000 / 60);
      if (steps) draw();
      frames++;
    } else acc = 0;
    if (now - fpsStart >= 1000) {
      $("fps").textContent = paused
        ? "PAUSED"
        : `${Math.round((frames * 1000) / (now - fpsStart))} FPS`;
      frames = 0;
      fpsStart = now;
    }
  } catch (error) {
    paused = true;
    acc = 0;
    sync();
    report("模拟遇到无效状态，已暂停。可以重新开始或打开有效快照。");
    console.error("Simulation paused after an invalid state", error);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
