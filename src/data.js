// Shared shape for a learner's private progress. The lesson catalog itself comes
// from SQLite through GET /api/catalog; no course/answer keys are bundled here.
export const initialData = {
  completed: [],
  listeningCompleted: [],
  listeningAnswers: {},
  listeningResults: {},
  speakingCompleted: [],
  speakingScores: {},
  speakingTranscripts: {},
  xp: 0,
  streak: 0,
  lastPracticeDate: null,
  sessions: [],
  liveHistory: [],
  settings: {
    tts: "kokoro",
    voice: "af_heart",
    useCachedVoice: true,
    nativeVoice: "",
    ttsCompute: "auto",
    ttsEngineVersion: 1,
    saveAudio: false,
  },
};
