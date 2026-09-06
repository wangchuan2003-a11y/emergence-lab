import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import {
  buildManifest,
  buildWorkerSource,
  writeOfflineWorker,
} from "../scripts/build-offline.mjs";

const files = [
  { path: "index.html", contents: "<html>shell</html>" },
  { path: "assets/app.js", contents: "console.log('shell')" },
  { path: "assets/app.css", contents: "body { color: teal; }" },
];

function workerHarness(manifest, scope = "https://example.test/lab/") {
  const events = new Map();
  const stores = new Map();
  const fetched = [];
  const installed = [];
  let claims = 0;
  let network = async () => new Response("online");
  let installError;
  const key = (request) =>
    typeof request === "string" ? request : request.url;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async addAll(requests) {
          if (installError) throw installError;
          for (const request of requests) {
            installed.push(request);
            entries.set(key(request), new Response("cached:" + key(request)));
          }
        },
        async match(request) {
          return entries.get(key(request))?.clone();
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
  vm.runInNewContext(buildWorkerSource(manifest), {
    URL,
    Request,
    Set,
    Promise,
    caches,
    fetch: async (request) => {
      fetched.push(request);
      return network(request);
    },
    self: {
      registration: { scope },
      clients: {
        async claim() {
          claims++;
        },
      },
      addEventListener(name, handler) {
        events.set(name, handler);
      },
    },
  });
  return {
    stores,
    fetched,
    installed,
    get claims() {
      return claims;
    },
    setNetwork(handler) {
      network = handler;
    },
    failInstall(error) {
      installError = error;
    },
    async dispatch(name) {
      let pending;
      events.get(name)({
        waitUntil(promise) {
          pending = promise;
        },
      });
      await pending;
    },
    request(url, { method = "GET", mode = "cors" } = {}) {
      let response;
      events.get("fetch")({
        request: { url, method, mode },
        respondWith(promise) {
          response = promise;
        },
      });
      return response;
    },
  };
}

test("build output is deterministic, content-versioned and excludes non-shell files", async () => {
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = await mkdtemp(
    path.join(temporaryRoot, "emergence-offline-test-"),
  );
  try {
    await mkdir(path.join(directory, "assets"));
    for (const file of files)
      await writeFile(path.join(directory, file.path), file.contents);
    await writeFile(path.join(directory, "assets", "font.woff2"), "font-bytes");
    await writeFile(
      path.join(directory, "snapshot.json"),
      '{"private":"snapshot"}',
    );
    await writeFile(path.join(directory, "sw.js"), "old worker");
    await writeFile(path.join(directory, "assets", "app.js.map"), "source map");

    const initial = await writeOfflineWorker(directory);
    assert.deepEqual(initial.resources, [
      "assets/app.css",
      "assets/app.js",
      "assets/font.woff2",
      "index.html",
    ]);
    assert.deepEqual(await writeOfflineWorker(directory), initial);
    await writeFile(
      path.join(directory, "assets", "app.js"),
      "changed build bytes",
    );
    const changed = await writeOfflineWorker(directory);
    assert.notEqual(changed.version, initial.version);
    const source = await readFile(path.join(directory, "sw.js"), "utf8");
    assert.ok(source.includes(changed.version));
    assert.ok(!source.includes("private"));
    assert.ok(!source.includes("snapshot.json"));
    assert.ok(!source.includes("skipWaiting"));
    assert.ok(!source.includes("reload()"));
  } finally {
    const resolved = path.resolve(directory);
    const relative = path.relative(temporaryRoot, resolved);
    assert.ok(
      relative && !path.isAbsolute(relative) && !relative.startsWith(".."),
    );
    assert.equal(path.dirname(resolved), temporaryRoot);
    assert.ok(path.basename(resolved).startsWith("emergence-offline-test-"));
    await rm(resolved, { recursive: true, force: true });
  }
});

test("pure manifest rejects external, ambiguous and escaping paths", () => {
  const manifest = buildManifest(files);
  assert.deepEqual(buildManifest([...files].reverse()), manifest);
  for (const filename of [
    "https://outside.test/app.js",
    "//outside.test/app.js",
    "/other/app.js",
    "../app.js",
    "assets/../app.js",
    "assets\\app.js",
    "assets/%2e%2e/app.js",
    "assets/app.js?user=1",
    "assets/app.js#fragment",
    "assets//app.js",
  ]) {
    assert.throws(() =>
      buildManifest([...files, { path: filename, contents: "x" }]),
    );
    assert.throws(() =>
      buildWorkerSource({ ...manifest, resources: ["index.html", filename] }),
    );
  }
  assert.throws(() => buildManifest(files.slice(1)), /index.html/);
  assert.throws(() => buildManifest([...files, files[0]]), /duplicate/);
  assert.throws(() =>
    buildWorkerSource({
      ...manifest,
      resources: ["index.html", "snapshot.json"],
    }),
  );
  assert.throws(() =>
    buildWorkerSource({ ...manifest, resources: ["index.html", "sw.js"] }),
  );
});

test("installation precaches the complete scoped shell and activation preserves other applications", async () => {
  const manifest = buildManifest(files);
  const worker = workerHarness(manifest);
  await worker.dispatch("install");
  assert.deepEqual(
    worker.installed.map((request) => request.url),
    manifest.resources.map((file) => "https://example.test/lab/" + file),
  );
  assert.ok(worker.installed.every((request) => request.cache === "reload"));
  assert.equal(worker.claims, 0);

  const current = `emergence-lab-shell:${encodeURIComponent("/lab/")}:${manifest.version}`;
  const old = `emergence-lab-shell:${encodeURIComponent("/lab/")}:old`;
  const other = `emergence-lab-shell:${encodeURIComponent("/other/")}:old`;
  const root = `emergence-lab-shell:${encodeURIComponent("/")}:old`;
  for (const name of [old, other, root, "another-app-cache"])
    worker.stores.set(name, new Map());
  await worker.dispatch("activate");
  assert.deepEqual(
    [...worker.stores.keys()].sort(),
    [current, other, root, "another-app-cache"].sort(),
  );
  assert.equal(worker.claims, 1);

  const otherWorker = workerHarness(manifest, "https://example.test/other/");
  await otherWorker.dispatch("install");
  assert.notEqual([...otherWorker.stores.keys()][0], current);
  const broken = workerHarness(manifest);
  broken.failInstall(new Error("one resource unavailable"));
  await assert.rejects(broken.dispatch("install"), /resource unavailable/);
  assert.equal(broken.claims, 0);
});

test("only exact same-origin scoped GET shell assets use the cache", async () => {
  const worker = workerHarness(buildManifest(files));
  await worker.dispatch("install");
  const response = await worker.request(
    "https://example.test/lab/assets/app.js",
  );
  assert.equal(
    await response.text(),
    "cached:https://example.test/lab/assets/app.js",
  );
  assert.equal(worker.fetched.length, 0);
  for (const [url, options] of [
    ["https://outside.test/lab/assets/app.js", {}],
    ["https://example.test/other/assets/app.js", {}],
    ["https://example.test/lab-other/assets/app.js", {}],
    ["https://example.test/lab/snapshot.json", {}],
    ["https://example.test/lab/assets/app.js?user=1", {}],
    ["https://example.test/lab/assets/app.js", { method: "POST" }],
    ["https://example.test/other/", { mode: "navigate" }],
  ])
    assert.equal(worker.request(url, options), undefined);
});

test("navigation uses the network then the cached index without storing navigation or user data", async () => {
  const worker = workerHarness(buildManifest(files));
  await worker.dispatch("install");
  const cache = [...worker.stores.values()][0];
  const initialKeys = [...cache.keys()];
  const url = "https://example.test/lab/?snapshot=user-choice";
  const online = await worker.request(url, { mode: "navigate" });
  assert.equal(await online.text(), "online");
  worker.setNetwork(async () => {
    throw new TypeError("offline");
  });
  const offline = await worker.request(url, { mode: "navigate" });
  assert.equal(
    await offline.text(),
    "cached:https://example.test/lab/index.html",
  );
  worker.setNetwork(async () => new Response("unavailable", { status: 503 }));
  const unavailable = await worker.request(url, { mode: "navigate" });
  assert.equal(
    await unavailable.text(),
    "cached:https://example.test/lab/index.html",
  );
  assert.equal(worker.fetched.length, 3);
  assert.deepEqual([...cache.keys()], initialKeys);
});

test("a newer online page never replaces the older worker's complete offline shell", async () => {
  const oldHtml = '<script src="./assets/app-old.js"></script>';
  const newHtml = '<script src="./assets/app-new.js"></script>';
  const worker = workerHarness(
    buildManifest([
      { path: "index.html", contents: oldHtml },
      { path: "assets/app-old.js", contents: "old compatible application" },
    ]),
  );
  await worker.dispatch("install");
  const cache = [...worker.stores.values()][0];
  const indexUrl = "https://example.test/lab/index.html";
  const oldAssetUrl = "https://example.test/lab/assets/app-old.js";
  const newAssetUrl = "https://example.test/lab/assets/app-new.js";
  cache.set(indexUrl, new Response(oldHtml));
  cache.set(oldAssetUrl, new Response("old compatible application"));
  worker.setNetwork(async () => new Response(newHtml));
  const online = await worker.request("https://example.test/lab/", {
    mode: "navigate",
  });
  assert.equal(await online.text(), newHtml);
  assert.equal(worker.request(newAssetUrl), undefined);
  assert.ok(!cache.has(newAssetUrl));

  worker.setNetwork(async () => {
    throw new TypeError("offline");
  });
  const offline = await worker.request("https://example.test/lab/", {
    mode: "navigate",
  });
  assert.equal(await offline.text(), oldHtml);
  const oldAsset = await worker.request(oldAssetUrl);
  assert.equal(await oldAsset.text(), "old compatible application");
  assert.equal(cache.size, 2);
});
