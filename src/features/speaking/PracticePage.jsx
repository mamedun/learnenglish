import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronRight,
  FileAudio2,
  Eye,
  EyeOff,
  Languages,
  Mic,
  MoreHorizontal,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
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
import {
  speechRecognitionErrorMessage,
  useSpeechRecognition,
} from "../../hooks/useSpeechRecognition";
import CourseMedia from "../courses/CourseMedia";
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
    liveTranscription && (!recognizer.supported || recognizer.braveDetected);
  const responseCaptured = liveTranscription
    ? Boolean(stripTranscriptSourceLabel(transcript)) && !transcribing
    : Boolean(audioBlob);
  const passedTurnCount = passedPracticeTurnCount(turns, similarityThreshold);
  const lastTurn = turns.at(-1);
  const retryPending = Boolean(
    lastTurn && !isPracticeTurnPassed(lastTurn, similarityThreshold),
  );
  const goodPoints = practicePoints(turns, similarityThreshold);
  const responseCost = responseMode === "audio" ? 5 : 2;
  const responseCostLabel = unlimitedDiamonds
    ? "Gratis · Admin unlimited"
    : `${responseCost} diamond`;
  const nextLesson = findNextPracticeLesson(allUnits, unit.id);
  const canFinishLesson = canCompletePracticeLesson(
    passedTurnCount,
    goodPoints,
  );
  const lessonProgress = getPracticeLessonProgress({
    scenarioComplete,
    responseCaptured,
    feedbackCount: passedTurnCount,
    goodPoints,
    completed: Boolean(completed?.has?.(unit.id)),
  });
  const ttsBusy = isTtsBusy(ttsStatus);
  useEffect(() => {
    setShowPrompt(false);
    setResponseMode("transcript");
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
        <div className="roleplay-card">
          <div className="roleplay-top">
            <span className="roleplay-tag">
              <WandSparkles size={13} /> {unit.part}
            </span>
            <span className="level-pill">
              {unit.level} · {unit.duration}
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
          <div className="character-row">
            <div className="character-avatar">
              <Mic size={24} />
            </div>
            <div>
              <b>
                Maya <span>· English coach</span>
              </b>
              {showPrompt ? (
                <p className="visible-practice-prompt">“{unit.prompt}”</p>
              ) : (
                <p className="prompt-hidden-note">
                  Pertanyaan disembunyikan agar kamu fokus mendengarkan.
                </p>
              )}
              <button
                className="text-button question-reveal"
                onClick={() => {
                  const nextVisible = !showPrompt;
                  setShowPrompt(nextVisible);
                  if (nextVisible) setScenarioComplete(true);
                }}
                aria-expanded={showPrompt}
              >
                {showPrompt ? (
                  <>
                    <EyeOff size={14} /> Sembunyikan soal
                  </>
                ) : (
                  <>
                    <Eye size={14} /> Tampilkan soal
                  </>
                )}
              </button>
            </div>
            <button
              className="round-play"
              onClick={() =>
                speak(unit.prompt, {
                  type: "speaking",
                  item: unit,
                  onPlaybackComplete: () => {
                    if (currentUnitIdRef.current === unit.id)
                      setScenarioComplete(true);
                  },
                })
              }
              aria-label={
                ttsBusy ? "Menyiapkan audio pertanyaan" : "Dengarkan pertanyaan"
              }
              title={
                ttsBusy ? "Audio sedang disiapkan" : "Putar pertanyaan lisan"
              }
              disabled={ttsBusy}
            >
              {ttsBusy ? (
                <span className="spinner round-play-spinner" />
              ) : (
                <Volume2 size={17} />
              )}
              <span>
                {ttsBusy
                  ? ttsStatus?.phase === "speaking"
                    ? "Sedang dibaca…"
                    : "Menyiapkan audio…"
                  : "Dengarkan soal"}
              </span>
            </button>
          </div>
          <div className="ielts-task-meta">
            <div>
              <small>FORMAT LATIHAN</small>
              <b>{unit.questionType}</b>
            </div>
            <div>
              <small>TARGET</small>
              <b>{unit.bandTarget}</b>
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
                {retryPending ? "ULANGI TOPIK YANG SAMA" : "GILIRANMU"}
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
                {!liveTranscription && (
                  <div className="waveform">
                    {Array.from({ length: 32 }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          height: `${12 + Math.random() * 27}px`,
                          animationDelay: `${i * 0.03}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
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
                        ? recognizer.braveDetected
                          ? "Live transcription tidak tersedia di Brave; gunakan rekaman AI atau Google Chrome"
                          : recognizer.supported
                            ? "Transkrip muncul langsung dan tidak dapat diedit"
                            : "Transkripsi langsung tidak didukung browser ini"
                        : "Audio baru dikirim setelah kamu menyetujui proses AI"}
                </span>
              </>
            )}
            {liveTranscription ? (
              <div className="mic-controls">
                <span
                  className={`mic-control ${recognizer.supported && !recognizer.braveDetected ? "granted" : ""}`}
                >
                  <Mic size={14} />
                  {recognizer.braveDetected
                    ? "Google Chrome diperlukan"
                    : recognizer.supported
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
                  {recognizer.braveDetected
                    ? "Brave tidak mendukung layanan transkripsi live ini. Pilih evaluasi rekaman AI atau gunakan Google Chrome."
                    : "Browser ini tidak mendukung transkripsi live. Pilih evaluasi rekaman AI atau gunakan Google Chrome."}
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
                <b>{goodPoints} / 100 poin</b>
                <small>
                  Setiap percakapan lulus memberi 25 poin. Skor AI minimal 4/5
                  dihitung lulus.
                </small>
              </div>
              <div className="lesson-points-meter">
                <i style={{ width: `${Math.min(100, goodPoints)}%` }} />
              </div>
              <span>{passedTurnCount} / 4 percakapan lulus</span>
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
                  Perlu minimal 4 percakapan lulus dan 100 poin. Kamu tetap bisa
                  terus berlatih setelah mencapai target.
                </small>
              </div>
              <button
                className="btn-primary"
                onClick={finishUnit}
                disabled={!canFinishLesson}
              >
                {nextLesson ? "Next Lesson" : "Selesaikan Lesson"}{" "}
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
                    const note = toPlainText(criterion.feedback_id || "");
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
    </div>
  );
}
