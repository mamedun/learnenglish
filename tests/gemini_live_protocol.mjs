import assert from "node:assert/strict";
import {
  getGeminiLiveMessageError,
  parseGeminiLiveMessage,
} from "../src/lib/geminiLiveProtocol.js";

const setupComplete = JSON.stringify({ setupComplete: {} });
assert.deepEqual(await parseGeminiLiveMessage(setupComplete), {
  setupComplete: {},
});
assert.deepEqual(await parseGeminiLiveMessage(new Blob([setupComplete])), {
  setupComplete: {},
});
assert.deepEqual(
  await parseGeminiLiveMessage(new TextEncoder().encode(setupComplete)),
  { setupComplete: {} },
);
assert.deepEqual(
  await parseGeminiLiveMessage(new TextEncoder().encode(setupComplete).buffer),
  { setupComplete: {} },
);
await assert.rejects(
  parseGeminiLiveMessage(new Blob(["not JSON"])),
  SyntaxError,
);
await assert.rejects(parseGeminiLiveMessage({ setupComplete: {} }), TypeError);
assert.equal(
  getGeminiLiveMessageError({
    error: { code: 400, message: "Invalid Live model" },
  }),
  "Invalid Live model",
);
assert.equal(getGeminiLiveMessageError({ setupComplete: {} }), null);

console.log(
  "PASS: Gemini Live text/binary WebSocket frames decode, and server errors are surfaced.",
);
