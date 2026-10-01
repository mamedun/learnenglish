import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
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
} from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "../../lib/formatTime";
import { isTtsBusy } from "../../lib/ttsRocks";
import {
  speechRecognitionErrorMessage,
  useSpeechRecognition,
} from "../../hooks/useSpeechRecognition";

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
    speechInputMode = "live_transcribe",
    resetRecording,
  } = p;
  const liveTranscription = speechInputMode !== "ai_audio";
  const recognizer = useSpeechRecognition({ language: "en-US" });
  const [showPrompt, setShowPrompt] = useState(false);
  const transcribing = liveTranscription && recognizer.listening;
  const ttsBusy = isTtsBusy(ttsStatus);
  useEffect(() => {
    setShowPrompt(false);
    recognizer.reset();
    p.setTranscript("");
    p.resetRecording?.();
    // Reset the input when switching lesson or when the admin changes the global mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.id, speechInputMode]);
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
          ? "Brave tidak dapat mengakses layanan transkripsi live ini. Gunakan Google Chrome atau minta admin mengaktifkan mode rekaman AI."
          : result.reason === "unsupported"
            ? "Browser ini tidak mendukung transkripsi langsung. Minta admin mengganti mode input ke rekaman AI atau gunakan Google Chrome."
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
  const visual =
    unit.image ||
    (unit.part?.includes("Part 2")
      ? "/learnenglish/images/speaking/speaking-cue-card-practice.jpg"
      : null);
  return (
    <div className="practice-layout">
      <div className="practice-main">
        <div className="practice-head">
          <button className="back-link" onClick={p.onBack}>
            <ArrowLeft size={16} /> Kembali
          </button>
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
              {allUnits
                .filter((u) => u.level === unit.level)
                .map((u) => (
                  <button key={u.id} onClick={() => startUnit(u)}>
                    <span>{u.emoji}</span>
                    <span>
                      <b>{u.title}</b>
                      <small>
                        {completed.has(u.id) ? "Selesai" : "Belum selesai"}
                      </small>
                    </span>
                    {completed.has(u.id) ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <ChevronRight size={15} />
                    )}
                  </button>
                ))}
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
            <figure className="visual-prompt">
              <img
                src={visual}
                alt={
                  unit.image
                    ? "Pasar lokal untuk supplementary speaking practice"
                    : "Ilustrasi supplementary cue-card speaking practice"
                }
              />
              <figcaption>
                {unit.image
                  ? "Visual conversation enrichment \xB7 bukan format resmi IELTS Speaking"
                  : "Supplementary speaking illustration \xB7 bukan format resmi IELTS Speaking"}
              </figcaption>
            </figure>
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
                onClick={() => setShowPrompt((visible) => !visible)}
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
                speak(unit.prompt, { type: "speaking", item: unit })
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
              <div className="eyebrow">GILIRANMU</div>
              <h3>Jawab dengan suaramu</h3>
            </div>
            <span className="privacy-mini">
              <ShieldCheck size={14} /> Audio dikirim hanya dengan persetujuan
            </span>
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
                  (liveTranscription &&
                    (!recognizer.supported || recognizer.braveDetected))
                }
                aria-pressed={recording || transcribing}
                aria-label={
                  permission === "requesting"
                    ? "Meminta akses mikrofon"
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
                    : liveTranscription
                      ? "Ketuk untuk mulai bicara"
                      : "Ketuk untuk mulai merekam"}
                </b>
                <span className="record-hint">
                  {permission === "requesting" && !liveTranscription
                    ? "Pilih Izinkan pada dialog browser jika diminta"
                    : liveTranscription
                      ? recognizer.braveDetected
                        ? "Live transcription tidak tersedia di Brave; gunakan Google Chrome"
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
          {liveTranscription && recognizer.braveDetected && (
            <div className="speech-browser-warning" role="note">
              <Languages size={16} />
              <span>
                Brave tidak dapat mengakses layanan live speech recognition yang
                digunakan browser ini. Buka AI Lesson di Google Chrome, atau
                minta admin mengaktifkan mode rekaman AI.
              </span>
            </div>
          )}
          {liveTranscription ? (
            <div className="transcript-area">
              <div className="transcript-label">
                <span>TRANSKRIP JAWABANMU · LANGSUNG</span>
                <span>{p.transcript.length}/3000</span>
              </div>
              <textarea
                maxLength={3000}
                value={p.transcript}
                readOnly
                aria-label="Transkrip ucapan langsung, hanya baca"
                placeholder="Transkrip ucapan akan tampil di sini…"
              />
              <div className="transcript-foot">
                <span>
                  Read-only · diproses oleh speech recognition browser
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
                Transkrip jawabanmu ditampilkan setelah audio diproses oleh AI.
                Rekaman tidak diunggah sebelum kamu menyetujui pengiriman.
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
              {liveTranscription
                ? "Suara ditranskripsi langsung oleh browser"
                : p.sessionSaveAudio === null
                  ? "arsip ditanyakan terpisah"
                  : p.sessionSaveAudio
                    ? "arsip audio disimpan di akun server"
                    : "audio tidak diarsipkan"}
            </span>
            <button
              className="btn-primary"
              onClick={submitTurn}
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
                  Kirim jawaban <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
        {turns.length > 0 && (
          <div className="feedback-section">
            <div className="feedback-heading">
              <div>
                <div className="eyebrow">FEEDBACK TUTOR</div>
                <h2>
                  Bagus, kamu sudah mencoba! <span>✦</span>
                </h2>
              </div>
              <span className="session-count">{turns.length} jawaban</span>
            </div>
            {turns.map((t, i) => (
              <div className="feedback-card" key={t.id}>
                <div className="feedback-top">
                  <span>JAWABAN {i + 1}</span>
                  <div className="stars">
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
                <div className="feedback-dialog">
                  <div className="bubble learner-bubble">
                    <small>KAMU</small>
                    <em className="transcript-result-label">
                      {t.transcriptionSource === "ai"
                        ? "TRANSKRIP · HASIL AI"
                        : "TRANSKRIP · LIVE"}
                    </em>
                    {t.userText}
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
                          : "Dengarkan"}
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
                <div className="band-estimate">
                  <span>IELTS Speaking practice estimate</span>
                  <b>
                    {t.estimatedBand != null
                      ? `Band ${Number(t.estimatedBand).toFixed(1)}`
                      : "Belum dapat diestimasi"}
                  </b>
                  <small>Feedback latihan · bukan skor resmi</small>
                </div>
                <div className="score-row">
                  {[
                    ["Fluency & Coherence", "fluency_coherence"],
                    ["Lexical Resource", "lexical_resource"],
                    ["Grammar Range & Accuracy", "grammatical_range_accuracy"],
                    ["Pronunciation", "pronunciation"],
                  ].map(([label, key]) => {
                    const c = t.criteria?.[key];
                    return (
                      <span key={key}>
                        {label}
                        <b>
                          {c?.band != null
                            ? `Band ${Number(c.band).toFixed(1)}`
                            : "Belum dinilai"}
                        </b>
                        <small>
                          {c?.status === "provisional"
                            ? "Estimasi teks"
                            : c?.status === "scored"
                              ? "Dinilai"
                              : "Audio diperlukan"}
                        </small>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="finish-row">
              <div>
                <b>Siap menyelesaikan pelajaran?</b>
                <small>
                  Rata-rata rating latihan 3.5★ (bukan band IELTS) untuk membuka
                  langkah berikutnya.
                </small>
              </div>
              <button className="btn-primary" onClick={finishUnit}>
                Selesaikan lesson <Check size={16} />
              </button>
            </div>
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
              <b>{turns.length ? Math.min(100, turns.length * 25) : 0}%</b>
              <small>selesai</small>
            </div>
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="43" />
              <circle
                className="ring-value"
                cx="50"
                cy="50"
                r="43"
                style={{ strokeDashoffset: 270 - turns.length * 18 }}
              />
            </svg>
          </div>
          <div className="aside-progress-label">
            <b>{unit.title}</b>
            <span>{turns.length} dari 4 langkah</span>
          </div>
          <div className="aside-steps">
            {[
              "Dengarkan skenario",
              "Rekam jawaban",
              "Lihat feedback",
              "Coba lagi / lanjut",
            ].map((s, i) => (
              <div className={i < turns.length + 1 ? "step-done" : ""} key={s}>
                <span>{i < turns.length ? <Check size={12} /> : i + 1}</span>
                {s}
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
        <div className="privacy-card">
          <ShieldCheck size={18} />
          <div>
            <b>Privasi & audio</b>
            <p>
              Rekaman hanya dikirim untuk evaluasi AI setelah persetujuan satu
              kali. Arsip audio memerlukan persetujuan terpisah;
              SpeechRecognition browser tidak digunakan.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
