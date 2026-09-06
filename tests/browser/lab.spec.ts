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
