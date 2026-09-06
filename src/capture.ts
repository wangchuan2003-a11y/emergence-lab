export type CaptureState = "idle" | "recording" | "stopping";

type CaptureCallbacks = {
  onState: (state: CaptureState, secondsLeft: number) => void;
  onMessage: (message: string) => void;
  onComplete: (blob: Blob, filename: string) => void;
};

type CaptureDependencies = {
  Recorder: typeof MediaRecorder | undefined;
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (timer: number) => void;
};

const mimeTypes = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];
const maxDuration = 8000;

type Session = {
  recorder: MediaRecorder;
  stream: MediaStream;
  filename: string;
  mime: string;
  chunks: Blob[];
  timer?: number;
  deadline: number;
};

export function createCaptureController(
  canvas: HTMLCanvasElement,
  callbacks: CaptureCallbacks,
  dependencies: Partial<CaptureDependencies> = {},
) {
  const runtime: CaptureDependencies = {
    Recorder: typeof MediaRecorder === "undefined" ? undefined : MediaRecorder,
    now: () => performance.now(),
    setTimeout: (callback, delay) => window.setTimeout(callback, delay),
    clearTimeout: (timer) => window.clearTimeout(timer),
    ...dependencies,
  };
  let state: CaptureState = "idle";
  let session: Session | undefined;
  let disposed = false;

  function clearTimer(active: Session) {
    if (active.timer !== undefined) {
      runtime.clearTimeout(active.timer);
      active.timer = undefined;
    }
  }

  function finish(active: Session, save: boolean, message?: string) {
    // Error, stop, and page teardown can all arrive for the same recording.
    if (session !== active) return;
    session = undefined;
    clearTimer(active);
    const recorder = active.recorder;
    recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Track cleanup is still required if the encoder has already failed.
      }
    }
    active.stream.getTracks().forEach((track) => track.stop());
    state = "idle";
    callbacks.onState(state, 0);
    if (message) callbacks.onMessage(message);
    if (!save) return;
    const blob = new Blob(active.chunks, { type: active.mime });
    if (!blob.size) {
      callbacks.onMessage("录像没有有效数据，请重试或保存 PNG。");
      return;
    }
    callbacks.onComplete(blob, active.filename);
    callbacks.onMessage("录像已导出。");
  }

  function stop() {
    if (!session || state !== "recording") return;
    const active = session;
    clearTimer(active);
    state = "stopping";
    callbacks.onState(state, 0);
    try {
      // An inactive recorder may already have its final data/stop events queued.
      if (active.recorder.state !== "inactive") active.recorder.stop();
    } catch {
      finish(active, false, "录制失败，请重试或保存 PNG。");
    }
  }

  function tick(active: Session) {
    if (session !== active || state !== "recording") return;
    const remaining = active.deadline - runtime.now();
    if (remaining <= 0) {
      stop();
      return;
    }
    callbacks.onState(state, Math.ceil(remaining / 1000));
    active.timer = runtime.setTimeout(
      () => tick(active),
      Math.min(1000, remaining),
    );
  }

  return {
    get state(): CaptureState {
      return state;
    },
    start(filenameBase: string, durationMs = maxDuration) {
      if (disposed || session) return;
      const Recorder = runtime.Recorder;
      if (!Recorder || typeof canvas.captureStream !== "function") {
        callbacks.onMessage("此浏览器不支持录制，请使用保存画面。");
        return;
      }
      let stream: MediaStream | undefined;
      let active: Session | undefined;
      try {
        const mime = mimeTypes.find((type) => Recorder.isTypeSupported(type));
        if (!mime) {
          callbacks.onMessage("没有可用的视频编码器，请使用保存画面。");
          return;
        }
        stream = canvas.captureStream(30);
        const recorder = new Recorder(stream, { mimeType: mime });
        const actualMime = recorder.mimeType || mime;
        const duration = Number.isFinite(durationMs)
          ? Math.max(1, Math.min(durationMs, maxDuration))
          : maxDuration;
        active = {
          recorder,
          stream,
          filename: `${filenameBase}.${actualMime.includes("mp4") ? "mp4" : "webm"}`,
          mime: actualMime,
          chunks: [],
          deadline: runtime.now() + duration,
        };
        const recording = active;
        session = recording;
        recorder.ondataavailable = (event) => {
          if (session === recording && event.data.size)
            recording.chunks.push(event.data);
        };
        recorder.onstop = () => finish(recording, true);
        recorder.onerror = () =>
          finish(recording, false, "录制失败，请重试或保存 PNG。");
        recorder.start();
        if (session !== recording) return;
        state = "recording";
        callbacks.onMessage("正在录制画布，可随时停止并保存。");
        tick(recording);
      } catch {
        if (active) {
          finish(active, false, "无法开始录制，请使用保存画面。");
        } else {
          stream?.getTracks().forEach((track) => track.stop());
          callbacks.onMessage("无法开始录制，请使用保存画面。");
        }
      }
    },
    stop,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (session) finish(session, false);
    },
  };
}
