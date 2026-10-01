import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [theme, app, settings] = await Promise.all([
  readFile(new URL("../src/theme.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/App.jsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/settings/SettingsPage.jsx", import.meta.url),
    "utf8",
  ),
]);
const mobileRule =
  theme.match(/@media \(max-width: 720px\)([\s\S]*?)(?=\n@media|$)/)?.[1] || "";
assert.match(mobileRule, /\.topbar \.icon-btn\s*\{[^}]*display:\s*grid/s);
assert.doesNotMatch(
  mobileRule,
  /\.topbar \.icon-btn\s*\{[^}]*display:\s*none/s,
);
assert.match(app, /aria-label="Pengaturan"/);
assert.match(app, /const engine = isSmallViewport \? "native"/);
assert.match(settings, /const isSmallViewport = useSmallViewport\(\)/);
assert.match(settings, /!isSmallViewport && \(/);
assert.match(settings, /activeTtsEngine = isSmallViewport/);
assert.match(settings, /shared audio lesson tetap\s+diprioritaskan/);
console.log(
  "PASS: Settings gear stays visible on mobile, Browser Native is mobile-default, and lesson cache playback remains prioritized.",
);
