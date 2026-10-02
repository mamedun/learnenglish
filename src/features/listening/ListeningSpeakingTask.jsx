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
import useSmallViewport from "../../hooks/useSmallViewport";
import "./ListeningSpeakingTask.css";

export default function ListeningSpeakingTask({
  lesson,
  speechInputMode = "live_transcribe",
  speechScoringMode = "local",
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
  const liveMode = speechInputMode !== "ai_audio";
  const recognition = useSpeechRecognition({ language: "en-US" });
  const [open, setOpen] = useState(false);
  const [directAudioMode, setDirectAudioMode] = useState(false);
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
  const similarityThreshold = normalizeSpeechThreshold(
    speechSimilarityThreshold,
  );
  const isSmallViewport = useSmallViewport();
  const liveInput = liveMode && !directAudioMode;
  const mobileTranscriptEditable = liveInput && isSmallViewport;
  const answer = liveInput ? recognition.transcript : aiTranscript;
  const preview = answer
    ? compareSpokenText(lesson.script, answer, similarityThreshold)
    : null;
  const aiScoring = directAudioMode || speechScoringMode === "ai";
  const displayedScore = aiScoring ? checked : (checked ?? preview);
  const diamondCost = directAudioMode
    ? 3
    : liveInput
      ? speechScoringMode === "ai"
        ? 1
        : 0
      : speechScoringMode === "ai"
        ? 2
        : 1;
  const costLabel = unlimitedDiamonds
    ? "Gratis · Admin unlimited"
    : diamondCost === 0
      ? "Gratis"
      : `${diamondCost} diamond${diamondCost === 1 ? "" : "s"}`;
  const savedTranscriptText =
    typeof savedTranscript === "string"
      ? savedTranscript
      : String(savedTranscript?.text || "");
  const ttsBusy = isTtsBusy(ttsStatus);

  useEffect(() => {
    setOpen(false);
    setDirectAudioMode(false);
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

  function chooseDirectAudioMode(enabled) {
    if (enabled === directAudioMode) return;
    if (recording || processing || requestingMic || recognition.listening)
      return;
    recognition.reset();
    setAudioBlob(null);
    setAiTranscript("");
    setChecked(null);
    setDirectAudioMode(enabled);
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
      setRecordingSeconds(0);
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
            course_id: courseId,
            unit_id: lesson.id,
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
      title: directAudioMode
        ? "Kirim rekaman untuk penilaian suara langsung?"
        : "Kirim rekaman untuk transkripsi AI?",
      text: directAudioMode
        ? "Audio akan dikirim langsung ke server AI yang dipilih admin untuk dinilai terhadap naskah. Browser tidak membuat transkrip terlebih dahulu. Audio tidak disimpan oleh proses evaluasi ini."
        : "Audio dikirim satu kali ke server AI yang dipilih admin untuk membuat transkrip. Audio tidak disimpan oleh proses evaluasi ini.",
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
      form.append(
        "task_mode",
        directAudioMode ? "read_aloud_direct" : "read_aloud",
      );
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
      setProcessingMessage(
        directAudioMode
          ? "Mengirim audio langsung ke AI untuk dinilai…"
          : speechScoringMode === "ai"
            ? "Mengirim audio untuk transkripsi dan penilaian AI…"
            : "Mengirim audio untuk transkripsi…",
      );
      const response = await apiFetch("assess-audio", {
        method: "POST",
        body: form,
      });
      setProcessingMessage(
        directAudioMode
          ? "Menerima skor AI dan hasil audio…"
          : "Menerima transkrip dari AI…",
      );
      const payload = await response.json();
      if (Number.isFinite(Number(payload.diamonds)))
        onDiamondsChanged?.(Number(payload.diamonds));
      if (!response.ok)
        throw new Error(payload.error || "AI gagal mentranskripsikan audio.");
      const text = String(payload.result?.transcript || "").trim();
      if (!text) throw new Error("Server AI tidak menghasilkan transkrip.");
      setAiTranscript(text);
      const evaluationMethod = directAudioMode
        ? "ai_direct"
        : speechScoringMode === "ai"
          ? "ai"
          : "local";
      onAttempt?.(null, text, evaluationMethod);
      let result;
      if (directAudioMode || speechScoringMode === "ai") {
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
      onAttempt?.(result.percent, text, evaluationMethod);
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
            {directAudioMode
              ? unlimitedDiamonds
                ? "AI menilai rekaman langsung; akses Admin tidak memakai diamond."
                : "AI menilai audio langsung tanpa transkripsi browser terlebih dahulu · 3 diamond per penilaian."
              : speechScoringMode === "ai"
                ? `Pencocokan AI memakai ${unlimitedDiamonds ? "akses Admin tanpa diamond" : "1 diamond"}${liveInput ? "" : "; transkripsi audio juga memakai 1 diamond."}`
                : liveInput
                  ? ""
                  : `Pencocokan lokal gratis; transkripsi audio AI memakai ${unlimitedDiamonds ? "akses Admin tanpa diamond" : "1 diamond"}.`}
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
          <div className="listening-direct-mode-picker">
            <button
              type="button"
              className={`text-button listening-direct-mode-toggle ${directAudioMode ? "active" : ""}`}
              aria-pressed={directAudioMode}
              onClick={() => chooseDirectAudioMode(!directAudioMode)}
              disabled={
                processing ||
                recording ||
                requestingMic ||
                recognition.listening
              }
            >
              <AudioLines size={15} />
              {directAudioMode
                ? "Mode penilaian suara langsung aktif · "
                : "Coba penilaian suara langsung · "}
              {unlimitedDiamonds ? "gratis untuk Admin" : "3 diamond"}
            </button>
            {directAudioMode && (
              <small>
                Rekaman dikirim ke server AI untuk dinilai langsung. Browser
                tidak mentranskripsikan audio sebelum pengiriman.
              </small>
            )}
          </div>
          {liveInput && recognition.braveDetected && (
            <div className="speech-browser-warning" role="note">
              <b>Google Chrome diperlukan untuk live transcription.</b>
              Brave dapat menampilkan tombol Web Speech tetapi tidak mencapai
              layanan transkripsinya. Gunakan Google Chrome untuk live
              transcription.
            </div>
          )}
          <div className="shadowing-controls">
            {liveInput ? (
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
                        ? `Nilai dengan AI · ${unlimitedDiamonds ? "gratis untuk Admin" : "1 diamond"}`
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
                      {directAudioMode
                        ? `Nilai audio langsung · ${costLabel}`
                        : speechScoringMode === "ai"
                          ? `Transkripsikan + AI match · ${unlimitedDiamonds ? "gratis untuk Admin" : "2 diamond"}`
                          : `Transkripsikan · ${unlimitedDiamonds ? "gratis untuk Admin" : "1 diamond"}`}{" "}
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
                liveInput
                  ? "Hanya teks naskah dan transkrip yang dibandingkan; audio tidak dikirim."
                  : directAudioMode
                    ? "Audio dikirim langsung ke provider AI setelah persetujuan; browser tidak mentranskripsikannya terlebih dahulu."
                    : "Audio sedang dikirim dan dianalisis. Koneksi lambat bisa membutuhkan waktu."
              }
              compact
              className="shadowing-processing-status"
            />
          )}
          {liveInput ? (
            <div className="transcript-area shadowing-transcript">
              <div className="transcript-label">
                <span>
                  {mobileTranscriptEditable
                    ? "TRANSKRIP LANGSUNG · BISA DIEDIT"
                    : "TRANSKRIP LANGSUNG · READ-ONLY"}
                </span>
                <span>{answer.length} karakter</span>
              </div>
              <textarea
                value={answer}
                readOnly={!mobileTranscriptEditable}
                onFocus={() => {
                  if (mobileTranscriptEditable && recognition.listening)
                    recognition.stop({ discardPendingResults: true });
                }}
                onChange={(event) =>
                  recognition.setTranscript(event.target.value)
                }
                aria-label={
                  mobileTranscriptEditable
                    ? "Transkrip live, bisa diedit atau diisi dengan dikte keyboard"
                    : "Transkrip live, hanya baca"
                }
                placeholder={
                  mobileTranscriptEditable
                    ? "Ketik jawaban atau gunakan mikrofon keyboard untuk dikte…"
                    : recognition.braveDetected
                      ? "Live transcription tidak tersedia di Brave. Gunakan Google Chrome."
                      : recognition.supported
                        ? "Ketuk Mulai bicara, lalu ucapkan paragraf…"
                        : "Browser tidak mendukung Web Speech API. Minta admin mengaktifkan mode rekaman AI."
                }
              />
              <div className="transcript-foot">
                {mobileTranscriptEditable
                  ? "Di HP, gunakan mikrofon keyboard untuk dikte teks. Audio tidak diunggah."
                  : speechScoringMode === "ai"
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
              {directAudioMode
                ? "Audio belum dikirim. Penilaian langsung dimulai hanya setelah kamu menekan tombol nilai dan menyetujui pengiriman."
                : "Audio belum dikirim. Pengiriman hanya terjadi setelah kamu menekan tombol transkripsi dan menyetujuinya."}
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
