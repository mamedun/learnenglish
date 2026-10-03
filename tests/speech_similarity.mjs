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

// Test mergeTranscripts (Android Chrome de-duplication and continuous streaming)
import { mergeTranscripts } from "../src/hooks/useSpeechRecognition.js";
assert.equal(mergeTranscripts("Good morning", "Good morning everyone"), "Good morning everyone");
assert.equal(mergeTranscripts("Good morning", "Good morning"), "Good morning");
assert.equal(mergeTranscripts("Good morning", "everyone"), "Good morning everyone");
assert.equal(mergeTranscripts("screen yesterday", "yesterday and opened"), "screen yesterday and opened");
assert.equal(mergeTranscripts("", "Hello world"), "Hello world");
assert.equal(mergeTranscripts("Hello world", ""), "Hello world");

// Test user scenario: Android Chrome cumulative interim chunks
const userScenarioChunks = [
  "hello",
  "hello my",
  "hello my name",
  "hello my name is",
  "hello my name is Maya",
];
let userResult = "";
for (const chunk of userScenarioChunks) {
  userResult = mergeTranscripts(userResult, chunk);
}
assert.equal(userResult, "hello my name is Maya");

console.log(
  "PASS: punctuation-insensitive matching, contraction/number variants, and 90% threshold.",
);
