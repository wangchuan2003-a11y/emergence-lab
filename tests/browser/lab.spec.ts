import { test, expect } from "@playwright/test";
test("presets, pause, controls, share, export and layout", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#scene-title")).toHaveText("群体的直觉");
  await page.locator('[data-preset="orbit"]').click();
  await expect(page.locator("#scene-title")).toHaveText("围绕一个未知");
  await page.locator("#pause").click();
  await expect(page.locator("#state")).toHaveText("已暂停");
  await page.locator("#speed").press("Home");
  for (let i = 0; i < 18; i++) await page.locator("#speed").press("ArrowRight");
  await expect(page.locator("#speed-value")).toHaveText("2.1");
  await page.locator("#seed").fill("123");
  await page.locator("#seed").press("Tab");
  await page.locator("#share").click();
  await expect(page).toHaveURL(/preset=orbit.*speed=2.1.*seed=123/);
  const shared = page.url();
  await page.goto(shared);
  await expect(page.locator("#seed")).toHaveValue("123");
  await expect(page.locator("#speed")).toHaveValue("2.1");
  const download = page.waitForEvent("download");
  await page.locator("#save").click();
  expect((await download).suggestedFilename()).toBe("emergence-orbit-123.png");
  await page.locator('[data-preset="swarm"]').click();
  await expect(page.locator("#scene-title")).toHaveText("看不见的河流");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("reduced motion starts paused and can resume", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#state")).toHaveText("已暂停");
  await page.locator("#pause").click();
  await expect(page.locator("#state")).toHaveText("运行中");
});

test("reaction controls, seeded share, single step and recording", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=coral");
  await expect(page.locator("#scene-title")).toHaveText("让一片珊瑚生长");
  await expect(page.locator("#bio-controls")).toBeVisible();
  await expect(page.locator("#particle-controls")).toBeHidden();
  await expect(page.locator("#step-count")).toHaveText("240");
  await page.locator("#step").click();
  await expect(page.locator("#step-count")).toHaveText("248");
  await page.locator("#palette").selectOption("ember");
  await page.locator("#feed").press("ArrowRight");
  await expect(page.locator("#feed-value")).toHaveText("0.0546");
  await page.locator("#share").click();
  await expect(page).toHaveURL(/palette=ember.*feed=0.0546/);
  await page.reload();
  await expect(page.locator("#feed")).toHaveValue("0.0546");
  await expect(page.locator("#palette")).toHaveValue("ember");
  await page.locator('[data-preset="cells"]').click();
  await expect(page.locator("#kill-value")).toHaveText("0.0649");
  const download = page.waitForEvent("download");
  await page.locator("#record").click();
  await expect(page.locator("#record")).toHaveText("停止并保存");
  await expect(page.locator("[data-preset=coral]")).toBeDisabled();
  await expect(page.locator("#reset")).toBeDisabled();
  await page.locator("#step").click();
  await page.locator("#record").click();
  expect((await download).suggestedFilename()).toMatch(
    /emergence-cells\.(webm|mp4)/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("checkpoint restores edited state and rejects bad files without changing it", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=coral");
  await page.locator("#pulse").click();
  await page.locator("#step").click();
  await page.locator(".checkpoint-panel summary").click();
  const firstDownload = page.waitForEvent("download");
  await page.locator("#checkpoint-save").click();
  const checkpoint = await firstDownload;
  const path = await checkpoint.path();
  const { readFile } = await import("node:fs/promises");
  const original = JSON.parse(await readFile(path!, "utf8"));
  expect(original.time).toBe(248);
  expect(original.b).toHaveLength(40960);
  await page.locator("#new-seed").click();
  await page.locator("#checkpoint-file").setInputFiles(path!);
  await expect(page.locator("#step-count")).toHaveText("248");
  await expect(page.locator("#state")).toHaveText("已暂停");
  const secondDownload = page.waitForEvent("download");
  await page.locator("#checkpoint-save").click();
  const restored = JSON.parse(
    await readFile((await (await secondDownload).path())!, "utf8"),
  );
  expect(restored).toEqual(original);
  await page.locator("#checkpoint-file").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":88}'),
  });
  await expect(page.locator("#status")).toContainText("不支持此快照");
  await expect(page.locator("#step-count")).toHaveText("248");
});

test("canvas shortcuts and touch-friendly brush controls work", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=coral");
  await page.locator('[data-brush="erase"]').click();
  await expect(page.locator('[data-brush="erase"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#pulse").click();
  await expect(page.locator("#status")).toContainText("已擦除");
  await page.locator("#world").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#step-count")).toHaveText("248");
  await page.keyboard.press("Space");
  await expect(page.locator("#state")).toHaveText("运行中");
  await page.locator("#pause").click();
  const before = await page.locator("#step-count").textContent();
  await page.locator("#feed").focus();
  await page.keyboard.press("ArrowRight");
  expect(await page.locator("#step-count").textContent()).toBe(before);
  await expect(page.locator("#step-count")).toHaveAttribute("aria-live", "off");
});

test("skip navigation preserves the current seeded experiment", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=coral&seed=88");
  await page.locator(".skip-link").focus();
  await page.locator(".skip-link").press("Enter");
  await expect(page).toHaveURL(/preset=coral&seed=88/);
  await expect(page.locator("#world")).toBeFocused();
  await expect(page.locator("#scene-title")).toHaveText("让一片珊瑚生长");
  await expect(page.locator("#step-count")).toHaveText("240");
});

