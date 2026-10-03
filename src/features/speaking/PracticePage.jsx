import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronRight,
  FileAudio2,
  Eye,
  EyeOff,
  Headphones,
  Languages,
  Mic,
  MoreHorizontal,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  WandSparkles,
  RotateCcw,
  Trash2,
  Gem,
  X,
} from "lucide-react";
import CustomMicPicker from "../../components/CustomMicPicker";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { formatTime } from "../../lib/formatTime";
import { appAsset } from "../../lib/appPaths";
import {
  canCompletePracticeLesson,
  findNextPracticeLesson,
  getPracticeLessonProgress,
  isPracticeTurnPassed,
  passedPracticeTurnCount,
  practicePoints,
} from "./lessonProgress";
import { isTtsBusy } from "../../lib/ttsRocks";
import { stripTranscriptSourceLabel, toPlainText } from "../../lib/plainText";
import { formatFeedbackText } from "../../lib/formatFeedback";
import {
  speechRecognitionErrorMessage,
  useSpeechRecognition,
} from "../../hooks/useSpeechRecognition";
import CourseMedia from "../courses/CourseMedia";
import AudioRadarWaveform from "../../components/AudioRadarWaveform";
import useSmallViewport from "../../hooks/useSmallViewport";

function PrepTimer({ unit }) {
  const [seconds, setSeconds] = useState(Number(unit.prepSeconds) || 60);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    setSeconds(Number(unit.prepSeconds) || 60);
    setRunning(false);
  }, [unit.id]);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(
      () =>
        setSeconds((s) => {
          if (s <= 1) {
            setRunning(false);
            toast.success("Waktu persiapan selesai. Mulai long turn-mu!");
            return 0;
          }
          return s - 1;
        }),
      1e3,
    );
    return () => clearInterval(id);
  }, [running]);
  return (
    <div className="prep-timer">
      <div>
        <small>IELTS PART 2 · PREPARATION</small>
        <b>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </b>
        <span>Siapkan catatan singkat; waktu bicara maksimal 2 menit.</span>
      </div>
      <button
        className="outline-btn"
        onClick={() => {
          if (seconds === 0) setSeconds(Number(unit.prepSeconds) || 60);
          setRunning(!running);
        }}
      >
        {running ? <Pause size={14} /> : <Play size={14} />}{" "}
        {running ? "Pause" : "Mulai 1 menit"}
      </button>
    </div>
  );
}

