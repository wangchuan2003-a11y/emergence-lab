import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyTranslations,
  translate,
  translations,
} from "../.test-build/i18n.js";

test("source keys translate to English and back to Chinese", () => {
  assert.equal(translate("暂停实验", "en"), "Pause simulation");
  assert.equal(translate("暂停实验", "zh"), "暂停实验");
  assert.equal(
    translate("文件不是有效的 JSON 快照。", "en"),
    "This file is not a valid JSON snapshot.",
  );
  assert.equal(translate("录像已导出。", "en"), "Recording exported.");
});

test("marked interface text and capture/snapshot errors have English translations", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const keys = [...html.matchAll(/data-i18n(?:-aria|-title)?="([^"]*)"/g)].map(
    (match) => match[1].replace(/\s+/g, " ").trim(),
  );
  for (const name of ["capture", "snapshot"]) {
    const source = readFileSync(
      new URL(`../src/${name}.ts`, import.meta.url),
      "utf8",
    );
    keys.push(
      ...[...source.matchAll(/"([^"\n]*\p{Script=Han}[^"\n]*)"/gu)].map(
        (match) => match[1],
      ),
    );
  }
  for (const key of new Set(keys)) {
    assert.ok(Object.hasOwn(translations, key), `Missing English text: ${key}`);
    assert.doesNotMatch(translations[key], /\p{Script=Han}/u);
  }
});

test("lookup normalizes source whitespace without changing unknown text", () => {
  assert.equal(translate("  补给率\n  F  ", "en"), "Feed rate F");
  assert.equal(
    translate("  not in the dictionary\n", "en"),
    "  not in the dictionary\n",
  );
  assert.equal(translate("toString", "en"), "toString");
  assert.equal(translate("F 0.0545 · K 0.0620", "en"), "F 0.0545 · K 0.0620");
  for (const key of Object.keys(translations)) {
    assert.equal(key, key.replace(/\s+/g, " ").trim());
  }
});

test("dynamic messages interpolate in both languages and retain missing values", () => {
  const source = "已恢复第 {step} 步并暂停。点击继续实验即可接着演化。";
  assert.equal(
    translate(source, "zh", { step: 120 }),
    "已恢复第 120 步并暂停。点击继续实验即可接着演化。",
  );
  assert.equal(
    translate(source, "en", { step: 120 }),
    "Restored step 120 and paused. Select Resume simulation to continue.",
  );
  assert.equal(
    translate("已导出宽 {width} 像素的 PNG。", "en", { width: 3840 }),
    "Exported a PNG at 3840 pixels wide.",
  );
  assert.equal(translate("{seconds}s", "en", { seconds: 0 }), "0s");
  assert.equal(translate("{seconds}s", "zh", { seconds: 8 }), "8s");
  assert.equal(translate("{seconds}s", "en"), "{seconds}s");
  assert.equal(
    translate("Unknown {value}", "en", { value: "$&" }),
    "Unknown $&",
  );
  assert.equal(translate("{toString}", "en"), "{toString}");
});

// A small DOM boundary stub keeps these tests runnable with Node alone.
function element(attributes) {
  const values = new Map(Object.entries(attributes));
  return {
    textContent: "Previous rendered text",
    getAttribute: (name) => values.get(name) ?? null,
    setAttribute: (name, value) => values.set(name, value),
  };
}

test("DOM language changes always read source attributes and preserve them", () => {
  const button = element({
    "data-i18n": "暂停",
    "data-i18n-aria": "暂停或继续实验",
    "data-i18n-title": "暂停实验",
  });
  const unknown = element({ "data-i18n": "Unlisted label" });
  const elements = [button, unknown];
  const root = {
    querySelectorAll(selector) {
      const attribute = selector.slice(1, -1);
      return elements.filter((item) => item.getAttribute(attribute) !== null);
    },
  };
  const originalSources = [
    button.getAttribute("data-i18n"),
    button.getAttribute("data-i18n-aria"),
    button.getAttribute("data-i18n-title"),
  ];
  applyTranslations(root, "en");
  assert.equal(button.textContent, "Pause");
  assert.equal(
    button.getAttribute("aria-label"),
    "Pause or resume the simulation",
  );
  assert.equal(button.getAttribute("title"), "Pause simulation");
  assert.equal(unknown.textContent, "Unlisted label");
  button.textContent = "Unrelated runtime text";
  applyTranslations(root, "zh");
  assert.equal(button.textContent, "暂停");
  assert.equal(button.getAttribute("aria-label"), "暂停或继续实验");
  assert.equal(button.getAttribute("title"), "暂停实验");
  applyTranslations(root, "en");
  assert.equal(button.textContent, "Pause");
  assert.deepEqual(
    ["data-i18n", "data-i18n-aria", "data-i18n-title"].map((name) =>
      button.getAttribute(name),
    ),
    originalSources,
  );
});
