export const PRACTICE_COMPLETION_MIN_TURNS = 4;
export const PRACTICE_COMPLETION_MIN_POINTS = 100;
export const GOOD_CONVERSATION_POINTS = 25;

export function practiceTurnPoints(stars, targetTurns = 4) {
  const s = Math.max(0, Math.min(5, Number(stars) || 0));
  if (s < 4) return 0;
  const t = Math.max(1, Number(targetTurns) || 4);
  return Math.round((s / (t * 5)) * 100);
}

export function isPracticeTurnPassed(turn, similarityThreshold = 90) {
  if (typeof turn?.passed === "boolean") return turn.passed;
  const stars = Number(turn?.stars);
  if (Number.isFinite(stars)) return stars >= 4;
  const similarity = Number(turn?.similarityPercent);
  if (Number.isFinite(similarity)) {
    return similarity >= similarityThreshold;
  }
  return false;
}

export function passedPracticeTurnCount(turns = [], similarityThreshold = 90) {
  if (!Array.isArray(turns)) return 0;
  return turns.reduce((passed, turn) => {
    return isPracticeTurnPassed(turn, similarityThreshold) ? passed + 1 : passed;
  }, 0);
}

export function practicePoints(
  turns = [],
  similarityThreshold = 90,
  targetTurns = 4,
) {
  if (!Array.isArray(turns)) return 0;
  const pointsPerTurn =
    Math.round(100 / Math.max(1, Number(targetTurns) || 4)) ||
    GOOD_CONVERSATION_POINTS;
  return turns.reduce((total, turn) => {
    if (typeof turn?.pointsEarned === "number") {
      return total + Math.max(0, turn.pointsEarned);
    }
    return isPracticeTurnPassed(turn, similarityThreshold)
      ? total + pointsPerTurn
      : total;
  }, 0);
}

export function canCompletePracticeLesson(
  conversationCount = 0,
  goodPoints = 0,
  targetTurns = 4,
  minScore = 100,
) {
  const turnsReq = Math.max(1, Number(targetTurns) || 4);
  const pointsReq = Math.max(10, Math.min(100, Number(minScore) || 100));
  return (
    Number.isFinite(Number(conversationCount)) &&
    Number(conversationCount) >= turnsReq &&
    Number.isFinite(Number(goodPoints)) &&
    Number(goodPoints) >= pointsReq
  );
}

export function getPracticeLessonProgress({
  scenarioComplete = false,
  responseCaptured = false,
  feedbackCount = 0,
  goodPoints = 0,
  completed = false,
  targetTurns = 4,
  minScore = 100,
} = {}) {
  const hasFinishedLesson =
    completed ||
    canCompletePracticeLesson(
      feedbackCount,
      goodPoints,
      targetTurns,
      minScore,
    );

  const steps = [
    {
      id: "listen",
      label: "Dengarkan skenario awal",
      done: Boolean(scenarioComplete || feedbackCount > 0 || hasFinishedLesson),
      current: !scenarioComplete && !feedbackCount && !hasFinishedLesson,
    },
    {
      id: "respond",
      label: "Rekam jawaban suaramu",
      done: Boolean(
        responseCaptured || feedbackCount > 0 || hasFinishedLesson,
      ),
      current:
        Boolean(scenarioComplete) &&
        !responseCaptured &&
        feedbackCount === 0 &&
        !hasFinishedLesson,
    },
    {
      id: "feedback",
      label: "Terima feedback dan lanjutkan giliran",
      done: Boolean(hasFinishedLesson),
      current:
        (Boolean(responseCaptured) || feedbackCount > 0) && !hasFinishedLesson,
    },
    {
      id: "finish",
      label: "Selesaikan lesson",
      done: Boolean(hasFinishedLesson),
      current: Boolean(hasFinishedLesson),
    },
  ];

  const completedCount = steps.filter((step) => step.done).length;
  const percentage = hasFinishedLesson
    ? 100
    : Math.min(75, Math.round((completedCount / steps.length) * 100));

  return {
    completedCount,
    percentage,
    steps,
  };
}

export function findNextPracticeLesson(lessons = [], currentLessonId) {
  if (!Array.isArray(lessons) || !currentLessonId) return null;
  const currentIndex = lessons.findIndex((item) => item.id === currentLessonId);
  if (currentIndex === -1 || currentIndex >= lessons.length - 1) return null;
  return lessons[currentIndex + 1] || null;
}
