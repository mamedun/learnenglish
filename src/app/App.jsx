import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import {
  AudioLines,
  BarChart3,
  ChevronRight,
  Flame,
  Headphones,
  Home,
  Mic,
  MoreHorizontal,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { initialData } from "../data";
import { awardXP } from "../gamification";
import { deleteAllRecordings, exportBackup, importBackup } from "../storage";
import { apiFetch, apiJson, refreshSession } from "../api";
import { useAuthStore } from "../store/authStore";
import { useLearningStore } from "../store/learningStore";
const greet = () => {
  const h = new Date().getHours();
  return h < 11
    ? "Selamat pagi"
    : h < 15
      ? "Selamat siang"
      : h < 18
        ? "Selamat sore"
        : "Selamat malam";
};
import AuthScreen from "../features/auth/AuthScreen";
import PasswordForm from "../features/auth/PasswordForm";
import HomePage from "../features/dashboard/HomePage";
import ModuleLoading from "../components/ModuleLoading";
import ModuleErrorBoundary from "../components/ModuleErrorBoundary";
import ProcessingStatus from "../components/ProcessingStatus";
import { LEVEL_ICONS } from "../features/learning/learningIcons";
import { convertRecordingToWav } from "../lib/audio";
import {
  generateKokoroAudio,
  isTtsBusy,
  KOKORO_VOICES,
  preloadKokoro,
  speakKokoro,
} from "../lib/ttsRocks";
import { getSharedTtsAudio, saveSharedTtsAudio } from "../lib/ttsCache";

const AdminPage = lazy(() => import("../features/admin/AdminPage"));
const ListeningPage = lazy(() => import("../features/listening/ListeningPage"));
const PracticePage = lazy(() => import("../features/speaking/PracticePage"));
const LivePage = lazy(() => import("../features/live/LivePage"));
const ProgressPage = lazy(() => import("../features/progress/ProgressPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));

function App() {
  const page = useLearningStore((s) => s.page);
  const setPage = useLearningStore((s) => s.setPage);
  const catalog = useLearningStore((s) => s.catalog);
  const setCatalog = useLearningStore((s) => s.setCatalog);
  const data = useLearningStore((s) => s.data);
  const setData = useLearningStore((s) => s.setData);
  const syncError = useLearningStore((s) => s.syncError);
  const setSyncError = useLearningStore((s) => s.setSyncError);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const authReady = useAuthStore((s) => s.authReady);
  const setAuthReady = useAuthStore((s) => s.setAuthReady);
  const dataReady = useAuthStore((s) => s.dataReady);
  const setDataReady = useAuthStore((s) => s.setDataReady);
  const loadError = useAuthStore((s) => s.loadError);
  const setLoadError = useAuthStore((s) => s.setLoadError);
  const saveChain = useRef(Promise.resolve());
  const accountIdRef = useRef(null);
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [selectedListeningId, setSelectedListeningId] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [appConfig, setAppConfig] = useState({
    speech_input_mode: "live_transcribe",
    speech_scoring_mode: "local",
    speech_similarity_threshold: 90,
    ai_provider: "clario",
  });
  const [ttsStatus, setTtsStatus] = useState({
    phase: "idle",
    message: "Model belum dimuat.",
  });
  const [turns, setTurns] = useState([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const [operationStatus, setOperationStatus] = useState("");
  const [loadingRecordingId, setLoadingRecordingId] = useState(null);
  const [importingBackup, setImportingBackup] = useState(false);
  const [permission, setPermission] = useState("idle");
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [sessionSaveAudio, setSessionSaveAudio] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showLessonList, setShowLessonList] = useState(false);
  const [liveOn, setLiveOn] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [liveLines, setLiveLines] = useState([]);
  const [liveStatus, setLiveStatus] = useState("Ready");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveAssessment, setLiveAssessment] = useState(null);
  const liveWsRef = useRef(null);
  const ttsRequestIdRef = useRef(0);
  const ttsAudioRef = useRef(null);
  const liveContextRef = useRef(null);
  const liveStreamRef = useRef(null);
  const liveSourceRef = useRef(null);
  const liveProcessorRef = useRef(null);
  const liveTranscriptRef = useRef("");
  const livePlayheadRef = useRef(0);
  const recorder = useRef(null);
  const streamRef = useRef(null);
  const chunks = useRef([]);
  const micRequestRef = useRef(null);
  const recordingStartRef = useRef(false);
  const fileInput = useRef(null);
  const audioUrlRef = useRef(null);
  const curriculum = catalog.levels;
  const listeningLessons = catalog.listening;
  const allUnits = useMemo(
    () => curriculum.flatMap((l) => l.units),
    [curriculum],
  );
  const activeUnit = allUnits.find((u) => u.id === activeUnitId) || allUnits[0];
  const ttsBusy = isTtsBusy(ttsStatus);

  async function loadAccount(account, current = () => true) {
    if (!current()) return;
    setUser(account);
    accountIdRef.current = account.id;
    setLoadError("");
    if (account.must_change_password) {
      setDataReady(false);
      return;
    }
    setDataReady(false);
    const [course, progress, config] = await Promise.all([
      apiJson("catalog"),
      apiJson("progress"),
      apiJson("app-config").catch(() => ({
        settings: {
          speech_input_mode: "live_transcribe",
          speech_scoring_mode: "local",
          speech_similarity_threshold: 90,
          ai_provider: "clario",
        },
      })),
    ]);
    if (!current()) return;
    setCatalog(course);
    setAppConfig({
      speech_input_mode:
        config.settings?.speech_input_mode || "live_transcribe",
      speech_scoring_mode: config.settings?.speech_scoring_mode || "local",
      speech_similarity_threshold:
        Number(config.settings?.speech_similarity_threshold) || 90,
      ai_provider: config.settings?.ai_provider || "clario",
    });
    const savedSettings = (progress.progress || {}).settings || {};
    const settings = { ...initialData.settings, ...savedSettings };
    // Prior releases always stored "native" as a fixed default; migrate that
    // placeholder once to Kokoro, while preserving deliberate choices made in
    // this release and later.
    if (Object.keys(savedSettings).length && !savedSettings.ttsEngineVersion) {
      settings.tts = "kokoro";
      settings.voice = "af_heart";
      settings.ttsCompute = "auto";
      settings.ttsEngineVersion = 1;
    }
    if (!KOKORO_VOICES.some((voice) => voice.id === settings.voice))
      settings.voice = "af_heart";
    settings.useCachedVoice =
      savedSettings.useCachedVoice === false ? false : true;
    setData({
      ...initialData,
      ...(progress.progress || {}),
      settings,
      speakingCompleted: progress.progress?.speakingCompleted || [],
      speakingScores: progress.progress?.speakingScores || {},
    });
    setPage("home");
    setDataReady(true);
  }
  async function reloadCatalog() {
    const course = await apiJson("catalog");
    setCatalog(course);
  }
  function enqueueSave(snapshot, id) {
    const task = saveChain.current
      .catch(() => {})
      .then(async () => {
        if (id !== accountIdRef.current) return;
        await apiJson("progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress: snapshot }),
        });
        setSyncError("");
      });
    saveChain.current = task;
    return task;
  }
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Restore a fresh access JWT from the HttpOnly refresh cookie. Access
        // tokens are intentionally never persisted in localStorage.
        const session = await refreshSession();
        if (session.user) await loadAccount(session.user, () => active);
      } catch (e) {
        if (active && accountIdRef.current && e.status !== 401)
          setLoadError(e.message || "Gagal memuat akun.");
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const onLocked = () => {
      accountIdRef.current = null;
      useAuthStore.getState().clearAuth();
      useLearningStore.getState().resetLearning();
      setTurns([]);
      toast.error("Aplikasi dikunci admin. Akses akun dibatasi.");
    };
    const onExpired = () => {
      accountIdRef.current = null;
      useAuthStore.getState().clearAuth();
      useLearningStore.getState().resetLearning();
      setTurns([]);
      toast.error("Sesi berakhir. Silakan masuk kembali.");
    };
    window.addEventListener("speakup:locked", onLocked);
    window.addEventListener("speakup:session-expired", onExpired);
    return () => {
      window.removeEventListener("speakup:locked", onLocked);
      window.removeEventListener("speakup:session-expired", onExpired);
    };
  }, []);
  useEffect(() => {
    if (!user || !dataReady) return;
    const id = user.id;
    const timer = window.setTimeout(
      () => enqueueSave(data, id).catch((e) => setSyncError(e.message)),
      550,
    );
    return () => clearTimeout(timer);
  }, [data, user, dataReady]);
  useEffect(() => {
    if (!user || !dataReady) return;
    let active = true;
    const refreshGlobalConfig = async () => {
      try {
        const result = await apiJson("app-config");
        if (active && result.settings)
          setAppConfig((current) => ({
            ...current,
            ...(result.settings.speech_input_mode
              ? { speech_input_mode: result.settings.speech_input_mode }
              : {}),
            ...(result.settings.speech_scoring_mode
              ? { speech_scoring_mode: result.settings.speech_scoring_mode }
              : {}),
            ...(result.settings.speech_similarity_threshold !== undefined
              ? {
                  speech_similarity_threshold: Number(
                    result.settings.speech_similarity_threshold,
                  ),
                }
              : {}),
            ...(result.settings.ai_provider
              ? { ai_provider: result.settings.ai_provider }
              : {}),
          }));
      } catch {
        // A transient config fetch must not interrupt a speaking lesson.
      }
    };
    const timer = window.setInterval(refreshGlobalConfig, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id, dataReady]);
  const [, setVoiceVersion] = useState(0);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const s = window.speechSynthesis;
    const refresh = () => setVoiceVersion((v) => v + 1);
    s.addEventListener("voiceschanged", refresh);
    refresh();
    return () => s.removeEventListener("voiceschanged", refresh);
  }, []);
  useEffect(() => {
    let t;
    if (recording) t = window.setInterval(() => setElapsed((s) => s + 1), 1e3);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => {
    let t;
    if (liveOn)
      t = window.setInterval(
        () => setLiveSeconds((s) => Math.min(1200, s + 1)),
        1e3,
      );
    return () => clearInterval(t);
  }, [liveOn]);
  useEffect(() => {
    if (liveOn && liveSeconds >= 1200) {
      toast.info("Sesi Live mencapai batas 20 menit.");
      void endLive();
    }
  }, [liveOn, liveSeconds]);
  useEffect(() => {
    if (
      recording &&
      activeUnit?.prepSeconds &&
      elapsed >= Number(activeUnit.responseSeconds || 120)
    )
      stopRecording();
  }, [recording, elapsed, activeUnit]);
  useEffect(
    () => () => {
      ttsRequestIdRef.current += 1;
      stopCurrentSpeech();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      liveStreamRef.current?.getTracks().forEach((t) => t.stop());
      liveWsRef.current?.close();
      void liveContextRef.current?.close();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );
  const completed = new Set(data.completed || []);
  const totalDone = allUnits.filter((u) => completed.has(u.id)).length;
  const levelProgress = curriculum.map((l) => ({
    ...l,
    done: l.units.filter((u) => completed.has(u.id)).length,
  }));
  const currentLevel =
    levelProgress.find((l) => l.units.some((u) => !completed.has(u.id))) ||
    levelProgress.at(-1);
  const allTurns = useMemo(
    () => (data.sessions || []).flatMap((s) => s.turns || []),
    [data.sessions],
  );
  const pct = allUnits.length
    ? Math.round((totalDone / allUnits.length) * 100)
    : 0;
  const hasPremiumAccess = user?.role === "admin" || user?.plan === "premium";
  const nav = (p) => {
    if (!hasPremiumAccess && ["practice", "live"].includes(p)) {
      toast.info(
        "AI Lesson dan Live Lesson tersedia untuk Premium. Listening tetap gratis.",
      );
      p = "listening";
    }
    if (p === "practice" && !allUnits.length)
      return toast.info("Belum ada unit speaking yang diterbitkan.");
    setPage(p);
  };
  const startListening = (id) => {
    setSelectedListeningId(id || null);
    setPage("listening");
  };
  const startUnit = (unit) => {
    if (!hasPremiumAccess) return nav("practice");
    if (!unit) return toast.info("Belum ada unit di level ini.");
    const index = allUnits.findIndex((x) => x.id === unit.id);
    const nextIndex = allUnits.findIndex((x) => !completed.has(x.id));
    if (nextIndex >= 0 && index > nextIndex) {
      toast.info("Selesaikan lesson sebelumnya untuk membuka materi ini.");
      return;
    }
    setActiveUnitId(unit.id);
    setTurns([]);
    setTranscript("");
    setAudioBlob(null);
    setSessionSaveAudio(null);
    setPage("practice");
    setShowLessonList(false);
  };
  async function requestMic() {
    if (micRequestRef.current) return micRequestRef.current;
    setPermission("requesting");
    const request = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId
            ? {
                deviceId: { exact: deviceId },
                echoCancellation: true,
                noiseSuppression: true,
              }
            : true,
        });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        const devicesFound = await navigator.mediaDevices
          .enumerateDevices()
          .catch(() => []);
        setDevices(
          devicesFound.filter((device) => device.kind === "audioinput"),
        );
        const track = stream.getAudioTracks()[0];
        if (!recorder.current || recorder.current.state === "inactive")
          setDeviceId(track?.getSettings().deviceId || deviceId || "");
        setPermission("granted");
        return stream;
      } catch (error) {
        setPermission(error?.name === "NotAllowedError" ? "denied" : "idle");
        toast.error(
          error?.name === "NotAllowedError"
            ? "Izin mikrofon ditolak. Izinkan mikrofon di browser, lalu coba lagi."
            : error?.name === "NotFoundError" ||
                error?.name === "OverconstrainedError"
              ? "Mikrofon yang dipilih tidak tersedia. Pilih perangkat lain lalu coba lagi."
              : "Mikrofon tidak dapat dibuka. Periksa perangkat, izin browser, dan koneksi HTTPS.",
        );
        return null;
      } finally {
        micRequestRef.current = null;
      }
    })();
    micRequestRef.current = request;
    return request;
  }
  async function startRecording() {
    if (recordingStartRef.current || recording || processing) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error(
        "Perekaman tidak tersedia. Gunakan browser modern melalui HTTPS.",
      );
      return;
    }
    recordingStartRef.current = true;
    try {
      let stream = streamRef.current;
      if (!stream || stream.getAudioTracks()[0]?.readyState !== "live")
        stream = await requestMic();
      if (!stream) return;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const mediaRecorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = mediaRecorder;
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        setAudioBlob(blob.size ? blob : null);
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
      };
      mediaRecorder.onerror = () => {
        setRecording(false);
        setAudioBlob(null);
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        toast.error(
          "Perekaman berhenti karena perangkat mikrofon bermasalah. Pilih ulang mikrofon dan coba lagi.",
        );
      };
      mediaRecorder.start(250);
      setElapsed(0);
      setTranscript("");
      setAudioBlob(null);
      setRecording(true);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setRecording(false);
      toast.error(
        error?.name === "NotAllowedError"
          ? "Izin mikrofon ditolak. Izinkan mikrofon di browser."
          : "Browser gagal memulai perekaman. Pilih ulang mikrofon atau coba Chrome/Edge.",
      );
    } finally {
      recordingStartRef.current = false;
    }
  }
  function stopRecording() {
    const mediaRecorder = recorder.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.stop();
      } catch {
        setRecording(false);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }
    setRecording(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }
  async function submitTurn() {
    const inputMode = appConfig.speech_input_mode || "live_transcribe";
    const useServerAudio = inputMode === "ai_audio";
    const submittedTranscript = transcript.trim();
    if (useServerAudio && !audioBlob) {
      toast.error("Rekam jawaban terlebih dahulu, lalu ketuk selesai merekam.");
      return;
    }
    if (!useServerAudio && !submittedTranscript) {
      toast.error("Mulai transkripsi dan ucapkan jawabanmu terlebih dahulu.");
      return;
    }

    setProcessing(true);
    setProcessingMessage(
      useServerAudio
        ? "Menunggu persetujuan pengiriman audio…"
        : "Mengirim transkrip ke tutor AI…",
    );
    let replyObj = null;
    let audioResult = null;
    let saveThisAudio = Boolean(sessionSaveAudio);
    try {
      if (useServerAudio) {
        const consent = await Swal.fire({
          title: "Kirim audio untuk diproses AI?",
          text: "Rekaman akan dikirim satu kali ke server AI yang dipilih admin untuk transkripsi dan feedback. Audio tidak disimpan oleh endpoint ini. Penyimpanan arsip audio (jika dipilih) adalah persetujuan terpisah.",
          icon: "info",
          showCancelButton: true,
          confirmButtonText: "Setuju & kirim audio",
          cancelButtonText: "Batal",
          confirmButtonColor: "#315c45",
        });
        if (!consent.isConfirmed) return;
        setProcessingMessage("Menyiapkan rekaman untuk dikirim…");

        const audioForAI =
          appConfig.ai_provider === "free"
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
        form.append("task_mode", "response");
        form.append("level", activeUnit.level);
        form.append("task", activeUnit.prompt);
        form.append(
          "audio",
          audioForAI,
          `${crypto.randomUUID()}.${audioExtension}`,
        );
        setProcessingMessage(
          "Mengirim audio untuk transkripsi dan feedback AI…",
        );
        const response = await apiFetch("assess-audio", {
          method: "POST",
          body: form,
        });
        setProcessingMessage("Menerima transkrip dan feedback AI…");
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "Evaluasi audio AI gagal.");
        audioResult = payload.result;
        replyObj = audioResult;
      } else {
        setProcessingMessage("Mengirim transkrip ke tutor AI…");
        const response = await apiFetch("chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: submittedTranscript,
            task: activeUnit.prompt,
            lesson: {
              id: activeUnit.id,
              title: activeUnit.title,
              objective: activeUnit.objective,
              part: activeUnit.part,
              visual_context: activeUnit.imageContext || null,
            },
            level: activeUnit.level,
            memory_summary:
              data.sessions
                .filter((session) => session.unitId === activeUnit.id)
                .map((session) => session.summary)
                .filter(Boolean)
                .slice(-1)[0] || "",
            recent_turns: data.sessions
              .filter((session) => session.unitId === activeUnit.id)
              .flatMap((session) => session.turns || [])
              .slice(-6)
              .map((turn) => ({ user: turn.userText, assistant: turn.reply })),
          }),
        });
        setProcessingMessage("Menyiapkan feedback tutor…");
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error || "Tutor AI belum tersedia.");
        replyObj = payload.result || payload;
      }

      const spokenText = useServerAudio
        ? String(audioResult?.transcript || "").trim()
        : submittedTranscript;
      if (!spokenText || !replyObj) {
        throw new Error(
          "AI belum menghasilkan transkrip. Silakan rekam ulang atau ganti mode input di admin.",
        );
      }

      if (useServerAudio && sessionSaveAudio === null) {
        const choice = await Swal.fire({
          title: "Simpan rekaman ke akun?",
          text: "Ini terpisah dari pengiriman audio untuk evaluasi AI. Rekaman arsip tidak akan dikirim ulang otomatis.",
          input: "radio",
          inputOptions: {
            save: "Simpan audio ke akun server",
            discard: "Jangan simpan audio",
          },
          inputValue: data.settings.saveAudio ? "save" : "discard",
          showCancelButton: true,
          confirmButtonText: "Lanjutkan",
          cancelButtonText: "Lewati",
          confirmButtonColor: "#315c45",
          inputValidator: (value) =>
            !value ? "Pilih salah satu opsi." : undefined,
        });
        saveThisAudio = Boolean(choice.isConfirmed && choice.value === "save");
        setSessionSaveAudio(saveThisAudio);
      }

      let audioId = null;
      if (saveThisAudio && useServerAudio && audioBlob) {
        setProcessingMessage("Mengunggah rekaman untuk disimpan ke akun…");
        const form = new FormData();
        form.append(
          "audio",
          audioBlob,
          `${crypto.randomUUID()}.${audioBlob.type.includes("mp4") ? "m4a" : "webm"}`,
        );
        const upload = await apiFetch("audio", { method: "POST", body: form });
        const result = await upload.json();
        if (upload.ok) audioId = result.audio.id;
        else toast.error(result.error || "Audio gagal disimpan.");
      }

      const assessment = replyObj.assessment || {};
      const criteria = assessment.criteria || {};
      const item = {
        id: crypto.randomUUID(),
        prompt: activeUnit.prompt,
        userText: spokenText,
        transcriptionSource: useServerAudio ? "ai" : "live",
        reply: replyObj.tutor_reply?.text || "Good job! Tell me more.",
        stars: Math.max(1, Math.min(5, Number(assessment.practice_stars ?? 4))),
        feedback:
          assessment.one_focus ||
          "Jawabanmu sudah menyampaikan maksud dengan baik.",
        createdAt: new Date().toISOString(),
        audioSaved: Boolean(audioId),
        audioId,
        estimatedBand: assessment.practice_band_estimate ?? null,
        confidence: assessment.confidence || "low",
        criteria,
        grammar: criteria.grammatical_range_accuracy?.band ?? null,
        context: criteria.fluency_coherence?.band ?? null,
        pronunciation: criteria.pronunciation?.band ?? null,
      };
      setTurns((previous) => [...previous, item]);
      setData((previous) => {
        const sessions = [...previous.sessions];
        const lastIndex = sessions.length - 1;
        if (sessions[lastIndex]?.unitId === activeUnit.id) {
          sessions[lastIndex] = {
            ...sessions[lastIndex],
            turns: [...(sessions[lastIndex].turns || []), item],
          };
        } else {
          sessions.push({
            id: crypto.randomUUID(),
            unitId: activeUnit.id,
            turns: [item],
          });
        }
        return { ...awardXP(previous, 5), sessions };
      });
      setAudioBlob(null);
      setTranscript("");
      if (replyObj.tutor_reply?.speech_text)
        void speak(replyObj.tutor_reply.speech_text);
    } catch (error) {
      toast.error(error.message || "Jawaban belum dapat diproses.");
    } finally {
      setProcessing(false);
      setProcessingMessage("");
    }
  }
  function finishUnit() {
    const avg = turns.length
      ? turns.reduce((a, t) => a + t.stars, 0) / turns.length
      : 0;
    if (avg < 3.5) {
      Swal.fire({
        title: "Sedikit latihan lagi!",
        text: "Coba satu jawaban lagi sebelum menyelesaikan pelajaran. Fokus pada masukan tutor.",
        icon: "info",
        confirmButtonText: "Lanjut latihan",
        confirmButtonColor: "#315c45",
      });
      return;
    }
    if (!completed.has(activeUnit.id)) {
      setData((prev) => ({
        ...awardXP(prev, 25),
        completed: [...prev.completed, activeUnit.id],
      }));
      toast.success("Pelajaran selesai! +25 XP");
    }
    nav("home");
  }
  function stopCurrentSpeech() {
    window.speechSynthesis?.cancel();
    const active = ttsAudioRef.current;
    if (!active) return;
    ttsAudioRef.current = null;
    active.audio.pause();
    active.audio.removeAttribute("src");
    active.audio.load();
    active.finish?.();
  }

  function playCachedAudio(blob, requestId) {
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error = null) => {
        if (settled) return;
        settled = true;
        audio.onended = null;
        audio.onerror = null;
        if (ttsAudioRef.current?.audio === audio) ttsAudioRef.current = null;
        URL.revokeObjectURL(objectUrl);
        if (requestId === ttsRequestIdRef.current) {
          setTtsStatus(
            error
              ? { phase: "error", message: "Audio cache gagal diputar." }
              : {
                  phase: "ready",
                  message: "Audio Kokoro cache selesai diputar.",
                },
          );
        }
        if (error) reject(error);
        else resolve();
      };
      ttsAudioRef.current = { audio, url: objectUrl, finish };
      audio.onended = () => finish();
      audio.onerror = () =>
        finish(new Error("File audio bersama tidak dapat diputar."));
      setTtsStatus({
        phase: "speaking",
        message: "Memutar audio Kokoro dari shared cache…",
      });
      try {
        const playback = audio.play();
        playback?.catch(finish);
      } catch (error) {
        finish(error);
      }
    });
  }

  function speakWithBrowser(text, requestId, fallbackReason = "") {
    const synth = window.speechSynthesis;
    if (!synth) throw new Error("Text-to-speech tidak didukung browser ini.");
    synth.cancel();
    const voice =
      synth
        .getVoices()
        .find((item) => item.name === data.settings.nativeVoice) ||
      synth
        .getVoices()
        .find((item) => item.lang.toLowerCase().startsWith("en"));
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || "en-US";
    utterance.rate = 0.88;
    if (voice) utterance.voice = voice;
    setTtsStatus({
      phase: "speaking",
      message: fallbackReason || "Menyiapkan suara Browser Native…",
    });
    utterance.onstart = () => {
      if (requestId === ttsRequestIdRef.current)
        setTtsStatus({
          phase: "speaking",
          message: fallbackReason || "Membacakan dengan Browser Native…",
        });
    };
    utterance.onend = () => {
      if (requestId === ttsRequestIdRef.current)
        setTtsStatus({ phase: "ready", message: "Browser Native siap." });
    };
    utterance.onerror = (event) => {
      if (requestId !== ttsRequestIdRef.current) return;
      if (event.error === "canceled" || event.error === "interrupted") {
        setTtsStatus({
          phase: "ready",
          message: "Pemutaran suara dihentikan.",
        });
        return;
      }
      setTtsStatus({
        phase: "error",
        message: "Browser Native gagal membacakan teks.",
      });
      toast.error("Browser Native gagal membacakan teks.");
    };
    synth.speak(utterance);
  }

  function speakNativeFallback(text, requestId, message) {
    try {
      speakWithBrowser(text, requestId, message);
      return true;
    } catch (error) {
      if (requestId === ttsRequestIdRef.current)
        setTtsStatus({ phase: "error", message: error.message });
      toast.error(error.message || "Browser TTS gagal diputar.");
      return false;
    }
  }

  async function speak(text, options = {}) {
    const sourceText = String(text || "").trim();
    if (!sourceText) return;
    const requestId = ++ttsRequestIdRef.current;
    stopCurrentSpeech();
    const engine = data.settings.tts || "kokoro";
    const cachedMode = data.settings.useCachedVoice !== false;
    const forceKokoro = options?.forceKokoro === true;
    const context = options?.type && options?.item ? options : null;
    const segments = Array.isArray(context?.item?.ttsSegments)
      ? context.item.ttsSegments.filter((turn) =>
          String(turn?.text || "").trim(),
        )
      : [];
    const spokenText = segments.length
      ? segments.map((turn) => String(turn.text).trim()).join(" ")
      : sourceText;
    const userVoice = KOKORO_VOICES.some(
      (voice) => voice.id === data.settings.voice,
    )
      ? data.settings.voice
      : "af_heart";

    if (engine === "native") {
      try {
        speakWithBrowser(spokenText, requestId);
      } catch (error) {
        setTtsStatus({ phase: "error", message: error.message });
        toast.error(error.message || "Browser TTS gagal diputar.");
      }
      return;
    }

    if (!forceKokoro && context) {
      const item = context.item;
      const voice = cachedMode ? item.defaultVoice || "af_heart" : userVoice;
      let cachedAudio = null;
      setTtsStatus({
        phase: "cache-lookup",
        message: "Memeriksa shared Kokoro cache…",
      });
      try {
        if (segments.length >= 2) {
          cachedAudio = await getSharedTtsAudio(context.type, item, "multi");
          if (!cachedAudio && !cachedMode)
            cachedAudio = await getSharedTtsAudio(context.type, item, voice);
        } else {
          cachedAudio = await getSharedTtsAudio(context.type, item, voice);
        }
      } catch {
        if (requestId !== ttsRequestIdRef.current) return;
        if (cachedMode) {
          speakNativeFallback(
            spokenText,
            requestId,
            "Shared cache tidak tersedia; menggunakan Browser Native.",
          );
          return;
        }
      }
      if (requestId !== ttsRequestIdRef.current) return;
      if (cachedAudio) {
        try {
          await playCachedAudio(cachedAudio, requestId);
        } catch {
          if (requestId !== ttsRequestIdRef.current) return;
          toast.info("Audio cache gagal diputar; memakai Browser Native.");
          speakNativeFallback(spokenText, requestId);
        }
        return;
      }
      if (cachedMode) {
        speakNativeFallback(
          spokenText,
          requestId,
          "Audio belum tersedia di shared cache; menggunakan Browser Native.",
        );
        return;
      }

      try {
        const audio = await generateKokoroAudio(spokenText, {
          voice: userVoice,
          compute: data.settings.ttsCompute || "auto",
          speed: 0.88,
          onStatus: (status) => {
            if (requestId === ttsRequestIdRef.current) setTtsStatus(status);
          },
        });
        if (requestId !== ttsRequestIdRef.current) return;
        setTtsStatus({
          phase: "cache-upload",
          message: "Audio siap; mengunggah ke shared cache…",
        });
        try {
          await saveSharedTtsAudio({
            contentType: context.type,
            item,
            voiceId: userVoice,
            audio,
          });
          if (requestId === ttsRequestIdRef.current)
            setTtsStatus({
              phase: "cache-upload",
              message: "Audio disimpan untuk digunakan bersama.",
            });
        } catch (uploadError) {
          if (requestId === ttsRequestIdRef.current)
            toast.info(
              "Audio diputar lokal, tetapi belum dapat disimpan ke shared cache.",
            );
        }
        if (requestId === ttsRequestIdRef.current)
          await playCachedAudio(audio, requestId);
      } catch (error) {
        if (requestId !== ttsRequestIdRef.current) return;
        setTtsStatus({
          phase: "error",
          message: error.message || "Kokoro gagal membuat audio.",
        });
        if ("speechSynthesis" in window) {
          toast.error(
            "Kokoro belum tersedia. Memakai Browser Native untuk kali ini.",
          );
          try {
            speakWithBrowser(spokenText, requestId);
          } catch {
            toast.error(error.message || "Gagal memutar suara.");
          }
        } else {
          toast.error(error.message || "Gagal memutar suara.");
        }
      }
      return;
    }

    if (!forceKokoro && cachedMode) {
      // Dynamic tutor replies are deliberately not persisted in the shared cache.
      speakNativeFallback(
        sourceText,
        requestId,
        "Balasan tutor tidak disimpan ke cache; menggunakan Browser Native.",
      );
      return;
    }

    setTtsStatus({ phase: "initialize", message: "Menyiapkan Kokoro…" });
    try {
      await speakKokoro(sourceText, {
        voice: userVoice,
        compute: data.settings.ttsCompute || "auto",
        speed: 0.88,
        onStatus: (status) => {
          if (requestId === ttsRequestIdRef.current) setTtsStatus(status);
        },
      });
    } catch (error) {
      if (requestId !== ttsRequestIdRef.current) return;
      setTtsStatus({
        phase: "error",
        message: error.message || "Kokoro gagal dimuat.",
      });
      if ("speechSynthesis" in window) {
        toast.error(
          "Kokoro belum tersedia. Memakai Browser Native untuk kali ini.",
        );
        try {
          speakWithBrowser(sourceText, requestId);
        } catch {
          toast.error(error.message || "Gagal memutar suara.");
        }
      } else {
        toast.error(error.message || "Gagal memutar suara.");
      }
    }
  }

  async function preloadTTS() {
    setTtsStatus({ phase: "initialize", message: "Menyiapkan model Kokoro…" });
    try {
      const device = await preloadKokoro({
        compute: data.settings.ttsCompute || "auto",
        onStatus: setTtsStatus,
      });
      toast.success(
        `Model Kokoro siap (${device === "webgpu" ? "WebGPU" : "WASM"}).`,
      );
    } catch (error) {
      setTtsStatus({
        phase: "error",
        message: error.message || "Model Kokoro gagal dimuat.",
      });
      toast.error(error.message || "Model Kokoro gagal dimuat.");
    }
  }

  function resetRecording() {
    const activeRecorder = recorder.current;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.onstop = null;
      activeRecorder.ondataavailable = null;
      try {
        activeRecorder.stop();
      } catch {
        // The recorder may already have stopped.
      }
    }
    recorder.current = null;
    chunks.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
    setAudioBlob(null);
    setTranscript("");
    setElapsed(0);
  }
  async function playRecording(id) {
    setLoadingRecordingId(id);
    try {
      const response = await apiFetch(`audio/${encodeURIComponent(id)}`);
      if (!response.ok)
        throw new Error("Audio tidak ditemukan atau akses ditolak.");
      const blob = await response.blob();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = URL.createObjectURL(blob);
      await new Audio(audioUrlRef.current).play();
    } catch (e) {
      toast.error(e.message || "Audio gagal diputar.");
    } finally {
      setLoadingRecordingId(null);
    }
  }
  async function runBackupExport(snapshot, includeAudio) {
    setOperationStatus(
      includeAudio
        ? "Mengunduh rekaman untuk dimasukkan ke backup…"
        : "Membuat backup ZIP…",
    );
    try {
      await exportBackup(snapshot, includeAudio);
    } finally {
      setOperationStatus("");
    }
  }
  async function handleImport(file) {
    if (!file) return;
    try {
      const res = await Swal.fire({
        title: "Impor backup?",
        text: "Pilih OK untuk mengganti progres lokal dengan file ini.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Impor & ganti",
        cancelButtonText: "Batal",
        confirmButtonColor: "#315c45",
      });
      if (res.isConfirmed) {
        setImportingBackup(true);
        setOperationStatus("Menunggu sinkronisasi progres…");
        await saveChain.current.catch(() => {});
        setOperationStatus("Mengimpor backup ke akun…");
        const imported = await importBackup(file);
        setData(imported);
        toast.success("Backup berhasil diimpor ke akun server.");
      }
    } catch (e) {
      toast.error(e.message || "File backup tidak valid.");
    } finally {
      setImportingBackup(false);
      setOperationStatus("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function resetData() {
    const res = await Swal.fire({
      title: "Hapus semua progres?",
      text: "Riwayat, progres, dan rekaman server pada akun ini akan dihapus.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus semuanya",
      cancelButtonText: "Batal",
      confirmButtonColor: "#d33",
    });
    if (!res.isConfirmed) return;
    setOperationStatus("Menunggu sinkronisasi progres…");
    try {
      await saveChain.current.catch(() => {});
      setOperationStatus("Menghapus rekaman dan progres akun…");
      await deleteAllRecordings();
      const fresh = structuredClone(initialData);
      setData(fresh);
      setTurns([]);
      toast.success("Data akun di server sudah dihapus.");
    } catch (error) {
      toast.error(error.message || "Gagal menghapus progres.");
    } finally {
      setOperationStatus("");
    }
  }
  const voices =
    typeof speechSynthesis !== "undefined"
      ? speechSynthesis
          .getVoices()
          .filter((v) => v.lang.toLowerCase().startsWith("en"))
      : [];
  const liveInstruction =
    "You are Maya, a supportive English speaking coach. Conduct an IELTS-inspired practice conversation at the learner\u2019s level. Ask one concise follow-up at a time, encourage elaboration, and keep the conversation natural. This is practice, not an official IELTS test. Do not claim official scores. The session is limited to 20 minutes.";
  function pcmBase64(input, fromRate) {
    const ratio = fromRate / 16e3;
    const length = Math.floor(input.length / ratio);
    const bytes = new Uint8Array(length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
      view.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768)
      binary += String.fromCharCode(
        ...bytes.subarray(i, Math.min(i + 32768, bytes.length)),
      );
    return btoa(binary);
  }
  function playLiveAudio(base64) {
    try {
      const raw = atob(base64);
      const pcm = new Int16Array(raw.length / 2);
      for (let i = 0; i < pcm.length; i++) {
        const value = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
        pcm[i] = value >= 32768 ? value - 65536 : value;
      }
      const ctx = liveContextRef.current;
      if (!ctx || !pcm.length) return;
      const audio = ctx.createBuffer(1, pcm.length, 24e3);
      const channel = audio.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
      const source = ctx.createBufferSource();
      source.buffer = audio;
      source.connect(ctx.destination);
      const now = ctx.currentTime;
      livePlayheadRef.current = Math.max(livePlayheadRef.current, now);
      source.start(livePlayheadRef.current);
      livePlayheadRef.current += audio.duration;
    } catch {}
  }
  async function beginLive() {
    try {
      if (!hasPremiumAccess) {
        toast.error("Live Lesson tersedia untuk akun Premium.");
        return;
      }
      const consent = await Swal.fire({
        title: "Izinkan Live Lesson?",
        text: "Audio mikrofon dikirim langsung dari browser ke Gemini selama sesi. Audio tidak diarsipkan oleh SpeakUp. Setelah sesi, transkrip akan dikirim ke AI untuk feedback jika tersedia.",
        icon: "info",
        showCancelButton: true,
        confirmButtonText: "Setuju & lanjutkan",
        cancelButtonText: "Batal",
        confirmButtonColor: "#315c45",
      });
      if (!consent.isConfirmed) return;
      setLiveLoading(true);
      setLiveAssessment(null);
      setLiveLines([]);
      liveTranscriptRef.current = "";
      setLiveSeconds(0);
      setLiveStatus("Meminta akses mikrofon…");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      liveStreamRef.current = stream;
      setLiveStatus("Meminta token sementara…");
      const tokenResp = await apiFetch("live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const tokenData = await tokenResp.json();
      if (!tokenResp.ok)
        throw new Error(tokenData.error || "Token Gemini Live tidak tersedia.");
      const ctx = new AudioContext();
      liveContextRef.current = ctx;
      await ctx.resume();
      const model = String(tokenData.model || "gemini-3.8-live").replace(
        /^models\//,
        "",
      );
      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(tokenData.token)}`,
      );
      liveWsRef.current = ws;
      setLiveStatus("Menghubungkan ke Gemini Live…");
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            setup: {
              model: `models/${model}`,
              generationConfig: { responseModalities: ["AUDIO"] },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              sessionResumption: {},
              systemInstruction: { parts: [{ text: liveInstruction }] },
            },
          }),
        );
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.setupComplete) {
            setLiveStatus("Connected \xB7 speaking");
            setLiveOn(true);
            setLiveLoading(false);
            const src = ctx.createMediaStreamSource(stream);
            const proc = ctx.createScriptProcessor(4096, 1, 1);
            const mute = ctx.createGain();
            mute.gain.value = 0;
            src.connect(proc);
            proc.connect(mute);
            mute.connect(ctx.destination);
            proc.onaudioprocess = (e) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const data2 = pcmBase64(
                e.inputBuffer.getChannelData(0),
                ctx.sampleRate,
              );
              ws.send(
                JSON.stringify({
                  realtimeInput: {
                    audio: { data: data2, mimeType: "audio/pcm;rate=16000" },
                  },
                }),
              );
            };
            liveSourceRef.current = src;
            liveProcessorRef.current = proc;
          }
          const c = msg.serverContent;
          if (c) {
            if (c.inputTranscription?.text) {
              const text = String(c.inputTranscription.text);
              liveTranscriptRef.current += `Learner: ${text}
`;
              setLiveLines((v) => [...v, { who: "learner", text }]);
            }
            if (c.outputTranscription?.text) {
              const text = String(c.outputTranscription.text);
              liveTranscriptRef.current += "\n";
              liveTranscriptRef.current += `Maya: ${text}`;
              setLiveLines((v) => [...v, { who: "coach", text }]);
            }
            for (const part of c.modelTurn?.parts || [])
              if (part.inlineData?.data) playLiveAudio(part.inlineData.data);
          }
        } catch {}
      };
      ws.onerror = () => {
        setLiveLoading(false);
        setLiveStatus("Connection error");
        toast.error(
          "Koneksi Gemini Live gagal. Periksa model dan konfigurasi admin.",
        );
        void endLive();
      };
      ws.onclose = () => {
        if (liveWsRef.current === ws) {
          setLiveLoading(false);
          setLiveStatus("Disconnected");
          void endLive();
        }
      };
    } catch (e) {
      setLiveLoading(false);
      setLiveStatus("Unavailable");
      liveStreamRef.current?.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
      liveProcessorRef.current?.disconnect();
      liveProcessorRef.current = null;
      liveSourceRef.current?.disconnect();
      liveSourceRef.current = null;
      const failedWs = liveWsRef.current;
      liveWsRef.current = null;
      failedWs?.close();
      const failedCtx = liveContextRef.current;
      liveContextRef.current = null;
      if (failedCtx) void failedCtx.close().catch(() => {});
      toast.error(e.message || "Gemini Live gagal dimulai.");
    }
  }
  async function endLive() {
    setLiveLoading(true);
    setLiveStatus("Mengakhiri sesi Live…");
    liveProcessorRef.current?.disconnect();
    liveProcessorRef.current = null;
    liveSourceRef.current?.disconnect();
    liveSourceRef.current = null;
    liveStreamRef.current?.getTracks().forEach((t) => t.stop());
    liveStreamRef.current = null;
    const ws = liveWsRef.current;
    liveWsRef.current = null;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      try {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        ws.close();
      } catch {}
    }
    const ctx = liveContextRef.current;
    liveContextRef.current = null;
    if (ctx) await ctx.close().catch(() => {});
    setLiveOn(false);
    const transcript2 = liveTranscriptRef.current.trim().slice(0, 12e3);
    if (!transcript2) {
      setLiveStatus("Sesi berakhir");
      setLiveLoading(false);
      toast.info("Sesi ditutup. Belum ada transkrip untuk dinilai.");
      return;
    }
    setLiveStatus("Mengirim transkrip untuk feedback sesi…");
    try {
      const r = await apiFetch("live-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript2,
          level: activeUnit.level,
        }),
      });
      setLiveStatus("Menerima feedback sesi…");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Feedback gagal dibuat.");
      setLiveAssessment(j.assessment);
      setLiveStatus("Feedback ready");
      toast.success("Feedback sesi Live siap.");
    } catch (e) {
      setLiveStatus("Session ended \xB7 feedback unavailable");
      toast.error(e.message || "Transkrip sesi tidak dapat dinilai.");
    } finally {
      setLiveLoading(false);
    }
  }
  async function authenticate(mode, payload) {
    const result = await apiJson(mode, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    useAuthStore.getState().setAccessToken(result.access_token);
    await loadAccount(result.user);
    toast.success(
      result.user.must_change_password
        ? "Akun siap. Ganti password awal sebelum melanjutkan."
        : mode === "register"
          ? "Akun berhasil dibuat. Selamat belajar!"
          : "Berhasil masuk. Welcome back!",
    );
  }
  async function logout() {
    if (user && dataReady) {
      try {
        await enqueueSave(data, user.id);
      } catch (error) {
        setSyncError(error.message);
        toast.error(
          "Progres belum tersimpan. Coba keluar lagi saat server pulih.",
        );
        return;
      }
    }
    try {
      await apiJson("logout", { method: "POST" });
    } catch (error) {
      toast.error(
        error.message || "Server belum dapat mengakhiri sesi. Coba lagi.",
      );
      return;
    }
    accountIdRef.current = null;
    useAuthStore.getState().clearAuth();
    useLearningStore.getState().resetLearning();
    setTurns([]);
    toast.success("Kamu sudah logout.");
  }
  if (!authReady)
    return (
      <div className="auth-loading">
        <div className="brand-mark">
          <AudioLines size={22} />
        </div>
        <b>SpeakUp</b>
        <span>Memeriksa sesi...</span>
      </div>
    );
  if (!user) return <AuthScreen onAuth={authenticate} />;
  if (user.must_change_password)
    return <PasswordForm required onLogout={logout} onChanged={loadAccount} />;
  if (!dataReady)
    return (
      <div className="auth-loading">
        <div className="brand-mark">
          <AudioLines size={22} />
        </div>
        <b>SpeakUp</b>
        {loadError ? (
          <>
            <p role="alert">{loadError}</p>
            <button
              className="btn-primary"
              onClick={() =>
                loadAccount(user).catch((e) => setLoadError(e.message))
              }
            >
              Coba lagi <RotateCcw size={16} />
            </button>
            <button className="text-button" onClick={logout}>
              Keluar
            </button>
          </>
        ) : (
          <span>Memuat perjalanan belajarmu...</span>
        )}
      </div>
    );
  const menu = [
    { id: "home", label: "Beranda", icon: Home },
    { id: "listening", label: "Listening Lab", icon: Headphones },
    ...(hasPremiumAccess
      ? [
          { id: "practice", label: "AI Lesson", icon: Mic },
          { id: "live", label: "Live Lesson", icon: AudioLines },
        ]
      : []),
    { id: "progress", label: "Pencapaian", icon: BarChart3 },
    { id: "settings", label: "Pengaturan", icon: Settings },
    ...(user.role === "admin"
      ? [{ id: "admin", label: "Studio Admin", icon: ShieldCheck }]
      : []),
  ];
  const pageTitle = menu.find((item) => item.id === page)?.label || "SpeakUp";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => nav("home")}
          aria-label="SpeakUp Beranda"
        >
          <span className="brand-mark">
            <AudioLines size={25} />
          </span>
          <span>
            <b>
              speak<span>up</span>
            </b>
            <small>ENGLISH ADVENTURE</small>
          </span>
        </button>
        <div className="sidebar-divider" />
        <div className="side-label">MENU UTAMA</div>
        <nav className="side-nav" aria-label="Menu utama">
          {menu.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => nav(item.id)}
              title={item.label}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.id === "live" && <span className="live-tag">BETA</span>}
            </button>
          ))}
        </nav>
        {hasPremiumAccess && (
          <div className="sidebar-course">
            <div className="side-label">JALUR SPEAKING</div>
            <div className="level-list">
              {curriculum.map((l, i) => (
                <button
                  key={l.id}
                  className="level-item"
                  onClick={() =>
                    startUnit(
                      l.units.find((u) => !completed.has(u.id)) || l.units[0],
                    )
                  }
                  disabled={!l.units.length}
                >
                  <span className="level-dot" style={{ background: l.color }}>
                    {(() => {
                      const Icon = LEVEL_ICONS[i] || Sparkles;
                      return <Icon size={19} />;
                    })()}
                  </span>
                  <span>
                    <b>
                      {l.id} · {l.label}
                    </b>
                    <small>
                      {l.units.filter((u) => completed.has(u.id)).length}/
                      {l.units.length} lesson
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </div>
        )}
        {!hasPremiumAccess && (
          <div className="sidebar-premium">
            <span>
              <Sparkles size={25} />
            </span>
            <b>Your adventure starts here!</b>
            <p>
              Listening selalu gratis. AI & Live Lesson terbuka untuk akun
              Premium.
            </p>
          </div>
        )}
        <div className="sidebar-bottom">
          <button className="profile-row" onClick={() => nav("settings")}>
            <span className="avatar">
              {user.name?.charAt(0)?.toUpperCase() || "S"}
            </span>
            <span>
              <b>{user.name}</b>
              <small>
                {user.role === "admin"
                  ? "Administrator"
                  : user.plan === "premium"
                    ? "Premium learner"
                    : "Regular learner"}
              </small>
            </span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => nav("home")}>
            <span className="brand-mark">
              <AudioLines size={20} />
            </span>
            <b>
              speak<span>up</span>
            </b>
          </button>
          <div className="breadcrumb">
            Ruang belajar <ChevronRight size={16} />
            <b>{pageTitle}</b>
          </div>
          <div className="top-actions">
            <span className="xp-pill">
              <Zap size={16} /> {data.xp} XP
            </span>
            <span className="streak-pill">
              <Flame size={17} fill="currentColor" /> {data.streak || 0} hari
            </span>
            <button
              className="icon-btn"
              onClick={() => nav("settings")}
              aria-label="Pengaturan"
            >
              <Settings size={21} />
            </button>
          </div>
        </header>
        {syncError && (
          <div className="sync-banner" role="alert">
            Progres belum tersimpan: {syncError}. Periksa koneksi dan tetap di
            halaman ini hingga sinkron.
          </div>
        )}
        <div className="page-content">
          {processing ? (
            <ProcessingStatus
              message={processingMessage || "Memproses jawaban…"}
              detail="Permintaan sedang diproses. Koneksi lambat bisa membutuhkan waktu lebih lama."
              className="processing-status-global"
            />
          ) : ttsBusy ? (
            <ProcessingStatus
              message={ttsStatus.message || "Menyiapkan audio…"}
              progress={ttsStatus.progress}
              detail={
                ttsStatus.phase === "download"
                  ? "Unduhan awal model sekitar 82 MB. Model akan tersimpan di perangkat untuk pemutaran berikutnya."
                  : ttsStatus.phase === "load-model" ||
                      ttsStatus.phase === "cache-hit"
                    ? "Model sedang dimuat di perangkat sebelum suara mulai diputar."
                    : ttsStatus.phase === "speaking"
                      ? "Suara sedang dibuat dan diputar di perangkat."
                      : "Menyiapkan mesin suara. Proses pertama kali bisa memerlukan waktu."
              }
              className="processing-status-global"
            />
          ) : liveLoading ? (
            <ProcessingStatus
              message={liveStatus || "Menghubungkan ke Gemini Live…"}
              detail="Menyiapkan mikrofon, koneksi, atau feedback sesi."
              className="processing-status-global"
            />
          ) : loadingRecordingId ? (
            <ProcessingStatus
              message="Memuat rekaman audio…"
              detail="Audio sedang diambil dari akunmu."
              className="processing-status-global"
            />
          ) : permission === "requesting" ? (
            <ProcessingStatus
              message="Meminta akses mikrofon…"
              detail="Pilih Izinkan pada dialog browser jika diminta."
              className="processing-status-global"
            />
          ) : operationStatus ? (
            <ProcessingStatus
              message={operationStatus}
              detail="Menunggu proses selesai; jangan tutup halaman ini."
              className="processing-status-global"
            />
          ) : null}
          <ModuleErrorBoundary module={page}>
            <Suspense fallback={<ModuleLoading label={pageTitle} />}>
              {page === "home" && (
                <HomePage
                  greet={greet()}
                  userName={user.name}
                  data={data}
                  pct={pct}
                  totalDone={totalDone}
                  currentLevel={currentLevel}
                  completed={completed}
                  startUnit={startUnit}
                  nav={nav}
                  allUnits={allUnits}
                  curriculum={curriculum}
                  listeningLessons={listeningLessons}
                  hasPremiumAccess={hasPremiumAccess}
                  startListening={startListening}
                />
              )}
              {page === "listening" && (
                <ListeningPage
                  levels={curriculum}
                  lessons={listeningLessons}
                  initialLessonId={selectedListeningId}
                  data={data}
                  setData={setData}
                  speak={speak}
                  ttsStatus={ttsStatus}
                  speechInputMode={appConfig.speech_input_mode}
                  speechScoringMode={appConfig.speech_scoring_mode}
                  speechSimilarityThreshold={
                    appConfig.speech_similarity_threshold
                  }
                  aiProvider={appConfig.ai_provider}
                />
              )}
              {page === "practice" && activeUnit && (
                <PracticePage
                  onBack={() => nav("home")}
                  unit={activeUnit}
                  allUnits={allUnits}
                  turns={turns}
                  transcript={transcript}
                  setTranscript={setTranscript}
                  recording={recording}
                  processing={processing}
                  processingMessage={processingMessage}
                  permission={permission}
                  devices={devices}
                  deviceId={deviceId}
                  changeDevice={(id) => {
                    if (
                      recording ||
                      recordingStartRef.current ||
                      micRequestRef.current
                    )
                      return;
                    streamRef.current
                      ?.getTracks()
                      .forEach((track) => track.stop());
                    streamRef.current = null;
                    setDeviceId(id);
                    setPermission("idle");
                    setAudioBlob(null);
                    setTranscript("");
                    setElapsed(0);
                  }}
                  elapsed={elapsed}
                  audioBlob={audioBlob}
                  showLessonList={showLessonList}
                  setShowLessonList={setShowLessonList}
                  startUnit={startUnit}
                  startRecording={startRecording}
                  stopRecording={stopRecording}
                  requestMic={requestMic}
                  submitTurn={submitTurn}
                  finishUnit={finishUnit}
                  speak={speak}
                  ttsStatus={ttsStatus}
                  playRecording={playRecording}
                  loadingRecordingId={loadingRecordingId}
                  completed={completed}
                  sessionSaveAudio={sessionSaveAudio}
                  speechInputMode={appConfig.speech_input_mode}
                  resetRecording={resetRecording}
                />
              )}
              {page === "live" && (
                <LivePage
                  liveOn={liveOn}
                  liveSeconds={liveSeconds}
                  liveLines={liveLines}
                  liveStatus={liveStatus}
                  liveLoading={liveLoading}
                  liveAssessment={liveAssessment}
                  beginLive={beginLive}
                  endLive={endLive}
                />
              )}
              {page === "progress" && (
                <ProgressPage
                  data={data}
                  pct={pct}
                  totalDone={totalDone}
                  allTurns={allTurns}
                  startUnit={startUnit}
                  allUnits={allUnits}
                  curriculum={curriculum}
                  nav={nav}
                  hasPremiumAccess={hasPremiumAccess}
                  listeningLessons={listeningLessons}
                />
              )}
              {page === "settings" && (
                <SettingsPage
                  data={data}
                  setData={setData}
                  voices={voices}
                  fileInput={fileInput}
                  resetData={resetData}
                  exportBackup={runBackupExport}
                  importingBackup={importingBackup}
                  speak={speak}
                  preloadTTS={preloadTTS}
                  ttsStatus={ttsStatus}
                  user={user}
                  onLogout={logout}
                  onAdmin={() => nav("admin")}
                  onPasswordChanged={setUser}
                />
              )}
              {page === "admin" && user.role === "admin" && (
                <AdminPage
                  user={user}
                  onCatalogChange={reloadCatalog}
                  onSpeechModeChange={(mode) =>
                    setAppConfig((current) => ({
                      ...current,
                      speech_input_mode: mode,
                    }))
                  }
                  onSpeechScoringModeChange={(mode) =>
                    setAppConfig((current) => ({
                      ...current,
                      speech_scoring_mode: mode,
                    }))
                  }
                  onSpeechSimilarityThresholdChange={(threshold) =>
                    setAppConfig((current) => ({
                      ...current,
                      speech_similarity_threshold: threshold,
                    }))
                  }
                  onAIProviderChange={(provider) =>
                    setAppConfig((current) => ({
                      ...current,
                      ai_provider: provider,
                    }))
                  }
                />
              )}
            </Suspense>
          </ModuleErrorBoundary>
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Menu seluler">
        {menu
          .filter((item) =>
            ["home", "listening", "practice", "progress", "settings"].includes(
              item.id,
            ),
          )
          .map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => nav(item.id)}
            >
              <item.icon size={21} />
              {item.label === "Listening Lab"
                ? "Listening"
                : item.label === "Pencapaian"
                  ? "Progres"
                  : item.label}
            </button>
          ))}
      </nav>
      <input
        ref={fileInput}
        type="file"
        accept=".zip"
        hidden
        onChange={(e) => handleImport(e.target.files?.[0])}
      />
    </div>
  );
}

export default App;
