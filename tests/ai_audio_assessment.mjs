import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [app, practice, api, admin, audioTask, listening] = await Promise.all([
  read("src/app/App.jsx"),
  read("src/features/speaking/PracticePage.jsx"),
  read("api/index.php"),
  read("src/features/admin/AdminPage.jsx"),
  read("src/features/listening/ListeningSpeakingTask.jsx"),
  read("src/features/listening/ListeningPage.jsx"),
]);

const submitStart = app.indexOf("async function submitTurn(");
const finishStart = app.indexOf("function clearPracticeHistory(", submitStart);
assert.notEqual(submitStart, -1);
assert.notEqual(finishStart, -1);
const submitTurn = app.slice(submitStart, finishStart);
assert.match(submitTurn, /await apiJson\("app-config"\)/);
assert.match(submitTurn, /settings\?\.ai_provider/);
assert.match(submitTurn, /const useServerAudio = mode === "audio"/);
assert.match(submitTurn, /currentConfig\.ai_provider === "free"/);
assert.match(submitTurn, /currentConfig\.free_browser_debug/);
assert.match(submitTurn, /user\?\.role === "admin"/);
assert.doesNotMatch(submitTurn, /speech_input_mode/);
assert.match(submitTurn, /fetch\(debugSetup\.url/);
assert.match(submitTurn, /headers: debugSetup\.headers/);
assert.match(submitTurn, /body: directForm/);
assert.match(submitTurn, /consent: true/);
assert.match(submitTurn, /debugSetup\.token_expires_at/);
assert.match(submitTurn, /AI audio assessment returned a non-JSON response/);
assert.match(submitTurn, /const responseText = await response\.text\(\)/);
assert.ok(
  submitTurn.indexOf("await Swal.fire(") <
    submitTurn.indexOf('apiFetch("assess-audio"'),
  "audio consent must precede upload",
);
assert.match(app, /canCompletePracticeLesson\(turns\.length, points\)/);
assert.match(
  app,
  /practicePoints\(turns, appConfig\.speech_similarity_threshold\)/,
);
assert.match(app, /live-billing\/start/);
assert.match(app, /live-billing\/started/);
assert.match(app, /live-billing\/reserve/);
assert.match(app, /live-billing\/settle/);
assert.match(app, /billing_session_id: liveBillingSessionRef\.current/);
assert.doesNotMatch(app, /hasPremiumAccess/);

assert.match(practice, /setResponseMode\("transcript"\)/);
assert.match(practice, /chooseResponseMode\("audio"\)/);
assert.match(practice, /submitTurn\(\{ mode: responseMode \}\)/);
assert.match(practice, /2 diamond/);
assert.match(practice, /5 diamond/);
assert.match(practice, /clearHistory\?\.\(unit\.id\)/);
assert.match(practice, /\[\.\.\.turns\]\.reverse\(\)/);
assert.match(practice, /criterion\.rating/);
assert.match(practice, /criterion\.feedback_id/);
assert.doesNotMatch(practice, /speechInputMode/);
assert.doesNotMatch(practice, /IELTS Speaking practice estimate/);
assert.doesNotMatch(practice, /Belum dapat diestimasi/);
assert.doesNotMatch(practice, /estimatedBand/);
assert.match(practice, /Audio-dependent · not scored/);
assert.match(practice, /minimal 4 percakapan dan 100 poin/i);

const chatStart = api.indexOf("if($action==='chat'&&$method==='POST')");
const audioStart = api.indexOf(
  "if($action==='assess-audio'&&$method==='POST')",
);
const liveTokenStart = api.indexOf("if($action==='live-token'", audioStart);
assert.notEqual(chatStart, -1);
assert.notEqual(audioStart, -1);
assert.match(
  api.slice(chatStart, audioStart),
  /wallet_reserve\(\(int\)\$u\['id'\],2,'ai_lesson_text'/,
);
assert.match(
  api.slice(audioStart, liveTokenStart),
  /\$mode==='read_aloud'\?1:5/,
);
assert.match(
  api.slice(audioStart, liveTokenStart),
  /'audio\/webm'=>'audio\/webm','video\/webm'=>'audio\/webm'/,
);
assert.match(api.slice(audioStart, liveTokenStart), /'rating'=>max\(1,min\(5/);
assert.match(api.slice(audioStart, liveTokenStart), /'status'=>'scored'/);
assert.match(api, /\$criteria\[\$key\]=\['rating'=>\$rating===null\?null/);
assert.match(api, /\$isTextCriterion\?'provisional':'not_scored'/);
assert.match(api, /Audio-dependent criterion; transcript text is insufficient/);
assert.doesNotMatch(api, /function require_premium\(/);

const audioUploadStart = api.indexOf("if($action==='audio'&&$method==='POST')");
const audioUploadEnd = api.indexOf(
  "if($action==='audio'&&$method==='GET')",
  audioUploadStart,
);
const audioUpload = api.slice(audioUploadStart, audioUploadEnd);
assert.match(audioUpload, /'video\/webm'=>'webm'/);
assert.match(audioUpload, /'video\/webm'=>'audio\/webm'/);

assert.match(admin, /AI provider global/);
assert.match(admin, /Gemini Live tetap memakai Gemini/);
assert.match(admin, /1 diamond/);
assert.match(admin, /payment_qris_payload/);
assert.match(admin, /payment_tax_percent/);
assert.match(admin, /payment_admin_fee/);
assert.match(admin, /payment_whatsapp/);
assert.match(admin, /AdminPurchasesPanel/);
assert.match(admin, /AdminUsersPanel/);
assert.match(audioTask, /expected_text:\s*lesson\.script,\s*transcript/);
assert.match(audioTask, /onAttempt\?\.\(\s*result\.percent,\s*text/);
const audioCheckStart = audioTask.indexOf("async function checkAiAudio()");
const audioCheckEnd = audioTask.indexOf("\n  return (", audioCheckStart);
const audioCheckFlow = audioTask.slice(audioCheckStart, audioCheckEnd);
assert.match(audioCheckFlow, /payload\.result\?\.percent/);
assert.doesNotMatch(audioCheckFlow, /apiFetch\("speech-score"/);
assert.match(api, /function ai_speech_similarity\(/);
assert.match(listening, /listeningAnswers/);
assert.match(listening, /listeningResults/);
assert.match(listening, /speakingTranscripts/);
assert.match(listening, /savedTranscript=/);

const debugStart = api.indexOf(
  "if($action==='free-audio-debug-config'&&$method==='POST')",
);
const debugEnd = api.indexOf(
  "if($action==='admin/users'&&$method==='GET')",
  debugStart,
);
const debugRoute = api.slice(debugStart, debugEnd);
assert.notEqual(debugStart, -1);
assert.notEqual(debugEnd, -1);
assert.match(debugRoute, /require_admin\(\)/);
assert.match(debugRoute, /free_browser_debug/);
assert.match(debugRoute, /\['provider'\]!=='free'/);
assert.match(debugRoute, /\['free_token_mode'\]!=='auto'/);
assert.match(debugRoute, /\['consent'\]\?\?false\)!==true/);
assert.match(debugRoute, /\['free_ttl_min'\]=5/);
assert.match(debugRoute, /'Authorization'=>'Bearer '\.\$token/);
assert.match(debugRoute, /'X-API-Key'=>\$config\['free_api_key'\]/);
assert.doesNotMatch(debugRoute, /'free_jwt_secret'\s*=>/);
assert.doesNotMatch(api, /HTTP_USER_AGENT|User-Agent/);

console.log(
  "PASS: AI Lesson uses per-response diamond modes, four-criterion audio ratings, text-only scoring limits, consent, and point completion; Listening progress persists transcripts and choices.",
);
