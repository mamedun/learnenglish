import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getGeneratedSamples } from "../src/lib/ttsRocks.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  app,
  settings,
  generator,
  legacyStudio,
  courseStudio,
  cacheApi,
  courseware,
  catalog,
  ttsRocks,
] = await Promise.all([
  read("src/app/App.jsx"),
  read("src/features/settings/SettingsPage.jsx"),
  read("src/features/admin/SharedTtsCacheGenerator.jsx"),
  read("src/features/admin/ContentStudio.jsx"),
  read("src/features/admin/CourseStudio.jsx"),
  read("api/tts_cache.php"),
  read("api/courseware.php"),
  read("api/catalog.php"),
  read("src/lib/ttsRocks.js"),
]);

const expectedWaveform = Float32Array.from([0.25, -0.5, 0.75]);
assert.deepEqual(
  getGeneratedSamples({ audio: { audio: expectedWaveform } }),
  expectedWaveform,
);
assert.deepEqual(
  getGeneratedSamples({ audio: { data: expectedWaveform } }),
  expectedWaveform,
);
assert.deepEqual(getGeneratedSamples(expectedWaveform), expectedWaveform);
assert.deepEqual(
  getGeneratedSamples({
    audio: { audio: new Float32Array(0), data: expectedWaveform },
  }),
  expectedWaveform,
);

assert.match(app, /const engine = isSmallViewport \? "native"/);
assert.ok(
  app.indexOf("if (context) {") < app.indexOf('if (engine === "native"'),
  "authored-content cache lookup must precede the learner's selected engine",
);
assert.match(app, /if \(context\) \{[\s\S]*?getSharedTtsAudio\([\s\S]*?"auto"/);
assert.doesNotMatch(app, /generateKokoroAudio|saveSharedTtsAudio/);
assert.match(app, /Audio lesson belum tersedia; menggunakan Browser Native/);
assert.match(settings, /const isSmallViewport = useSmallViewport\(\)/);
assert.match(settings, /!isSmallViewport && \(/);
assert.match(
  settings,
  /Materi Listening dan AI Lesson selalu memeriksa shared audio/,
);

assert.match(generator, /KOKORO_VOICES\.map/);
assert.match(generator, /Promise\.allSettled/);
assert.match(generator, /engine Kokoro memproses bergiliran/);
assert.match(generator, /generateKokoroCompositeAudio/);
assert.match(ttsRocks, /serializeKokoroInference/);
assert.match(ttsRocks, /new TTS\.TextSplitterStream\(\)/);
assert.match(ttsRocks, /kokoroTtsInstance\.stream\(splitter/);
assert.doesNotMatch(ttsRocks, /kokoroTtsInstance\.generate/);
assert.match(generator, /Generate ulang mengganti file lama/);
assert.match(legacyStudio, /<SharedTtsCacheGenerator/);
assert.match(courseStudio, /<SharedTtsCacheGenerator/);
assert.match(courseStudio, /audioSourceChanged/);
assert.match(
  courseStudio,
  /modules: \{ \.\.\.\(current\.modules \|\| \{\}\), \[modality\]: imported \}/,
);

assert.match(cacheApi, /\$voice !== 'auto'/);
assert.match(
  cacheApi,
  /if \(count\(\$segments\) >= 2\) \$voiceCandidates\[\] = 'multi'/,
);
assert.match(cacheApi, /tts_cache_default_voice/);
assert.match(cacheApi, /function tts_cache_delete_course/);
assert.match(courseware, /courseware_tts_revision_value/);
assert.match(
  courseware,
  /\$unit\['ttsRevision'\] = courseware_tts_revision_value/,
);
assert.match(courseware, /tts_cache_delete_content\(\$cacheType, \$cacheId\)/);
assert.match(courseware, /tts_cache_delete_course\(\$pdo, \$courseId\)/);
assert.match(catalog, /tts_cache_delete_content\(\$contentType, \$id\)/);

console.log(
  "PASS: authored lessons use cache-first auto voice selection, mobile uses Browser Native, Admin inference is chunked and serialized, and cache writes invalidate stale content.",
);
