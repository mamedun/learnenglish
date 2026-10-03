import assert from "node:assert/strict";
import { formatFeedbackText } from "../src/lib/formatFeedback.js";
import { selectBestVoice } from "../src/lib/ttsRocks.js";

// Test 1: Feedback criteria text formatting & segmentation
assert.equal(formatFeedbackText("slightrepetition"), "Slight repetition");
assert.equal(
  formatFeedbackText("excellentdescriptivevocabulary"),
  "Excellent descriptive vocabulary",
);
assert.equal(
  formatFeedbackText("gooduseofrelativeclauses"),
  "Good use of relative clauses",
);
assert.equal(
  formatFeedbackText("clearandeasytounderstand"),
  "Clear and easy to understand",
);
assert.equal(formatFeedbackText("minorhesitation"), "Minor hesitation");
assert.equal(formatFeedbackText("slight_repetition"), "Slight repetition");
assert.equal(
  formatFeedbackText("excellentDescriptiveVocabulary"),
  "Excellent descriptive vocabulary",
);
assert.equal(
  formatFeedbackText(
    "Audio-dependent criterion; transcript text is insufficient.",
  ),
  "Audio-dependent criterion; transcript text is insufficient.",
);

// Test 2: Best British female voice selection prioritization
const chromeVoices = [
  { name: "Google US English", lang: "en-US" },
  { name: "Google UK English Female", lang: "en-GB" },
  { name: "Google UK English Male", lang: "en-GB" },
];
assert.equal(
  selectBestVoice(chromeVoices)?.name,
  "Google UK English Female",
);

const edgeVoices = [
  { name: "Microsoft David - English (United States)", lang: "en-US" },
  { name: "Microsoft Zira - English (United States)", lang: "en-US" },
  {
    name: "Microsoft Libby Online (Natural) - English (United Kingdom)",
    lang: "en-GB",
  },
];
assert.equal(
  selectBestVoice(edgeVoices)?.name,
  "Microsoft Libby Online (Natural) - English (United Kingdom)",
);

const edgeSoniaVoices = [
  { name: "Microsoft David - English (United States)", lang: "en-US" },
  {
    name: "Microsoft Sonia Online (Natural) - English (United Kingdom)",
    lang: "en-GB",
  },
];
assert.equal(
  selectBestVoice(edgeSoniaVoices)?.name,
  "Microsoft Sonia Online (Natural) - English (United Kingdom)",
);

const windowsLegacyVoices = [
  { name: "Microsoft David Desktop - English (United States)", lang: "en-US" },
  { name: "Microsoft Zira Desktop - English (United States)", lang: "en-US" },
];
assert.equal(
  selectBestVoice(windowsLegacyVoices)?.name,
  "Microsoft Zira Desktop - English (United States)",
);

const macVoices = [
  { name: "Alex", lang: "en-US" },
  { name: "Daniel", lang: "en-GB" },
  { name: "Fiona", lang: "en-GB" },
];
assert.equal(selectBestVoice(macVoices)?.name, "Fiona");

console.log(
  "PASS: Feedback text segmentation and British female voice prioritization verified.",
);
