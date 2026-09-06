import "./style.css";
import { Simulation, parseSettings, serialize, type Preset } from "./engine";
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("world"),
  ctx = canvas.getContext("2d")!;
let settings = parseSettings(location.hash),
  sim = new Simulation(settings),
  paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
let viewScale = 1,
  viewX = 0,
  viewY = 0;
let pointer: { x: number; y: number; repel: boolean } | undefined,
  pulseUntil = 0;
const colors = ["#d9f87e", "#a3dad3", "#efb88d"];
const scenes: Record<Preset, [string, string]> = {
  flock: ["群体的直觉", "每个个体只看邻居，群体却形成了方向。"],
  orbit: ["围绕一个未知", "向心力与切向运动，共同维持流动的环。"],
  swarm: ["看不见的河流", "同一片流场，把独立个体编织成纹理。"],
};
function resize() {
  const r = canvas.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  viewScale = Math.min(canvas.width / sim.width, canvas.height / sim.height);
  viewX = (canvas.width - sim.width * viewScale) / 2;
  viewY = (canvas.height - sim.height * viewScale) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#111718";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(viewScale, 0, 0, viewScale, viewX, viewY);
  draw(true);
}
function draw(clear = false) {
  ctx.fillStyle = clear ? "#111718" : "rgba(17,23,24,0.19)";
  ctx.fillRect(0, 0, sim.width, sim.height);
  for (let c = 0; c < 3; c++) {
    ctx.beginPath();
    ctx.strokeStyle = colors[c];
    ctx.lineWidth = 1.45;
    for (let i = c; i < settings.count; i += 3) {
      const x = sim.x[i],
        y = sim.y[i];
      ctx.moveTo(x, y);
      ctx.lineTo(x - sim.vx[i] * 2.5, y - sim.vy[i] * 2.5);
    }
    ctx.stroke();
  }
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
}
function reset() {
  sim = new Simulation(settings);
  pointer = undefined;
  pulseUntil = 0;
  draw(true);
  sync();
}
function report(message: string) {
  $("status").textContent = message;
}
for (const key of ["count", "speed", "cohesion", "separation"] as const) {
  $(key).addEventListener("input", () => {
    settings[key] = Number($<HTMLInputElement>(key).value);
    if (key === "count") reset();
    else sync();
  });
}
document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((b) =>
  b.addEventListener("click", () => {
    settings.preset = b.dataset.preset as Preset;
    reset();
  }),
);
$("pause").onclick = () => {
  paused = !paused;
  sync();
};
$("reset").onclick = () => {
  reset();
  report("已用当前种子重新开始。");
};
$("new-seed").onclick = () => {
  settings.seed = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  reset();
};
$("seed").addEventListener("change", () => {
  const input = $<HTMLInputElement>("seed"),
    v = Number(input.value);
  settings.seed = Number.isFinite(v)
    ? Math.round(Math.max(0, Math.min(999999, v)))
    : 42;
  reset();
});
$("pulse").onclick = () => {
  pulseUntil = sim.time + 90;
  if (paused) {
    sim.step({ x: 600, y: 380, repel: true });
    draw();
    report("暂停中：已施加一帧中心扰动。");
  }
};
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector(".stage")!.requestFullscreen();
  } catch {
    report("此浏览器不支持全屏，请使用浏览器缩放。");
  }
};
$("save").onclick = () => {
  canvas.toBlob((blob) => {
    if (!blob) {
      report("画面导出失败，请重试。");
      return;
    }
    const a = document.createElement("a"),
      url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `emergence-${settings.preset}-${settings.seed}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    report("画面已导出为 PNG。");
  });
};
$("share").onclick = async () => {
  const url = new URL(location.href);
  url.hash = serialize(settings);
  history.replaceState(null, "", url);
  try {
    await navigator.clipboard.writeText(url.href);
    report("参数链接已复制，打开后从相同初始状态开始。");
  } catch {
    report("参数已写入地址栏，请复制浏览器地址分享。");
  }
};
window.addEventListener("hashchange", () => {
  settings = parseSettings(location.hash);
  reset();
});
function updatePointer(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  pointer = {
    x: (((e.clientX - r.left) * canvas.width) / r.width - viewX) / viewScale,
    y: (((e.clientY - r.top) * canvas.height) / r.height - viewY) / viewScale,
    repel: e.buttons > 0,
  };
}
canvas.addEventListener("pointermove", updatePointer);
canvas.addEventListener("pointerdown", updatePointer);
canvas.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse") updatePointer(e);
  else pointer = undefined;
});
canvas.addEventListener("pointerleave", () => (pointer = undefined));
canvas.addEventListener("pointercancel", () => (pointer = undefined));
new ResizeObserver(resize).observe(canvas);
sync();
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
    while (acc >= 1000 / 60 && steps < 5) {
      sim.step(
        pointer ??
          (sim.time < pulseUntil ? { x: 600, y: 380, repel: true } : undefined),
      );
      acc -= 1000 / 60;
      steps++;
    }
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
