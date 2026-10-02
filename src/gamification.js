// XP and streaks are lightweight motivation, not an IELTS score or paid currency.
function localDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function awardXP(progress, points) {
  const now = new Date();
  const today = localDay(now);
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 1);
  const yesterday = localDay(previous);
  const last = progress.lastPracticeDate;
  const streak =
    last === today
      ? Number(progress.streak) || 1
      : last === yesterday
        ? (Number(progress.streak) || 0) + 1
        : 1;
  return {
    ...progress,
    xp: (Number(progress.xp) || 0) + points,
    streak,
    lastPracticeDate: today,
  };
}

export function achievements(progress) {
  const count =
    (progress.completed?.length || 0) +
    (progress.listeningCompleted?.length || 0) +
    (progress.liveCompleted?.length || 0);
  return [
    {
      icon: "sprout",
      title: "Langkah pertama",
      detail: "Selesaikan 1 lesson",
      unlocked: count >= 1,
    },
    {
      icon: "headphones",
      title: "Telinga tajam",
      detail: "Selesaikan 5 listening",
      unlocked: (progress.listeningCompleted?.length || 0) >= 5,
    },
    {
      icon: "flame",
      title: "On a roll",
      detail: "Latihan 3 hari beruntun",
      unlocked: (progress.streak || 0) >= 3,
    },
    {
      icon: "star",
      title: "Bintang belajar",
      detail: "Kumpulkan 100 XP",
      unlocked: (progress.xp || 0) >= 100,
    },
  ];
}
