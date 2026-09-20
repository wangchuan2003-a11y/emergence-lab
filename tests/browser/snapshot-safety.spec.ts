import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("invalid network palette preserves canvas, controls and exported state", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#preset=physarum&networkCount=500&seed=71");
  await page.locator("#step").click();
  await page.locator("#pulse").click();
  await page.locator(".checkpoint-panel summary").click();
  const exported = async () => {
    const download = page.waitForEvent("download");
    await page.locator("#checkpoint-save").click();
    return JSON.parse(await readFile((await (await download).path())!, "utf8"));
  };
  const original = await exported();
  const canvas = () => page.locator("#world").evaluate((el: HTMLCanvasElement) => el.toDataURL());
  const before = await canvas();
  const url = page.url();
  for (const palette of [["lagoon"], null, {}, true, 1]) {
    await page.locator("#checkpoint-file").setInputFiles({
      name: "invalid.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...original, palette })),
    });
    await expect(page.locator("#status")).toContainText("快照影调或时间无效");
    expect(await canvas()).toBe(before);
    expect(await exported()).toEqual(original);
    await expect(page.locator("#state")).toHaveText("已暂停");
    await expect(page.locator("#network-count")).toHaveValue("500");
    expect(page.url()).toBe(url);
  }
  // A valid checkpoint remains importable and deterministic.
  await page.locator("#checkpoint-file").setInputFiles({
    name: "valid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(original)),
  });
  await expect(page.locator("#status")).toContainText("已恢复");
  expect(await exported()).toEqual(original);
  expect(errors).toEqual([]);
});
