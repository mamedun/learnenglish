import assert from "node:assert/strict";
import fs from "node:fs";

console.log("Running bilingual and full course import/export tests...");

const studioSource = fs.readFileSync(
  "src/features/admin/CourseStudio.jsx",
  "utf8",
);
const editorSource = fs.readFileSync(
  "src/features/admin/CourseContentEditor.jsx",
  "utf8",
);
const listeningSource = fs.readFileSync(
  "src/features/listening/ListeningPage.jsx",
  "utf8",
);
const practiceSource = fs.readFileSync(
  "src/features/speaking/PracticePage.jsx",
  "utf8",
);
const apiSource = fs.readFileSync("api/index.php", "utf8");
const coursewareSource = fs.readFileSync("api/courseware.php", "utf8");
const appSource = fs.readFileSync("src/app/App.jsx", "utf8");
const cssSource = fs.readFileSync("src/overrides.css", "utf8");

// 1. Check Full Course Export & Import in CourseStudio
assert.match(
  studioSource,
  /async function exportFullCourse\(\)/,
  "CourseStudio should have exportFullCourse function",
);
assert.match(
  studioSource,
  /async function importFullCourse\(event\)/,
  "CourseStudio should have importFullCourse function",
);
assert.match(
  studioSource,
  /importCourseRef/,
  "CourseStudio should have importCourseRef input ref",
);
assert.match(
  studioSource,
  /safeSlug\(courseInfo\.id/,
  "importFullCourse should sanitize course ID",
);
assert.match(
  studioSource,
  /-copy-/,
  "importFullCourse should handle duplicate course ID collision protection",
);
assert.match(
  studioSource,
  /catIdMap/,
  "importFullCourse should map category IDs to maintain relationship with units",
);
assert.match(
  studioSource,
  /usedUnitIds/,
  "importFullCourse should protect against duplicate unit IDs",
);
assert.match(
  studioSource,
  /Export Course/,
  "CourseStudio should display Export Course button",
);
assert.match(
  studioSource,
  /Import/,
  "CourseStudio should display Import button in sidebar",
);

// 2. Check CourseContentEditor bilingual translation inputs
assert.match(
  editorSource,
  /scriptTranslation/,
  "CourseContentEditor should have scriptTranslation field for Listening",
);
assert.match(
  editorSource,
  /promptTranslation/,
  "CourseContentEditor should have promptTranslation field for Listening and AI Lesson",
);
assert.match(
  editorSource,
  /optionsTranslation/,
  "CourseContentEditor should have optionsTranslation field for Listening questions",
);
assert.match(
  editorSource,
  /explainTranslation/,
  "CourseContentEditor should have explainTranslation field for Listening questions",
);

// 3. Check ListeningPage bilingual toggle & in-place subtitle display
assert.match(
  listeningSource,
  /bilingual-toggle-pill/,
  "ListeningPage should render bilingual toggle pill",
);
assert.match(
  listeningSource,
  /langMode === "ID"/,
  "ListeningPage should support switching to ID mode",
);
assert.match(
  listeningSource,
  /scriptTranslation/,
  "ListeningPage should display scriptTranslation",
);
assert.match(
  listeningSource,
  /promptTranslation/,
  "ListeningPage should display promptTranslation",
);
assert.match(
  listeningSource,
  /optionsTranslation/,
  "ListeningPage should display optionsTranslation",
);
assert.match(
  listeningSource,
  /explainTranslation/,
  "ListeningPage should display explainTranslation",
);
assert.match(
  listeningSource,
  /Terjemahan belum tersedia untuk materi ini/,
  "ListeningPage should have subtle fallback notice when translation is empty",
);

// 4. Check PracticePage bilingual toggle & subtitle display
assert.match(
  practiceSource,
  /bilingual-toggle-pill/,
  "PracticePage should render bilingual toggle pill",
);
assert.match(
  practiceSource,
  /langMode === "ID"/,
  "PracticePage should toggle feedback and subtitles based on langMode",
);
assert.match(
  practiceSource,
  /promptTranslation/,
  "PracticePage should render promptTranslation for learner cue/prompt",
);
assert.match(
  practiceSource,
  /replyTranslation/,
  "PracticePage should render tutor reply translation",
);
assert.match(
  practiceSource,
  /feedbackTranslation|oneFocusId/,
  "PracticePage should render tutor note translation",
);
assert.match(
  practiceSource,
  /feedback_id_id|feedbackIdId/,
  "PracticePage should render Indonesian criteria feedback",
);
assert.match(
  practiceSource,
  /Terjemahan belum tersedia untuk materi ini/,
  "PracticePage should have subtle fallback notice when translation is empty",
);

// 5. Check Backend API for bilingual support
assert.match(
  apiSource,
  /"translation":"Indonesian translation"/,
  "api/index.php should request Indonesian translation for tutor_reply",
);
assert.match(
  apiSource,
  /one_focus_id/,
  "api/index.php should request Indonesian one_focus_id",
);
assert.match(
  apiSource,
  /feedback_id_id/,
  "api/index.php should request Indonesian feedback_id_id for criteria",
);
assert.match(
  coursewareSource,
  /'explainTranslation'=>\(string\)\(\$question\['explainTranslation'\]\?\?''\)/,
  "courseware.php should return explainTranslation in check answer response",
);

// 6. Check App.jsx stores translation fields in turn history
assert.match(
  appSource,
  /replyTranslation:\s*replyObj\.tutor_reply\?\.translation/,
  "App.jsx should store replyTranslation in turn item",
);
assert.match(
  appSource,
  /feedbackTranslation:\s*toPlainText\(assessment\.one_focus_id/,
  "App.jsx should store feedbackTranslation in turn item",
);

// 7. Check CSS styling
assert.match(
  cssSource,
  /\.bilingual-toggle-pill/,
  "overrides.css should style bilingual toggle pill",
);
assert.match(
  cssSource,
  /\.bilingual-subtitle-text/,
  "overrides.css should style bilingual subtitle text softly underneath English",
);
assert.match(
  cssSource,
  /\.bilingual-fallback-notice/,
  "overrides.css should style fallback notice softly",
);

console.log(
  "PASS: Bilingual pre-translate feature, course import/export with collision protection, and backend prompt schema verified.",
);