export default function PracticePage(p) {
  const {
    unit,
    allUnits,
    turns,
    transcript,
    setTranscript,
    recording,
    processing,
    processingMessage,
    permission,
    devices,
    deviceId,
    elapsed,
    audioBlob,
    showLessonList,
    setShowLessonList,
    startUnit,
    startRecording,
    stopRecording,
    requestMic,
    submitTurn,
    finishUnit,
    speak,
    ttsStatus,
    playRecording,
    loadingRecordingId,
    completed,
    clearHistory,
    diamonds = 0,
    unlimitedDiamonds = false,
    similarityThreshold = 90,
    resetRecording,
    learningProgressionMode = "parallel",
  } = p;
  const isLinear = learningProgressionMode === "linear";
  const [responseMode, setResponseMode] = useState("transcript");
  const [mobileModeModal, setMobileModeModal] = useState(null);
  const [langMode, setLangMode] = useState("EN");
  const tutorName = unit.tutorName || "Maya";
  const tutorGender = unit.tutorGender || "female";
  const currentUnitIdRef = useRef(unit.id);
  currentUnitIdRef.current = unit.id;
  const liveTranscription = responseMode === "transcript";
  const isSmallViewport = useSmallViewport();
  const mobileTranscriptEditable = liveTranscription && isSmallViewport;
  const recognizer = useSpeechRecognition({ language: "en-US" });
  const [showPrompt, setShowPrompt] = useState(false);
  const [scenarioComplete, setScenarioComplete] = useState(() =>
    Boolean(completed?.has?.(unit.id)),
  );
  const transcribing = liveTranscription && recognizer.listening;
  const liveRecognitionUnavailable =
    liveTranscription && !recognizer.supported;
  const responseCaptured = liveTranscription
    ? Boolean(stripTranscriptSourceLabel(transcript)) && !transcribing
    : Boolean(audioBlob);
  const targetTurns = Math.max(
    1,
    Number(unit.targetTurns || unit.target_turns) || 4,
  );
  const minScore = Math.max(
    10,
    Math.min(100, Number(unit.minScore || unit.min_score) || 80),
  );
  const passedTurnCount = passedPracticeTurnCount(turns, similarityThreshold);
  const lastTurn = turns.at(-1);
  const retryPending = Boolean(
    lastTurn && !isPracticeTurnPassed(lastTurn, similarityThreshold),
  );
  const goodPoints = practicePoints(turns, similarityThreshold, targetTurns);
  const responseCost = responseMode === "audio" ? 5 : 2;
  const responseCostLabel = unlimitedDiamonds
    ? "Gratis · Admin unlimited"
    : `${responseCost} diamond`;
  const nextLesson = findNextPracticeLesson(allUnits, unit.id);
  const canFinishLesson = canCompletePracticeLesson(
    passedTurnCount,
    goodPoints,
    targetTurns,
    minScore,
  );
  const lessonProgress = getPracticeLessonProgress({
    scenarioComplete,
    responseCaptured,
    feedbackCount: passedTurnCount,
    goodPoints,
    completed: Boolean(completed?.has?.(unit.id)),
    targetTurns,
    minScore,
  });
  const ttsBusy = isTtsBusy(ttsStatus);
  const [promptPlaying, setPromptPlaying] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const celebratedUnitRef = useRef(new Set());
  const pendingCelebrationRef = useRef(false);

  useEffect(() => {
    if (!ttsBusy) {
      setPromptPlaying(false);
    }
  }, [ttsBusy]);

  useEffect(() => {
    if (canFinishLesson && !celebratedUnitRef.current.has(unit.id)) {
      if (ttsBusy) {
        // Tutor is still speaking the reply; wait until playback finishes
        pendingCelebrationRef.current = true;
      } else {
        celebratedUnitRef.current.add(unit.id);
        pendingCelebrationRef.current = false;
        setShowCongratsModal(true);
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 99999,
          });
        } catch (_) {}
      }
    }
  }, [canFinishLesson, unit.id, ttsBusy]);

  useEffect(() => {
    if (
      !ttsBusy &&
      pendingCelebrationRef.current &&
      canFinishLesson &&
      !celebratedUnitRef.current.has(unit.id)
    ) {
      celebratedUnitRef.current.add(unit.id);
      pendingCelebrationRef.current = false;
      setShowCongratsModal(true);
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          zIndex: 99999,
        });
      } catch (_) {}
    }
  }, [ttsBusy, canFinishLesson, unit.id]);

  useEffect(() => {
    setShowPrompt(false);
    setResponseMode("transcript");
    setPromptPlaying(false);
    setShowCongratsModal(false);
    pendingCelebrationRef.current = false;
    recognizer.reset();
    p.setTranscript("");
    p.resetRecording?.();
    // Reset the per-response capture when switching lessons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id]);
  useEffect(() => {
    setScenarioComplete(Boolean(completed?.has?.(unit.id)));
  }, [unit.id]);
  const previousTurnCount = useRef(turns.length);
  const previousLastTurn = useRef(turns.at(-1));
  useEffect(() => {
    const latestTurn = turns.at(-1);
    const appendedTurn = turns.length > previousTurnCount.current;
    const replacedTurn =
      turns.length === previousTurnCount.current &&
      latestTurn &&
      latestTurn !== previousLastTurn.current;
    if (appendedTurn || replacedTurn) {
      // Clear Web Speech API's internal transcript as well as App state after
      // both a new slot and a failed-slot replacement.
      recognizer.reset();
      p.setTranscript("");
    }
    previousTurnCount.current = turns.length;
    previousLastTurn.current = latestTurn;
  }, [turns, recognizer.reset, p.setTranscript]);
  useEffect(() => {
    if (liveTranscription) p.setTranscript(recognizer.transcript);
  }, [recognizer.transcript, liveTranscription, p.setTranscript]);
  useEffect(() => {
    const onSpeechError = (event) => {
      toast.error(
        speechRecognitionErrorMessage(event.detail?.error, event.detail?.brave),
      );
    };
    window.addEventListener("speakup:speech-error", onSpeechError);
    return () =>
      window.removeEventListener("speakup:speech-error", onSpeechError);
  }, []);
  function startLiveTranscription() {
    const result = recognizer.start({ append: Boolean(recognizer.transcript) });
    if (!result.ok) {
      toast.error(
        result.reason === "unsupported-brave"
          ? "Brave tidak dapat mengakses layanan transkripsi live ini. Gunakan Google Chrome atau pilih mode evaluasi audio AI."
          : result.reason === "unsupported"
            ? "Browser ini tidak mendukung transkripsi langsung. Pilih mode evaluasi audio AI atau gunakan Google Chrome."
            : "Mikrofon/transkripsi tidak dapat dimulai. Periksa izin browser.",
      );
      return;
    }
    p.setTranscript(recognizer.transcript);
  }
  function resetSpeechInput() {
    if (liveTranscription) {
      recognizer.reset();
      p.setTranscript("");
    } else {
      resetRecording?.();
    }
  }
  function chooseResponseMode(mode) {
    if (mode === responseMode) return;
    recognizer.stop();
    recognizer.reset();
    resetRecording?.();
    p.setTranscript("");
    setResponseMode(mode);
  }
  async function confirmClearHistory() {
    const result = await Swal.fire({
      title: "Hapus riwayat lesson ini?",
      text: "Transkrip, feedback, dan tautan rekaman dari lesson ini akan dihapus dari progres akun. Tindakan ini tidak dapat dibatalkan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus riwayat",
      cancelButtonText: "Batal",
      confirmButtonColor: "#c84343",
    });
    if (result.isConfirmed) clearHistory?.(unit.id);
  }
  const visual =
    unit.image ||
    unit.mediaUrl ||
    (unit.part?.includes("Part 2")
      ? appAsset("images/speaking/speaking-cue-card-practice.jpg")
      : null);
  return (
    <div className="practice-layout">
      <div className="practice-main">
        <div className="practice-head">
          {p.showBackButton !== false && (
            <button className="back-link" onClick={p.onBack}>
              <ArrowLeft size={16} /> Kembali
            </button>
          )}
          <div className="practice-title-row">
            <div>
              <div className="eyebrow">
                <span className="lesson-pill">{unit.level} · LESSON</span>
                <span>{unit.id}</span>
              </div>
              <h1>{unit.title}</h1>
              <p>{unit.subtitle}</p>
            </div>
            <button
              className="outline-btn practice-lesson-list-btn"
              onClick={() => setShowLessonList(!showLessonList)}
              title="Daftar pelajaran"
            >
              <BookOpen size={16} /> <span>Daftar pelajaran</span> <ChevronDown size={15} />
            </button>
          </div>
          {showLessonList && (
            <div
              className="lesson-dropdown-backdrop"
              onClick={() => setShowLessonList(false)}
              aria-hidden="true"
            />
          )}
          {showLessonList && (
            <div className="lesson-dropdown">
              <div className="lesson-dropdown-head">
                <b>Daftar Pelajaran ({unit.level})</b>
                <button
                  type="button"
                  className="lesson-dropdown-close"
                  onClick={() => setShowLessonList(false)}
                  aria-label="Tutup"
                >
                  <X size={16} />
                </button>
              </div>
              {(() => {
                const firstIncompleteIdx = isLinear
                  ? allUnits.findIndex((item) => !completed.has(item.id))
                  : -1;
                return allUnits
                  .filter((u) => u.level === unit.level)
                  .map((u) => {
                    const unitIdx = allUnits.findIndex(
                      (item) => item.id === u.id,
                    );
                    const isLocked =
                      isLinear &&
                      firstIncompleteIdx >= 0 &&
                      unitIdx > firstIncompleteIdx;
                    return (
                      <button
                        key={u.id}
                        className={isLocked ? "locked" : ""}
                        onClick={() => {
                          if (isLocked) {
                            toast.info(
                              "Mode Linear: Selesaikan lesson sebelumnya untuk membuka materi ini.",
                            );
                            return;
                          }
                          setShowLessonList(false);
                          startUnit(u);
                        }}
                      >
                        <span>{u.emoji}</span>
                        <span>
                          <b>{u.title}</b>
                          <small>
                            {completed.has(u.id)
                              ? "Selesai"
                              : isLocked
                                ? "Terkunci · Selesaikan sebelumnya"
                                : "Belum selesai"}
                          </small>
                        </span>
                        {completed.has(u.id) ? (
                          <CheckCircle2 size={16} />
                        ) : isLocked ? (
                          <Lock size={15} />
                        ) : (
                          <ChevronRight size={15} />
                        )}
                      </button>
                    );
                  });
              })()}
            </div>
          )}
        </div>

        {/* Alur Belajar Gamified Step Roadmap */}
        <div className="practice-flow-bar" role="navigation" aria-label="Alur Latihan">
          <div className={`practice-flow-step ${scenarioComplete ? "done" : "active"}`}>
            <span className="flow-step-num">1</span>
            <Headphones size={13} />
            <span>Dengarkan Soal</span>
            {scenarioComplete && <Check size={12} />}
          </div>
          <span className="practice-flow-arrow">➔</span>
          <div className={`practice-flow-step ${turns.length > 0 ? "done" : scenarioComplete ? "active" : ""}`}>
            <span className="flow-step-num">2</span>
            <Mic size={13} />
            <span>Bicara & Jawab</span>
            {turns.length > 0 && <Check size={12} />}
          </div>
          <span className="practice-flow-arrow">➔</span>
          <div className={`practice-flow-step ${canFinishLesson ? "done" : turns.length > 0 ? "active" : ""}`}>
            <span className="flow-step-num">3</span>
            <Sparkles size={13} />
            <span>Evaluasi Tutor ({passedTurnCount}/{targetTurns})</span>
            {canFinishLesson && <Check size={12} />}
          </div>
        </div>

        <div className="roleplay-card">
          <div className="roleplay-top">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="roleplay-tag">
                <WandSparkles size={13} /> {unit.part || "Speaking Practice"}
              </span>
              <span className="level-pill">
                {unit.level} · {unit.duration || "Self-paced"}
              </span>
            </div>
            <div
              className="bilingual-toggle-pill"
              role="group"
              aria-label="Pilihan bahasa materi"
            >
              <Languages size={14} className="bilingual-toggle-icon" />
              <button
                type="button"
                className={`bilingual-btn ${langMode === "EN" ? "active" : ""}`}
                onClick={() => setLangMode("EN")}
              >
                EN
              </button>
              <span className="bilingual-divider">/</span>
              <button
                type="button"
                className={`bilingual-btn ${langMode === "ID" ? "active" : ""}`}
                onClick={() => setLangMode("ID")}
              >
                ID
              </button>
            </div>
          </div>
          {unit.prepSeconds > 0 && <PrepTimer unit={unit} />}
          {visual && (
            <CourseMedia
              src={visual}
              alt={unit.title || "Ilustrasi speaking practice"}
              className="visual-prompt"
            />
          )}

          {/* Catchy Hero Audio Card for Speaking */}
          <div className="practice-audio-hero-card">
            <div className={`practice-audio-disc ${promptPlaying ? "playing" : ""}`}>
              {promptPlaying ? (
                <div className="soundwave-bars" aria-label="Audio pertanyaan sedang diputar">
                  <span className="soundwave-bar" />
                  <span className="soundwave-bar" />
                  <span className="soundwave-bar" />
                  <span className="soundwave-bar" />
                </div>
              ) : (
                <Headphones size={24} />
              )}
            </div>
            <div className="practice-audio-info">
              <div className="practice-step-tag">
                <Sparkles size={12} /> LANGKAH 1 · DENGARKAN SOAL TERLEBIH DAHULU
              </div>
              <b>Dengarkan Pertanyaan Tutor AI</b>
              <p>
                {promptPlaying
                  ? `Dengarkan baik-baik pertanyaan dari coach ${tutorName}…`
                  : "Putar audio untuk mendengarkan topik dan pertanyaan lisan sebelum kamu menjawab."}
              </p>
            </div>
            <button
              className={`practice-play-cta ${!scenarioComplete && !promptPlaying && !ttsBusy ? "idle-pulse" : ""}`}
              onClick={() => {
                setPromptPlaying(true);
                speak(unit.prompt, {
                  type: "speaking",
                  item: unit,
                  voice:
                    unit?.voice ||
                    unit?.defaultVoice ||
                    unit?.content?.defaultVoice ||
                    "af_heart",
                  onPlaybackComplete: () => {
                    setPromptPlaying(false);
                    if (currentUnitIdRef.current === unit.id)
                      setScenarioComplete(true);
                  },
                });
              }}
              disabled={ttsBusy}
              aria-label={
                ttsBusy ? "Menyiapkan audio pertanyaan" : "Putar pertanyaan lisan"
              }
              title={
                ttsBusy ? "Audio sedang disiapkan" : "Putar pertanyaan lisan"
              }
            >
              {ttsBusy ? (
                <>
                  <span className="spinner round-play-spinner" />
                  <span>
                    {ttsStatus?.phase === "speaking"
                      ? "Sedang Membaca…"
                      : "Menyiapkan Audio…"}
                  </span>
                </>
              ) : promptPlaying ? (
                <>
                  <Volume2 size={18} />
                  <span>Sedang Berbicara…</span>
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" />
                  <span>Dengarkan Soal</span>
                </>
              )}
            </button>
          </div>

          {/* Accordion toggle naskah soal */}
          <div className="practice-prompt-accordion">
            <button
              type="button"
              className="text-button script-toggle"
              onClick={() => {
                const nextVisible = !showPrompt;
                setShowPrompt(nextVisible);
                if (nextVisible) setScenarioComplete(true);
              }}
              aria-expanded={showPrompt}
            >
              {showPrompt ? (
                <>
                  <EyeOff size={15} /> Sembunyikan Transkrip
                </>
              ) : (
                <>
                  <Eye size={15} /> Lihat Transkrip
                </>
              )}
              <ChevronRight
                size={14}
                style={{
                  transform: showPrompt ? "rotate(90deg)" : "none",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>
            {showPrompt && (
              <div className="practice-prompt-text-box">
                <small>
                  Naskah Pertanyaan Coach {tutorName}:
                </small>
                <div className="bilingual-primary-text">“{unit.prompt}”</div>
                {langMode === "ID" && (
                  <div className="bilingual-subtitle-text">
                    {unit.promptTranslation ? (
                      unit.promptTranslation
                    ) : (
                      <span className="bilingual-fallback-notice">
                        Terjemahan belum tersedia untuk materi ini
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="ielts-task-meta">
            <div>
              <small>FORMAT LATIHAN</small>
              <b>{unit.questionType || "Part 1 · Speaking"}</b>
            </div>
            <div>
              <small>TARGET</small>
              <b>{unit.bandTarget || "Band 6.5+"}</b>
            </div>
            <div>
              <small>TARGET LULUS</small>
              <b>{targetTurns} Giliran ({minScore} Poin)</b>
            </div>
          </div>
        </div>
        <div className="answer-card">
          <div className="answer-head">
            <div>
              <div className="eyebrow">
                {retryPending ? "ULANGI TOPIK YANG SAMA" : "LANGKAH 2 · GILIRANMU BICARA"}
              </div>
              <h3>
                {retryPending ? "Coba jawabanmu lagi" : "Jawab dengan suaramu"}
              </h3>
            </div>
          </div>
          {retryPending && (
            <div className="practice-retry-note" role="status">
              Nilai belum mencapai 4/5. Rekam jawaban suara untuk pertanyaan
              yang sama; kartu feedback ini akan diganti dan slot percakapan
              baru hanya dihitung setelah lulus.
            </div>
          )}
          {/* Desktop Response Modes */}
          <div
            className="practice-response-modes"
            role="group"
            aria-label="Pilih mode jawaban"
          >
            <button
              type="button"
              className={`practice-response-mode ${responseMode === "transcript" ? "selected" : ""}`}
              aria-pressed={responseMode === "transcript"}
              onClick={() => chooseResponseMode("transcript")}
              disabled={processing || recording || transcribing}
            >
              <span className="practice-mode-label">LIVE TRANSKRIP · AI</span>
              <b>Transkrip ke tutor AI</b>
              <small>
                Speech-to-text browser · AI menilai kosakata & grammar
              </small>
              <strong>
                {unlimitedDiamonds ? (
                  <>
                    <ShieldCheck size={14} /> Gratis · Admin
                  </>
                ) : (
                  <>
                    <Gem size={14} /> 2
                  </>
                )}
              </strong>
            </button>
            <button
              type="button"
              className={`practice-response-mode ${responseMode === "audio" ? "selected" : ""}`}
              aria-pressed={responseMode === "audio"}
              onClick={() => chooseResponseMode("audio")}
              disabled={processing || recording || transcribing}
            >
              <span className="practice-mode-label">REKAM AUDIO · AI</span>
              <b>Evaluasi rekaman server</b>
              <small>
                Transkripsi AI + penilaian keempat kriteria speaking
              </small>
              <strong>
                {unlimitedDiamonds ? (
                  <>
                    <ShieldCheck size={14} /> Gratis · Admin
                  </>
                ) : (
                  <>
                    <Gem size={14} /> 5
                  </>
                )}
              </strong>
            </button>
          </div>

          {/* Mobile Response Modes: Compact Buttons */}
          <div className="practice-response-modes-mobile" role="group" aria-label="Pilih mode jawaban">
            <button
              type="button"
              className={`practice-mode-mobile-btn ${responseMode === "transcript" ? "selected" : ""}`}
              onClick={() => {
                chooseResponseMode("transcript");
                setMobileModeModal("transcript");
              }}
              disabled={processing || recording || transcribing}
            >
              <span className="mode-mobile-badge">Live Transkrip</span>
              <span className="mode-mobile-cost">
                {unlimitedDiamonds ? "Gratis" : <><Gem size={12} /> 2</>}
              </span>
            </button>
            <button
              type="button"
              className={`practice-mode-mobile-btn ${responseMode === "audio" ? "selected" : ""}`}
              onClick={() => {
                chooseResponseMode("audio");
                setMobileModeModal("audio");
              }}
              disabled={processing || recording || transcribing}
            >
              <span className="mode-mobile-badge">Rekam Audio</span>
              <span className="mode-mobile-cost">
                {unlimitedDiamonds ? "Gratis" : <><Gem size={12} /> 5</>}
              </span>
            </button>
            <button
              type="button"
              className={`practice-mode-mobile-btn keyboard-mode ${responseMode === "keyboard" ? "selected" : ""}`}
              onClick={() => {
                chooseResponseMode("keyboard");
                setMobileModeModal("keyboard");
              }}
              disabled={processing || recording || transcribing}
            >
              <span className="mode-mobile-badge">Keyboard</span>
              <span className="mode-mobile-cost">
                {unlimitedDiamonds ? "Gratis" : <><Gem size={12} /> 2</>}
              </span>
            </button>
          </div>

          {/* Mobile Explanation Modal for Response Mode */}
          {mobileModeModal && (
            <div
              className="practice-mode-modal-backdrop"
              onClick={() => setMobileModeModal(null)}
              aria-hidden="true"
            >
              <div
                className="practice-mode-modal"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="practice-mode-modal-head">
                  <h4>
                    {mobileModeModal === "transcript"
                      ? "Mode Live Transkrip"
                      : mobileModeModal === "audio"
                        ? "Mode Rekam Audio AI"
                        : "Mode Keyboard (Dikte / Ketik)"}
                  </h4>
                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => setMobileModeModal(null)}
                    aria-label="Tutup"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="practice-mode-modal-body">
                  {mobileModeModal === "transcript" ? (
                    <p>
                      Suara kamu diubah menjadi teks langsung oleh browser secara instan. Tutor AI mengevaluasi pilihan kata (lexical) dan tata bahasa (grammar).
                    </p>
                  ) : mobileModeModal === "audio" ? (
                    <p>
                      Rekaman audio kamu dikirim ke server AI untuk analisis lengkap keempat kriteria speaking: pengucapan (pronunciation), kelancaran (fluency), grammar, dan lexical resource.
                    </p>
                  ) : (
                    <p>
                      Ketikkan jawabanmu secara manual atau gunakan mikrofon bawaan keyboard HP untuk mendiktekan teks jawaban ke Tutor AI.
                    </p>
                  )}
                  <div className="practice-mode-modal-cost">
                    <span>Biaya:</span>
                    <b>
                      {unlimitedDiamonds ? (
                        "Gratis (Akses Admin)"
                      ) : mobileModeModal === "audio" ? (
                        <><Gem size={14} /> 5</>
                      ) : (
                        <><Gem size={14} /> 2</>
                      )}
                    </b>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={() => setMobileModeModal(null)}
                >
                  Pilih & Lanjutkan
                </button>
              </div>
            </div>
          )}

          {responseMode !== "keyboard" && (
            <div className="mic-stage">
            <div
              className={`mic-halo ${recording || transcribing ? "is-recording" : ""}`}
            >
              {(recording || transcribing) && (
                <div className="mic-radar-pulse" aria-hidden="true">
                  <span className="radar-ring rr1" />
                  <span className="radar-ring rr2" />
                  <span className="radar-ring rr3" />
                </div>
              )}
              <button
                className="mic-main"
                onClick={() => {
                  if (liveTranscription) {
                    if (recognizer.listening) recognizer.stop();
                    else startLiveTranscription();
                  } else if (recording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
                disabled={
                  processing ||
                  permission === "requesting" ||
                  !scenarioComplete ||
                  liveRecognitionUnavailable
                }
                aria-pressed={recording || transcribing}
                aria-label={
                  permission === "requesting"
                    ? "Meminta akses mikrofon"
                    : !scenarioComplete
                      ? "Dengarkan atau tampilkan soal terlebih dahulu"
                      : liveRecognitionUnavailable
                        ? "Live transcription tidak tersedia; pilih rekaman AI"
                        : recording || transcribing
                          ? "Selesai bicara"
                          : liveTranscription
                            ? "Mulai bicara"
                            : "Mulai merekam"
                }
              >
                {permission === "requesting" && !liveTranscription ? (
                  <span className="spinner mic-main-spinner" />
                ) : recording || transcribing ? (
                  <Pause size={26} fill="currentColor" />
                ) : (
                  <Mic size={26} />
                )}
              </button>
            </div>
            {recording || transcribing ? (
              <>
                <b className="recording-label">
                  {liveTranscription
                    ? "Sedang mentranskripsi ucapan…"
                    : "Sedang merekam audio…"}
                </b>
                <span className="record-time">
                  {liveTranscription ? "LIVE · EN-US" : formatTime(elapsed)}{" "}
                  <i className="live-dot" />
                </span>
                <AudioRadarWaveform
                  compact
                  stream={recording ? p.audioStream : null}
                  theme={liveTranscription ? "emerald" : "coral"}
                  label={
                    liveTranscription
                      ? "Mendengarkan ucapanmu secara live…"
                      : `Merekam audio langsung (${formatTime(elapsed)})`
                  }
                  subLabel={
                    liveTranscription
                      ? "Bicaralah dalam bahasa Inggris untuk menjawab tantangan soal"
                      : "Tekan 'Selesai bicara' jika telah selesai menjawab"
                  }
                  className="practice-audio-radar"
                />
                <button
                  className="stop-button"
                  onClick={liveTranscription ? recognizer.stop : stopRecording}
                >
                  <Pause size={14} fill="currentColor" /> Selesai bicara
                </button>
              </>
            ) : (
              <>
                <b className="recording-label">
                  {permission === "requesting" && !liveTranscription
                    ? "Meminta akses mikrofon…"
                    : !scenarioComplete
                      ? "Dengarkan atau tampilkan soal terlebih dahulu"
                      : liveRecognitionUnavailable
                        ? "Live transcription tidak tersedia di browser ini"
                        : liveTranscription
                          ? "Ketuk untuk mulai bicara"
                          : "Ketuk untuk mulai merekam"}
                </b>
                <span className="record-hint">
                  {permission === "requesting" && !liveTranscription
                    ? "Pilih Izinkan pada dialog browser jika diminta"
                    : !scenarioComplete
                      ? "Putar audio atau tampilkan teks soal untuk membuka mikrofon"
                      : liveTranscription
                        ? recognizer.supported
                          ? "Transkrip muncul langsung dan tidak dapat diedit"
                          : "Transkripsi langsung tidak didukung browser ini"
                        : "Audio baru dikirim setelah kamu menyetujui proses AI"}
                </span>
              </>
            )}
            {liveTranscription ? (
              <div className="mic-controls">
                <span
                  className={`mic-control ${recognizer.supported ? "granted" : ""}`}
                >
                  <Mic size={14} />
                  {recognizer.supported
                    ? "Live transcription siap"
                    : "Browser tidak didukung"}
                </span>
                <CustomMicPicker
                  devices={devices}
                  deviceId={deviceId}
                  onChangeDevice={p.changeDevice}
                />
              </div>
            ) : (
              <div className="mic-controls">
                <button
                  onClick={requestMic}
                  disabled={
                    permission === "requesting" ||
                    permission === "granted" ||
                    recording ||
                    processing
                  }
                  className={
                    permission === "granted"
                      ? "mic-control granted"
                      : "mic-control"
                  }
                >
                  {permission === "requesting" ? (
                    <span className="spinner" />
                  ) : (
                    <Mic size={14} />
                  )}
                  {permission === "granted"
                    ? "Mikrofon siap"
                    : permission === "denied"
                      ? "Izin ditolak"
                      : permission === "requesting"
                        ? "Meminta izin…"
                        : "Pilih mikrofon"}
                </button>
                <CustomMicPicker
                  devices={devices}
                  deviceId={deviceId}
                  onChangeDevice={p.changeDevice}
                />
              </div>
            )}
          </div>
          )}
          {liveTranscription && liveRecognitionUnavailable && (
            <div className="speech-browser-warning" role="note">
              <Languages size={16} />
              <div className="speech-browser-warning-content">
                <span>
                  Browser ini tidak mendukung Web Speech API live. Gunakan browser Chromium (Chrome, Brave, Edge) atau pilih mode evaluasi rekaman AI.
                </span>
                <button
                  className="text-button"
                  onClick={() => chooseResponseMode("audio")}
                  disabled={processing || recording || transcribing}
                >
                  Pilih evaluasi audio AI ·{" "}
                  {unlimitedDiamonds ? "gratis Admin" : <><Gem size={12} style={{ display: "inline", verticalAlign: "middle" }} /> 5</>}
                </button>
                <small>
                  Audio hanya dikirim setelah kamu menekan Kirim jawaban dan
                  menyetujui pemrosesan.
                </small>
              </div>
            </div>
          )}
          {liveTranscription || responseMode === "keyboard" ? (
            <div className="transcript-area">
              <div className="transcript-label">
                <span>
                  {responseMode === "keyboard"
                    ? "TRANSKRIP JAWABAN (KEYBOARD)"
                    : "TRANSKRIP JAWABANMU · LANGSUNG"}
                </span>
                <span>
                  {stripTranscriptSourceLabel(p.transcript).length}/3000
                </span>
              </div>
              <textarea
                maxLength={3000}
                value={stripTranscriptSourceLabel(p.transcript)}
                readOnly={responseMode !== "keyboard"}
                onFocus={() => {
                  if (responseMode === "keyboard" && recognizer.listening)
                    recognizer.stop({ discardPendingResults: true });
                }}
                onChange={(event) => {
                  const value = stripTranscriptSourceLabel(
                    event.target.value,
                  ).slice(0, 3000);
                  recognizer.setTranscript(value);
                  p.setTranscript(value);
                }}
                aria-label={
                  responseMode === "keyboard"
                    ? "Transkrip jawaban, ketik manual atau gunakan dikte keyboard"
                    : "Transkrip ucapan langsung, hanya baca"
                }
                placeholder={
                  responseMode === "keyboard"
                    ? "Ketik jawaban atau gunakan mikrofon keyboard untuk dikte…"
                    : "Transkrip ucapan akan tampil di sini saat kamu berbicara…"
                }
              />
              <div className="transcript-foot">
                <button
                  className="text-button"
                  onClick={resetSpeechInput}
                  disabled={transcribing}
                >
                  <RotateCcw size={13} /> Ulangi / reset
                </button>
              </div>
            </div>
          ) : (
            audioBlob && (
              <div className="audio-recorded-action-row" style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button className="text-button" onClick={resetSpeechInput} type="button">
                  <RotateCcw size={13} /> Rekam ulang
                </button>
              </div>
            )
          )}
          <div className="answer-actions">
            <button
              className="btn-primary"
              onClick={() => submitTurn({ mode: responseMode })}
              disabled={
                processing ||
                transcribing ||
                (responseMode === "audio" ? !audioBlob : !p.transcript.trim())
              }
            >
              {processing ? (
                <>
                  <span className="spinner" />
                  {responseMode === "audio"
                    ? "Memproses audio…"
                    : "Mengirim transkrip…"}
                </>
              ) : (
                <>
                  Kirim jawaban · {unlimitedDiamonds ? "Gratis" : <><Gem size={13} style={{ display: "inline", verticalAlign: "middle" }} /> {responseCost}</>} <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
        {turns.length > 0 && (
          <div className="feedback-section">
            <div className="feedback-heading">
              <div>
                <div className="eyebrow">RIWAYAT AI LESSON</div>
                <h2>
                  Feedback terbaru <span>✦</span>
                </h2>
              </div>
              <div className="feedback-heading-actions">
                <div
                  className="bilingual-toggle-pill"
                  role="group"
                  aria-label="Pilihan bahasa feedback"
                >
                  <Languages size={14} className="bilingual-toggle-icon" />
                  <button
                    type="button"
                    className={`bilingual-btn ${langMode === "EN" ? "active" : ""}`}
                    onClick={() => setLangMode("EN")}
                  >
                    EN
                  </button>
                  <span className="bilingual-divider">/</span>
                  <button
                    type="button"
                    className={`bilingual-btn ${langMode === "ID" ? "active" : ""}`}
                    onClick={() => setLangMode("ID")}
                  >
                    ID
                  </button>
                </div>
                <span className="session-count">
                  {passedTurnCount} percakapan lulus · {goodPoints}/100 poin
                </span>
                <button
                  className="text-button clear-lesson-history"
                  type="button"
                  onClick={confirmClearHistory}
                >
                  <Trash2 size={14} /> Hapus riwayat
                </button>
              </div>
            </div>
            <div className="lesson-points-banner">
              <div>
                <b>{goodPoints} / {minScore} poin minimum</b>
                <small>
                  Target {targetTurns} percakapan. Skor AI minimal 4/5 dihitung lulus.
                </small>
              </div>
              <div className="lesson-points-meter">
                <i
                  style={{
                    width: `${Math.min(100, Math.round((goodPoints / minScore) * 100))}%`,
                  }}
                />
              </div>
              <span>{passedTurnCount} / {targetTurns} percakapan lulus</span>
            </div>
            <div className="finish-row finish-row-top">
              <div>
                <b>
                  {canFinishLesson
                    ? nextLesson
                      ? "Siap lanjut ke lesson berikutnya"
                      : "Lesson siap diselesaikan"
                    : "Lanjutkan percakapan untuk menyelesaikan"}
                </b>
                <small>
                  Perlu minimal {targetTurns} percakapan lulus dan {minScore} poin. Kamu tetap bisa terus berbicara setelah mencapai target.
                </small>
              </div>
              <button
                className="btn-primary"
                onClick={() => {
                  if (canFinishLesson) {
                    setShowCongratsModal(true);
                    try {
                      confetti({
                        particleCount: 100,
                        spread: 70,
                        origin: { y: 0.6 },
                        zIndex: 99999,
                      });
                    } catch (_) {}
                  } else {
                    finishUnit();
                  }
                }}
                disabled={!canFinishLesson}
              >
                {nextLesson ? "Lanjut Soal / Materi Berikutnya" : "Selesaikan Lesson"}{" "}
                {nextLesson ? <ArrowRight size={16} /> : <Check size={16} />}
              </button>
            </div>
            {[...turns].reverse().map((t, i) => (
              <div className="feedback-card" key={t.id}>
                <div className="feedback-top">
                  <span>SLOT {Number(t.slot) || turns.length - i}</span>
                  <div className="feedback-turn-meta">
                    <span
                      className={`practice-turn-status ${isPracticeTurnPassed(t, similarityThreshold) ? "passed" : "retry"}`}
                    >
                      {isPracticeTurnPassed(t, similarityThreshold)
                        ? "LULUS"
                        : "ULANGI TOPIK"}
                    </span>
                    <span
                      className={`turn-points ${Number(t.pointsEarned ?? (Number(t.stars) >= 4 ? 25 : 0)) > 0 ? "earned" : ""}`}
                    >
                      +
                      {Number(
                        t.pointsEarned ?? (Number(t.stars) >= 4 ? 25 : 0),
                      )}{" "}
                      poin
                    </span>
                    <div
                      className="stars"
                      aria-label={`${t.stars} dari 5 bintang`}
                    >
                      {Array.from({ length: 5 }, (_, j) => (
                        <Star
                          key={j}
                          size={15}
                          fill={j < t.stars ? "#f3b64c" : "transparent"}
                          color={j < t.stars ? "#f3b64c" : "#ccd1cb"}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="feedback-dialog">
                  <div className="bubble learner-bubble">
                    <small>KAMU</small>
                    {stripTranscriptSourceLabel(t.userText)}
                    {t.audioSaved && (
                      <button
                        className="audio-mini"
                        onClick={() => playRecording(t.audioId)}
                        disabled={Boolean(loadingRecordingId)}
                      >
                        {loadingRecordingId === t.audioId ? (
                          <span className="spinner" />
                        ) : (
                          <Play size={12} />
                        )}
                        {loadingRecordingId === t.audioId
                          ? "Memuat audio…"
                          : "Dengarkan rekaman"}
                      </button>
                    )}
                  </div>
                  <div className="bubble coach-bubble">
                    <small>
                      {(tutorName || "Maya").toUpperCase()}{" "}
                      <button
                        onClick={() =>
                          speak(t.reply, {
                            type: "ai_reply",
                            item: unit,
                            voice:
                              unit?.voice ||
                              unit?.defaultVoice ||
                              unit?.content?.defaultVoice ||
                              "af_heart",
                          })
                        }
                        disabled={ttsBusy}
                        aria-label={
                          ttsBusy ? "Menyiapkan audio" : "Bacakan balasan"
                        }
                      >
                        {ttsBusy ? (
                          <span className="spinner" />
                        ) : (
                          <Volume2 size={13} />
                        )}
                      </button>
                    </small>
                    <div className="bilingual-primary-text">{t.reply}</div>
                    {langMode === "ID" && (
                      <div className="bilingual-subtitle-text coach-reply-subtitle">
                        {t.replyTranslation ? (
                          t.replyTranslation
                        ) : (
                          <span className="bilingual-fallback-notice">
                            Terjemahan belum tersedia untuk materi ini
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="feedback-note">
                  <Sparkles size={15} />
                  <div>
                    <b>Catatan tutor</b>
                    <div className="bilingual-primary-text">{t.feedback}</div>
                    {langMode === "ID" && (
                      <div className="bilingual-subtitle-text feedback-note-subtitle">
                        {(t.feedbackTranslation || t.oneFocusId) ? (
                          t.feedbackTranslation || t.oneFocusId
                        ) : (
                          <span className="bilingual-fallback-notice">
                            Terjemahan belum tersedia untuk materi ini
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="score-row practice-criteria-grid">
                  {[
                    ["Fluency & Coherence", "fluency_coherence"],
                    ["Lexical Resource", "lexical_resource"],
                    ["Grammar Range & Accuracy", "grammatical_range_accuracy"],
                    ["Pronunciation", "pronunciation"],
                  ].map(([label, key]) => {
                    const criterion = t.criteria?.[key] || {};
                    const rating = Number(criterion.rating);
                    const isRated =
                      Number.isFinite(rating) && rating >= 1 && rating <= 5;
                    const enNote = formatFeedbackText(
                      toPlainText(criterion.feedback_id || ""),
                    );
                    const idNote = formatFeedbackText(
                      toPlainText(
                        criterion.feedback_id_id ||
                          criterion.feedbackIdId ||
                          "",
                      ),
                    );
                    const displayNote =
                      langMode === "ID"
                        ? idNote || enNote || "Terjemahan belum tersedia untuk materi ini"
                        : enNote;
                    const statusText =
                      langMode === "ID"
                        ? criterion.status === "provisional"
                          ? "Penilaian latihan berbasis teks"
                          : criterion.status === "scored"
                            ? "Penilaian latihan berbasis audio"
                            : "Perlu rekaman audio · belum dinilai"
                        : criterion.status === "provisional"
                          ? "Text-based practice rating"
                          : criterion.status === "scored"
                            ? "Audio-based practice rating"
                            : "Audio-dependent · not scored";
                    const evidence = (
                      Array.isArray(criterion.evidence)
                        ? criterion.evidence
                        : []
                    )
                      .filter((item) => typeof item === "string" && item.trim())
                      .slice(0, 2)
                      .map((item) => toPlainText(item));
                    return (
                      <div
                        className={`practice-criterion ${isRated ? "rated" : "not-rated"}`}
                        key={key}
                      >
                        <span>{label}</span>
                        <b>
                          {isRated
                            ? `${rating} / 5`
                            : langMode === "ID"
                              ? "Belum dinilai"
                              : "Not scored"}
                        </b>
                        <small>{statusText}</small>
                        {displayNote && (
                          <small className="criteria-evidence">
                            {displayNote}
                          </small>
                        )}
                        {evidence.map((item, evidenceIndex) => (
                          <small
                            className="criteria-evidence"
                            key={`${key}-${evidenceIndex}`}
                          >
                            {item}
                          </small>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <aside className="practice-aside">
        <div className="aside-card progress-aside">
          <div className="aside-top">
            <span>PROGRES LESSON</span>
            <MoreHorizontal size={18} />
          </div>
          <div className="lesson-progress-ring">
            <div>
              <b>{lessonProgress.percentage}%</b>
              <small>selesai</small>
            </div>
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="43" />
              <circle
                className="ring-value"
                cx="50"
                cy="50"
                r="43"
                style={{
                  strokeDashoffset: 270 - lessonProgress.percentage * 2.7,
                }}
              />
            </svg>
          </div>
          <div
            className="aside-progress-label"
            aria-live="polite"
            aria-atomic="true"
          >
            <b>{unit.title}</b>
            <span>{lessonProgress.completedCount} dari 4 langkah</span>
          </div>
          <div className="aside-steps">
            {lessonProgress.steps.map((step, i) => (
              <div
                className={[
                  step.done ? "step-done" : "",
                  step.current ? "step-current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={step.label}
                aria-current={step.current ? "step" : undefined}
              >
                <span>{step.done ? <Check size={12} /> : i + 1}</span>
                {step.label}
              </div>
            ))}
          </div>
        </div>
        <div className="aside-card tips-aside">
          <div className="tips-title">
            <div>
              <Sparkles size={16} />
            </div>
            <b>Quick tip</b>
          </div>
          <p>
            Gunakan kalimat sederhana dulu. Kamu bisa menambahkan detail setelah
            menyampaikan ide utama.
          </p>
          <div className="tip-example">
            <small>TRY THIS</small>
            <span>“I’m from Bandung, and I...”</span>
          </div>
        </div>
      </aside>

      {/* Gamified Congratulations Modal */}
      {showCongratsModal && (
        <div
          className="congrats-modal-backdrop"
          onClick={() => setShowCongratsModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="congrats-modal-title"
        >
          <div
            className="congrats-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="congrats-trophy-wrap">
              <Trophy size={42} />
            </div>
            <div
              className="eyebrow"
              style={{
                color: "#b07502",
                fontWeight: 800,
                letterSpacing: "0.8px",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Sparkles size={14} /> LESSON ACCOMPLISHED!
            </div>
            <h2
              id="congrats-modal-title"
              style={{ fontSize: 24, margin: "6px 0 8px", color: "#231a4c" }}
            >
              Selamat! Lesson Selesai!
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "#6b648c",
                margin: "0 0 16px",
                lineHeight: 1.5,
              }}
            >
              Target percakapan tercapai dengan luar biasa. Kamu telah menyelesaikan materi{" "}
              <b>{unit.title}</b>!
            </p>

            <div className="congrats-stats-grid">
              <div className="congrats-stat-box">
                <small>Percakapan Lulus</small>
                <b>
                  {passedTurnCount} / {targetTurns} Selesai
                </b>
              </div>
              <div className="congrats-stat-box">
                <small>Poin / Skor</small>
                <b>{goodPoints} / 100 XP</b>
              </div>
            </div>

            <div
              style={{
                background: "#eef9f0",
                border: "1px solid #ccebd1",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "#286835",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <Sparkles size={16} /> +25 Bonus XP Ditambahkan ke Akunmu!
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {nextLesson ? (
                <button
                  className="btn-primary"
                  style={{
                    padding: "14px 20px",
                    fontSize: 15,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 14,
                    boxShadow: "0 6px 18px rgba(88, 70, 200, 0.28)",
                  }}
                  onClick={() => {
                    setShowCongratsModal(false);
                    finishUnit();
                  }}
                >
                  Lanjut Soal / Materi Berikutnya <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  className="btn-primary"
                  style={{
                    padding: "14px 20px",
                    fontSize: 15,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 14,
                  }}
                  onClick={() => {
                    setShowCongratsModal(false);
                    finishUnit();
                  }}
                >
                  Selesai · Buka Daftar Pelajaran <Check size={18} />
                </button>
              )}
              <button
                className="outline-btn"
                style={{
                  padding: "12px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 14,
                  color: "#544e73",
                }}
                onClick={() => setShowCongratsModal(false)}
              >
                Tetap Bicara & Lanjut Percakapan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
