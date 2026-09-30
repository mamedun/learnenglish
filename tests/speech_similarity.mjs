import assert from "node:assert/strict";
import {
  compareSpokenText,
  normalizeWords,
} from "../src/lib/speechSimilarity.js";

assert.deepEqual(normalizeWords("Hello, world! How's it going?"), [
  "hello",
  "world",
  "hows",
  "it",
  "going",
]);
assert.equal(compareSpokenText("Hello, world!", "hello world.").percent, 100);
assert.equal(
  compareSpokenText(
    "one two three four five six seven eight nine ten",
    "one two three four five six seven eight nine",
  ).percent,
  90,
);
assert.equal(
  compareSpokenText(
    "one two three four five six seven eight nine ten",
    "one two three four five six seven eight nine wrong",
  ).passed,
  true,
);
assert.equal(
  compareSpokenText(
    "one two three four five six seven eight nine ten",
    "one two three four five six seven eight wrong wrong",
  ).passed,
  false,
);
assert.equal(compareSpokenText("", "anything").passed, false);
console.log("PASS: punctuation-insensitive speech matching and 90% threshold.");
