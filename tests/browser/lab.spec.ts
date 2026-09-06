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
