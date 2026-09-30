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
import { compareSpokenText } from "../../lib/speechSimilarity";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import "./ListeningSpeakingTask.css";

export default function ListeningSpeakingTask({
  lesson,
  speechInputMode = "live_transcribe",
  aiProvider = "clario",
  speak,
  passed,
  passedScore = 0,
  onPass,
}) {
  const liveMode = speechInputMode !== "ai_audio";
  const recognition = useSpeechRecognition({ language: "en-US" });
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [aiTranscript, setAiTranscript] = useState("");
  const [checked, setChecked] = useState(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const answer = liveMode ? recognition.transcript : aiTranscript;
  const preview = answer ? compareSpokenText(lesson.script, answer) : null;

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
    const onSpeechError = (event) => {
      const code = event.detail?.error;
      toast.error(
        code === "not-allowed" || code === "service-not-allowed"
          ? "Izin mikrofon/transkripsi ditolak. Izinkan penggunaan mikrofon di browser."
          : code === "audio-capture"
            ? "Browser tidak menemukan mikrofon. Periksa perangkat input."
            : `Transkripsi berhenti${code ? ` (${code})` : ""}. Coba ulangi.`,
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
        result.reason === "unsupported"
          ? "Transkripsi langsung tidak didukung browser ini. Gunakan Chrome/Edge atau minta admin mengaktifkan mode rekaman AI."
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
    const result = compareSpokenText(lesson.script, recognition.transcript);
    setChecked(result);
    if (result.passed) {
      onPass?.(result.percent);
      toast.success(
        `Bagus! Kemiripan ${result.percent}% — latihan speaking lulus.`,
      );
    } else {
      toast.info(
        `Kemiripan ${result.percent}%. Coba ulangi hingga minimal 90%.`,
      );
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
    try {
      const audioForAI =
        aiProvider === "ichanlabs"
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
      const response = await apiFetch("assess-audio", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "AI gagal mentranskripsikan audio.");
      const text = String(payload.result?.transcript || "").trim();
      if (!text) throw new Error("Server AI tidak menghasilkan transkrip.");
      setAiTranscript(text);
      const result = compareSpokenText(lesson.script, text);
      setChecked(result);
      if (result.passed) {
        onPass?.(result.percent);
        toast.success(
          `Bagus! Kemiripan ${result.percent}% — latihan speaking lulus.`,
        );
      } else {
        toast.info(
          `Kemiripan ${result.percent}%. Coba rekam ulang hingga minimal 90%.`,
        );
      }
    } catch (error) {
      toast.error(error.message || "Rekaman belum dapat diproses.");
    } finally {
      setProcessing(false);
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
            minimal 90% sesuai.
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
          <button className="text-button" onClick={() => speak(lesson.script)}>
            <Volume2 size={15} /> Dengarkan paragraf
          </button>
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
                  disabled={!recognition.supported}
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
                  disabled={!answer || recognition.listening}
                >
                  Periksa transkrip <Check size={15} />
                </button>
                <button
                  className="text-button"
                  onClick={resetAttempt}
                  disabled={recognition.listening}
                >
                  <RotateCcw size={14} /> Reset / ulangi
                </button>
              </>
            ) : (
              <>
                <button
                  className={`mic-control ${recording ? "granted" : ""}`}
                  onClick={recording ? stopAudioRecording : startAudioRecording}
                  disabled={processing}
                >
                  {recording ? <Pause size={15} /> : <Mic size={15} />}
                  {recording ? "Selesai merekam" : "Mulai merekam"}
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
                      Transkripsikan & periksa <Check size={15} />
                    </>
                  )}
                </button>
                <button
                  className="text-button"
                  onClick={resetAttempt}
                  disabled={processing}
                >
                  <RotateCcw size={14} /> Reset / rekam ulang
                </button>
              </>
            )}
          </div>
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
                  recognition.supported
                    ? "Ketuk Mulai bicara, lalu ucapkan paragraf…"
                    : "Browser tidak mendukung Web Speech API. Minta admin mengaktifkan mode rekaman AI."
                }
              />
              <div className="transcript-foot">
                Punctuation diabaikan saat menghitung kecocokan.
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
          {preview && (
            <div
              className={`shadowing-score ${preview.passed ? "passed" : ""}`}
              role="status"
            >
              <span>Kecocokan kata</span>
              <b>{checked?.percent ?? preview.percent}%</b>
              <small>
                {(checked || preview).passed
                  ? "Target minimal 90% tercapai"
                  : "Ulangi hingga mencapai 90% atau lebih"}
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
