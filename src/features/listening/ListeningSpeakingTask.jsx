import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  CheckCircle2,
  Mic,
  Pause,
  RotateCcw,
  Volume2,
} from "lucide-react";
import Swal from "sweetalert2";
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
import "./ListeningSpeakingTask.css";

export default function ListeningSpeakingTask({
  lesson,
  speechInputMode = "live_transcribe",
  speechScoringMode = "local",
  speechSimilarityThreshold = 90,
  aiProvider = "clario",
  speak,
  ttsStatus,
  passed,
  passedScore = 0,
  savedTranscript = "",
  onPass,
  onAttempt,
  onDiamondsChanged,
}) {
  const liveMode = speechInputMode !== "ai_audio";
  const recognition = useSpeechRecognition({ language: "en-US" });
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [requestingMic, setRequestingMic] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [aiTranscript, setAiTranscript] = useState("");
  const [checked, setChecked] = useState(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const similarityThreshold = normalizeSpeechThreshold(
    speechSimilarityThreshold,
  );
  const answer = liveMode ? recognition.transcript : aiTranscript;
  const preview = answer
    ? compareSpokenText(lesson.script, answer, similarityThreshold)
    : null;
  const aiScoring = speechScoringMode === "ai";
  const displayedScore = aiScoring ? checked : (checked ?? preview);
  const savedTranscriptText =
    typeof savedTranscript === "string"
      ? savedTranscript
      : String(savedTranscript?.text || "");
  const ttsBusy = isTtsBusy(ttsStatus);

  useEffect(() => {
    setOpen(false);
    resetAttempt();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
    // Reset the recorder when lesson, input mode, or global AI provider changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, liveMode, aiProvider]);
  useEffect(() => {
    setChecked(null);
  }, [speechScoringMode, speechSimilarityThreshold]);
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

  function resetAttempt() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      try {
        recorderRef.current.stop();
      } catch {
        // Recorder may have ended already.
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
    const result = recognition.start({
      append: Boolean(recognition.transcript),
    });
    if (!result.ok) {
      toast.error(
        result.reason === "unsupported-brave"
          ? "Brave tidak dapat mengakses layanan live transcription ini. Gunakan Google Chrome atau minta admin mengaktifkan mode rekaman AI."
          : result.reason === "unsupported"
            ? "Transkripsi langsung tidak didukung browser ini. Gunakan Google Chrome atau minta admin mengaktifkan mode rekaman AI."
            : "Mikrofon tidak dapat dinyalakan. Periksa izin browser dan gunakan HTTPS.",
      );
      return;
    }
    setChecked(null);
  }

  async function startAudioRecording() {
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
      recorder.start(250);
      setAudioBlob(null);
      setAiTranscript("");
      setChecked(null);
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

  async function checkLiveTranscript() {
    if (recognition.listening) {
      toast.info(
        "Ketuk Selesai bicara terlebih dahulu agar transkrip lengkap.",
      );
      return;
    }
    const transcript = recognition.transcript.trim();
    if (!transcript) {
      toast.info("Bicarakan paragrafnya terlebih dahulu.");
      return;
    }
    onAttempt?.(null, transcript, aiScoring ? "ai" : "local");

    if (aiScoring) {
      setProcessing(true);
      setProcessingMessage("Membandingkan transkrip dengan AI…");
    }
    try {
      let result;
      if (aiScoring) {
        const response = await apiFetch("speech-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expected_text: lesson.script,
            transcript,
          }),
        });
        const payload = await response.json();
        if (Number.isFinite(Number(payload.diamonds)))
          onDiamondsChanged?.(Number(payload.diamonds));
        if (!response.ok)
          throw new Error(payload.error || "AI gagal membandingkan transkrip.");
        const percent = Math.max(0, Math.min(100, Math.round(payload.percent)));
        result = {
          percent,
          passed: meetsSpeechThreshold(percent, similarityThreshold),
        };
      } else {
        result = compareSpokenText(
          lesson.script,
          transcript,
          similarityThreshold,
        );
      }
      setChecked(result);
      onAttempt?.(result.percent, transcript, aiScoring ? "ai" : "local");
      if (result.passed) {
        onPass?.(result.percent, transcript);
        toast.success(
          `Bagus! Kemiripan ${result.percent}% — latihan speaking lulus.`,
        );
      } else {
        toast.info(
          `Kemiripan ${result.percent}%. Coba ulangi hingga minimal ${similarityThreshold}%.`,
        );
      }
    } catch (error) {
      toast.error(error.message || "Transkrip belum dapat dinilai.");
    } finally {
      if (aiScoring) {
        setProcessing(false);
        setProcessingMessage("");
      }
    }
  }

  async function checkAiAudio() {
    if (!audioBlob) {
      toast.info("Rekam paragraf terlebih dahulu.");
      return;
    }
    const consent = await Swal.fire({
      title: "Kirim rekaman untuk transkripsi AI?",
      text: "Audio dikirim satu kali ke server AI yang dipilih admin untuk membuat transkrip. Audio tidak disimpan oleh proses evaluasi ini.",
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Setuju & proses audio",
      cancelButtonText: "Batal",
      confirmButtonColor: "#315c45",
    });
    if (!consent.isConfirmed) return;

    setProcessing(true);
    setProcessingMessage("Menyiapkan rekaman untuk dikirim…");
    try {
      const audioForAI =
        aiProvider === "free"
          ? audioBlob
          : await convertRecordingToWav(audioBlob);
      if (audioForAI.size > 12 * 1024 * 1024)
        throw new Error("Audio melebihi batas 12 MB.");
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
      form.append("task_mode", "read_aloud");
      form.append("level", lesson.level);
      form.append("task", lesson.script);
      form.append(
        "audio",
        audioForAI,
        `read-aloud-${lesson.id}.${audioExtension}`,
      );
      setProcessingMessage(
        speechScoringMode === "ai"
          ? "Mengirim audio untuk transkripsi dan penilaian AI…"
          : "Mengirim audio untuk transkripsi…",
      );
      const response = await apiFetch("assess-audio", {
        method: "POST",
        body: form,
      });
      setProcessingMessage("Menerima transkrip dari AI…");
      const payload = await response.json();
      if (Number.isFinite(Number(payload.diamonds)))
        onDiamondsChanged?.(Number(payload.diamonds));
      if (!response.ok)
        throw new Error(payload.error || "AI gagal mentranskripsikan audio.");
      const text = String(payload.result?.transcript || "").trim();
      if (!text) throw new Error("Server AI tidak menghasilkan transkrip.");
      setAiTranscript(text);
      onAttempt?.(null, text, speechScoringMode === "ai" ? "ai" : "local");
      let result;
      if (speechScoringMode === "ai") {
        const percent = Number(payload.result?.percent);
        if (!Number.isFinite(percent) || percent < 0 || percent > 100)
          throw new Error(
            "AI tidak mengembalikan persentase kecocokan yang valid.",
          );
        result = {
          percent: Math.round(percent),
          passed: meetsSpeechThreshold(percent, similarityThreshold),
        };
      } else {
        result = compareSpokenText(lesson.script, text, similarityThreshold);
      }
      setChecked(result);
      onAttempt?.(
        result.percent,
        text,
        speechScoringMode === "ai" ? "ai" : "local",
      );
      if (result.passed) {
        onPass?.(result.percent, text);
        toast.success(
          `Bagus! Kemiripan ${result.percent}% — latihan speaking lulus.`,
        );
      } else {
        toast.info(
          `Kemiripan ${result.percent}%. Coba rekam ulang hingga minimal ${similarityThreshold}%.`,
        );
      }
    } catch (error) {
      toast.error(error.message || "Rekaman belum dapat diproses.");
    } finally {
      setProcessing(false);
      setProcessingMessage("");
    }
  }

  return (
    <section className="listening-speaking-card">
      <div className="listening-speaking-heading">
        <div>
          <span className="eyebrow">
            <AudioLines size={14} /> LISTENING + SPEAKING
          </span>
          <h3>Ucapkan kembali paragrafnya</h3>
          <p>
            Dengarkan contoh, baca nyaring, lalu ulangi sampai kata-katanya
            minimal {similarityThreshold}% sesuai.{" "}
            {speechScoringMode === "ai"
              ? `Pencocokan AI memakai 1 diamond${liveMode ? " per percakapan; audio tidak dikirim." : " per pencocokan; transkripsi audio juga memakai 1 diamond."}`
              : liveMode
                ? "Pencocokan lokal gratis; audio tidak dikirim."
                : "Pencocokan lokal gratis; transkripsi audio AI memakai 1 diamond."}
          </p>
        </div>
        {passed && (
          <span className="speech-pass-badge">
            <CheckCircle2 size={15} /> LULUS · {passedScore}%
          </span>
        )}
      </div>
      <button
        className="outline-btn listening-speaking-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Tutup latihan speaking" : "Mulai latihan speaking"}{" "}
        <Mic size={15} />
      </button>
      {open && (
        <div className="shadowing-body">
          <div className="shadowing-passage">{lesson.script}</div>
          <button
            className="text-button"
            onClick={() => speak(lesson.script)}
            disabled={ttsBusy}
          >
            {ttsBusy ? (
              <>
                <span className="spinner" />
                {ttsStatus?.phase === "speaking"
                  ? "Sedang membacakan…"
                  : "Menyiapkan audio…"}
              </>
            ) : (
              <>
                <Volume2 size={15} /> Dengarkan paragraf
              </>
            )}
          </button>
          {liveMode && recognition.braveDetected && (
            <div className="speech-browser-warning" role="note">
              <b>Google Chrome diperlukan untuk live transcription.</b>
              Brave dapat menampilkan tombol Web Speech tetapi tidak mencapai
              layanan transkripsinya. Gunakan Google Chrome untuk live
              transcription.
            </div>
          )}
          <div className="shadowing-controls">
            {liveMode ? (
              <>
                <button
                  className={`mic-control ${recognition.listening ? "granted" : ""}`}
                  onClick={
                    recognition.listening
                      ? recognition.stop
                      : startLiveTranscription
                  }
                  disabled={
                    !recognition.supported ||
                    recognition.braveDetected ||
                    processing
                  }
                >
                  {recognition.listening ? (
                    <Pause size={15} />
                  ) : (
                    <Mic size={15} />
                  )}
                  {recognition.listening ? "Selesai bicara" : "Mulai bicara"}
                </button>
                <button
                  className="outline-btn"
                  onClick={checkLiveTranscript}
                  disabled={!answer || recognition.listening || processing}
                >
                  {processing && aiScoring ? (
                    <>
                      <span className="spinner" /> Menilai…
                    </>
                  ) : (
                    <>
                      {aiScoring
                        ? "Nilai dengan AI · 1 diamond"
                        : "Periksa gratis"}{" "}
                      <Check size={15} />
                    </>
                  )}
                </button>
                <button
                  className="text-button"
                  onClick={resetAttempt}
                  disabled={recognition.listening || processing}
                >
                  <RotateCcw size={14} /> Reset / ulangi
                </button>
              </>
            ) : (
              <>
                <button
                  className={`mic-control ${recording ? "granted" : ""}`}
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
                    ? "Selesai merekam"
                    : requestingMic
                      ? "Meminta akses…"
                      : "Mulai merekam"}
                </button>
                <button
                  className="outline-btn"
                  onClick={checkAiAudio}
                  disabled={!audioBlob || recording || processing}
                >
                  {processing ? (
                    <>
                      <span className="spinner" /> Memproses…
                    </>
                  ) : (
                    <>
                      {speechScoringMode === "ai"
                        ? "Transkripsikan + AI match · 2 diamond"
                        : "Transkripsikan · 1 diamond"}{" "}
                      <Check size={15} />
                    </>
                  )}
                </button>
                <button
                  className="text-button"
                  onClick={resetAttempt}
                  disabled={processing || requestingMic}
                >
                  <RotateCcw size={14} /> Reset / rekam ulang
                </button>
              </>
            )}
          </div>
          {requestingMic && (
            <ProcessingStatus
              message="Meminta akses mikrofon…"
              detail="Pilih Izinkan pada dialog browser jika diminta."
              compact
              className="shadowing-processing-status"
            />
          )}
          {processing && (
            <ProcessingStatus
              message={processingMessage || "Memproses audio…"}
              detail={
                liveMode
                  ? "Hanya teks naskah dan transkrip yang dibandingkan; audio tidak dikirim."
                  : "Audio sedang dikirim dan dianalisis. Koneksi lambat bisa membutuhkan waktu."
              }
              compact
              className="shadowing-processing-status"
            />
          )}
          {liveMode ? (
            <div className="transcript-area shadowing-transcript">
              <div className="transcript-label">
                <span>TRANSKRIP LANGSUNG · READ-ONLY</span>
                <span>{answer.length} karakter</span>
              </div>
              <textarea
                value={answer}
                readOnly
                placeholder={
                  recognition.braveDetected
                    ? "Live transcription tidak tersedia di Brave. Gunakan Google Chrome."
                    : recognition.supported
                      ? "Ketuk Mulai bicara, lalu ucapkan paragraf…"
                      : "Browser tidak mendukung Web Speech API. Minta admin mengaktifkan mode rekaman AI."
                }
              />
              <div className="transcript-foot">
                {aiScoring
                  ? "Naskah dan transkrip teks dinilai AI; audio tidak dikirim."
                  : "Punctuation diabaikan saat menghitung kecocokan."}
              </div>
            </div>
          ) : aiTranscript ? (
            <div className="transcript-area shadowing-transcript">
              <div className="transcript-label">
                <span>TRANSKRIP HASIL AI</span>
                <span>{aiTranscript.length} karakter</span>
              </div>
              <textarea value={aiTranscript} readOnly />
            </div>
          ) : (
            <p className="shadowing-privacy">
              Audio belum dikirim. Pengiriman hanya terjadi setelah kamu menekan
              tombol transkripsi dan menyetujuinya.
            </p>
          )}
          {savedTranscriptText &&
            savedTranscriptText !== answer &&
            savedTranscriptText !== aiTranscript && (
              <div className="transcript-area shadowing-transcript saved-speaking-transcript">
                <div className="transcript-label">
                  <span>TRANSKRIP TERAKHIR · TERSIMPAN</span>
                  <span>{savedTranscriptText.length} karakter</span>
                </div>
                <textarea
                  value={savedTranscriptText}
                  readOnly
                  aria-label="Transkrip latihan speaking tersimpan"
                />
                {savedTranscript?.score != null && (
                  <div className="transcript-foot">
                    Skor terakhir: {savedTranscript.score}% · audio tidak
                    disimpan.
                  </div>
                )}
              </div>
            )}
          {displayedScore && (
            <div
              className={`shadowing-score ${displayedScore.passed ? "passed" : ""}`}
              role="status"
            >
              <span>{aiScoring ? "Kecocokan · AI" : "Kecocokan kata"}</span>
              <b>{displayedScore.percent}%</b>
              <small>
                {displayedScore.passed
                  ? `Target minimal ${similarityThreshold}% tercapai`
                  : `Ulangi hingga mencapai ${similarityThreshold}% atau lebih`}
              </small>
            </div>
          )}
          {passed && (
            <p className="shadowing-success">
              <CheckCircle2 size={15} /> Bagian speaking sudah selesai. Kamu
              tetap bisa mengulang untuk latihan.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
