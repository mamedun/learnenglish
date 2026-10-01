import assert from "node:assert/strict";
import { mergeLiveTranscriptText } from "../src/lib/liveTranscript.js";

assert.equal(mergeLiveTranscriptText("", "Hello"), "Hello");
assert.equal(mergeLiveTranscriptText("Hi! I", "don't"), "Hi! I don't");
assert.equal(
  mergeLiveTranscriptText("I don't ", "have ability"),
  "I don't have ability",
);
assert.equal(mergeLiveTranscriptText("Hello", ","), "Hello,");
assert.equal(
  mergeLiveTranscriptText("I don't", "I don't have"),
  "I don't have",
);
assert.equal(
  mergeLiveTranscriptText("I don't have", "I don't"),
  "I don't have",
);

console.log(
  "PASS: Live transcript fragments join as readable utterances without duplicate cumulative text.",
);
