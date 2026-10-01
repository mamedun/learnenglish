import assert from "node:assert/strict";
import {
  canCompletePracticeLesson,
  findNextPracticeLesson,
  getPracticeLessonProgress,
} from "../src/features/speaking/lessonProgress.js";

assert.equal(canCompletePracticeLesson(0), false);
assert.equal(canCompletePracticeLesson(1), true);
assert.equal(canCompletePracticeLesson(2), true);

const initial = getPracticeLessonProgress();
assert.equal(initial.percentage, 0);
assert.equal(initial.completedCount, 0);
assert.equal(initial.steps[0].current, true);

const scenarioHeard = getPracticeLessonProgress({ scenarioComplete: true });
assert.equal(scenarioHeard.percentage, 25);
assert.equal(scenarioHeard.completedCount, 1);
assert.equal(scenarioHeard.steps[1].current, true);

const answerRecorded = getPracticeLessonProgress({
  scenarioComplete: true,
  responseCaptured: true,
});
assert.equal(answerRecorded.percentage, 50);
assert.equal(answerRecorded.completedCount, 2);
assert.equal(answerRecorded.steps[2].current, true);

const feedbackShown = getPracticeLessonProgress({
  scenarioComplete: true,
  feedbackCount: 1,
});
assert.equal(feedbackShown.percentage, 100);
assert.equal(feedbackShown.completedCount, 4);
assert.equal(
  feedbackShown.steps.every((step) => step.done),
  true,
);

const retryRecorded = getPracticeLessonProgress({
  scenarioComplete: true,
  feedbackCount: 1,
  retryCaptured: true,
});
assert.equal(retryRecorded.percentage, 100);
assert.equal(retryRecorded.completedCount, 4);
assert.equal(
  retryRecorded.steps.every((step) => step.done),
  true,
);

const previouslyCompleted = getPracticeLessonProgress({ completed: true });
assert.equal(previouslyCompleted.percentage, 100);

const lessons = [{ id: "one" }, { id: "two" }, { id: "three" }];
assert.deepEqual(findNextPracticeLesson(lessons, "one"), lessons[1]);
assert.deepEqual(findNextPracticeLesson(lessons, "two"), lessons[2]);
assert.equal(findNextPracticeLesson(lessons, "three"), null);
assert.equal(findNextPracticeLesson(lessons, "missing"), null);

console.log(
  "PASS: AI lesson progress advances normally, and one feedback response is enough to complete.",
);
