import type { Simulation } from "./engine.js";
import type { ReactionDiffusion } from "./reaction.js";
import type { Physarum } from "./physarum.js";

export type RenderSource =
  | { kind: "particles"; model: Simulation }
  | { kind: "reaction"; model: ReactionDiffusion }
  | { kind: "network"; model: Physarum; showAgents: boolean };

export type View = {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Palette = "lagoon" | "ember" | "mono";
const particleColors = {
  lagoon: ["#d9f87e", "#70ded7", "#e8bb8e"],
  ember: ["#ffaf6e", "#f2745d", "#ffe0aa"],
  mono: ["#edfaff", "#abc5d7", "#7994ac"],
} as const;
// Preserve the previous 1.25 px marker at the 1200 px reference width.
const agentSize = (1.25 * 256) / 1200;

export function getDomain(source: RenderSource) {
  return { width: source.model.width, height: source.model.height };
}

/** Fit a model domain into canvas pixels without changing its aspect ratio. */
export function fitView(
  canvasWidth: number,
  canvasHeight: number,
  domainWidth: number,
  domainHeight: number,
): View {
  if (
    !Number.isFinite(canvasWidth) ||
    !Number.isFinite(canvasHeight) ||
    !Number.isFinite(domainWidth) ||
    !Number.isFinite(domainHeight) ||
    canvasWidth < 0 ||
    canvasHeight < 0 ||
    domainWidth < 0 ||
    domainHeight < 0
  )
    throw new RangeError("View dimensions must be finite and nonnegative");
  if (!canvasWidth || !canvasHeight || !domainWidth || !domainHeight)
    return {
      scale: 0,
      x: canvasWidth / 2,
      y: canvasHeight / 2,
      width: 0,
      height: 0,
    };
  const scale = Math.min(
    canvasWidth / domainWidth,
    canvasHeight / domainHeight,
  );
  const width = domainWidth * scale,
    height = domainHeight * scale;
  return {
    scale,
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    width,
    height,
  };
}

/** Right/bottom edges are outside; returned coordinates are never clamped. */
export function pointToDomain(view: View, pixelX: number, pixelY: number) {
  if (
    view.scale <= 0 ||
    !Number.isFinite(view.scale) ||
    !Number.isFinite(pixelX) ||
    !Number.isFinite(pixelY)
  )
    return { x: 0, y: 0, inside: false };
  const offsetX = pixelX - view.x,
    offsetY = pixelY - view.y;
  return {
    x: offsetX / view.scale,
    y: offsetY / view.scale,
    inside:
      offsetX >= 0 &&
      offsetY >= 0 &&
      offsetX < view.width &&
      offsetY < view.height,
  };
}

/** Draw in native model units. The caller owns the canvas fit transform. */
export function createRenderer() {
  let fieldCanvas: HTMLCanvasElement | undefined,
    fieldContext: CanvasRenderingContext2D | null = null,
    fieldImage: ImageData | undefined;

  return {
    paint(
      ctx: CanvasRenderingContext2D,
      source: RenderSource,
      palette: Palette,
      clear = false,
    ) {
      const { width, height } = source.model;
      ctx.save();
      try {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.clip();
        if (source.kind !== "particles") {
          if (!fieldCanvas) {
            fieldCanvas = document.createElement("canvas");
            fieldContext = fieldCanvas.getContext("2d");
          }
          if (!fieldContext)
            throw new Error("Canvas 2D rendering is unavailable");
          if (
            !fieldImage ||
            fieldImage.width !== width ||
            fieldImage.height !== height
          ) {
            fieldCanvas.width = width;
            fieldCanvas.height = height;
            fieldImage = fieldContext.createImageData(width, height);
          }
          source.model.pixels(fieldImage.data, palette);
          fieldContext.putImageData(fieldImage, 0, 0);
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(fieldCanvas, 0, 0, width, height);
          if (source.kind === "network" && source.showAgents) {
            ctx.globalCompositeOperation = "screen";
            ctx.globalAlpha = 0.65;
            ctx.fillStyle = palette === "ember" ? "#ffe6bd" : "#d6fff3";
            const model = source.model;
            for (let i = 0; i < model.settings.count; i++)
              ctx.fillRect(model.x[i], model.y[i], agentSize, agentSize);
          }
        } else {
          ctx.fillStyle = clear ? "#070f14" : "rgba(7,15,20,.15)";
          ctx.fillRect(0, 0, width, height);
          ctx.globalCompositeOperation = "lighter";
          const model = source.model,
            colors = particleColors[palette];
          for (let c = 0; c < 3; c++) {
            ctx.beginPath();
            ctx.strokeStyle = colors[c];
            ctx.lineWidth = 1.6;
            for (let i = c; i < model.settings.count; i += 3) {
              ctx.moveTo(model.x[i], model.y[i]);
              ctx.lineTo(
                model.x[i] - model.vx[i] * 3.5,
                model.y[i] - model.vy[i] * 3.5,
              );
            }
            ctx.stroke();
          }
        }
      } finally {
        ctx.restore();
      }
    },
  };
}
