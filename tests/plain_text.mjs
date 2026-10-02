import assert from "node:assert/strict";
import {
  stripTranscriptSourceLabel,
  toPlainText,
} from "../src/lib/plainText.js";

assert.equal(
  stripTranscriptSourceLabel(
    "*TRANSKRIP · LIVE*my name is Ricky and I am from Bandung",
  ),
  "my name is Ricky and I am from Bandung",
);
assert.equal(
  stripTranscriptSourceLabel(
    "**TRANSKRIP · HASIL AI**: my name is Ricky and I am from Bandung",
  ),
  "my name is Ricky and I am from Bandung",
);
assert.equal(
  toPlainText(
    "<p>Hi <strong>Ricky</strong>! <b>Tips:</b> Use <em>“I'm”</em>.</p>",
  ),
  "Hi Ricky! Tips: Use “I'm”.",
);
assert.equal(
  toPlainText(
    "Hi Ricky! It's nice to meet you. **Tips:** Use *\"I'm\"* instead of a longer form.",
    { forSpeech: true },
  ),
  "Hi Ricky! It's nice to meet you. Tips: Use \"I'm\" instead of a longer form.",
);
assert.equal(
  toPlainText(
    "## Quick tips\n- **First**, say hello.\n- Then ask a question.\n\n[Read more](https://example.com)",
  ),
  "Quick tips\nFirst, say hello.\nThen ask a question.\n\nRead more",
);
assert.equal(
  toPlainText("Use &quot;I'm&quot; &amp; speak clearly."),
  'Use "I\'m" & speak clearly.',
);
assert.equal(toPlainText("**TRANSKRIP · LIVE**hello!"), "hello!");

console.log(
  "PASS: transcript source labels and Markdown/HTML are removed for display and TTS.",
);
