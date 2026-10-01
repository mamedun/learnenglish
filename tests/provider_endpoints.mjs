import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [api, configExample, admin, app] = await Promise.all([
  readFile(new URL("../api/index.php", import.meta.url), "utf8"),
  readFile(new URL("../api/config.example.php", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/admin/AdminPage.jsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/app/App.jsx", import.meta.url), "utf8"),
]);

assert.match(api, /\['clario','free','gemini','openrouter'\]/);
assert.match(api, /function gemini_ai_request\(/);
assert.match(
  api,
  /generativelanguage\.googleapis\.com\/v1beta\/models\/.*generateContent/,
);
assert.match(api, /inlineData/);
assert.match(api, /openrouter\.ai\/api\/v1/);
assert.match(api, /openrouter_api_key_enc/);
assert.match(api, /gemini_ai_api_key_enc/);
assert.match(api, /gemini_key_enc/);
assert.match(api, /GEMINI_AI_API_KEY/);
assert.match(api, /OPENROUTER_API_KEY/);
assert.match(api, /supportedGenerationMethods/);
assert.match(api, /sg\(\?:\[1-9\]\|10\)\\\.ichsanlabs\\\.com/);
assert.match(api, /'iss'=>'ichsanlabs\.com'/);
assert.match(
  api,
  /app_setting_compat\('free_api_key_enc','ichan_api_key_enc'\)/,
);
assert.match(api, /Authorization: Bearer '\.\$token/);
assert.match(api, /X-API-Key: '\.\$c\['free_api_key'\]/);
assert.match(api, /if\(\$c\['provider'\]==='openrouter'\)/);
assert.match(api, /if\(\$c\['provider'\]==='gemini'\)/);
assert.match(api, /\$j\['provider'\]='clario'/);

assert.match(configExample, /GEMINI_AI_API_KEY/);
assert.match(configExample, /OPENROUTER_API_KEY/);
assert.match(configExample, /GEMINI_API_KEY/);
assert.match(admin, /<option value="gemini">/);
assert.match(admin, /<option value="openrouter">/);
assert.match(admin, /id="gemini-ai-key"/);
assert.match(admin, /id="openrouter-api-key"/);
assert.match(admin, /id="gemini-ai-model"/);
assert.match(admin, /id="openrouter-model"/);
assert.match(admin, /modelsProvider === "gemini"/);
assert.match(admin, /modelsProvider === "openrouter"/);
assert.match(admin, /refreshModels\("gemini"\)/);
assert.match(admin, /refreshModels\("openrouter"\)/);
assert.match(admin, /Gemini Live · real-time voice/);
assert.match(app, /\["clario", "free", "gemini", "openrouter"\]/);

console.log(
  "PASS: Gemini Server AI and OpenRouter have separate encrypted credentials, selected-provider routing, and model catalogs; Gemini Live stays independently configured.",
);
