import assert from "node:assert/strict";
import {
  canCompletePracticeLesson,
  findNextPracticeLesson,
  getPracticeLessonProgress,
  practicePoints,
} from "../src/features/speaking/lessonProgress.js";

assert.equal(canCompletePracticeLesson(0, 0), false);
assert.equal(canCompletePracticeLesson(3, 75), false);
assert.equal(canCompletePracticeLesson(4, 75), false);
assert.equal(canCompletePracticeLesson(4, 99), false);
assert.equal(canCompletePracticeLesson(4, 100), true);
assert.equal(canCompletePracticeLesson(8, 200), true);

assert.equal(
  practicePoints([
    { stars: 4 },
    { stars: 3 },
    { similarityPercent: 90 },
    { similarityPercent: 89 },
  ]),
  50,
);
assert.equal(practicePoints([{ similarityPercent: 89 }], 89), 25);
assert.equal(practicePoints([{ pointsEarned: 25 }, { pointsEarned: 0 }]), 25);

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

const oneConversation = getPracticeLessonProgress({
  scenarioComplete: true,
  feedbackCount: 1,
  goodPoints: 25,
});
assert.equal(oneConversation.percentage, 50);
assert.equal(oneConversation.completedCount, 2);
assert.equal(oneConversation.steps[2].current, true);

const completionReady = getPracticeLessonProgress({
  scenarioComplete: true,
  feedbackCount: 4,
  goodPoints: 100,
});
assert.equal(completionReady.percentage, 100);
assert.equal(completionReady.completedCount, 4);
assert.equal(
  completionReady.steps.every((step) => step.done),
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
  "PASS: AI Lesson requires four conversations and 100 points; good-turn scoring and unlimited extra turns are supported.",
);
