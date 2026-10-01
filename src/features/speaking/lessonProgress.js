export function canCompletePracticeLesson(feedbackCount = 0) {
  return Number.isFinite(Number(feedbackCount)) && Number(feedbackCount) > 0;
}

export const PRACTICE_PROGRESS_STEPS = [
  "Dengarkan skenario",
  "Rekam jawaban",
  "Lihat feedback",
  "Coba lagi / lanjut",
];

export function getPracticeLessonProgress({
  scenarioComplete = false,
  responseCaptured = false,
  feedbackCount = 0,
  retryCaptured = false,
  completed = false,
} = {}) {
  const hasFeedback = Number(feedbackCount) > 0;
  const done = [
    completed || scenarioComplete,
    completed || responseCaptured || hasFeedback,
    completed || hasFeedback,
    completed || hasFeedback || retryCaptured,
  ];
  const currentIndex = done.findIndex((stepDone) => !stepDone);
  const completedCount = done.filter(Boolean).length;

  return {
    steps: PRACTICE_PROGRESS_STEPS.map((label, index) => ({
      label,
      done: done[index],
      current: index === currentIndex,
    })),
    completedCount,
    percentage: Math.round(
      (completedCount / PRACTICE_PROGRESS_STEPS.length) * 100,
    ),
  };
}
