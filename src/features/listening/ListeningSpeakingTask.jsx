import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  CheckCircle2,
  Gem,
  Keyboard,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../../api";
import { convertRecordingToMp3, convertRecordingToWav } from "../../lib/audio";
import {
  compareSpokenText,
  meetsSpeechThreshold,
  normalizeSpeechThreshold,
} from "../../lib/speechSimilarity";
import { isTtsBusy } from "../../lib/ttsRocks";
import {
  speechRecognitionErrorMessage,
  useSpeechRecognition,
} from "../../hooks/useSpeechRecognition";
import ProcessingStatus from "../../components/ProcessingStatus";
import AudioRadarWaveform from "../../components/AudioRadarWaveform";
import MascotLoadingToast from "../../components/MascotLoadingToast";
import CustomMicPicker from "../../components/CustomMicPicker";
import useSmallViewport from "../../hooks/useSmallViewport";
import "./ListeningSpeakingTask.css";

export default function ListeningSpeakingTask({
  lesson,
  aiAudioCost = 3,
  speechSimilarityThreshold = 90,
  aiProvider = "clario",
  courseId = "ielts",
  maxRecordSeconds = 180,
  maxAiAudioBytes = 12 * 1024 * 1024,
  devices = [],
  deviceId = "",
  changeDevice = null,
  speak,
  ttsStatus,
  passed,
  passedScore = 0,
  savedTranscript = "",
  unlimitedDiamonds = false,
  onPass,
  onAttempt,
  onDiamondsChanged,
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("system"); // "system" | "ai" | "keyboard"
  const [activeModal, setActiveModal] = useState(null);
  const recognition = useSpeechRecognition({ language: "en-US" });

  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingStream, setRecordingStream] = useState(null);
  const [requestingMic, setRequestingMic] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [aiTranscript, setAiTranscript] = useState("");
  const [checked, setChecked] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const similarityThreshold = normalizeSpeechThreshold(speechSimilarityThreshold);
  const isSmallViewport = useSmallViewport();
  const isKeyboardMode = mode === "keyboard";

  const diamondCost = aiAudioCost ?? 3;
  const costLabel = unlimitedDiamonds
    ? "Gratis · Admin unlimited"
    : <><Gem size={12} style={{ display: "inline", verticalAlign: "middle" }} /> {diamondCost}</>;

  const savedTranscriptText =
    typeof savedTranscript === "string"
      ? savedTranscript
      : String(savedTranscript?.text || "");
  const ttsBusy = isTtsBusy(ttsStatus);

  const audioPreviewUrl = useMemo(() => {
    if (!audioBlob) return null;
    return URL.createObjectURL(audioBlob);
  }, [audioBlob]);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  useEffect(() => {
    setOpen(false);
    resetAttempt();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, aiProvider]);

  useEffect(() => {
    setChecked(null);
  }, [speechSimilarityThreshold]);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = window.setInterval(
      () => setRecordingSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (
      recording &&
      recordingSeconds >= Math.max(10, Number(maxRecordSeconds) || 180)
    ) {
      toast.info(
        `Rekaman otomatis dihentikan setelah ${Math.max(10, Number(maxRecordSeconds) || 180)} detik.`,
      );
      const activeRecorder = recorderRef.current;
      if (activeRecorder && activeRecorder.state !== "inactive")
        activeRecorder.stop();
      else setRecording(false);
    }
  }, [recording, recordingSeconds, maxRecordSeconds]);

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

  function switchMode(newMode) {
    if (newMode === mode) return;
    if (recording || processing || requestingMic || recognition.listening)
      return;
    resetAttempt();
    setMode(newMode);
  }

  function resetAttempt() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      try {
        recorderRef.current.stop();
      } catch {
        // Already stopped
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    recognition.reset();
    setRecording(false);
    setRecordingStream(null);
    setAudioBlob(null);
    setAiTranscript("");
    setChecked(null);
  }

  function startLiveTranscription() {
    setChecked(null);
    const result = recognition.start({
      append: Boolean(recognition.transcript),
    });
    if (!result.ok) {
      toast.error(
        result.reason === "unsupported-brave"
          ? "Brave tidak dapat mengakses layanan transkripsi live ini. Gunakan Google Chrome atau pilih tab Penilaian AI."
          : result.reason === "unsupported"
            ? "Transkripsi langsung tidak didukung browser ini. Gunakan Google Chrome atau pilih tab Penilaian AI."
            : "Mikrofon tidak dapat dinyalakan. Periksa izin browser dan pastikan menggunakan HTTPS.",
      );
    }
  }

  async function startAudioRecording() {
    setChecked(null);
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error(
        "Perekaman audio tidak tersedia. Gunakan browser modern melalui HTTPS.",
      );
      return;
    }
    setRequestingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setAudioBlob(
          new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          }),
        );
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        setRecordingStream(null);
      };
      setRecordingSeconds(0);
      recorder.start(250);
      setAudioBlob(null);
      setAiTranscript("");
      setRecording(true);
      setRecordingStream(stream);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      toast.error(
        error?.name === "NotAllowedError"
          ? "Izin mikrofon ditolak. Izinkan mikrofon di browser."
          : "Mikrofon tidak dapat digunakan. Periksa perangkat dan izin browser.",
      );
    } finally {
      setRequestingMic(false);
    }
  }

  function stopAudioRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else setRecording(false);
  }

  function checkLiveTranscript() {
    if (recognition.listening) {
      toast.info("Ketuk Selesai bicara terlebih dahulu.");
      return;
    }
    const transcript = recognition.transcript.trim();
    if (!transcript) {
      toast.info("Bicarakan paragrafnya terlebih dahulu.");
      return;
    }
    onAttempt?.(null, transcript, "local");
    const result = compareSpokenText(
      lesson.script,
      transcript,
      similarityThreshold,
    );
    setChecked(result);
    onAttempt?.(result.percent, transcript, "local");
    if (result.passed) {
      onPass?.(result.percent, transcript);
      toast.success(
        `Bagus! Kemiripan kata ${result.percent}% — latihan speaking lulus.`,
      );
    } else {
      toast.info(
        `Kemiripan kata ${result.percent}%. Coba ulangi hingga minimal ${similarityThreshold}%.`,
      );
    }
  }

  async function checkAiAudio() {
    if (!audioBlob) {
      toast.info("Rekam suara terlebih dahulu sebelum menilai.");
      return;
    }

    setProcessing(true);
    setProcessingMessage("Menyiapkan rekaman audio untuk dikirim ke AI…");
    try {
      let audioForAI;
      try {
        audioForAI = await convertRecordingToMp3(audioBlob, 128);
      } catch {
        audioForAI =
          aiProvider === "free"
            ? audioBlob
            : await convertRecordingToWav(audioBlob);
      }
      if (audioForAI.size > (Number(maxAiAudioBytes) || 12 * 1024 * 1024))
        throw new Error(
          `Audio melebihi batas ${(Number(maxAiAudioBytes) || 12 * 1024 * 1024) / (1024 * 1024)} MB.`,
        );
      const audioMime = (audioForAI.type || "audio/mpeg").split(";")[0];
      const audioExtension =
        audioMime === "audio/mpeg" || audioMime === "audio/mp3"
          ? "mp3"
          : audioMime === "audio/mp4"
            ? "m4a"
            : audioMime === "audio/ogg"
              ? "ogg"
              : audioMime === "audio/wav"
                ? "wav"
                : "webm";
      const form = new FormData();
      form.append("consent", "1");
      form.append("task_mode", "read_aloud_direct");
      form.append("level", lesson.level);
      form.append("task", lesson.script);
      form.append("course_id", courseId);
      form.append("unit_id", lesson.id);
      form.append("duration_seconds", String(recordingSeconds));
      form.append(
        "audio",
        audioForAI,
        `read-aloud-${lesson.id}.${audioExtension}`,
      );

      setProcessingMessage("AI sedang menganalisis audio, pelafalan & artikulasi…");
      const response = await apiFetch("assess-audio", {
        method: "POST",
        body: form,
      });

      setProcessingMessage("Menerima skor akurasi dan laporan artikulasi dari AI…");
      const payload = await response.json();
      if (Number.isFinite(Number(payload.diamonds)))
        onDiamondsChanged?.(Number(payload.diamonds));
      if (!response.ok)
        throw new Error(payload.error || "AI gagal menganalisis rekaman audio.");

      const text = String(payload.result?.transcript || "").trim();
      const percentRaw = Number(payload.result?.percent);
      if (!Number.isFinite(percentRaw) || percentRaw < 0 || percentRaw > 100)
        throw new Error("AI tidak mengembalikan skor kecocokan yang valid.");

      const percent = Math.round(percentRaw);
      setAiTranscript(text);
      onAttempt?.(null, text, "ai_direct");

      const result = {
        percent,
        passed: meetsSpeechThreshold(percent, similarityThreshold),
        articulationReport: payload.result?.articulation_report || null,
      };
      setChecked(result);
      onAttempt?.(result.percent, text, "ai_direct");

      if (result.passed) {
        onPass?.(result.percent, text);
        toast.success(
          `Luar biasa! Skor pelafalan AI ${result.percent}% — latihan speaking lulus.`,
        );
      } else {
        toast.info(
          `Skor pelafalan AI ${result.percent}%. Coba rekam ulang hingga minimal ${similarityThreshold}%.`,
        );
      }
    } catch (error) {
      toast.error(error.message || "Rekaman audio belum dapat diproses oleh AI.");
    } finally {
      setProcessing(false);
      setProcessingMessage("");
    }
  }

  // BUG FIX: Score is strictly hidden until the user clicks check!
  const displayedScore = checked;

  return (
    <section className="listening-speaking-card">
      <div className="listening-speaking-heading">
        <div>
          <h3>Latihan Melafalkan Paragraf</h3>
          <p className="listening-speaking-desc">
            Tirukan dan lafalkan naskah cerita untuk melatih kelancaran,
            artikulasi, dan intonasi bahasa Inggrismu.
          </p>
        </div>
        {passed ? (
          <span className="speech-pass-badge speaking-sticker-badge">
            <CheckCircle2 size={15} /> Selesai ({passedScore || 100}%)
          </span>
        ) : (
          <span className="level-pill speaking-sticker-badge">Target {similarityThreshold}%</span>
        )}
      </div>

      <button
        type="button"
        className={`listening-speaking-toggle-btn ${open ? "is-open" : ""}`}
        onClick={() => setOpen(!open)}
      >
        <div className="toggle-btn-inner">
          <div className="toggle-btn-icon">
            <Mic size={18} />
          </div>
          <div className="toggle-btn-text">
            <b>{open ? "Tutup Latihan Speaking" : "Buka Latihan Speaking"}</b>
            <small>{open ? "Klik untuk melipat naskah" : "Tirukan audio & lafalkan naskah cerita"}</small>
          </div>
        </div>
        <span className="toggle-btn-badge">{open ? "Aktif" : "Mulai"}</span>
      </button>

      {open && (
        <div className="shadowing-body">
          <div className="shadowing-passage" lang="en">
            {lesson.script}
          </div>

          <button
            className="text-button"
            onClick={() => speak(lesson.script)}
            disabled={ttsBusy}
          >
            {ttsBusy ? (
              <>
                <span className="spinner" /> Membaca audio…
              </>
            ) : (
              <>
                <Volume2 size={15} /> Dengarkan contoh pelafalan
              </>
            )}
          </button>

          {/* Mode Selector Tab Buttons (1 row on mobile, 3 tabs) */}
          <div className="speaking-mode-tabs" role="tablist" aria-label="Mode Penilaian Speaking">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "system"}
              className={`speaking-mode-tab ${mode === "system" ? "active" : ""}`}
              onClick={() => {
                switchMode("system");
                setActiveModal("system");
              }}
              disabled={recording || processing || recognition.listening}
            >
              <Sparkles size={16} />
              <div>
                <b>TTS (Sistem)</b>
                <small className="mode-tab-desc">Browser · Gratis</small>
              </div>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "ai"}
              className={`speaking-mode-tab ${mode === "ai" ? "active" : ""}`}
              onClick={() => {
                switchMode("ai");
                setActiveModal("ai");
              }}
              disabled={recording || processing || recognition.listening}
            >
              <AudioLines size={16} />
              <div>
                <b>AI</b>
                <small className="mode-tab-desc">Server · {unlimitedDiamonds ? "Gratis" : <><Gem size={11} style={{ display: "inline", verticalAlign: "middle" }} /> {diamondCost}</>}</small>
              </div>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "keyboard"}
              className={`speaking-mode-tab keyboard-tab ${mode === "keyboard" ? "active" : ""}`}
              onClick={() => {
                switchMode("keyboard");
                setActiveModal("keyboard");
              }}
              disabled={recording || processing || recognition.listening}
            >
              <Keyboard size={16} />
              <div>
                <b>Keyboard</b>
                <small className="mode-tab-desc">Dikte HP · Gratis</small>
              </div>
            </button>
          </div>

          {/* Mode Description Notice */}
          <div className="speaking-mode-notice">
            {mode === "system" ? (
              <>
                <span className="speaking-mode-pill system">Penilaian Sistem (Lokal)</span>
                <p>
                  Suara kamu dikonversi menjadi teks langsung oleh browser, lalu naskah dinilai secara instan oleh sistem pencocokan lokal tanpa mengirim audio (Gratis).
                </p>
              </>
            ) : mode === "ai" ? (
              <>
                <span className="speaking-mode-pill ai">Penilaian AI (Akurasi Tinggi)</span>
                <p>
                  Penilaian AI lebih akurat karena suara kamu diproses dan dianalisis langsung oleh AI untuk akurasi pengucapan, kejelasan artikulasi, dan kelancaran (stutter). Browser tidak membuat transkrip terlebih dahulu; rekaman audio dikirim langsung ke AI.
                </p>
              </>
            ) : (
              <>
                <span className="speaking-mode-pill keyboard">Mode Keyboard (Manual / Dikte)</span>
                <p>
                  Gunakan keyboard atau fitur mikrofon bawaan smartphone untuk mengetikkan naskah cerita secara manual, lalu klik tombol Periksa Jawaban di bawah (Gratis).
                </p>
              </>
            )}
          </div>

          {/* Controls & Inputs based on Mode */}
          {mode === "keyboard" ? (
            <>
              {/* Transcript Textarea for Keyboard Mode (Hero mic is hidden) */}
              <div className="transcript-area shadowing-transcript keyboard-mode-area">
                <div className="transcript-label">
                  <span>TRANSKRIP / INPUT TEKS (KEYBOARD)</span>
                  <span>{recognition.transcript.length} karakter</span>
                </div>
                <textarea
                  value={recognition.transcript}
                  readOnly={false}
                  onChange={(event) => {
                    setChecked(null);
                    recognition.setTranscript(event.target.value);
                  }}
                  aria-label="Ketik naskah cerita"
                  placeholder="Ketik transkrip naskah di sini atau gunakan mikrofon bawaan keyboard HP untuk mendiktekan teks…"
                  rows={4}
                />
                <div className="transcript-foot">
                  Ketik atau dikte naskah cerita bahasa Inggris di atas, lalu klik Periksa Jawaban.
                </div>
              </div>

              <div className="speaking-action-row">
                <button
                  className="btn-primary"
                  onClick={checkLiveTranscript}
                  disabled={!recognition.transcript.trim() || processing}
                >
                  <Check size={16} /> Periksa Jawaban (Gratis)
                </button>
                <button
                  className="outline-btn"
                  onClick={resetAttempt}
                  disabled={processing}
                >
                  <RotateCcw size={14} /> Reset / Ulangi
                </button>
              </div>
            </>
          ) : mode === "system" ? (
            <>
              {/* Custom Mic Selector for System Mode */}
              <CustomMicPicker
                devices={devices}
                deviceId={deviceId}
                onChangeDevice={changeDevice}
              />

              {/* Catchy Hero Action Button for System Mode */}
              <div className="listening-mic-hero-wrap">
                <button
                  type="button"
                  className={`listening-mic-hero-btn ${recognition.listening ? "is-active system-active" : "system-idle"}`}
                  onClick={
                    recognition.listening
                      ? recognition.stop
                      : startLiveTranscription
                  }
                  disabled={!recognition.supported || processing}
                >
                  <div className="mic-hero-icon-bubble">
                    {recognition.listening ? (
                      <Pause size={24} />
                    ) : (
                      <Mic size={24} />
                    )}
                  </div>
                  <div className="mic-hero-content">
                    <div className="mic-hero-title-row">
                      <span className="mic-hero-main-title">
                        {recognition.listening
                          ? "Selesai Bicara · Klik di Sini"
                          : "Ketuk untuk Mulai Bicara"}
                      </span>
                      <span className="mic-hero-badge system">
                        {recognition.listening ? "MENDENGARKAN…" : "GRATIS · SISTEM"}
                      </span>
                    </div>
                    <span className="mic-hero-subtitle">
                      {recognition.listening
                        ? "Klik untuk berhenti bicara & melihat teks hasil transkripsimu di bawah"
                        : "Nyalakan mikrofon, lalu bacakan naskah di atas dengan lantang dan jelas"}
                    </span>
                  </div>
                </button>
              </div>

              {/* Audio Radar & Waveform Animation when Mic is Active */}
              {recognition.listening && (
                <AudioRadarWaveform
                  theme="emerald"
                  label="Mikrofon Aktif · Sistem mendengarkan suaramu…"
                  subLabel="Bicaralah dengan jelas sesuai naskah bahasa Inggris di atas"
                />
              )}

              {/* Transcript Textarea (System mode is read-only; editing is reserved for Keyboard mode) */}
              <div className="transcript-area shadowing-transcript">
                <div className="transcript-label">
                  <span>TRANSKRIP LANGSUNG (BROWSER)</span>
                  <span>{recognition.transcript.length} karakter</span>
                </div>
                <textarea
                  value={recognition.transcript}
                  readOnly={true}
                  aria-label="Transkrip bicara"
                  placeholder={
                    recognition.supported
                      ? "Ketuk Mulai bicara, lalu bacakan paragraf di atas…"
                      : "Browser tidak mendukung Web Speech API. Silakan pilih tab Penilaian AI atau Keyboard."
                  }
                />
                <div className="transcript-foot">
                  Tanda baca diabaikan saat menghitung persentase kecocokan kata.
                </div>
              </div>

              {/* Action Buttons Below Transcript (Mirip Soal Pilihan Ganda) */}
              <div className="speaking-action-row">
                <button
                  className="btn-primary"
                  onClick={checkLiveTranscript}
                  disabled={!recognition.transcript.trim() || recognition.listening || processing}
                >
                  <Check size={16} /> Periksa Jawaban (Gratis)
                </button>
                <button
                  className="outline-btn"
                  onClick={resetAttempt}
                  disabled={recognition.listening || processing}
                >
                  <RotateCcw size={14} /> Reset / Ulangi
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Custom Mic Selector for AI Audio Mode */}
              <CustomMicPicker
                devices={devices}
                deviceId={deviceId}
                onChangeDevice={changeDevice}
              />

              {/* Catchy Hero Action Button for AI Mode */}
              <div className="listening-mic-hero-wrap">
                <button
                  type="button"
                  className={`listening-mic-hero-btn ${recording ? "is-active ai-active" : "ai-idle"}`}
                  onClick={recording ? stopAudioRecording : startAudioRecording}
                  disabled={processing || requestingMic}
                >
                  <div className="mic-hero-icon-bubble">
                    {requestingMic ? (
                      <span className="spinner" />
                    ) : recording ? (
                      <Pause size={24} />
                    ) : (
                      <Mic size={24} />
                    )}
                  </div>
                  <div className="mic-hero-content">
                    <div className="mic-hero-title-row">
                      <span className="mic-hero-main-title">
                        {recording
                          ? `Selesai Merekam (${recordingSeconds}s) · Klik di Sini`
                          : requestingMic
                            ? "Meminta Izin Mikrofon…"
                            : "Mulai Merekam Suara (Penilaian AI)"}
                      </span>
                      <span className="mic-hero-badge ai">
                        {recording ? "MEREKAM LIVE" : costLabel}
                      </span>
                    </div>
                    <span className="mic-hero-subtitle">
                      {recording
                        ? "Klik untuk menyelesaikan rekaman, dengarkan kembali, lalu minta penilaian AI"
                        : "Suara direkam langsung untuk dinilai akurasi pengucapan & artikulasinya oleh AI"}
                    </span>
                  </div>
                </button>
              </div>

              {/* Audio Radar & Waveform Animation when Recording Audio for AI */}
              {recording && (
                <AudioRadarWaveform
                  stream={recordingStream}
                  theme="coral"
                  label={`Merekam Audio Langsung (${recordingSeconds} detik)`}
                  subLabel="Bicaralah dengan tempo wajar. Tekan selesai jika telah membaca naskah."
                />
              )}

              {/* Audio Preview if Recorded */}
              {audioPreviewUrl ? (
                <div className="speaking-audio-preview">
                  <Play size={16} color="#315c45" />
                  <audio controls src={audioPreviewUrl} />
                </div>
              ) : (
                <p className="shadowing-privacy">
                  Tekan <b>Mulai merekam suara</b>, bacakan paragraf di atas dengan jelas, lalu tekan <b>Selesai merekam</b>.
                </p>
              )}

              {/* Action Buttons Below Audio Preview */}
              <div className="speaking-action-row">
                <button
                  className="btn-primary"
                  onClick={checkAiAudio}
                  disabled={!audioBlob || recording || processing}
                >
                  {processing ? (
                    <>
                      <span className="spinner" /> Memproses dengan AI…
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Nilai dengan AI · {unlimitedDiamonds ? "Gratis" : <><Gem size={13} style={{ display: "inline", verticalAlign: "middle", marginLeft: 2, marginRight: 2 }} /> {diamondCost}</>}
                    </>
                  )}
                </button>
                <button
                  className="outline-btn"
                  onClick={resetAttempt}
                  disabled={recording || processing || requestingMic}
                >
                  <RotateCcw size={14} /> Rekam Ulang
                </button>
              </div>
            </>
          )}

          {/* Gamified Mascot Bottom Loading Toast */}
          <MascotLoadingToast
            active={processing}
            type="ai"
            title={mode === "ai" ? "Menilai Rekaman dengan AI…" : "Memeriksa Jawaban…"}
            message={processingMessage || (mode === "ai" ? "AI sedang menilai akurasi fonetik & artikulasimu…" : "Membandingkan fonetik kata...")}
          />

          {/* Score & Articulation Display (Shown only AFTER clicking check) */}
          {displayedScore && (
            <>
              <div
                className={`shadowing-score ${displayedScore.passed ? "passed" : ""}`}
                role="status"
              >
                <span>
                  {mode === "ai" ? "Skor Akurasi · Penilaian AI" : "Kecocokan Kata · Sistem"}
                </span>
                <b>{displayedScore.percent}%</b>
                <small>
                  {displayedScore.passed
                    ? `Target minimal ${similarityThreshold}% tercapai (LULUS)`
                    : `Belum mencapai target ${similarityThreshold}%. Coba ulangi lagi.`}
                </small>
              </div>

              {/* AI Transcript & Articulation Report */}
              {mode === "ai" && aiTranscript && (
                <div className="transcript-area shadowing-transcript" style={{ marginTop: 8 }}>
                  <div className="transcript-label">
                    <span>TRANSKRIP TERDENGAR OLEH AI</span>
                    <span>{aiTranscript.length} karakter</span>
                  </div>
                  <textarea value={aiTranscript} readOnly />
                </div>
              )}

              {displayedScore.articulationReport && (
                <div className="speaking-articulation-box">
                  <b>
                    <AudioLines size={15} /> Laporan Artikulasi & Kejelasan AI
                  </b>
                  <p>{displayedScore.articulationReport}</p>
                </div>
              )}
            </>
          )}

          {savedTranscriptText &&
            !displayedScore &&
            savedTranscriptText !== recognition.transcript &&
            savedTranscriptText !== aiTranscript && (
              <div className="transcript-area shadowing-transcript saved-speaking-transcript">
                <div className="transcript-label">
                  <span>TRANSKRIP LATIHAN TERAKHIR · TERSIMPAN</span>
                  <span>{savedTranscriptText.length} karakter</span>
                </div>
                <textarea
                  value={savedTranscriptText}
                  readOnly
                  aria-label="Transkrip latihan speaking tersimpan"
                />
                {savedTranscript?.score != null && (
                  <div className="transcript-foot">
                    Skor terakhir: {savedTranscript.score}%
                  </div>
                )}
              </div>
            )}

          {passed && (
            <p className="shadowing-success">
              <CheckCircle2 size={16} /> Misi speaking materi ini sudah selesai. Kamu tetap bisa mengulang untuk terus melatih artikulasi.
            </p>
          )}
        </div>
      )}

      {/* Explanation Modal for Mode Selection */}
      {activeModal && (
        <div
          className="speaking-mode-modal-backdrop"
          onClick={() => setActiveModal(null)}
          aria-hidden="true"
        >
          <div
            className="speaking-mode-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="speaking-mode-modal-head">
              <h4>
                {activeModal === "system" && "Mode Penilaian TTS (Sistem)"}
                {activeModal === "ai" && "Mode Penilaian AI (Akurasi Server)"}
                {activeModal === "keyboard" && "Mode Keyboard (Manual / Dikte)"}
              </h4>
              <button
                type="button"
                className="speaking-mode-modal-close"
                onClick={() => setActiveModal(null)}
                aria-label="Tutup penjelasan mode"
              >
                <X size={18} />
              </button>
            </div>
            <div className="speaking-mode-modal-body">
              {activeModal === "system" && (
                <p>
                  Suaramu diubah menjadi teks langsung oleh Web Speech API browser secara instan dan dinilai dengan pencocokan kata lokal. 100% gratis.
                </p>
              )}
              {activeModal === "ai" && (
                <p>
                  Rekaman suara kamu diunggah dan dianalisis langsung oleh AI cerdas untuk menilai akurasi pengucapan, artikulasi, dan kelancaran berbicara. Biaya: {unlimitedDiamonds ? "Gratis (Akses Admin)" : <><Gem size={13} style={{ display: "inline", verticalAlign: "middle" }} /> {diamondCost}</>}.
                </p>
              )}
              {activeModal === "keyboard" && (
                <p>
                  Ketikkan teks naskah secara manual atau gunakan mikrofon bawaan keyboard HP-mu untuk mendiktekan teks tanpa Web Speech API. 100% gratis dan praktis!
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => setActiveModal(null)}
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
