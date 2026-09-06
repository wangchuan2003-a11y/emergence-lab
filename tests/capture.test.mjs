import test from "node:test";
import assert from "node:assert/strict";
import { createCaptureController } from "../.test-build/capture.js";

function setup({ supported = "video/webm", fail = "" } = {}) {
  let time = 0;
  let nextTimer = 0;
  const timers = new Map();
  const instances = [];
  const states = [];
  const messages = [];
  const completed = [];
  const tracks = [
    {
      stops: 0,
      stop() {
        this.stops++;
      },
    },
  ];
  const captureRates = [];
  class Recorder {
    static isTypeSupported(type) {
      return type === supported;
    }
    constructor(stream, { mimeType }) {
      if (fail === "construct") throw new Error("encoder unavailable");
      this.mimeType = mimeType;
      this.state = "inactive";
      this.stops = 0;
      instances.push(this);
    }
    start() {
      if (fail === "start") throw new Error("encoder cannot start");
      this.state = "recording";
    }
    stop() {
      this.stops++;
      this.state = "inactive";
      if (fail === "stop") throw new Error("encoder cannot stop");
      // Final data and stop events are asynchronous in the browser.
    }
    data(value) {
      this.ondataavailable?.({ data: new Blob([value]) });
    }
    finish() {
      this.state = "inactive";
      this.onstop?.();
    }
  }
  const canvas = {
    captureStream(rate) {
      captureRates.push(rate);
      return { getTracks: () => tracks };
    },
  };
  const controller = createCaptureController(
    canvas,
    {
      onState: (...args) => states.push(args),
      onMessage: (message) => messages.push(message),
      onComplete: (blob, filename) => completed.push({ blob, filename }),
    },
    {
      Recorder,
      now: () => time,
      setTimeout: (callback, delay) => {
        const id = ++nextTimer;
        timers.set(id, { callback, at: time + delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  );
  function advance(milliseconds) {
    const target = time + milliseconds;
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      time = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    time = target;
  }
  return {
    controller,
    instances,
    tracks,
    states,
    messages,
    completed,
    timers,
    captureRates,
    advance,
  };
}

test("stop waits for final data, keeps the start filename, and cleans up once", async () => {
  const h = setup();
  h.controller.start("emergence-coral-42");
  h.controller.start("emergence-flock-99");
  const recorder = h.instances[0];
  assert.deepEqual(h.captureRates, [30]);
  assert.equal(h.controller.state, "recording");
  assert.deepEqual(h.states, [["recording", 8]]);
  h.advance(2000);
  assert.deepEqual(h.states.at(-1), ["recording", 6]);

  h.controller.stop();
  h.controller.stop();
  assert.equal(h.controller.state, "stopping");
  assert.equal(recorder.stops, 1);
  assert.equal(h.tracks[0].stops, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.completed.length, 0);
  recorder.data("final video chunk");
  recorder.finish();
  recorder.finish();
  h.controller.dispose();
  assert.equal(h.controller.state, "idle");
  assert.deepEqual(h.states.slice(-2), [
    ["stopping", 0],
    ["idle", 0],
  ]);
  assert.equal(h.tracks[0].stops, 1);
  assert.equal(h.completed.length, 1);
  assert.equal(h.completed[0].filename, "emergence-coral-42.webm");
  assert.equal(await h.completed[0].blob.text(), "final video chunk");
  assert.equal(h.completed[0].blob.type, "video/webm");
});

test("automatic stop is capped at eight seconds", () => {
  const h = setup();
  h.controller.start("eight-seconds", 60000);
  h.advance(7999);
  assert.equal(h.controller.state, "recording");
  assert.deepEqual(h.states.at(-1), ["recording", 1]);
  h.advance(1);
  assert.equal(h.controller.state, "stopping");
  assert.equal(h.instances[0].stops, 1);
  assert.equal(h.timers.size, 0);
  h.instances[0].data("video");
  h.instances[0].finish();
  assert.equal(h.tracks[0].stops, 1);
});

test("short recordings use the selected MP4 type and correct countdown", () => {
  const h = setup({ supported: "video/mp4" });
  h.controller.start("short", 1500);
  assert.deepEqual(h.states.at(-1), ["recording", 2]);
  h.advance(1000);
  assert.deepEqual(h.states.at(-1), ["recording", 1]);
  h.advance(500);
  h.instances[0].data("video");
  h.instances[0].finish();
  assert.equal(h.completed[0].filename, "short.mp4");
  assert.equal(h.completed[0].blob.type, "video/mp4");
});

test("recorder errors discard data and ignore late stop events", () => {
  const h = setup();
  h.controller.start("failed");
  const recorder = h.instances[0];
  const lateStop = recorder.onstop;
  const lateError = recorder.onerror;
  recorder.data("partial video");
  recorder.onerror();
  lateStop();
  lateError();
  assert.equal(h.controller.state, "idle");
  assert.equal(h.completed.length, 0);
  assert.equal(h.tracks[0].stops, 1);
  assert.equal(recorder.stops, 1);
  assert.equal(h.timers.size, 0);
  assert.equal(
    h.messages.filter((message) => message.includes("录制失败")).length,
    1,
  );
  h.controller.start("retry");
  assert.equal(h.instances.length, 2);
  assert.equal(h.controller.state, "recording");
  h.controller.dispose();
});

for (const fail of ["construct", "start", "stop"]) {
  test(`${fail} failure releases stream and leaves the controller idle`, () => {
    const h = setup({ fail });
    h.controller.start("failed");
    if (fail === "stop") h.controller.stop();
    assert.equal(h.controller.state, "idle");
    assert.equal(h.completed.length, 0);
    assert.equal(h.tracks[0].stops, 1);
    assert.equal(h.timers.size, 0);
    h.controller.dispose();
    assert.equal(h.tracks[0].stops, 1);
  });
}

test("empty video data is never downloaded", () => {
  const h = setup();
  h.controller.start("empty");
  h.instances[0].data("");
  h.controller.stop();
  h.instances[0].finish();
  assert.equal(h.completed.length, 0);
  assert.equal(h.controller.state, "idle");
  assert.equal(h.tracks[0].stops, 1);
  assert.match(h.messages.at(-1), /没有有效数据/);
});

test("disposing while stopping discards queued results and is idempotent", () => {
  const h = setup();
  h.controller.start("leaving");
  const recorder = h.instances[0];
  const lateData = recorder.ondataavailable;
  const lateStop = recorder.onstop;
  h.controller.stop();
  h.controller.dispose();
  h.controller.dispose();
  lateData({ data: new Blob(["late video"]) });
  lateStop();
  h.controller.start("after-dispose");
  h.advance(10000);
  assert.equal(h.controller.state, "idle");
  assert.equal(h.completed.length, 0);
  assert.equal(h.tracks[0].stops, 1);
  assert.equal(h.instances.length, 1);
  assert.equal(h.timers.size, 0);
});

test("unsupported codecs do not allocate a stream", () => {
  const h = setup({ supported: "" });
  h.controller.start("unsupported");
  assert.equal(h.controller.state, "idle");
  assert.equal(h.captureRates.length, 0);
  assert.equal(h.timers.size, 0);
  assert.match(h.messages.at(-1), /没有可用的视频编码器/);
});
