import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../api/index.php", import.meta.url),
  "utf8",
);
const assessmentStart = source.indexOf(
  "if($action==='live-assessment'&&$method==='POST')",
);
const assessmentEnd = source.indexOf(
  "respond(['error'=>'Route tidak ditemukan.'],404);",
  assessmentStart,
);
assert.notEqual(assessmentStart, -1, "live-assessment route must exist");
assert.notEqual(
  assessmentEnd,
  -1,
  "live-assessment route must have a clear end",
);
const assessmentRoute = source.slice(assessmentStart, assessmentEnd);
assert.match(assessmentRoute, /\$c\['provider'\]==='free'/);
assert.match(assessmentRoute, /free_request\(\$prompt/);
assert.match(assessmentRoute, /provider_request\('\/chat\/completions'/);
assert.doesNotMatch(
  assessmentRoute,
  /generativelanguage\.googleapis\.com|generateContent/,
  "post-session assessment must not call Gemini directly",
);

const chatStart = source.indexOf("if($action==='chat'&&$method==='POST')");
const audioStart = source.indexOf(
  "if($action==='assess-audio'&&$method==='POST')",
  chatStart,
);
assert.notEqual(chatStart, -1, "regular AI chat route must exist");
assert.notEqual(
  audioStart,
  -1,
  "regular AI chat route must end before audio assessment",
);
assert.match(
  source.slice(chatStart, audioStart),
  /provider_request\('\/chat\/completions'/,
);

console.log(
  "PASS: Live assessment uses the selected Free/Clario provider; Clario chat routing remains available.",
);
