import assert from "node:assert/strict";
import {
  buildLearnerAssessmentTranscript,
  mergeLiveTranscriptText,
} from "../src/lib/liveTranscript.js";

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
assert.equal(
  buildLearnerAssessmentTranscript([
    { who: "learner", text: "I like this topic." },
    { who: "coach", text: "Tell me why you like it." },
    { who: "learner", text: "It feels relaxing." },
  ]),
  "I like this topic.\nIt feels relaxing.",
);
assert.equal(
  buildLearnerAssessmentTranscript([{ who: "learner", text: "abcdefgh" }], 5),
  "abcde",
);

console.log(
  "PASS: Live transcript fragments join as readable utterances without duplicate cumulative text.",
);
