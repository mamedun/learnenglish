import assert from "node:assert/strict";
import {
  encodePcm16Base64,
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

function decodePcm16(encoded) {
  const binary = atob(encoded);
  return Array.from(binary, (character) => character.charCodeAt(0));
}
assert.deepEqual(
  decodePcm16(encodePcm16Base64([-1, 0, 1], 16_000)),
  [0, 128, 0, 0, 255, 127],
);
const downsampledBytes = decodePcm16(
  encodePcm16Base64([-1, -0.5, 0, 0.5, 1, 0], 48_000),
);
const downsampledView = new DataView(Uint8Array.from(downsampledBytes).buffer);
assert.equal(downsampledView.getInt16(0, true), -32768);
assert.equal(downsampledView.getInt16(2, true), 16384);
assert.throws(() => encodePcm16Base64([0], 0), RangeError);

console.log(
  "PASS: Gemini Live text/binary WebSocket frames decode, and server errors are surfaced.",
);
