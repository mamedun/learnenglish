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
} from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "../../lib/formatTime";

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
    playRecording,
    completed,
  } = p;
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
              <p>“{unit.prompt}”</p>
            </div>
            <button
              className="round-play"
              onClick={() => speak(unit.prompt)}
              aria-label="Dengarkan contoh"
            >
              <Volume2 size={17} />
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
            <div className={`mic-halo ${recording ? "is-recording" : ""}`}>
              <button
                className="mic-main"
                onClick={recording ? stopRecording : startRecording}
                disabled={processing}
              >
                <Mic size={26} />
              </button>
            </div>
            {recording ? (
              <>
                <b className="recording-label">Sedang merekam...</b>
                <span className="record-time">
                  {formatTime(elapsed)} <i className="live-dot" />
                </span>
                <div className="waveform">
                  {Array.from({ length: 32 }, (_, i) => (
                    <i
                      key={i}
                      style={{
                        height: `${recording ? 12 + Math.random() * 27 : 8}px`,
                        animationDelay: `${i * 0.03}s`,
                      }}
                    />
                  ))}
                </div>
                <button className="stop-button" onClick={stopRecording}>
                  <Pause size={14} fill="currentColor" /> Selesai merekam
                </button>
              </>
            ) : (
              <>
                <b className="recording-label">Ketuk untuk mulai bicara</b>
                <span className="record-hint">
                  atau ketik jawabanmu di bawah
                </span>
              </>
            )}
            <div className="mic-controls">
              <button
                onClick={requestMic}
                className={
                  permission === "granted"
                    ? "mic-control granted"
                    : "mic-control"
                }
              >
                <Mic size={14} />
                {permission === "granted"
                  ? "Mikrofon siap"
                  : permission === "denied"
                    ? "Izin ditolak"
                    : "Pilih mikrofon"}
              </button>
              {devices.length > 0 && (
                <select
                  aria-label="Pilih mikrofon"
                  value={deviceId}
                  onChange={(e) => p.changeDevice(e.target.value)}
                >
                  {devices.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Mikrofon ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="transcript-area">
            <div className="transcript-label">
              <span>TRANSKRIP JAWABANMU</span>
              <span>{transcript.length}/500</span>
            </div>
            <textarea
              maxLength={500}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Speech recognition otomatis tidak aktif. Ketik jawaban, atau kirim rekaman setelah menyetujui evaluasi audio..."
            />
            <div className="transcript-foot">
              <span>
                {audioBlob ? (
                  <>
                    <FileAudio2 size={13} /> Audio{" "}
                    {Math.max(1, Math.round(audioBlob.size / 1024))} KB siap
                  </>
                ) : (
                  "Transkrip dapat diedit sebelum dikirim"
                )}
              </span>
              <span>
                <Languages size={13} /> English
              </span>
            </div>
          </div>
          <div className="answer-actions">
            <span>
              <ShieldCheck size={15} /> Rekaman{" "}
              {p.sessionSaveAudio === null
                ? "akan ditanyakan per sesi"
                : p.sessionSaveAudio
                  ? "akan disimpan di akun server"
                  : "tidak akan disimpan"}
            </span>
            <button
              className="btn-primary"
              onClick={submitTurn}
              disabled={processing || (!transcript.trim() && !audioBlob)}
            >
              {processing ? (
                <>
                  <span className="spinner" /> Menganalisis...
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
                    {t.userText}
                    {t.audioSaved && (
                      <button
                        className="audio-mini"
                        onClick={() => playRecording(t.audioId)}
                      >
                        <Play size={12} /> Dengarkan
                      </button>
                    )}
                  </div>
                  <div className="bubble coach-bubble">
                    <small>
                      MAYA{" "}
                      <button onClick={() => speak(t.reply)}>
                        <Volume2 size={13} />
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
