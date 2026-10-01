import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [theme, app] = await Promise.all([
  readFile(new URL("../src/theme.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/App.jsx", import.meta.url), "utf8"),
]);
const mobileRule =
  theme.match(/@media \(max-width: 720px\)([\s\S]*?)(?=\n@media|$)/)?.[1] || "";
assert.match(mobileRule, /\.topbar \.icon-btn\s*\{[^}]*display:\s*grid/s);
assert.doesNotMatch(
  mobileRule,
  /\.topbar \.icon-btn\s*\{[^}]*display:\s*none/s,
);
assert.match(app, /aria-label="Pengaturan"/);
console.log("PASS: Settings gear remains visible in the mobile top bar.");
