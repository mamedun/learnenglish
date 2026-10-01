import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(
  new URL("../src/app/App.jsx", import.meta.url),
  "utf8",
);
const submitStart = app.indexOf("async function submitTurn(");
const finishStart = app.indexOf("function finishUnit()", submitStart);
assert.notEqual(submitStart, -1);
assert.notEqual(finishStart, -1);
const submitTurn = app.slice(submitStart, finishStart);
assert.match(submitTurn, /await apiJson\("app-config"\)/);
assert.match(submitTurn, /settings\?\.speech_input_mode/);
assert.match(submitTurn, /settings\?\.ai_provider/);
assert.match(submitTurn, /speech_input_mode: settings\.speech_input_mode/);
assert.match(submitTurn, /currentConfig\.speech_input_mode/);
assert.match(submitTurn, /currentConfig\.ai_provider === "free"/);
assert.match(submitTurn, /await Swal\.fire\(/);
assert.match(submitTurn, /consent\.isConfirmed/);
assert.match(submitTurn, /payload\?\.detail/);
assert.ok(
  submitTurn.indexOf("await Swal.fire(") <
    submitTurn.indexOf('apiFetch("assess-audio"'),
);
assert.match(app, /canCompletePracticeLesson\(turns\.length\)/);
assert.doesNotMatch(app, /avg\s*<\s*3\.5/);
const practice = await readFile(
  new URL("../src/features/speaking/PracticePage.jsx", import.meta.url),
  "utf8",
);
assert.match(practice, /criteria-evidence/);
assert.match(practice, /c\?\.evidence/);

const api = await readFile(
  new URL("../api/index.php", import.meta.url),
  "utf8",
);
const chatStart = api.indexOf("if($action==='chat'&&$method==='POST')");
const audioStart = api.indexOf(
  "if($action==='assess-audio'&&$method==='POST')",
);
assert.notEqual(chatStart, -1);
assert.notEqual(audioStart, -1);
const freeTextBranch = api.slice(
  chatStart,
  api.indexOf("$model=$cfg['model'];", chatStart),
);
assert.match(freeTextBranch, /practice_stars/);
assert.match(freeTextBranch, /isTextCriterion/);
assert.match(
  freeTextBranch,
  /status'\s*=>\s*\$isTextCriterion\?'provisional':'not_scored'/,
);
assert.match(freeTextBranch, /Text-based estimate from your transcript/);
assert.match(freeTextBranch, /\$assessment\['retry_recommended'\]=false/);
assert.doesNotMatch(freeTextBranch, /'practice_stars'\s*=>\s*3/);
const admin = await readFile(
  new URL("../src/features/admin/AdminPage.jsx", import.meta.url),
  "utf8",
);
assert.match(admin, /berlaku hanya untuk latihan read-aloud/i);
assert.match(admin, /Gemini Live tetap memakai Gemini/);
assert.match(admin, /AI\s+Lesson terbuka memakai provider global/);
const clarioTextBranch = api.slice(
  api.indexOf("$model=$cfg['model'];", chatStart),
  audioStart,
);
assert.match(
  clarioTextBranch,
  /fluency_coherence'\]=\['band'=>null,'status'=>'not_scored'/,
);
assert.match(
  clarioTextBranch,
  /pronunciation'\]=\['band'=>null,'status'=>'not_scored'/,
);
assert.match(clarioTextBranch, /practice_stars'\]\?\?null/);
const clarioStart = api.indexOf("if(!in_array($mime,['audio/wav'", audioStart);
assert.notEqual(audioStart, -1);
assert.notEqual(clarioStart, -1);
const freeAudioBranch = api.slice(audioStart, clarioStart);
assert.match(freeAudioBranch, /free_request\(\$prompt,\$file\['tmp_name'\]/);
assert.match(freeAudioBranch, /practice_stars/);
assert.match(freeAudioBranch, /criteria/);
assert.doesNotMatch(freeAudioBranch, /'practice_stars'\s*=>\s*3/);
assert.match(freeAudioBranch, /assessment audio terstruktur/);
assert.match(freeAudioBranch, /free_response_diagnostics/);
assert.match(freeAudioBranch, /node=%s/);
const freeRequestStart = api.indexOf("function free_request(");
const freeDiagnosticsStart = api.indexOf(
  "function free_response_diagnostics(",
  freeRequestStart,
);
assert.notEqual(freeRequestStart, -1);
assert.notEqual(freeDiagnosticsStart, -1);
const freeAdapter = api.slice(freeRequestStart, freeDiagnosticsStart);
assert.match(freeAdapter, /Authorization: Bearer/);
assert.match(freeAdapter, /X-API-Key/);
assert.match(freeAdapter, /http_multipart\(/);
assert.match(freeAdapter, /node_host/);
assert.doesNotMatch(freeAdapter, /HTTP_USER_AGENT|User-Agent/);
assert.match(api, /function free_failure_detail\(/);

const clarioAudioBranch = api.slice(
  clarioStart,
  api.indexOf("if($action==='live-token'", clarioStart),
);
assert.match(clarioAudioBranch, /type'=>'input_audio'/);
assert.match(clarioAudioBranch, /inline_image_not_supported/);
assert.match(clarioAudioBranch, /clario_audio_input_unsupported/);
assert.match(clarioAudioBranch, /image_url hanya berlaku untuk gambar/);
assert.match(admin, /endpoint\/model terpilih harus mendukung audio/);

console.log(
  "PASS: AI Lesson confirms current audio mode, requests Free audio assessment, and does not gate completion by stars.",
);
