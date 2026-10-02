import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  CheckCircle2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../../api";
import { convertRecordingToWav } from "../../lib/audio";
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
  const [mode, setMode] = useState("system"); // "system" | "ai"
  const recognition = useSpeechRecognition({ language: "en-US" });

  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
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
  const mobileTranscriptEditable = mode === "system" && isSmallViewport;

  const diamondCost = aiAudioCost ?? 3;
  const costLabel = unlimitedDiamonds
    ? "Gratis · Admin unlimited"
    : `${diamondCost} diamond`;

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
      };
      setRecordingSeconds(0);
      recorder.start(250);
      setAudioBlob(null);
      setAiTranscript("");
      setRecording(true);
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
      const audioForAI =
        aiProvider === "free"
          ? audioBlob
          : await convertRecordingToWav(audioBlob);
      if (audioForAI.size > (Number(maxAiAudioBytes) || 12 * 1024 * 1024))
        throw new Error(
          `Audio melebihi batas ${(Number(maxAiAudioBytes) || 12 * 1024 * 1024) / (1024 * 1024)} MB.`,
        );
      const audioMime = (audioForAI.type || "audio/webm").split(";")[0];
      const audioExtension =
        audioMime === "audio/mp4"
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
          <span className="eyebrow">
            <Volume2 size={14} /> SHADOWING & SPEAKING · MISI BINTANG
          </span>
          <h3>Latihan Melafalkan Paragraf</h3>
          <p>
            Tirukan dan lafalkan naskah cerita untuk melatih kelancaran,
            artikulasi, dan intonasi bahasa Inggrismu.
          </p>
        </div>
        {passed ? (
          <span className="speech-pass-badge">
            <CheckCircle2 size={15} /> Selesai ({passedScore || 100}%)
          </span>
        ) : (
          <span className="level-pill">Target {similarityThreshold}%</span>
        )}
      </div>

      <button
        className="outline-btn listening-speaking-toggle"
        onClick={() => setOpen(!open)}
      >
        <Mic size={15} />
        {open ? "Tutup latihan speaking" : "Buka latihan speaking"}
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

          {/* Mode Selector Tab Buttons */}
          <div className="speaking-mode-tabs" role="tablist" aria-label="Mode Penilaian Speaking">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "system"}
              className={`speaking-mode-tab ${mode === "system" ? "active" : ""}`}
              onClick={() => switchMode("system")}
              disabled={recording || processing || recognition.listening}
            >
              <Sparkles size={17} />
              <div>
                <b>Penilaian Sistem</b>
                <small>Browser Speech-to-Text · Gratis</small>
              </div>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "ai"}
              className={`speaking-mode-tab ${mode === "ai" ? "active" : ""}`}
              onClick={() => switchMode("ai")}
              disabled={recording || processing || recognition.listening}
            >
              <AudioLines size={17} />
              <div>
                <b>Penilaian AI</b>
                <small>Analisis Suara & Artikulasi · {costLabel}</small>
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
            ) : (
              <>
                <span className="speaking-mode-pill ai">Penilaian AI (Akurasi Tinggi)</span>
                <p>
                  Penilaian AI lebih akurat karena suara kamu diproses dan dianalisis langsung oleh AI untuk akurasi pengucapan, kejelasan artikulasi, dan kelancaran (stutter). Naskah dan rekaman suara dikirim langsung ke AI.
                </p>
              </>
            )}
          </div>

          {/* Controls & Inputs based on Mode */}
          {mode === "system" ? (
            <>
              <div className="shadowing-controls">
                <button
                  className={`mic-control ${recognition.listening ? "granted is-listening-live" : ""}`}
                  onClick={
                    recognition.listening
                      ? recognition.stop
                      : startLiveTranscription
                  }
                  disabled={!recognition.supported || processing}
                >
                  {recognition.listening ? (
                    <Pause size={15} />
                  ) : (
                    <Mic size={15} />
                  )}
                  {recognition.listening ? "Selesai bicara" : "Mulai bicara"}
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

              {/* Transcript Textarea */}
              <div className="transcript-area shadowing-transcript">
                <div className="transcript-label">
                  <span>
                    {mobileTranscriptEditable
                      ? "TRANSKRIP LANGSUNG · BISA DIEDIT"
                      : "TRANSKRIP LANGSUNG (BROWSER)"}
                  </span>
                  <span>{recognition.transcript.length} karakter</span>
                </div>
                <textarea
                  value={recognition.transcript}
                  readOnly={!mobileTranscriptEditable}
                  onFocus={() => {
                    if (mobileTranscriptEditable && recognition.listening)
                      recognition.stop({ discardPendingResults: true });
                  }}
                  onChange={(event) => {
                    setChecked(null);
                    recognition.setTranscript(event.target.value);
                  }}
                  aria-label="Transkrip bicara"
                  placeholder={
                    mobileTranscriptEditable
                      ? "Ketik jawaban atau gunakan mikrofon keyboard untuk dikte…"
                      : recognition.supported
                        ? "Ketuk Mulai bicara, lalu bacakan paragraf di atas…"
                        : "Browser tidak mendukung Web Speech API. Silakan pilih tab Penilaian AI."
                  }
                />
                <div className="transcript-foot">
                  {mobileTranscriptEditable
                    ? "Di HP, gunakan mikrofon keyboard untuk dikte teks. Audio tidak diunggah."
                    : "Tanda baca diabaikan saat menghitung persentase kecocokan kata."}
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
              <div className="shadowing-controls">
                <button
                  className={`mic-control ${recording ? "granted is-recording-live" : ""}`}
                  onClick={recording ? stopAudioRecording : startAudioRecording}
                  disabled={processing || requestingMic}
                >
                  {requestingMic ? (
                    <span className="spinner" />
                  ) : recording ? (
                    <Pause size={15} />
                  ) : (
                    <Mic size={15} />
                  )}
                  {recording
                    ? `Selesai merekam (${recordingSeconds}s)`
                    : requestingMic
                      ? "Meminta akses mikrofon…"
                      : "Mulai merekam suara"}
                </button>
              </div>

              {/* Audio Radar & Waveform Animation when Recording Audio for AI */}
              {recording && (
                <AudioRadarWaveform
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
                      <Check size={16} /> Nilai dengan AI ({costLabel})
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

          {requestingMic && (
            <ProcessingStatus
              message="Meminta akses mikrofon…"
              detail="Pilih Izinkan pada dialog izin browser."
              compact
              className="shadowing-processing-status"
            />
          )}

          {processing && (
            <ProcessingStatus
              message={processingMessage || "Memproses audio…"}
              detail="Audio sedang dianalisis oleh AI server. Mohon tunggu beberapa detik."
              compact
              className="shadowing-processing-status"
            />
          )}

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
    </section>
  );
}
