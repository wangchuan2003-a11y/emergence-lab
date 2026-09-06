import { defineConfig } from "vite";
const candidate = (process.env.GITHUB_SHA ?? "").slice(0, 7);
const revision = /^[a-f0-9]{7}$/.test(candidate) ? candidate : "local";
export default defineConfig({
  base: "./",
  define: { __APP_REVISION__: JSON.stringify(revision) },
});
