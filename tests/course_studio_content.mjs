import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [studio, editor, dialogue, app] = await Promise.all([
  read("src/features/admin/CourseStudio.jsx"),
  read("src/features/admin/CourseContentEditor.jsx"),
  read("src/features/admin/DialogueEditor.jsx"),
  read("src/app/App.jsx"),
]);

assert.match(studio, /CourseContentEditor/);
assert.match(studio, /contentView === "visual"/);
assert.match(studio, /contentView === "json"/);
assert.match(studio, /contentView === "both"/);
assert.match(studio, /value=\{contentText\}/);
assert.match(
  studio,
  /JSON\.stringify\(\{ \.\.\.contentDraft, \.\.\.patch \}, null, 2\)/,
);
assert.match(studio, /admin\/tts-cache\/status\?course_id=/);
assert.match(studio, /course-unit-audio-badge is-/);
assert.match(studio, /getSharedTtsAudio\(contentType, item, "auto"\)/);
assert.match(studio, /<CourseStudioAudioPreview/);
assert.match(studio, /className="course-audio-preview-player"[\s\S]*?controls/);
assert.match(studio, /onCacheGenerated=/);

const mediaLabel = studio.indexOf(
  "Ilustrasi / video / YouTube / URL eksternal",
);
assert.notEqual(mediaLabel, -1);
assert.ok(
  studio.lastIndexOf('modality !== "live_lesson" && (', mediaLabel) !== -1,
  "Live Lesson must not render the shared illustration/media field and preview",
);
const audioPreviewIndex = studio.indexOf("<CourseStudioAudioPreview");
assert.notEqual(audioPreviewIndex, -1);
assert.ok(
  studio.lastIndexOf(
    'modality !== "live_lesson" && selectedUnit &&',
    audioPreviewIndex,
  ) !== -1,
  "Cached audio preview is restricted to Listening and AI Lesson",
);

assert.match(editor, /function ListeningEditor/);
assert.match(editor, /function AiLessonEditor/);
assert.match(editor, /function LiveLessonEditor/);
assert.match(editor, /Naskah audio/);
assert.match(editor, /Bank soal/);
assert.match(editor, /Cue card \/ prompt learner/);
assert.match(editor, /Peran teacher \/ AI/);
assert.match(editor, /Kalimat pembuka teacher/);
assert.match(editor, /content\.ttsSegments/);
assert.match(editor, /content\.defaultVoice/);
assert.match(editor, /content\.questions/);
assert.match(editor, /content\.responseStyle/);
assert.match(editor, /<DialogueEditor/);
assert.match(dialogue, /Suara Kokoro/);
assert.match(dialogue, /Nama speaker/);
assert.match(dialogue, /Teks giliran/);
assert.match(dialogue, /Naikkan giliran/);
assert.match(dialogue, /Turunkan giliran/);
assert.match(
  app,
  /const segments = authoredSegments\.length >= 2 \? authoredSegments : \[\]/,
  "A partly edited single-speaker segment must not replace the full lesson script",
);

console.log(
  "PASS: Course Studio has synchronized modality-specific editors, accessible JSON editing, multi-speaker voice controls, and no Live media preview.",
);
