import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(
  new URL("../src/app/App.jsx", import.meta.url),
  "utf8",
);
const api = await readFile(
  new URL("../api/index.php", import.meta.url),
  "utf8",
);
const liveStart = app.indexOf("async function beginLive()");
const liveEnd = app.indexOf("async function assessLiveTranscript", liveStart);
assert.notEqual(liveStart, -1, "Live session start handler must exist");
assert.notEqual(liveEnd, -1, "Live session setup must have a clear boundary");
const beginLive = app.slice(liveStart, liveEnd);

const inputContext = beginLive.indexOf(
  "new AudioContextCtor({ sampleRate: 16_000 })",
);
const resumeContexts = beginLive.indexOf(
  "await Promise.all([inputContext.resume(), outputContext.resume()])",
);
const getMicrophone = beginLive.indexOf("navigator.mediaDevices.getUserMedia");
const getToken = beginLive.indexOf('apiFetch("live-token"');
assert.ok(inputContext >= 0 && inputContext < resumeContexts);
assert.ok(resumeContexts < getMicrophone);
assert.ok(getMicrophone < getToken);
assert.match(beginLive, /liveOutputContextRef\.current = outputContext/);
assert.match(beginLive, /ws\.binaryType = "arraybuffer"/);
assert.match(
  beginLive,
  /encodePcm16Base64\(samples, inputContext\.sampleRate\)/,
);
assert.match(beginLive, /mimeType: "audio\/pcm;rate=16000"/);
assert.match(beginLive, /interimInputTranscription\?\.text/);
assert.match(beginLive, /playLiveAudio\(part\.inlineData\.data\)/);
assert.match(beginLive, /microphoneWatchdog/);

const playAudioStart = app.indexOf("function playLiveAudio(");
const playAudioEnd = app.indexOf(
  "function clearLiveSetupTimer(",
  playAudioStart,
);
const playLiveAudio = app.slice(playAudioStart, playAudioEnd);
assert.match(playLiveAudio, /liveOutputContextRef\.current/);
assert.match(playLiveAudio, /createBuffer\(1, pcm\.length, 24e3\)/);
const tokenStart = api.indexOf("if($action==='live-token'&&$method==='POST')");
const assessmentStart = api.indexOf(
  "if($action==='live-assessment'&&$method==='POST')",
  tokenStart,
);
assert.ok(tokenStart >= 0 && assessmentStart > tokenStart);
const tokenRoute = api.slice(tokenStart, assessmentStart);
assert.match(tokenRoute, /voiceName'=>'Kore'/);
assert.match(tokenRoute, /responseModalities'=>\['AUDIO'\]/);
assert.match(beginLive, /voiceName: "Kore"/);

console.log(
  "PASS: Live audio contexts are resumed before network waits, microphone PCM uses 16 kHz, and Live input/output/transcription paths stay connected.",
);