test("network settings, drawing, single step and checkpoint roundtrip", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=physarum&networkCount=1000&sensorDistance=14");
  await expect(page.locator("#scene-title")).toHaveText("路径，记住了来者");
  await expect(page.locator("#network-controls")).toBeVisible();
  await expect(page.locator("#bio-controls")).toBeHidden();
  await expect(page.locator("#brush-controls")).toBeVisible();
  await expect(page.locator("#network-count")).toHaveValue("1000");
  await expect(page.locator("#sensor-distance")).toHaveValue("14");
  await expect(page.locator("#step-count")).toHaveText("120");
  await page.locator("#step").click();
  await expect(page.locator("#step-count")).toHaveText("121");
  await page.locator("#pulse").click();
  await page.locator("#share").click();
  await expect(page).toHaveURL(/networkCount=1000.*sensorDistance=14/);
  await page.locator(".checkpoint-panel summary").click();
  const pending = page.waitForEvent("download");
  await page.locator("#checkpoint-save").click();
  const path = await (await pending).path();
  await page.locator("#new-seed").click();
  await page.locator("#checkpoint-file").setInputFiles(path!);
  await expect(page.locator("#step-count")).toHaveText("121");
  await expect(page.locator("#state")).toHaveText("已暂停");
  await page.locator("#stage-pause").click();
  await expect(page.locator("#state")).toHaveText("运行中");
  expect(errors).toEqual([]);
});

test("high resolution PNG preserves domain aspect and locks its filename", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=coral&seed=91");
  await page.locator("#export-width").selectOption("1920");
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      original.call(
        this,
        (blob) => setTimeout(() => callback(blob), 150),
        type,
        quality,
      );
    };
  });
  const pending = page.waitForEvent("download");
  await page.locator("#save").click();
  await page.locator('[data-preset="orbit"]').click();
  const image = await pending;
  expect(image.suggestedFilename()).toBe("emergence-coral-91.png");
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile((await image.path())!);
  expect(bytes.readUInt32BE(16)).toBe(1920);
  expect(bytes.readUInt32BE(20)).toBe(1200);
});

test("a delayed checkpoint cannot overwrite a later scene choice", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=coral");
  await page.locator(".checkpoint-panel summary").click();
  const pending = page.waitForEvent("download");
  await page.locator("#checkpoint-save").click();
  const path = await (await pending).path();
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(path!);
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = function () {
      const file = this;
      return new Promise<string>((resolve) => {
        (
          window as unknown as { finishCheckpointRead: () => Promise<void> }
        ).finishCheckpointRead = () => original.call(file).then(resolve);
      });
    };
  });
  await page.locator("#checkpoint-file").setInputFiles({
    name: "slow.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await page.locator('[data-preset="orbit"]').click();
  await page.evaluate(() =>
    (
      window as unknown as { finishCheckpointRead: () => Promise<void> }
    ).finishCheckpointRead(),
  );
  await expect(page.locator("#scene-title")).toHaveText("围绕一个未知");
  await expect(page.locator("#state")).toHaveText("已暂停");
});

test("body space is not an experiment shortcut and particle overlay survives checkpoints", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=physarum");
  await page.keyboard.press("Space");
  await expect(page.locator("#state")).toHaveText("已暂停");
  await page.locator("#show-agents").uncheck();
  await page.locator(".checkpoint-panel summary").click();
  const pending = page.waitForEvent("download");
  await page.locator("#checkpoint-save").click();
  const path = await (await pending).path();
  await page.locator("#show-agents").check();
  await page.locator("#checkpoint-file").setInputFiles(path!);
  await expect(page.locator("#show-agents")).not.toBeChecked();
});

test("English interface switches without resetting the model and shares its language", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=physarum&networkCount=1000&lang=en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#scene-title")).toHaveText("Trails that remember");
  await expect(page.locator(".intro p")).toContainText(/forms\.\s+Seed/);
  await expect(page.locator("#state")).toHaveText("Paused");
  await expect(page.locator("#step-count")).toHaveText("120");
  const visibleText = (await page.locator("body").innerText()).replaceAll(
    "中文",
    "",
  );
  expect(/[\u3400-\u9fff]/.test(visibleText)).toBe(false);
  await page.locator("#language-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("#scene-title")).toHaveText("路径，记住了来者");
  await page.locator("#step").click();
  await page.locator("#language-toggle").click();
  await expect(page.locator("#step-count")).toHaveText("121");
  await expect(page.locator("#state")).toHaveText("Paused");
  await page.locator("#share").click();
  await expect(page).toHaveURL(/lang=en/);
  await expect(page.locator("#status")).not.toHaveText(/[\u3400-\u9fff]/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("language switch during recording preserves the capture lifecycle", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=coral&lang=en");
  const pending = page.waitForEvent("download");
  await page.locator("#record").click();
  await page.locator("#language-toggle").click();
  await expect(page.locator("#record")).toHaveText("停止并保存");
  await expect(page.locator("#reset")).toBeDisabled();
  await page.locator("#step").click();
  await page.locator("#record").click();
  expect((await pending).suggestedFilename()).toMatch(
    /emergence-coral\.(webm|mp4)/,
  );
  await expect(page.locator("#reset")).toBeEnabled();
});

test("an installed offline copy opens in a new page without a network", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=physarum&lang=en&networkCount=1000");
  await expect(page.locator("#offline-state")).toHaveText(
    "Offline copy ready",
    { timeout: 15000 },
  );
  await context.setOffline(true);
  const offline = await context.newPage();
  const errors: string[] = [];
  offline.on("pageerror", (e) => errors.push(e.message));
  await offline.emulateMedia({ reducedMotion: "reduce" });
  await offline.goto("/#preset=physarum&lang=en&networkCount=1000");
  await expect(offline.locator("#scene-title")).toHaveText(
    "Trails that remember",
  );
  await expect(offline.locator("#step-count")).toHaveText("120");
  await offline.locator("#step").click();
  await expect(offline.locator("#step-count")).toHaveText("121");
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
