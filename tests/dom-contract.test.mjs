import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

test("literal application element bindings exist exactly once in the HTML shell", async () => {
  const html = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  const ids = new Map();
  for (const match of html.matchAll(/\bid="([^"]+)"/g))
    ids.set(match[1], (ids.get(match[1]) ?? 0) + 1);
  const code = await readFile(
    new URL("../src/main.ts", import.meta.url),
    "utf8",
  );
  const source = ts.createSourceFile(
    "main.ts",
    code,
    ts.ScriptTarget.Latest,
    true,
  );
  const required = new Set();
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "$" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    )
      required.add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const missing = [...required].filter((id) => ids.get(id) !== 1);
  assert.deepEqual(
    missing,
    [],
    `Missing or duplicate application elements: ${missing.join(", ")}`,
  );
});
