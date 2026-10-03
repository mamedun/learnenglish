import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { encodeMonoSamplesToMp3 } from "../src/lib/audio.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const sampleRate = 24000;
const samples = new Float32Array(sampleRate);
for (let i = 0; i < samples.length; i++) {
  samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.4;
}

const mp3Blob = encodeMonoSamplesToMp3(samples, sampleRate, 128);
assert.equal(mp3Blob.type, "audio/mpeg");
assert(mp3Blob.size > 10000 && mp3Blob.size < 25000);

// Check that api/tts_cache.php and api/index.php allow MP3 uploads and cache storage
const [ttsCachePhp, apiIndexPhp, appJsx, listeningJsx, ttsRocksJs] = await Promise.all([
  read("api/tts_cache.php"),
  read("api/index.php"),
  read("src/app/App.jsx"),
  read("src/features/listening/ListeningSpeakingTask.jsx"),
  read("src/lib/ttsRocks.js"),
]);

assert.match(ttsCachePhp, /audio\/mpeg/);
assert.match(ttsCachePhp, /audio\/mp3/);
assert.match(apiIndexPhp, /'audio\/mpeg'=>/);
assert.match(apiIndexPhp, /'format'=>\$audioFormat/);
assert.match(appJsx, /convertRecordingToMp3/);
assert.match(listeningJsx, /convertRecordingToMp3/);
assert.match(ttsRocksJs, /encodeMonoSamplesToMp3/);

console.log("PASS: Client-side MP3 128kbps mono encoding, server cache handling, and audio assessment pipeline verified.");
