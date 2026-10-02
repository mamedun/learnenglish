import assert from "node:assert/strict";
import {
  compareSpokenText,
  normalizeWords,
} from "../src/lib/speechSimilarity.js";

assert.deepEqual(normalizeWords("Hello, world! How's it going?"), [
  "hello",
  "world",
  "how",
  "is",
  "it",
  "going",
]);
assert.equal(compareSpokenText("Hello, world!", "hello world.").percent, 100);
assert.equal(
  compareSpokenText(
    "Hello, I’m Maya. I moved into apartment 4B on Monday. The building is next to the small green park. I work at a bakery, so I leave home at six in the morning.",
    "hello I am Maya I moved into apartment 4B on Monday the building is next to the small green Park I work at a bakery so I leave home at 6:00 in the morning",
  ).percent,
  100,
  "contracted words and speech-recognized number/time variants should match fairly",
);
assert.deepEqual(normalizeWords("twenty-one students"), ["21", "students"]);
assert.equal(
  compareSpokenText("Apartment 4B", "Apartment four B").percent,
  100,
);
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
    "one two three four five six seven eight nine",
    90,
  ).passed,
  true,
  "the default 90% cutoff remains inclusive",
);
assert.equal(
  compareSpokenText(
    "one two three four five six seven eight nine ten",
    "one two three four five six seven eight nine",
    91,
  ).passed,
  false,
  "an Admin-configured threshold applies to local comparison",
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
console.log(
  "PASS: punctuation-insensitive matching, contraction/number variants, and 90% threshold.",
);
