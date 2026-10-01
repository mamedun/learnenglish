export const PRACTICE_COMPLETION_MIN_TURNS = 4;
export const PRACTICE_COMPLETION_MIN_POINTS = 100;
export const GOOD_CONVERSATION_POINTS = 25;

export function practicePoints(turns = [], similarityThreshold = 90) {
  if (!Array.isArray(turns)) return 0;
  return turns.reduce((total, turn) => {
    const stars = Number(turn?.stars) || 0;
    const similarity = Number(turn?.similarityPercent) || 0;
    const earned =
      Number(turn?.pointsEarned) ||
      (stars >= 4 || similarity >= Number(similarityThreshold)
        ? GOOD_CONVERSATION_POINTS
        : 0);
    return total + Math.max(0, Math.min(GOOD_CONVERSATION_POINTS, earned));
  }, 0);
}

export function canCompletePracticeLesson(
  conversationCount = 0,
  goodPoints = 0,
) {
  return (
    Number.isFinite(Number(conversationCount)) &&
    Number(conversationCount) >= PRACTICE_COMPLETION_MIN_TURNS &&
    Number.isFinite(Number(goodPoints)) &&
    Number(goodPoints) >= PRACTICE_COMPLETION_MIN_POINTS
  );
}

export function findNextPracticeLesson(lessons, currentLessonId) {
  const currentIndex = lessons.findIndex(
    (lesson) => lesson.id === currentLessonId,
  );
  return currentIndex < 0 ? null : (lessons[currentIndex + 1] ?? null);
}

export const PRACTICE_PROGRESS_STEPS = [
  "Dengarkan skenario",
  "Pilih metode jawaban",
  "Kirim minimal empat percakapan",
  "Kumpulkan 100 poin",
];

export function getPracticeLessonProgress({
  scenarioComplete = false,
  responseCaptured = false,
  feedbackCount = 0,
  goodPoints = 0,
  completed = false,
} = {}) {
  const hasFeedback = Number(feedbackCount) > 0;
  const enoughTurns = Number(feedbackCount) >= PRACTICE_COMPLETION_MIN_TURNS;
  const enoughPoints = Number(goodPoints) >= PRACTICE_COMPLETION_MIN_POINTS;
  const done = [
    completed || scenarioComplete,
    completed || responseCaptured || hasFeedback,
    completed || enoughTurns,
    completed || (enoughTurns && enoughPoints),
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
