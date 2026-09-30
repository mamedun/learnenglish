// Shared shape for a learner's private progress. The lesson catalog itself comes
// from SQLite through GET /api/catalog; no course/answer keys are bundled here.
export const initialData = {
  completed: [],
  listeningCompleted: [],
  xp: 0,
  streak: 0,
  lastPracticeDate: null,
  sessions: [],
  settings: { tts: "native", voice: "", saveAudio: false },
};
