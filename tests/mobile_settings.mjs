import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [theme, app, settings, toastCss] = await Promise.all([
  readFile(new URL("../src/theme.css", import.meta.url), "utf8"),
  readFile(new URL("../src/app/App.jsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/settings/SettingsPage.jsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/components/MascotLoadingToast.css", import.meta.url),
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

// Assertions for TTS settings labels and engine selection
assert.match(settings, /<b>Natural Voice<\/b>/);
assert.match(settings, /Kokoro TTS · Suara neural alami/);
assert.match(settings, /<b>Browser Native<\/b>/);
assert.doesNotMatch(settings, /KOKORO VOICE · BALASAN TUTOR DINAMIS/);
assert.match(settings, /SUARA BROWSER NATIVE|BROWSER VOICE/);
assert.match(
  settings,
  /balasan tutor\s+pada AI Lesson akan otomatis menggunakan voice Kokoro pilihan materi/s,
);

// Assertions for tutor reply prioritizing material/unit voice in App.jsx
assert.match(app, /voice:\s*resolvedVoice/);
assert.match(app, /candidateVoice[\s\S]*?activeUnit\?\.voice/);
assert.match(app, /type:\s*"ai_reply"/);
assert.match(
  app,
  /Ganti ke Browser Native di Settings jika Proses Audio Terlalu lama/,
);

// Assertions for MascotLoadingToast responsive width
assert.match(toastCss, /max-width:\s*720px/);
assert.match(toastCss, /width:\s*calc\(100% - 16px\)/);

console.log(
  "PASS: Settings gear stays visible on mobile, Natural Voice / Browser Native configured, lesson voice prioritized, and toast widened.",
);
