import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// 1. Verify manifest.webmanifest
const manifestRaw = await read("public/manifest.webmanifest");
const manifest = JSON.parse(manifestRaw);

assert.equal(manifest.name, "SpeakUp — AI English Fluency Coach");
assert.equal(manifest.short_name, "SpeakUp");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.theme_color, "#315c45");
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2);

const has192 = manifest.icons.some((i) => i.sizes === "192x192");
const has512 = manifest.icons.some((i) => i.sizes === "512x512");
const hasMaskable = manifest.icons.some((i) => i.purpose?.includes("maskable"));

assert(has192, "Manifest must have 192x192 icon");
assert(has512, "Manifest must have 512x512 icon");
assert(hasMaskable, "Manifest must have maskable icon");

// 2. Verify Service Worker
const swJs = await read("public/sw.js");
assert.match(swJs, /addEventListener\("install"/);
assert.match(swJs, /addEventListener\("activate"/);
assert.match(swJs, /addEventListener\("fetch"/);
assert.match(swJs, /skipWaiting/);
assert.match(swJs, /clients\.claim/);

// 3. Verify HTML integration
const indexHtml = await read("index.html");
assert.match(indexHtml, /rel="manifest"/);
assert.match(indexHtml, /manifest\.webmanifest/);
assert.match(indexHtml, /rel="apple-touch-icon"/);
assert.match(indexHtml, /name="mobile-web-app-capable"/);
assert.match(indexHtml, /name="apple-mobile-web-app-capable"/);
assert.match(indexHtml, /theme-color/);

// 4. Verify PWA install hook and UI
const pwaHook = await read("src/hooks/usePwaInstall.js");
assert.match(pwaHook, /beforeinstallprompt/);
assert.match(pwaHook, /appinstalled/);
assert.match(pwaHook, /installApp/);

const settingsJsx = await read("src/features/settings/SettingsPage.jsx");
assert.match(settingsJsx, /usePwaInstall/);
assert.match(settingsJsx, /Aplikasi Mobile \(PWA\)/);

// 5. Verify icon files exist
await stat(new URL("../public/icons/icon-192.png", import.meta.url));
await stat(new URL("../public/icons/icon-512.png", import.meta.url));
await stat(new URL("../public/icons/apple-touch-icon.png", import.meta.url));

console.log("PASS: PWA manifest, service worker, responsive icons, and mobile install prompt verified.");
