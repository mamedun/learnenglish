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
} from "lucide-react";
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
              className="outline-btn"
              onClick={() => setShowLessonList(!showLessonList)}
            >
              <BookOpen size={16} /> Daftar pelajaran <ChevronDown size={15} />
            </button>
          </div>
          {showLessonList && (
            <div className="lesson-dropdown">
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
            <span className="roleplay-tag">
              <WandSparkles size={13} /> {unit.part || "Speaking Practice"}
            </span>
            <span className="level-pill">
              {unit.level} · {unit.duration || "Self-paced"}
            </span>
          </div>
          {unit.prepSeconds > 0 && <PrepTimer unit={unit} />}
          {visual && (
            <CourseMedia
              src={visual}
              alt={unit.title || "Ilustrasi speaking practice"}
              className="visual-prompt"
              caption={unit.image ? "Visual conversation enrichment · bukan format resmi IELTS Speaking" : "Supplementary speaking illustration · bukan format resmi IELTS Speaking"}
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
                  ? "Dengarkan baik-baik pertanyaan dari coach Maya…"
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
              style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#5444b0", fontWeight: 600, fontSize: 13 }}
            >
              {showPrompt ? (
                <>
                  <EyeOff size={15} /> Sembunyikan naskah soal
                </>
              ) : (
                <>
                  <Eye size={15} /> Buka naskah teks pertanyaan sebagai alternatif
                </>
              )}
              <ChevronRight size={14} style={{ transform: showPrompt ? "rotate(90deg)" : "none", transition: "transform 0.2s ease" }} />
            </button>
            {showPrompt && (
              <div className="practice-prompt-text-box">
                <small style={{ display: "block", color: "#6e678e", marginBottom: 5, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Naskah Pertanyaan Coach Maya:
                </small>
                “{unit.prompt}”
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
          <div className="roleplay-hint">
            <Sparkles size={15} />
            <span>
              Balas dalam Bahasa Inggris. Tidak harus sempurna—yang penting
              mulai bicara!
            </span>
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
            <span className="privacy-mini">
              <ShieldCheck size={14} />
              {liveTranscription
                ? "Transkrip browser · audio tidak dikirim ke AI aplikasi"
                : "Audio dikirim hanya setelah persetujuan"}
            </span>
          </div>
          {retryPending && (
            <div className="practice-retry-note" role="status">
              Nilai belum mencapai 4/5. Rekam jawaban suara untuk pertanyaan
              yang sama; kartu feedback ini akan diganti dan slot percakapan
              baru hanya dihitung setelah lulus.
            </div>
          )}
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
                    <Gem size={14} /> 2 diamond
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
                    <Gem size={14} /> 5 diamond
                  </>
                )}
              </strong>
            </button>
          </div>
          <div className="practice-wallet-hint">
            {unlimitedDiamonds
              ? "Akses Admin unlimited · saldo diamond tidak digunakan."
              : `Saldo ${Number(diamonds).toLocaleString("id-ID")} diamond · tidak ada mode AI Lesson gratis.`}
          </div>
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
                {devices.length > 0 && (
                  <select
                    aria-label="Pilih mikrofon"
                    value={deviceId}
                    onChange={(e) => p.changeDevice(e.target.value)}
                  >
                    {devices.map((device, i) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Mikrofon ${i + 1}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
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
                  {unlimitedDiamonds ? "gratis Admin" : "5 diamond"}
                </button>
                <small>
                  Audio hanya dikirim setelah kamu menekan Kirim jawaban dan
                  menyetujui pemrosesan.
                </small>
              </div>
            </div>
          )}
          {liveTranscription ? (
            <div className="transcript-area">
              <div className="transcript-label">
                <span>TRANSKRIP JAWABANMU · LANGSUNG</span>
                <span>
                  {stripTranscriptSourceLabel(p.transcript).length}/3000
                </span>
              </div>
              <textarea
                maxLength={3000}
                value={stripTranscriptSourceLabel(p.transcript)}
                readOnly={!mobileTranscriptEditable}
                onFocus={() => {
                  if (mobileTranscriptEditable && recognizer.listening)
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
                  mobileTranscriptEditable
                    ? "Transkrip jawaban live, bisa diedit atau diisi dengan dikte keyboard"
                    : "Transkrip ucapan langsung, hanya baca"
                }
                placeholder={
                  mobileTranscriptEditable
                    ? "Ketik jawaban atau gunakan mikrofon keyboard untuk dikte…"
                    : "Transkrip ucapan akan tampil di sini…"
                }
              />
              <div className="transcript-foot">
                <span>
                  {mobileTranscriptEditable
                    ? "Bisa diedit di HP · gunakan mikrofon keyboard untuk dikte; audio tidak dikirim"
                    : "Read-only · Text akan otomatis ter generate saat anda bicara"}
                </span>
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
            <div className="audio-pending-note">
              <FileAudio2 size={17} />
              <span>
                Transkrip jawabanmu ditampilkan setelah audio didengarkan oleh Tutor Digital
              </span>
              {audioBlob && (
                <button className="text-button" onClick={resetSpeechInput}>
                  <RotateCcw size={13} /> Rekam ulang
                </button>
              )}
            </div>
          )}
          <div className="answer-actions">
            <span>
              <ShieldCheck size={15} />
              {unlimitedDiamonds
                ? liveTranscription
                  ? "Akses Admin unlimited · hanya transkrip yang dikirim ke AI"
                  : "Akses Admin unlimited · rekaman dikirim setelah persetujuan"
                : liveTranscription
                  ? "Transkrip saja dikirim ke AI · 2 diamond"
                  : p.sessionSaveAudio
                    ? "arsip audio disimpan di akun server · 5 diamond"
                    : "audio tidak diarsipkan · 5 diamond"}
            </span>
            <button
              className="btn-primary"
              onClick={() => submitTurn({ mode: responseMode })}
              disabled={
                processing ||
                transcribing ||
                (liveTranscription ? !transcript.trim() : !audioBlob)
              }
            >
              {processing ? (
                <>
                  <span className="spinner" />
                  {liveTranscription
                    ? "Mengirim transkrip…"
                    : "Memproses audio…"}
                </>
              ) : (
                <>
                  Kirim jawaban · {responseCostLabel} <ArrowRight size={16} />
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
                      MAYA{" "}
                      <button
                        onClick={() => speak(t.reply)}
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
                    {t.reply}
                  </div>
                </div>
                <div className="feedback-note">
                  <Sparkles size={15} />
                  <div>
                    <b>Catatan tutor</b>
                    <p>{t.feedback}</p>
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
                    const note = formatFeedbackText(
                      toPlainText(criterion.feedback_id || ""),
                    );
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
                        <b>{isRated ? `${rating} / 5` : "Not scored"}</b>
                        <small>
                          {criterion.status === "provisional"
                            ? "Text-based practice rating"
                            : criterion.status === "scored"
                              ? "Audio-based practice rating"
                              : "Audio-dependent · not scored"}
                        </small>
                        {note && (
                          <small className="criteria-evidence">{note}</small>
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
