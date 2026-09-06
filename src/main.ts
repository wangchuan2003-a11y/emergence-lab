import "./style.css";
import { Simulation, parseSettings, serialize, type Preset } from "./engine";
import { ReactionDiffusion, reactions, type BioPreset } from "./reaction";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("world"),
  ctx = canvas.getContext("2d")!;
const imageCanvas = document.createElement("canvas");
imageCanvas.width = 256;
imageCanvas.height = 160;
const imageContext = imageCanvas.getContext("2d")!,
  fieldImage = imageContext.createImageData(256, 160);
let settings = parseSettings(location.hash),
  sim = new Simulation(settings),
  bio: ReactionDiffusion | null = null;
let paused = matchMedia("(prefers-reduced-motion: reduce)").matches,
  viewScale = 1,
  viewX = 0,
  viewY = 0,
  pulseUntil = 0;
let feed = 0.0545,
  kill = 0.062,
  bioSpeed = 8,
  palette: "lagoon" | "ember" | "mono" = "lagoon";
let pointer: { x: number; y: number; repel: boolean } | undefined;
let recording: MediaRecorder | null = null,
  recordTimer: ReturnType<typeof setTimeout> | undefined;
const scenes: Record<Preset, [string, string]> = {
  flock: ["群体的直觉", "每个个体只看邻居，群体却形成了方向。"],
  orbit: ["围绕一个未知", "向心力与切向运动，共同维持流动的环。"],
  swarm: ["看不见的河流", "同一片流场，把独立个体编织成纹理。"],
  coral: ["让一片珊瑚生长", "两种虚拟物质，生成持续演变的分枝与迷宫。"],
  cells: ["一个，变成很多个", "斑点生长、拉伸与分裂：化学模式中的细胞幻象。"],
};
function report(s: string) {
  $("status").textContent = s;
}
function isBio() {
  return settings.preset === "coral" || settings.preset === "cells";
}
function readBioHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const bounded = (key: string, fallback: number, min: number, max: number) => {
    const s = q.get(key),
      n = s === null ? NaN : Number(s);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  const preset = isBio() ? (settings.preset as BioPreset) : "coral";
  feed = bounded("feed", reactions[preset].feed, 0.01, 0.08);
  kill = bounded("kill", reactions[preset].kill, 0.045, 0.075);
  bioSpeed = Math.round(bounded("rate", 8, 1, 16));
  const color = q.get("palette");
  palette = color === "ember" || color === "mono" ? color : "lagoon";
}
function resize() {
  const r = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  viewScale = Math.min(canvas.width / 1200, canvas.height / 760);
  viewX = (canvas.width - 1200 * viewScale) / 2;
  viewY = (canvas.height - 760 * viewScale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#070f14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(viewScale, 0, 0, viewScale, viewX, viewY);
  draw(true);
}
function draw(clear = false) {
  if (bio) {
    bio.pixels(fieldImage.data, palette);
    imageContext.putImageData(fieldImage, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(imageCanvas, 0, 0, 1200, 760);
  } else {
    ctx.fillStyle = clear ? "#070f14" : "rgba(7,15,20,.15)";
    ctx.fillRect(0, 0, 1200, 760);
    const colors =
      palette === "ember"
        ? ["#ffaf6e", "#f2745d", "#ffe0aa"]
        : palette === "mono"
          ? ["#edfaff", "#abc5d7", "#7994ac"]
          : ["#d9f87e", "#70ded7", "#e8bb8e"];
    ctx.globalCompositeOperation = "lighter";
    for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      ctx.strokeStyle = colors[c];
      ctx.lineWidth = 1.6;
      for (let i = c; i < settings.count; i += 3) {
        ctx.moveTo(sim.x[i], sim.y[i]);
        ctx.lineTo(sim.x[i] - sim.vx[i] * 3.5, sim.y[i] - sim.vy[i] * 3.5);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }
  $("step-count").textContent = String(bio?.time ?? sim.time);
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
  $("scene-title").textContent = scenes[settings.preset][0];
  $("scene-caption").textContent = scenes[settings.preset][1];
  $("pause").textContent = paused ? "继续实验" : "暂停实验";
  $("state").textContent = paused ? "已暂停" : "运行中";
  document.querySelector(".live")?.classList.toggle("paused", paused);
  $("particle-controls").hidden = isBio();
  $("bio-controls").hidden = !isBio();
  $("pointer-hint").textContent = isBio()
    ? "按住播种 · Shift 按住擦除"
    : "移动吸引 · 按住排斥";
  $("model-name").textContent = isBio() ? "GRAY–SCOTT" : "PARTICLE SYSTEM";
  for (const [id, v] of [
    ["feed", feed],
    ["kill", kill],
    ["rate", bioSpeed],
  ] as const) {
    $<HTMLInputElement>(id).value = String(v);
    $(id + "-value").textContent = id === "rate" ? `${v}×` : v.toFixed(4);
  }
  $<HTMLSelectElement>("palette").value = palette;
}
function reset() {
  sim = new Simulation(settings);
  bio = isBio()
    ? new ReactionDiffusion(settings.preset as BioPreset, settings.seed)
    : null;
  if (bio) bio.step(feed, kill, 240);
  pointer = undefined;
  pulseUntil = 0;
  draw(true);
  sync();
}
for (const key of ["count", "speed", "cohesion", "separation"] as const)
  $(key).addEventListener("input", () => {
    settings[key] = Number($<HTMLInputElement>(key).value);
    if (key === "count") reset();
    else sync();
  });
for (const key of ["feed", "kill", "rate"])
  $(key).addEventListener("input", () => {
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
$("pause").onclick = () => {
  paused = !paused;
  sync();
};
$("reset").onclick = () => {
  reset();
  report(
    isBio() ? "已重置；从 240 步预生长状态开始。" : "已用当前种子重新开始。",
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
  if (bio) {
    bio.inject(128, 80, false, 8);
    draw();
    report("已在中心加入反应物；继续运行可观察扩散。");
  } else {
    pulseUntil = sim.time + 90;
    if (paused) {
      sim.step({ x: 600, y: 380, repel: true });
      draw();
    }
  }
};
$("step").onclick = () => {
  paused = true;
  if (bio) bio.step(feed, kill, bioSpeed);
  else sim.step();
  draw();
  sync();
};
$("palette").onchange = () => {
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
$("save").onclick = () =>
  canvas.toBlob((blob) => {
    if (blob) {
      download(blob, `emergence-${settings.preset}-${settings.seed}.png`);
      report("当前画面已导出 PNG。");
    } else report("导出失败，请重试。");
  });
$("record").onclick = () => {
  if (recording) {
    if (recording.state === "recording") recording.stop();
    return;
  }
  if (typeof MediaRecorder === "undefined" || !canvas.captureStream) {
    report("此浏览器不支持录制，请使用保存画面。");
    return;
  }
  const mime = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ].find((t) => MediaRecorder.isTypeSupported(t));
  if (!mime) {
    report("没有可用的视频编码器，请使用保存画面。");
    return;
  }
  let stream: MediaStream | undefined;
  try {
    stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    recording = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const cleanup = () => {
      clearTimeout(recordTimer);
      stream?.getTracks().forEach((t) => t.stop());
      recording = null;
      $("record").textContent = "录制 8 秒";
    };
    let failed = false;
    recorder.onerror = () => {
      failed = true;
      cleanup();
      report("录制失败，请重试或保存 PNG。");
    };
    recorder.onstop = () => {
      cleanup();
      if (!failed) {
        download(
          new Blob(chunks, { type: mime }),
          `emergence-${settings.preset}.${mime.includes("mp4") ? "mp4" : "webm"}`,
        );
        report("录像已导出。");
      }
    };
    recorder.start();
    $("record").textContent = "停止并保存";
    report("正在录制画布（最多 8 秒），可随时停止。");
    recordTimer = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, 8000);
  } catch {
    stream?.getTracks().forEach((t) => t.stop());
    recording = null;
    report("无法开始录制，请使用保存画面。");
  }
};
$("share").onclick = async () => {
  const url = new URL(location.href);
  const q = new URLSearchParams(serialize(settings));
  q.set("palette", palette);
  if (bio) {
    q.set("feed", String(feed));
    q.set("kill", String(kill));
    q.set("rate", String(bioSpeed));
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
  settings = parseSettings(location.hash);
  readBioHash();
  reset();
});
function updatePointer(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  pointer = {
    x: (((e.clientX - r.left) * canvas.width) / r.width - viewX) / viewScale,
    y: (((e.clientY - r.top) * canvas.height) / r.height - viewY) / viewScale,
    repel: e.buttons > 0,
  };
  if (bio && e.buttons) {
    bio.inject(
      (pointer.x / 1200) * 256,
      (pointer.y / 760) * 160,
      e.shiftKey,
      5,
    );
    draw();
  }
}
canvas.addEventListener("pointermove", updatePointer);
canvas.addEventListener("pointerdown", updatePointer);
canvas.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse") updatePointer(e);
  else pointer = undefined;
});
canvas.addEventListener("pointerleave", () => (pointer = undefined));
canvas.addEventListener("pointercancel", () => (pointer = undefined));
window.addEventListener("pagehide", () => {
  if (recording?.state === "recording") recording.stop();
});
readBioHash();
reset();
new ResizeObserver(resize).observe(canvas);
resize();
let last = performance.now(),
  acc = 0,
  frames = 0,
  fpsStart = last;
function frame(now: number) {
  const elapsed = Math.min(now - last, 100);
  last = now;
  if (!paused && !document.hidden) {
    acc += elapsed;
    let steps = 0;
    const cap = bio ? 2 : 5;
    while (acc >= 1000 / 60 && steps < cap) {
      if (bio) bio.step(feed, kill, bioSpeed);
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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
