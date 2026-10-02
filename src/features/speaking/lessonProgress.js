export const PRACTICE_COMPLETION_MIN_TURNS = 4;
export const PRACTICE_COMPLETION_MIN_POINTS = 80;
export const GOOD_CONVERSATION_POINTS = 20;

export function practiceTurnPoints(stars, targetTurns = 4) {
  const s = Math.max(0, Math.min(5, Number(stars) || 0));
  if (s < 4) return 0;
  const t = Math.max(1, Number(targetTurns) || 4);
  return Math.round((s / (t * 5)) * 100);
}

export function isPracticeTurnPassed(turn, similarityThreshold = 90) {
  if (typeof turn?.passed === "boolean") return turn.passed;
  const stars = Number(turn?.stars);
  if (Number.isFinite(stars) && stars > 0) return stars >= 4;
  const similarity = Number(turn?.similarityPercent);
  if (Number.isFinite(similarity) && similarity > 0)
    return similarity >= Number(similarityThreshold);
  // Preserve older progress snapshots that only recorded the earned points.
  return Number(turn?.pointsEarned) > 0;
}

export function passedPracticeTurnCount(turns = [], similarityThreshold = 90) {
  if (!Array.isArray(turns)) return 0;
  return turns.filter((turn) => isPracticeTurnPassed(turn, similarityThreshold))
    .length;
}

export function practicePoints(
  turns = [],
  similarityThreshold = 90,
  targetTurns = 4,
) {
  if (!Array.isArray(turns)) return 0;
  let total = 0;
  for (const turn of turns) {
    if (!isPracticeTurnPassed(turn, similarityThreshold)) continue;
    const recorded = Number(turn?.pointsEarned);
    if (Number.isFinite(recorded) && recorded > 0) {
      total += recorded;
    } else {
      const stars = Number(turn?.stars) || 4;
      total += practiceTurnPoints(stars, targetTurns);
    }
  }
  return Math.min(100, total);
}

export function canCompletePracticeLesson(
  conversationCount = 0,
  goodPoints = 0,
  targetTurns = 4,
  minScore = 80,
) {
  const turnsReq = Math.max(1, Number(targetTurns) || 4);
  const pointsReq = Math.max(10, Math.min(100, Number(minScore) || 80));
  return (
    Number.isFinite(Number(conversationCount)) &&
    Number(conversationCount) >= turnsReq &&
    Number.isFinite(Number(goodPoints)) &&
    Number(goodPoints) >= pointsReq
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
  "Kirim minimal empat percakapan yang lulus",
  "Kumpulkan 80 poin",
];

export function getPracticeLessonProgress({
  scenarioComplete = false,
  responseCaptured = false,
  feedbackCount = 0,
  goodPoints = 0,
  completed = false,
  targetTurns = 4,
  minScore = 80,
} = {}) {
  const turnsReq = Math.max(1, Number(targetTurns) || 4);
  const pointsReq = Math.max(10, Math.min(100, Number(minScore) || 80));
  const hasFeedback = Number(feedbackCount) > 0;
  const enoughTurns = Number(feedbackCount) >= turnsReq;
  const enoughPoints = Number(goodPoints) >= pointsReq;
  const done = [
    completed || scenarioComplete,
    completed || responseCaptured || hasFeedback,
    completed || enoughTurns,
    completed || (enoughTurns && enoughPoints),
  ];
  const currentIndex = done.findIndex((stepDone) => !stepDone);
  const completedCount = done.filter(Boolean).length;

  const steps = [
    "Dengarkan skenario",
    "Pilih metode jawaban",
    `Kirim minimal ${turnsReq} percakapan yang lulus`,
    `Kumpulkan minimal ${pointsReq} poin`,
  ];

  return {
    steps: steps.map((label, index) => ({
      label,
      done: done[index],
      current: index === currentIndex,
    })),
    completedCount,
    percentage: Math.round(
      (completedCount / steps.length) * 100,
    ),
  };
}
