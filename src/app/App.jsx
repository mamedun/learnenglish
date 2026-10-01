import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { toast } from "sonner";
import {
  AudioLines,
  BookOpen,
  ChevronRight,
  Flame,
  Gem,
  Home,
  MoreHorizontal,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { initialData } from "../data";
import { DEFAULT_LIVE_TOPIC_ID, getLiveTopic } from "../data/liveTopics";
import { awardXP } from "../gamification";
import { hasCourseAccess } from "../features/courses/courseAccess";
import { buildCourseProgressSummary } from "../features/progress/progressSummary";
import { deleteAllRecordings, exportBackup, importBackup } from "../storage";
import { apiFetch, apiJson, apiUrl, refreshSession } from "../api";
import {
  canCompletePracticeLesson,
  findNextPracticeLesson,
  isPracticeTurnPassed,
  passedPracticeTurnCount,
  practicePoints,
} from "../features/speaking/lessonProgress";
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
import {
  CoursesPage,
  CourseDetailPage,
  ActivityHeader,
} from "../features/courses/CoursePages";
import CoursePurchaseDialog from "../features/courses/CoursePurchaseDialog";
import ModuleLoading from "../components/ModuleLoading";
import ModuleErrorBoundary from "../components/ModuleErrorBoundary";
import ProcessingStatus from "../components/ProcessingStatus";
import { convertRecordingToWav } from "../lib/audio";
import {
  generateKokoroAudio,
  isTtsBusy,
  KOKORO_VOICES,
  preloadKokoro,
  speakKokoro,
} from "../lib/ttsRocks";
import { getSharedTtsAudio, saveSharedTtsAudio } from "../lib/ttsCache";
import {
  encodePcm16Base64,
  getGeminiLiveMessageError,
  parseGeminiLiveMessage,
} from "../lib/geminiLiveProtocol";
import {
  buildLearnerAssessmentTranscript,
  mergeLiveTranscriptText,
} from "../lib/liveTranscript";
import { stripTranscriptSourceLabel, toPlainText } from "../lib/plainText";
import { appRouteFor, parseAppRoute } from "../lib/appRoutes";

const AdminPage = lazy(() => import("../features/admin/AdminPage"));
const ListeningPage = lazy(() => import("../features/listening/ListeningPage"));
const PracticePage = lazy(() => import("../features/speaking/PracticePage"));
const LivePage = lazy(() => import("../features/live/LivePage"));
const ProgressPage = lazy(() => import("../features/progress/ProgressPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));
const ShopPage = lazy(() => import("../features/shop/ShopPage"));

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const route = useMemo(
    () => parseAppRoute(location.pathname),
    [location.pathname],
  );
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
  const activityPathRef = useRef("");
  const activeUnitCourseIdRef = useRef("");
  const [courseList, setCourseList] = useState([]);
  const [courseAds, setCourseAds] = useState([]);
  const [courseCache, setCourseCache] = useState({});
  const progressCourseLoadsRef = useRef(new Set());
  const [progressCatalogLoading, setProgressCatalogLoading] = useState(false);
  const [coursePageLoading, setCoursePageLoading] = useState(false);
  const [coursePageError, setCoursePageError] = useState("");
  const [coursePurchase, setCoursePurchase] = useState(null);
  const [coursePaymentSettings, setCoursePaymentSettings] = useState(null);
  const [coursePurchaseRefreshing, setCoursePurchaseRefreshing] =
    useState(false);
  const [activeUnitId, setActiveUnitId] = useState(null);
  const [selectedListeningId, setSelectedListeningId] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [appConfig, setAppConfig] = useState({
    speech_input_mode: "live_transcribe",
    speech_scoring_mode: "local",
    speech_similarity_threshold: 90,
    ai_provider: "clario",
    free_browser_debug: false,
    courseware_policy: {
      max_record_seconds: 180,
      max_transcript_chars: 3000,
      max_live_seconds: 600,
      max_ai_audio_bytes: 12 * 1024 * 1024,
      cost_live_assessment: 0,
      cost_live_per_minute: 2,
      live_block_minutes: 5,
    },
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
  const [liveTopicId, setLiveTopicId] = useState(DEFAULT_LIVE_TOPIC_ID);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [liveRuntimePolicy, setLiveRuntimePolicy] = useState(null);
  const [liveLines, setLiveLines] = useState([]);
  const [liveStatus, setLiveStatus] = useState("Ready");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveAssessment, setLiveAssessment] = useState(null);
  const [liveAssessmentFailed, setLiveAssessmentFailed] = useState(false);
  const liveWsRef = useRef(null);
  const liveSetupTimerRef = useRef(null);
  const ttsRequestIdRef = useRef(0);
  const ttsAudioRef = useRef(null);
  const liveInputContextRef = useRef(null);
  const liveOutputContextRef = useRef(null);
  const liveStreamRef = useRef(null);
  const liveSourceRef = useRef(null);
  const liveProcessorRef = useRef(null);
  const submitTurnLockRef = useRef(false);
  const liveTranscriptLinesRef = useRef([]);
  const liveCurrentSpeakerRef = useRef(null);
  const livePlayheadRef = useRef(0);
  const liveBillingSessionRef = useRef(null);
  const liveCourseContextRef = useRef(null);
  const liveBillingBlocksRef = useRef(0);
  const liveBillingReservedMinutesRef = useRef(0);
  const liveStartedAtRef = useRef(0);
  const liveBillingReserveLockRef = useRef(false);
  const liveBillingStartedRef = useRef(false);
  const liveEndingRef = useRef(false);
  const recorder = useRef(null);
  const streamRef = useRef(null);
  const chunks = useRef([]);
  const micRequestRef = useRef(null);
  const recordingStartRef = useRef(false);
  const fileInput = useRef(null);
  const audioUrlRef = useRef(null);
  const currentCourseId = route?.courseId || "ielts";
  const currentCoursePayload = courseCache[currentCourseId] || null;
  const activeCatalog = currentCoursePayload?.catalog || catalog;
  const curriculum = activeCatalog?.levels || [];
  const listeningLessons = activeCatalog?.listening || [];
  const currentLiveTopics = activeCatalog?.liveTopics || [];
  const activeLiveTopic =
    currentLiveTopics.find((topic) => topic.id === liveTopicId) ||
    getLiveTopic(liveTopicId);
  const allUnits = useMemo(
    () => curriculum.flatMap((level) => level.units || []),
    [curriculum],
  );
  const activeUnit =
    allUnits.find((unit) => unit.id === activeUnitId) || allUnits[0];
  const maxLiveSeconds = Math.max(
    60,
    Math.min(
      3600,
      Number(appConfig.courseware_policy?.max_live_seconds) || 600,
    ),
  );
  const maxRecordingSeconds = Math.max(
    10,
    Math.min(
      900,
      Number(appConfig.courseware_policy?.max_record_seconds) || 180,
    ),
  );
  const maxTranscriptChars = Math.max(
    100,
    Math.min(
      48000,
      Number(appConfig.courseware_policy?.max_transcript_chars) || 3000,
    ),
  );
  const liveBlockMinutes = Math.max(
    1,
    Math.min(10, Number(appConfig.courseware_policy?.live_block_minutes) || 5),
  );
  const liveCostPerMinute = Math.max(
    0,
    Number(appConfig.courseware_policy?.cost_live_per_minute ?? 2),
  );
  const liveMaxSeconds =
    Number(liveRuntimePolicy?.maxSeconds) || maxLiveSeconds;
  const liveReservedMinutes =
    Number(liveRuntimePolicy?.reservedMinutes) ||
    liveBillingReservedMinutesRef.current ||
    liveBlockMinutes;
  const liveRuntimeBlockMinutes =
    Number(liveRuntimePolicy?.blockMinutes) || liveBlockMinutes;
  const liveRuntimeRate = Number(liveRuntimePolicy?.rate ?? liveCostPerMinute);
  const ttsBusy = isTtsBusy(ttsStatus);
  function applyDiamondBalance(value) {
    const diamonds = Number(value);
    if (!Number.isFinite(diamonds) || diamonds < 0) return;
    const account = useAuthStore.getState().user;
    if (account) setUser({ ...account, diamonds: Math.floor(diamonds) });
  }

  async function loadAccount(account, current = () => true) {
    if (!current()) return;
    setUser(account);
    accountIdRef.current = account.id;
    progressCourseLoadsRef.current.clear();
    setProgressCatalogLoading(false);
    setLoadError("");
    if (account.role === "admin" && account.must_change_password) {
      setDataReady(false);
      return;
    }
    setDataReady(false);
    const [legacyCatalog, progress, config, courseware] = await Promise.all([
      apiJson("catalog"),
      apiJson("progress"),
      apiJson("app-config").catch(() => ({
        settings: {
          speech_input_mode: "live_transcribe",
          speech_scoring_mode: "local",
          speech_similarity_threshold: 90,
          ai_provider: "clario",
          free_browser_debug: false,
          courseware_policy: {},
        },
      })),
      apiJson("courses").catch(() => ({ courses: [], ads: [] })),
    ]);
    if (!current()) return;
    const ieltsCourse = await apiJson("course-data?course_id=ielts").catch(
      () => null,
    );
    if (!current()) return;
    setCourseList(courseware.courses || []);
    setCourseAds(courseware.ads || []);
    setCourseCache(ieltsCourse ? { ielts: ieltsCourse } : {});
    setCatalog(ieltsCourse?.catalog || legacyCatalog);
    setAppConfig({
      speech_input_mode:
        config.settings?.speech_input_mode || "live_transcribe",
      speech_scoring_mode: config.settings?.speech_scoring_mode || "local",
      speech_similarity_threshold:
        Number(config.settings?.speech_similarity_threshold) || 90,
      ai_provider: config.settings?.ai_provider || "clario",
      free_browser_debug:
        account?.role === "admin" &&
        config.settings?.free_browser_debug === true,
      courseware_policy: {
        ...(config.settings?.courseware_policy || {}),
        max_record_seconds:
          Number(config.settings?.courseware_policy?.max_record_seconds) || 180,
        max_transcript_chars:
          Number(config.settings?.courseware_policy?.max_transcript_chars) ||
          3000,
        max_live_seconds:
          Number(config.settings?.courseware_policy?.max_live_seconds) || 600,
        max_ai_audio_bytes:
          Number(config.settings?.courseware_policy?.max_ai_audio_bytes) ||
          12 * 1024 * 1024,
        cost_live_assessment:
          Number(config.settings?.courseware_policy?.cost_live_assessment) || 0,
        cost_live_per_minute: Number(
          config.settings?.courseware_policy?.cost_live_per_minute ?? 2,
        ),
        live_block_minutes:
          Number(config.settings?.courseware_policy?.live_block_minutes) || 5,
      },
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
      listeningAnswers: progress.progress?.listeningAnswers || {},
      listeningResults: progress.progress?.listeningResults || {},
      speakingCompleted: progress.progress?.speakingCompleted || [],
      speakingScores: progress.progress?.speakingScores || {},
      speakingTranscripts: progress.progress?.speakingTranscripts || {},
      courseProgress: progress.progress?.courseProgress || {},
    });
    setDataReady(true);
  }
  async function reloadCatalog() {
    const [legacyCatalog, courseware] = await Promise.all([
      apiJson("catalog"),
      apiJson("courses").catch(() => ({ courses: [], ads: [] })),
    ]);
    const ieltsCourse = await apiJson("course-data?course_id=ielts").catch(
      () => null,
    );
    setCatalog(ieltsCourse?.catalog || legacyCatalog);
    setCourseList(courseware.courses || []);
    setCourseAds(courseware.ads || []);
    progressCourseLoadsRef.current.clear();
    setProgressCatalogLoading(false);
    setCourseCache(ieltsCourse ? { ielts: ieltsCourse } : {});
  }
  async function reloadCourses() {
    const result = await apiJson("courses");
    setCourseList(result.courses || []);
    setCourseAds(result.ads || []);
    return result;
  }
  async function reloadCourseData(courseId) {
    const payload = await apiJson(
      `course-data?course_id=${encodeURIComponent(courseId)}`,
    );
    setCourseCache((previous) => ({ ...previous, [courseId]: payload }));
    if (courseId === "ielts" && payload.catalog) setCatalog(payload.catalog);
    return payload;
  }
  useEffect(() => {
    if (!user || !dataReady || page !== "progress") return;
    const missing = courseList.filter(
      (course) =>
        hasCourseAccess(course) &&
        !courseCache[course.id] &&
        !progressCourseLoadsRef.current.has(course.id),
    );
    if (!missing.length) return;
    const requestUserId = user.id;
    missing.forEach((course) => progressCourseLoadsRef.current.add(course.id));
    setProgressCatalogLoading(true);
    Promise.all(
      missing.map(async (course) => {
        try {
          return [
            course.id,
            await apiJson(
              `course-data?course_id=${encodeURIComponent(course.id)}`,
            ),
          ];
        } catch {
          return [course.id, null];
        }
      }),
    )
      .then((results) => {
        if (accountIdRef.current !== requestUserId) return;
        results.forEach(([courseId, payload]) => {
          if (!payload) progressCourseLoadsRef.current.delete(courseId);
        });
        const loaded = Object.fromEntries(
          results.filter(([, payload]) => payload),
        );
        if (Object.keys(loaded).length)
          setCourseCache((previous) => ({ ...previous, ...loaded }));
      })
      .finally(() => {
        if (accountIdRef.current === requestUserId)
          setProgressCatalogLoading(false);
      });
  }, [page, user?.id, dataReady, courseList, courseCache]);
  function incrementCourseProgress(courseId) {
    const increment = (course) => {
      const progress = course.progress || {};
      const total = Math.max(0, Number(progress.total) || 0);
      const completed = Math.min(
        total,
        Math.max(0, Number(progress.completed) || 0) + 1,
      );
      return {
        ...course,
        progress: {
          ...progress,
          completed,
          total,
          percent: total ? Math.round((completed * 100) / total) : 0,
        },
      };
    };
    setCourseList((previous) =>
      previous.map((course) =>
        course.id === courseId ? increment(course) : course,
      ),
    );
    setCourseCache((previous) => {
      const cached = previous[courseId];
      if (!cached?.course) return previous;
      return {
        ...previous,
        [courseId]: { ...cached, course: increment(cached.course) },
      };
    });
  }
  useEffect(() => {
    if (!user || !dataReady || !route?.courseId) return undefined;
    setPage(route.page);
    if (courseCache[route.courseId]) {
      setCoursePageLoading(false);
      setCoursePageError("");
      return undefined;
    }
    let active = true;
    setCoursePageLoading(true);
    setCoursePageError("");
    apiJson(`course-data?course_id=${encodeURIComponent(route.courseId)}`)
      .then((payload) => {
        if (!active) return;
        setCourseCache((previous) => ({
          ...previous,
          [route.courseId]: payload,
        }));
        if (route.courseId === "ielts" && payload.catalog)
          setCatalog(payload.catalog);
      })
      .catch((error) => {
        if (active)
          setCoursePageError(error.message || "Course tidak dapat dimuat.");
      })
      .finally(() => {
        if (active) setCoursePageLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    route?.courseId,
    route?.page,
    dataReady,
    user?.id,
    courseCache,
    setPage,
    setCatalog,
  ]);
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
            ...(result.settings.courseware_policy
              ? {
                  courseware_policy: {
                    ...current.courseware_policy,
                    ...result.settings.courseware_policy,
                  },
                }
              : {}),
          }));
      } catch {
        // A transient config fetch must not interrupt a speaking lesson.
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshGlobalConfig();
    };
    void refreshGlobalConfig();
    const timer = window.setInterval(refreshGlobalConfig, 30_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
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
    if (!liveOn) return undefined;
    const updateLiveTime = () => {
      const startedAt = liveStartedAtRef.current;
      if (startedAt)
        setLiveSeconds(
          Math.min(liveMaxSeconds, Math.floor((Date.now() - startedAt) / 1000)),
        );
    };
    updateLiveTime();
    const timer = window.setInterval(updateLiveTime, 1e3);
    return () => clearInterval(timer);
  }, [liveOn, liveMaxSeconds]);
  useEffect(() => {
    if (liveOn && liveSeconds >= liveMaxSeconds) {
      toast.info(
        `Sesi Live mencapai batas ${Math.floor(liveMaxSeconds / 60)} menit.`,
      );
      void endLive();
    }
  }, [liveOn, liveSeconds, liveMaxSeconds]);
  useEffect(() => {
    const reservedMinutes =
      liveBillingReservedMinutesRef.current || liveReservedMinutes;
    const maxMinutes = Math.max(1, Math.ceil(liveMaxSeconds / 60));
    const reserveAt = Math.max(0, reservedMinutes * 60 - 60);
    if (
      !liveOn ||
      liveSeconds < reserveAt ||
      reservedMinutes >= maxMinutes ||
      liveBillingReserveLockRef.current
    )
      return;
    const sessionId = liveBillingSessionRef.current;
    if (!sessionId) return;
    liveBillingReserveLockRef.current = true;
    void apiJson("live-billing/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((result) => {
        liveBillingBlocksRef.current =
          Number(result.reserved_blocks) || liveBillingBlocksRef.current + 1;
        liveBillingReservedMinutesRef.current =
          Number(result.reserved_minutes) ||
          reservedMinutes + liveRuntimeBlockMinutes;
        setLiveRuntimePolicy((current) => ({
          ...(current || {}),
          reservedMinutes: liveBillingReservedMinutesRef.current,
        }));
        applyDiamondBalance(result.diamonds);
        setLiveStatus("Connected · next Live block reserved");
      })
      .catch((error) => {
        applyDiamondBalance(error.diamonds);
        toast.error(
          error.message || "Saldo tidak cukup untuk blok Live berikutnya.",
        );
        void endLive();
      })
      .finally(() => {
        liveBillingReserveLockRef.current = false;
      });
  }, [
    liveOn,
    liveSeconds,
    liveMaxSeconds,
    liveReservedMinutes,
    liveRuntimeBlockMinutes,
  ]);
  useEffect(() => {
    const hardLimit = Math.max(
      10,
      Number(appConfig.courseware_policy?.max_record_seconds) || 180,
    );
    const unitLimit = activeUnit?.prepSeconds
      ? Number(activeUnit.responseSeconds || 120)
      : hardLimit;
    if (recording && elapsed >= Math.min(hardLimit, unitLimit)) stopRecording();
  }, [
    recording,
    elapsed,
    activeUnit,
    appConfig.courseware_policy?.max_record_seconds,
  ]);
  useEffect(
    () => () => {
      ttsRequestIdRef.current += 1;
      stopCurrentSpeech();
      if (liveSetupTimerRef.current !== null) {
        clearTimeout(liveSetupTimerRef.current);
        liveSetupTimerRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      liveStreamRef.current?.getTracks().forEach((t) => t.stop());
      const liveWs = liveWsRef.current;
      liveWsRef.current = null;
      liveWs?.close();
      void liveInputContextRef.current?.close();
      void liveOutputContextRef.current?.close();
      liveInputContextRef.current = null;
      liveOutputContextRef.current = null;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );
  useEffect(() => {
    const settleLiveOnExit = () => {
      const sessionId = liveBillingSessionRef.current;
      const token = useAuthStore.getState().accessToken;
      if (!sessionId || !token) return;
      liveBillingSessionRef.current = null;
      void fetch(apiUrl("live-billing/settle"), {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          cancel: !liveBillingStartedRef.current,
        }),
      }).catch(() => {});
    };
    window.addEventListener("pagehide", settleLiveOnExit);
    return () => window.removeEventListener("pagehide", settleLiveOnExit);
  }, []);
  useEffect(() => {
    if (page !== "live" && (liveOn || liveBillingSessionRef.current))
      void endLive();
  }, [page, liveOn]);
  const scopedCourseProgress =
    currentCourseId === "ielts"
      ? data
      : (data.courseProgress || {})[currentCourseId] || {};
  const completed = new Set(scopedCourseProgress.completed || []);
  const totalDone = allUnits.filter((unit) => completed.has(unit.id)).length;
  const allTurns = useMemo(
    () => (data.sessions || []).flatMap((s) => s.turns || []),
    [data.sessions],
  );
  const pct = allUnits.length
    ? Math.round((totalDone / allUnits.length) * 100)
    : 0;
  const hasLearningAccess = Boolean(user);
  useEffect(() => {
    if (!authReady || !dataReady) return;
    if (!route) {
      setPage("home");
      navigate("/home", { replace: true });
      return;
    }
    const routeCourseId = route.courseId || "ielts";
    if (route.courseId && !courseCache[route.courseId]) {
      setPage(route.page);
      return;
    }
    const noteActivity = (modality, unitId = null) => {
      const key = `${routeCourseId}:${modality}:${unitId || ""}`;
      if (activityPathRef.current === key) return;
      activityPathRef.current = key;
      void apiJson("course-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: routeCourseId,
          modality,
          unit_id: unitId,
        }),
      })
        .then(() => {
          setCourseList((previous) =>
            previous.map((course) =>
              course.id === routeCourseId
                ? {
                    ...course,
                    lastModality: modality,
                    lastUnitId: unitId,
                    lastActivityAt: new Date().toISOString(),
                  }
                : course,
            ),
          );
        })
        .catch(() => {});
    };

    if (route.page === "practice") {
      const unit = allUnits.find((item) => item.id === route.unitId);
      if (!unit) {
        navigate(
          route.courseId
            ? appRouteFor("course-detail", { courseId: routeCourseId })
            : "/home",
          { replace: true },
        );
        return;
      }
      if (routeCourseId === "ielts") {
        const firstIncompleteIndex = allUnits.findIndex(
          (item) => !completed.has(item.id),
        );
        const routeUnitIndex = allUnits.findIndex(
          (item) => item.id === unit.id,
        );
        if (
          firstIncompleteIndex >= 0 &&
          routeUnitIndex > firstIncompleteIndex
        ) {
          toast.info("Selesaikan lesson sebelumnya untuk membuka materi ini.");
          navigate(
            appRouteFor("practice", {
              unitId: allUnits[firstIncompleteIndex].id,
            }),
            { replace: true },
          );
          return;
        }
      }
      if (
        activeUnitId !== unit.id ||
        activeUnitCourseIdRef.current !== routeCourseId
      ) {
        activeUnitCourseIdRef.current = routeCourseId;
        setTurns(
          (data.sessions || [])
            .filter(
              (session) =>
                (session.courseId || "ielts") === routeCourseId &&
                session.unitId === unit.id,
            )
            .flatMap((session) => session.turns || []),
        );
        setTranscript("");
        setAudioBlob(null);
        setSessionSaveAudio(null);
        setElapsed(0);
        setShowLessonList(false);
      }
      setActiveUnitId(unit.id);
      noteActivity("ai_lesson", unit.id);
    } else if (route.page === "listening") {
      if (
        route.listeningId &&
        !listeningLessons.some((lesson) => lesson.id === route.listeningId)
      ) {
        navigate(
          route.courseId
            ? appRouteFor("listening", { courseId: routeCourseId })
            : "/listening",
          { replace: true },
        );
        return;
      }
      setSelectedListeningId(route.listeningId || null);
      noteActivity("listening", route.listeningId || null);
    } else if (route.page === "live") {
      setSelectedListeningId(null);
      const topic =
        currentLiveTopics.find((item) => item.id === route.topicId) ||
        currentLiveTopics[0] ||
        getLiveTopic(DEFAULT_LIVE_TOPIC_ID);
      if (topic?.id) setLiveTopicId(topic.id);
      noteActivity("live_lesson", route.topicId || topic?.id || null);
    } else {
      setSelectedListeningId(null);
      activityPathRef.current = "";
      if (route.page === "admin" && user?.role !== "admin") {
        navigate("/home", { replace: true });
        return;
      }
    }

    setPage(route.page);
    if (location.pathname === "/") navigate("/home", { replace: true });
  }, [
    activeUnitId,
    allUnits,
    authReady,
    scopedCourseProgress.completed,
    courseCache,
    currentCourseId,
    currentLiveTopics,
    data.sessions,
    dataReady,
    hasLearningAccess,
    listeningLessons,
    location.pathname,
    navigate,
    route,
    setPage,
    user?.role,
  ]);

  const nav = (p) => {
    if (p === "practice") {
      if (!allUnits.length)
        return toast.info("Belum ada unit AI Lesson yang diterbitkan.");
      const targetUnit =
        allUnits.find((unit) => unit.id === activeUnitId) ||
        allUnits.find((unit) => !completed.has(unit.id)) ||
        allUnits[0];
      const targetPath = appRouteFor("practice", {
        unitId: targetUnit.id,
        courseId: currentCourseId,
      });
      if (location.pathname === targetPath) return;
      startUnit(targetUnit, currentCourseId);
      return;
    }
    const targetPath = appRouteFor(p);
    if (location.pathname === targetPath) return;
    setPage(p);
    navigate(targetPath);
  };
  const startListening = (id, courseId = currentCourseId) => {
    setSelectedListeningId(id || null);
    setPage("listening");
    const targetPath = appRouteFor("listening", { listeningId: id, courseId });
    if (location.pathname !== targetPath) navigate(targetPath);
  };
  const startUnit = (unit, courseId = unit?.courseId || currentCourseId) => {
    if (!unit) return toast.info("Belum ada unit di level ini.");
    if (courseId === "ielts") {
      const units =
        courseId === currentCourseId
          ? allUnits
          : (courseCache[courseId]?.catalog?.levels || []).flatMap(
              (level) => level.units || [],
            );
      const courseProgress =
        courseId === "ielts"
          ? data
          : (data.courseProgress || {})[courseId] || {};
      const courseCompleted = new Set(courseProgress.completed || []);
      const index = units.findIndex((item) => item.id === unit.id);
      const nextIndex = units.findIndex(
        (item) => !courseCompleted.has(item.id),
      );
      if (nextIndex >= 0 && index > nextIndex) {
        toast.info("Selesaikan lesson sebelumnya untuk membuka materi ini.");
        return;
      }
    }
    activeUnitCourseIdRef.current = courseId;
    setActiveUnitId(unit.id);
    setTurns(
      (data.sessions || [])
        .filter(
          (session) =>
            (session.courseId || "ielts") === courseId &&
            session.unitId === unit.id,
        )
        .flatMap((session) => session.turns || []),
    );
    setTranscript("");
    setAudioBlob(null);
    setSessionSaveAudio(null);
    setPage("practice");
    setShowLessonList(false);
    const targetPath = appRouteFor("practice", { unitId: unit.id, courseId });
    if (location.pathname !== targetPath) navigate(targetPath);
  };
  function openCourse(course) {
    if (!course?.id) return;
    setPage("course-detail");
    navigate(appRouteFor("course-detail", { courseId: course.id }));
  }
  function continueCourse(course) {
    if (!course?.id) return;
    const modality = course.lastModality;
    const unitId = course.lastUnitId;
    if (modality === "listening") {
      setSelectedListeningId(unitId || null);
      setPage("listening");
      navigate(
        appRouteFor("listening", {
          courseId: course.id,
          listeningId: unitId || undefined,
        }),
      );
    } else if (modality === "ai_lesson" && unitId) {
      navigate(appRouteFor("practice", { courseId: course.id, unitId }));
    } else if (modality === "live_lesson") {
      const topicId =
        unitId || courseCache[course.id]?.catalog?.liveTopics?.[0]?.id;
      if (topicId) setLiveTopicId(topicId);
      setPage("live");
      navigate(appRouteFor("live", { courseId: course.id, topicId }));
    } else {
      openCourse(course);
    }
  }
  function openCourseActivity(courseId, modality, unitId = null) {
    if (!courseId || !modality) return;
    const payload = courseCache[courseId];
    if (modality === "listening") {
      const lessonId = unitId || payload?.catalog?.listening?.[0]?.id || null;
      setSelectedListeningId(lessonId);
      setPage("listening");
      navigate(
        appRouteFor("listening", {
          courseId,
          listeningId: lessonId || undefined,
        }),
      );
    } else if (modality === "ai_lesson") {
      const units = (payload?.catalog?.levels || []).flatMap(
        (level) => level.units || [],
      );
      const unit = units.find((item) => item.id === unitId) || units[0];
      if (unit) startUnit(unit, courseId);
      else toast.info("Belum ada AI Lesson yang diterbitkan untuk course ini.");
    } else {
      const topicId = unitId || payload?.catalog?.liveTopics?.[0]?.id;
      if (!topicId)
        return toast.info("Belum ada topik Live Lesson yang diterbitkan.");
      setLiveTopicId(topicId);
      setPage("live");
      navigate(appRouteFor("live", { courseId, topicId }));
    }
  }
  async function enrollCourse(course) {
    if (!course?.id) return;
    try {
      await apiJson("course-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: course.id }),
      });
      await Promise.all([reloadCourses(), reloadCourseData(course.id)]);
      toast.success(`Kamu berhasil enroll ke ${course.name}.`);
    } catch (error) {
      toast.error(error.message || "Enrollment gagal diproses.");
    }
  }
  async function purchaseCourse(course) {
    if (!course?.id) return;
    try {
      const [created, history] = await Promise.all([
        apiJson("shop/course-purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course_id: course.id }),
        }),
        apiJson("shop/course-purchases"),
      ]);
      const purchase = created.purchase;
      const latest = (history.purchases || []).find(
        (item) => item.id === purchase.id,
      );
      setCoursePurchase({ ...(latest || {}), ...purchase });
      setCoursePaymentSettings(history.payments || {});
    } catch (error) {
      toast.error(error.message || "Pesanan course tidak dapat dibuat.");
    }
  }
  async function contactCoursePurchase(purchase) {
    try {
      await apiJson(`shop/course-purchases/${purchase.id}/contacted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } catch (error) {
      toast.error(
        error.message || "Status konfirmasi pembayaran tidak tersimpan.",
      );
    }
  }
  async function refreshCoursePurchase() {
    if (!coursePurchase) return;
    setCoursePurchaseRefreshing(true);
    try {
      const history = await apiJson("shop/course-purchases");
      setCoursePaymentSettings(history.payments || {});
      const updated = (history.purchases || []).find(
        (item) => item.id === coursePurchase.id,
      );
      if (!updated) throw new Error("Pesanan tidak ditemukan pada akun ini.");
      setCoursePurchase(updated);
      if (updated.status === "paid") {
        await Promise.all([
          reloadCourses(),
          reloadCourseData(updated.course_id),
        ]);
        toast.success("Pembayaran disetujui; enrollment course sudah aktif.");
      } else toast.info("Pembayaran masih menunggu verifikasi Admin.");
    } catch (error) {
      toast.error(error.message || "Status pembayaran gagal diperbarui.");
    } finally {
      setCoursePurchaseRefreshing(false);
    }
  }
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
  async function submitTurn({ mode = "transcript" } = {}) {
    if (submitTurnLockRef.current) return;
    const practiceCourseId = activeUnit?.courseId || currentCourseId;
    const currentUnitSessions = (data.sessions || []).filter(
      (session) =>
        (session.courseId || "ielts") === practiceCourseId &&
        session.unitId === activeUnit?.id,
    );
    if (!["transcript", "audio"].includes(mode)) {
      toast.error("Pilih metode jawaban yang valid.");
      return;
    }
    submitTurnLockRef.current = true;
    setProcessing(true);
    setProcessingMessage("Memeriksa provider AI global…");

    const stopBeforeSubmit = (message) => {
      submitTurnLockRef.current = false;
      setProcessing(false);
      setProcessingMessage("");
      toast.error(message);
    };
    let currentConfig;
    try {
      const latestConfig = await apiJson("app-config");
      const settings = latestConfig?.settings;
      if (
        !["clario", "free", "gemini", "openrouter"].includes(
          settings?.ai_provider,
        )
      )
        throw new Error("Provider AI global terbaru tidak dapat dipastikan.");
      currentConfig = {
        ...appConfig,
        speech_scoring_mode:
          settings.speech_scoring_mode ||
          appConfig.speech_scoring_mode ||
          "local",
        speech_similarity_threshold:
          Number(
            settings.speech_similarity_threshold ??
              appConfig.speech_similarity_threshold,
          ) || 90,
        ai_provider: settings.ai_provider,
        free_browser_debug:
          user?.role === "admin" && settings.free_browser_debug === true,
      };
      setAppConfig((previous) => ({
        ...previous,
        speech_scoring_mode: currentConfig.speech_scoring_mode,
        speech_similarity_threshold: currentConfig.speech_similarity_threshold,
        ai_provider: currentConfig.ai_provider,
        free_browser_debug: currentConfig.free_browser_debug,
      }));
    } catch (error) {
      stopBeforeSubmit(
        error?.message ||
          "Pengaturan provider AI tidak dapat diperiksa. Coba kirim ulang.",
      );
      return;
    }

    const useServerAudio = mode === "audio";
    const submittedTranscript = stripTranscriptSourceLabel(transcript);
    if (useServerAudio && !audioBlob) {
      stopBeforeSubmit(
        "Rekam jawaban terlebih dahulu, lalu ketuk selesai merekam.",
      );
      return;
    }
    if (!useServerAudio && !submittedTranscript) {
      stopBeforeSubmit(
        "Mulai transkripsi dan ucapkan jawabanmu terlebih dahulu.",
      );
      return;
    }

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
          text:
            currentConfig.ai_provider === "free" &&
            currentConfig.free_browser_debug &&
            user?.role === "admin"
              ? "Rekaman akan dikirim satu kali langsung dari browser Admin ke node Free untuk diagnosis. Debug ini tidak menyimpan hasil maupun arsip audio ke akun atau server PHP."
              : "Rekaman akan dikirim satu kali ke server AI yang dipilih admin untuk transkripsi dan feedback. Audio tidak disimpan oleh endpoint ini. Penyimpanan arsip audio (jika dipilih) adalah persetujuan terpisah.",
          icon: "info",
          showCancelButton: true,
          confirmButtonText: "Setuju & kirim audio",
          cancelButtonText: "Batal",
          confirmButtonColor: "#315c45",
        });
        if (!consent.isConfirmed) return;
        setProcessingMessage("Menyiapkan rekaman untuk dikirim…");

        const audioForAI =
          currentConfig.ai_provider === "free"
            ? audioBlob
            : await convertRecordingToWav(audioBlob);
        const maxAudioBytes =
          Number(appConfig.courseware_policy?.max_ai_audio_bytes) ||
          12 * 1024 * 1024;
        if (audioForAI.size > maxAudioBytes)
          throw new Error(
            `Audio melebihi batas ${(maxAudioBytes / 1024 / 1024).toFixed(0)} MB.`,
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

        if (
          currentConfig.ai_provider === "free" &&
          currentConfig.free_browser_debug &&
          user?.role === "admin"
        ) {
          const debugConsent = await Swal.fire({
            title: "Jalankan debug Free API dari browser?",
            text: "Browser Admin akan menerima API key X-API-Key dan Bearer JWT sementara. Key terlihat di DevTools/Network. Audio dikirim langsung ke node Free, bukan ke PHP. Hasil mentah hanya untuk diagnosis dan tidak disimpan.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Kirim langsung",
            cancelButtonText: "Batal",
            confirmButtonColor: "#9b5b16",
          });
          if (!debugConsent.isConfirmed) return;

          setProcessingMessage("Meminta prompt dan token debug dari PHP…");
          const debugSetupResponse = await apiFetch("free-audio-debug-config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              consent: true,
              task_mode: "response",
              level: activeUnit.level,
              task: activeUnit.prompt,
            }),
          });
          const debugSetup = await debugSetupResponse.json();
          if (!debugSetupResponse.ok)
            throw new Error(
              debugSetup.error || "Konfigurasi debug Free API gagal dibuat.",
            );

          const directForm = new FormData();
          directForm.append("prompt", debugSetup.prompt);
          directForm.append("audio", audioForAI, `audio.${audioExtension}`);
          setProcessingMessage(
            `Mengirim rekaman langsung ke ${debugSetup.node_host || "Free API"}…`,
          );
          const directRequestStarted = performance.now();
          let directResponse;
          try {
            directResponse = await fetch(debugSetup.url, {
              method: "POST",
              headers: debugSetup.headers,
              body: directForm,
            });
          } catch (error) {
            await Swal.fire({
              title: "Browser tidak menerima respons Free API",
              text: `${error?.message || "Network request failed."} Request berhenti setelah ${Math.round(performance.now() - directRequestStarted)} ms. Kemungkinan penyebabnya CORS/preflight pada node provider; browser tidak mengizinkan halaman membaca respons. Tidak ada fallback ke PHP pada mode debug ini.`,
              icon: "warning",
              confirmButtonText: "Tutup",
            });
            return;
          }

          const directBody = await directResponse.text();
          let responseBody = directBody;
          try {
            responseBody = JSON.stringify(JSON.parse(directBody), null, 2);
          } catch {
            // Keep non-JSON bodies visible for gateway/CORS/API diagnostics.
          }
          const responseLimit = 12000;
          const diagnostic = {
            elapsed_ms: Math.round(performance.now() - directRequestStarted),
            http_status: directResponse.status,
            ok: directResponse.ok,
            node: debugSetup.node_host,
            token_expires_at: debugSetup.token_expires_at,
            content_type: directResponse.headers.get("content-type") || "",
            body_truncated: responseBody.length > responseLimit,
            body: responseBody.slice(0, responseLimit),
          };
          const diagnosticText = JSON.stringify(diagnostic, null, 2);
          console.info(
            "Free API direct browser diagnostic response",
            diagnostic,
          );
          await Swal.fire({
            title: `Free API direct response · HTTP ${directResponse.status}`,
            input: "textarea",
            inputValue: diagnosticText,
            inputAttributes: { readonly: true, rows: 20, spellcheck: "false" },
            width: 900,
            confirmButtonText: "Tutup",
          });
          return;
        }

        const form = new FormData();
        form.append("consent", "1");
        form.append("task_mode", "response");
        form.append("level", activeUnit.level);
        form.append("task", activeUnit.prompt);
        form.append("course_id", practiceCourseId);
        form.append("unit_id", activeUnit.id);
        form.append("duration_seconds", String(elapsed));
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
        const responseText = await response.text();
        let payload;
        try {
          payload = JSON.parse(responseText);
        } catch {
          const contentType = response.headers.get("content-type") || "unknown";
          console.error("AI audio assessment returned a non-JSON response", {
            status: response.status,
            contentType,
            bodyLength: responseText.length,
          });
          if ([502, 503, 504].includes(response.status))
            throw new Error(
              `SpeakUp returned an HTML gateway response (HTTP ${response.status}, ${contentType}), not a Free API result. The PHP/API request did not complete normally; check PHP-FPM/origin timeout or server errors.`,
            );
          throw new Error(
            `Assessment server returned a non-JSON response (HTTP ${response.status}, ${contentType}).`,
          );
        }
        applyDiamondBalance(payload?.diamonds);
        if (!response.ok) {
          const details = [payload?.error, payload?.detail]
            .filter((value) => typeof value === "string" && value.trim())
            .map((value) => value.trim().slice(0, 350));
          throw new Error(details.join(" — ") || "Evaluasi audio AI gagal.");
        }
        audioResult = payload.result;
        applyDiamondBalance(payload.diamonds);
        replyObj = audioResult;
      } else {
        setProcessingMessage("Mengirim transkrip ke tutor AI…");
        const response = await apiFetch("chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: practiceCourseId,
            unit_id: activeUnit.id,
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
              currentUnitSessions
                .map((session) => session.summary)
                .filter(Boolean)
                .slice(-1)[0] || "",
            recent_turns: currentUnitSessions
              .flatMap((session) => session.turns || [])
              .slice(-6)
              .map((turn) => ({
                user: stripTranscriptSourceLabel(turn.userText),
                assistant: toPlainText(turn.reply),
              })),
          }),
        });
        setProcessingMessage("Menyiapkan feedback tutor…");
        const payload = await response.json();
        applyDiamondBalance(payload.diamonds);
        if (!response.ok)
          throw new Error(payload.error || "Tutor AI belum tersedia.");
        replyObj = payload.result || payload;
      }

      const spokenText = stripTranscriptSourceLabel(
        useServerAudio
          ? String(audioResult?.transcript || "")
          : submittedTranscript,
      );
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
      const assistantReply =
        toPlainText(replyObj.tutor_reply?.text || "") ||
        "Good job! Tell me more.";
      const assistantSpeech =
        toPlainText(replyObj.tutor_reply?.speech_text || assistantReply, {
          forSpeech: true,
        }) || toPlainText(assistantReply, { forSpeech: true });
      const practiceStars = Math.max(
        1,
        Math.min(5, Number(assessment.practice_stars ?? 3)),
      );
      const pointsEarned = practiceStars >= 4 ? 25 : 0;
      const failedTurnToRetry = turns.at(-1);
      const replacingFailedTurn = Boolean(
        failedTurnToRetry &&
        !isPracticeTurnPassed(
          failedTurnToRetry,
          currentConfig.speech_similarity_threshold,
        ),
      );
      const retrySlot = replacingFailedTurn ? failedTurnToRetry : null;
      const slot = retrySlot
        ? Number(retrySlot.slot) ||
          passedPracticeTurnCount(
            turns.slice(0, -1),
            currentConfig.speech_similarity_threshold,
          ) + 1
        : passedPracticeTurnCount(
            turns,
            currentConfig.speech_similarity_threshold,
          ) + 1;
      const item = {
        id: retrySlot?.id || crypto.randomUUID(),
        slot,
        passed: practiceStars >= 4,
        prompt: retrySlot?.prompt || activeUnit.prompt,
        userText: spokenText,
        transcriptionSource: useServerAudio ? "ai" : "live",
        reply: assistantReply,
        stars: practiceStars,
        pointsEarned,
        similarityPercent: null,
        feedback:
          toPlainText(assessment.one_focus || "") ||
          "Your answer communicated the main idea clearly.",
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
      if (retrySlot?.audioId)
        void apiJson(`audio/${retrySlot.audioId}`, { method: "DELETE" }).catch(
          () => {},
        );
      setTurns((previous) => {
        if (retrySlot && previous.at(-1)?.id === retrySlot.id)
          return [...previous.slice(0, -1), item];
        return [...previous, item];
      });
      setData((previous) => {
        const sessions = [...previous.sessions];
        let replaced = false;
        if (retrySlot) {
          for (let index = sessions.length - 1; index >= 0; index -= 1) {
            if (
              (sessions[index]?.courseId || "ielts") !== practiceCourseId ||
              sessions[index]?.unitId !== activeUnit.id
            )
              continue;
            const storedTurns = sessions[index].turns || [];
            if (storedTurns.at(-1)?.id !== retrySlot.id) continue;
            sessions[index] = {
              ...sessions[index],
              turns: [...storedTurns.slice(0, -1), item],
            };
            replaced = true;
            break;
          }
        }
        if (!replaced) {
          const lastIndex = sessions.length - 1;
          if (
            (sessions[lastIndex]?.courseId || "ielts") === practiceCourseId &&
            sessions[lastIndex]?.unitId === activeUnit.id
          ) {
            sessions[lastIndex] = {
              ...sessions[lastIndex],
              turns: [...(sessions[lastIndex].turns || []), item],
            };
          } else {
            sessions.push({
              id: crypto.randomUUID(),
              ...(practiceCourseId !== "ielts"
                ? { courseId: practiceCourseId }
                : {}),
              unitId: activeUnit.id,
              turns: [item],
            });
          }
        }
        const earned =
          item.pointsEarned > 0
            ? awardXP(previous, item.pointsEarned)
            : previous;
        return { ...earned, sessions };
      });
      setAudioBlob(null);
      setTranscript("");
      if (assistantSpeech) void speak(assistantSpeech);
    } catch (error) {
      toast.error(error.message || "Jawaban belum dapat diproses.");
    } finally {
      submitTurnLockRef.current = false;
      setProcessing(false);
      setProcessingMessage("");
    }
  }
  async function clearPracticeHistory(unitId = activeUnit?.id) {
    if (!unitId) return;
    const archivedAudioIds = new Set(
      [
        ...turns,
        ...(data.sessions || [])
          .filter(
            (session) =>
              (session.courseId || "ielts") === currentCourseId &&
              session.unitId === unitId,
          )
          .flatMap((session) => session.turns || []),
      ]
        .map((turn) => turn.audioId)
        .filter(Boolean),
    );
    const deletions = await Promise.allSettled(
      [...archivedAudioIds].map((id) =>
        apiJson(`audio/${id}`, { method: "DELETE" }),
      ),
    );
    const failedDeletions = deletions.filter(
      (result) => result.status === "rejected",
    ).length;
    setTurns([]);
    setData((previous) => ({
      ...previous,
      sessions: (previous.sessions || []).filter(
        (session) =>
          (session.courseId || "ielts") !== currentCourseId ||
          session.unitId !== unitId,
      ),
    }));
    setAudioBlob(null);
    setTranscript("");
    setSessionSaveAudio(null);
    if (failedDeletions)
      toast.error(
        `Riwayat teks dihapus, tetapi ${failedDeletions} arsip audio gagal dihapus.`,
      );
    else
      toast.success("Riwayat lesson dan arsip audio tersimpan telah dihapus.");
  }
  function finishUnit() {
    const passedCount = passedPracticeTurnCount(
      turns,
      appConfig.speech_similarity_threshold,
    );
    const points = practicePoints(turns, appConfig.speech_similarity_threshold);
    if (!canCompletePracticeLesson(passedCount, points)) {
      const remainingTurns = Math.max(0, 4 - passedCount);
      const remainingPoints = Math.max(0, 100 - points);
      toast.info(
        `Butuh minimal 4 percakapan lulus dan 100 poin untuk selesai. Saat ini ${passedCount} percakapan lulus · ${points}/100 poin${remainingTurns ? ` · ${remainingTurns} percakapan lulus lagi` : ""}${remainingPoints ? ` · ${remainingPoints} poin lagi` : ""}.`,
      );
      return;
    }

    const alreadyCompleted = completed.has(activeUnit.id);
    const practiceCourseId = activeUnit.courseId || currentCourseId;
    if (!alreadyCompleted) {
      setData((previous) => {
        const awarded = awardXP(previous, 25);
        if (practiceCourseId === "ielts")
          return {
            ...awarded,
            completed: Array.from(
              new Set([...(previous.completed || []), activeUnit.id]),
            ),
          };
        const courseProgress = previous.courseProgress || {};
        const current = courseProgress[practiceCourseId] || {};
        return {
          ...awarded,
          courseProgress: {
            ...courseProgress,
            [practiceCourseId]: {
              ...current,
              completed: Array.from(
                new Set([...(current.completed || []), activeUnit.id]),
              ),
            },
          },
        };
      });
      incrementCourseProgress(practiceCourseId);
    }

    const nextLesson = findNextPracticeLesson(allUnits, activeUnit.id);
    if (nextLesson) {
      toast.success(
        alreadyCompleted
          ? "Lesson selesai. Membuka lesson berikutnya."
          : "Pelajaran selesai! +25 XP · membuka lesson berikutnya.",
      );
      navigate(
        appRouteFor("practice", {
          unitId: nextLesson.id,
          courseId: practiceCourseId,
        }),
      );
      return;
    }

    setShowLessonList(true);
    toast.success(
      alreadyCompleted
        ? "Ini lesson terakhir yang tersedia. Daftar lesson tetap terbuka."
        : "Lesson terakhir selesai! +25 XP. Daftar lesson tetap terbuka.",
    );
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

  function speakWithBrowser(
    text,
    requestId,
    fallbackReason = "",
    onPlaybackComplete,
  ) {
    const cleanText = toPlainText(text, { forSpeech: true });
    if (!cleanText) return;
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
    const utterance = new SpeechSynthesisUtterance(cleanText);
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
      if (requestId !== ttsRequestIdRef.current) return;
      setTtsStatus({ phase: "ready", message: "Browser Native siap." });
      onPlaybackComplete?.();
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

  function speakNativeFallback(text, requestId, message, onPlaybackComplete) {
    try {
      speakWithBrowser(text, requestId, message, onPlaybackComplete);
      return true;
    } catch (error) {
      if (requestId === ttsRequestIdRef.current)
        setTtsStatus({ phase: "error", message: error.message });
      toast.error(error.message || "Browser TTS gagal diputar.");
      return false;
    }
  }

  async function speak(text, options = {}) {
    const sourceText = toPlainText(text, { forSpeech: true });
    if (!sourceText) return;
    const requestId = ++ttsRequestIdRef.current;
    stopCurrentSpeech();
    const notifyPlaybackComplete = () => {
      if (
        requestId === ttsRequestIdRef.current &&
        typeof options?.onPlaybackComplete === "function"
      )
        options.onPlaybackComplete();
    };
    const engine = data.settings.tts || "kokoro";
    const cachedMode = data.settings.useCachedVoice !== false;
    const forceKokoro = options?.forceKokoro === true;
    const context = options?.type && options?.item ? options : null;
    const authoredSegments = Array.isArray(context?.item?.ttsSegments)
      ? context.item.ttsSegments.filter((turn) =>
          String(turn?.text || "").trim(),
        )
      : [];
    // A single remaining turn is an in-progress dialog edit, not a complete
    // multi-speaker script; keep speaking the lesson's full prompt instead.
    const segments = authoredSegments.length >= 2 ? authoredSegments : [];
    const spokenText = toPlainText(
      segments.length
        ? segments.map((turn) => String(turn.text).trim()).join(" ")
        : sourceText,
      { forSpeech: true },
    );
    const userVoice = KOKORO_VOICES.some(
      (voice) => voice.id === data.settings.voice,
    )
      ? data.settings.voice
      : "af_heart";

    if (engine === "native") {
      try {
        speakWithBrowser(spokenText, requestId, "", notifyPlaybackComplete);
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
            notifyPlaybackComplete,
          );
          return;
        }
      }
      if (requestId !== ttsRequestIdRef.current) return;
      if (cachedAudio) {
        try {
          await playCachedAudio(cachedAudio, requestId);
          notifyPlaybackComplete();
        } catch {
          if (requestId !== ttsRequestIdRef.current) return;
          toast.info("Audio cache gagal diputar; memakai Browser Native.");
          speakNativeFallback(
            spokenText,
            requestId,
            undefined,
            notifyPlaybackComplete,
          );
        }
        return;
      }
      if (cachedMode) {
        speakNativeFallback(
          spokenText,
          requestId,
          "Audio belum tersedia di shared cache; menggunakan Browser Native.",
          notifyPlaybackComplete,
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
        if (requestId === ttsRequestIdRef.current) {
          await playCachedAudio(audio, requestId);
          notifyPlaybackComplete();
        }
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
            speakWithBrowser(spokenText, requestId, "", notifyPlaybackComplete);
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
      notifyPlaybackComplete();
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
          speakWithBrowser(sourceText, requestId, "", notifyPlaybackComplete);
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
  const liveInstruction = `You are Maya, a patient and encouraging English teacher. You are now role-playing as ${activeLiveTopic.teacherRole}. The learner is ${activeLiveTopic.learnerRole}. Stay in this role and keep the scenario focused on “${activeLiveTopic.label}”: ${activeLiveTopic.situation}

Start the conversation yourself as soon as the session is ready. Do not wait for the learner to speak first and do not ask them to choose a topic. Open warmly with this natural first question: “${activeLiveTopic.opening}” Then let the learner answer and continue the role-play with one concise, relevant open question at a time.

Speak entirely in English. Keep every spoken answer, correction, and explanation in English; never switch to Indonesian or mix languages. If the learner uses an Indonesian word because they are stuck, gently give its English equivalent and invite them to try it in a sentence.

After each learner turn, listen for actual grammar, sentence structure, pronoun choice (for example, I/he/she/they), word choice, and unnatural phrasing. When you notice a meaningful issue, briefly use this helpful pattern: “Instead of saying [the learner’s actual words], it’s better to say [a natural correction].” Give a short, friendly reason when useful, then continue the role-play. Correct the most useful one or two issues in that turn without interrupting the learner or turning the conversation into a lecture. Never invent an error or change the learner’s meaning. If their grammar, pronouns, sentence structure, and phrasing are already good, give specific praise for what they said well and keep the conversation moving.

Because this is live audio, comment on pronunciation or word stress only when a problem is clearly audible. If a sound is clearly mispronounced, kindly say the word naturally, give a short sound hint, and invite a retry. If pronunciation is clear, offer specific praise. Never guess pronunciation from text alone or assign a pronunciation score. Keep replies concise, natural, supportive, and suitable for spoken conversation. Use this response style: ${activeLiveTopic.responseStyle || "Warm, concise, and supportive."} This is practice, not an official IELTS test; do not claim official scores. The session is limited to ${Math.ceil(liveMaxSeconds / 60)} minutes.`;

  function appendLiveTranscriptChunk(who, chunk) {
    const incoming = String(chunk ?? "");
    if (!incoming.trim()) return;
    const lines = liveTranscriptLinesRef.current;
    const last = lines.at(-1);
    let nextLines;
    if (liveCurrentSpeakerRef.current === who && last?.who === who) {
      nextLines = [
        ...lines.slice(0, -1),
        { ...last, text: mergeLiveTranscriptText(last.text, incoming) },
      ];
    } else {
      nextLines = [...lines, { who, text: incoming.trimStart() }];
    }
    liveTranscriptLinesRef.current = nextLines;
    liveCurrentSpeakerRef.current = who;
    setLiveLines(nextLines);
  }

  function finishLiveTranscriptLine(who) {
    if (who == null || liveCurrentSpeakerRef.current === who)
      liveCurrentSpeakerRef.current = null;
  }

  function playLiveAudio(base64) {
    try {
      const raw = atob(base64);
      const pcm = new Int16Array(raw.length / 2);
      for (let i = 0; i < pcm.length; i++) {
        const value = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
        pcm[i] = value >= 32768 ? value - 65536 : value;
      }
      const ctx = liveOutputContextRef.current;
      if (!ctx || !pcm.length) return;
      const audio = ctx.createBuffer(1, pcm.length, 24e3);
      const channel = audio.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
      const source = ctx.createBufferSource();
      source.buffer = audio;
      source.connect(ctx.destination);
      const now = ctx.currentTime;
      livePlayheadRef.current = Math.max(livePlayheadRef.current, now);
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      source.start(livePlayheadRef.current);
      livePlayheadRef.current += audio.duration;
    } catch (error) {
      console.error("Gagal memutar audio respons Gemini Live:", error);
      setLiveStatus("Gemini mengirim audio, tetapi browser gagal memutarnya.");
    }
  }
  function clearLiveSetupTimer() {
    if (liveSetupTimerRef.current !== null) {
      window.clearTimeout(liveSetupTimerRef.current);
      liveSetupTimerRef.current = null;
    }
  }
  function cleanupFailedLiveConnection() {
    clearLiveSetupTimer();
    try {
      liveProcessorRef.current?.disconnect();
    } catch {}
    liveProcessorRef.current = null;
    try {
      liveSourceRef.current?.disconnect();
    } catch {}
    liveSourceRef.current = null;
    liveStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveStreamRef.current = null;
    const ws = liveWsRef.current;
    liveWsRef.current = null;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      try {
        ws.close();
      } catch {}
    }
    const inputContext = liveInputContextRef.current;
    liveInputContextRef.current = null;
    if (inputContext && inputContext.state !== "closed")
      void inputContext.close().catch(() => {});
    const outputContext = liveOutputContextRef.current;
    liveOutputContextRef.current = null;
    if (outputContext && outputContext.state !== "closed")
      void outputContext.close().catch(() => {});
  }
  async function settleLiveBilling(cancel = false) {
    const sessionId = liveBillingSessionRef.current;
    if (!sessionId) return null;
    liveBillingSessionRef.current = null;
    try {
      const result = await apiJson("live-billing/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, cancel }),
      });
      applyDiamondBalance(result.diamonds);
      return result;
    } catch (error) {
      toast.error(
        error.message || "Saldo Live belum dapat diselesaikan. Hubungi admin.",
      );
      return null;
    } finally {
      liveBillingBlocksRef.current = 0;
      liveBillingReservedMinutesRef.current = 0;
      liveBillingStartedRef.current = false;
      liveBillingReserveLockRef.current = false;
      liveStartedAtRef.current = 0;
      setLiveRuntimePolicy(null);
    }
  }
  function failLiveConnection(message) {
    cleanupFailedLiveConnection();
    setLiveOn(false);
    setLiveLoading(false);
    setLiveStatus(message);
    void settleLiveBilling(true);
    toast.error(message);
  }
  function assertLiveStartCurrent() {
    if (
      useLearningStore.getState().page !== "live" ||
      !liveBillingSessionRef.current ||
      liveEndingRef.current
    )
      throw new Error("Live session start cancelled.");
  }
  async function beginLive() {
    if (liveBillingSessionRef.current || liveOn || liveLoading) return;
    try {
      const consent = await Swal.fire({
        title: "Izinkan Live Lesson?",
        text:
          user?.role === "admin"
            ? `Audio mikrofon dikirim langsung dari browser ke Gemini dan tidak diarsipkan oleh SpeakUp. Setelah sesi, hanya transkrip dikirim ke provider global Admin untuk feedback. Akun Admin tidak memakai diamond; sesi dibatasi ${Math.ceil(liveMaxSeconds / 60)} menit.`
            : `Audio mikrofon dikirim langsung dari browser ke Gemini dan tidak diarsipkan oleh SpeakUp. Setelah sesi, hanya transkrip dikirim ke provider global Admin untuk feedback. Biaya ${liveCostPerMinute} diamond per menit; cadangan per blok ${liveBlockMinutes} menit. Batas sesi ${Math.ceil(liveMaxSeconds / 60)} menit.`,
        icon: "info",
        showCancelButton: true,
        confirmButtonText: "Setuju & lanjutkan",
        cancelButtonText: "Batal",
        confirmButtonColor: "#315c45",
      });
      if (!consent.isConfirmed || useLearningStore.getState().page !== "live")
        return;
      setLiveLoading(true);
      liveEndingRef.current = false;
      const billing = await apiJson("live-billing/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: currentCourseId,
          unit_id: activeLiveTopic?.id || null,
        }),
      });
      liveBillingSessionRef.current = billing.session_id;
      liveCourseContextRef.current = {
        courseId: currentCourseId,
        unitId: activeLiveTopic?.id || null,
      };
      liveBillingBlocksRef.current = Number(billing.reserved_blocks) || 1;
      liveBillingReservedMinutesRef.current =
        Number(billing.reserved_minutes) || liveBlockMinutes;
      setLiveRuntimePolicy({
        maxSeconds: Number(billing.max_seconds) || liveMaxSeconds,
        reservedMinutes: liveBillingReservedMinutesRef.current,
        blockMinutes: Number(billing.block_minutes) || liveBlockMinutes,
        rate: Number(billing.cost_per_minute ?? liveCostPerMinute),
      });
      liveBillingStartedRef.current = false;
      applyDiamondBalance(billing.diamonds);
      assertLiveStartCurrent();
      setLiveAssessment(null);
      setLiveAssessmentFailed(false);
      setLiveLines([]);
      liveTranscriptLinesRef.current = [];
      liveCurrentSpeakerRef.current = null;
      livePlayheadRef.current = 0;
      liveStartedAtRef.current = 0;
      setLiveSeconds(0);
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor)
        throw new Error("Browser ini tidak mendukung pemrosesan audio Live.");
      let inputContext;
      try {
        inputContext = new AudioContextCtor({ sampleRate: 16_000 });
      } catch {
        inputContext = new AudioContextCtor();
      }
      liveInputContextRef.current = inputContext;
      const outputContext = new AudioContextCtor();
      liveOutputContextRef.current = outputContext;
      livePlayheadRef.current = 0;
      setLiveStatus("Mengaktifkan perangkat audio…");
      await Promise.all([inputContext.resume(), outputContext.resume()]);
      assertLiveStartCurrent();
      if (inputContext.state !== "running" || outputContext.state !== "running")
        throw new Error(
          "Browser menahan pemrosesan audio. Izinkan audio di tab ini lalu mulai ulang Live.",
        );
      setLiveStatus("Meminta akses mikrofon…");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      liveStreamRef.current = stream;
      assertLiveStartCurrent();
      setLiveStatus("Meminta token sementara…");
      const tokenResp = await apiFetch("live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing_session_id: liveBillingSessionRef.current,
        }),
      });
      const tokenData = await tokenResp.json();
      assertLiveStartCurrent();
      if (!tokenResp.ok)
        throw new Error(
          tokenData?.error || "Token Gemini Live tidak tersedia.",
        );
      if (
        !tokenData ||
        typeof tokenData.token !== "string" ||
        !tokenData.token.trim()
      )
        throw new Error("Server tidak mengembalikan token Gemini Live.");
      const model = String(tokenData.model || "gemini-3.8-live").replace(
        /^models\//,
        "",
      );
      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(tokenData.token)}`,
      );
      ws.binaryType = "arraybuffer";
      liveWsRef.current = ws;
      setLiveStatus("Menghubungkan ke Gemini Live…");
      let setupCompleted = false;
      let currentTurnHasAudio = false;
      liveSetupTimerRef.current = window.setTimeout(() => {
        if (liveWsRef.current !== ws) return;
        failLiveConnection(
          "Gemini Live tidak mengonfirmasi konfigurasi dalam 30 detik. Periksa model dan Gemini API key di Admin, lalu coba lagi.",
        );
      }, 30_000);
      ws.onopen = () => {
        if (liveWsRef.current !== ws) return;
        setLiveStatus("Mengirim konfigurasi ke Gemini Live…");
        try {
          ws.send(
            JSON.stringify({
              setup: {
                model: `models/${model}`,
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: "Kore" },
                    },
                  },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                sessionResumption: {},
                systemInstruction: { parts: [{ text: liveInstruction }] },
              },
            }),
          );
        } catch (error) {
          failLiveConnection(
            error?.message || "Gagal mengirim konfigurasi Gemini Live.",
          );
        }
      };
      ws.onmessage = async (event) => {
        let msg;
        try {
          // Match the working SDK/sample behavior: Live protocol frames may
          // arrive as Blob or ArrayBuffer, not only as text strings.
          msg = await parseGeminiLiveMessage(event.data);
        } catch (error) {
          console.error("Tidak dapat membaca pesan Gemini Live:", error);
          return;
        }
        if (liveWsRef.current !== ws) return;
        const serverError = getGeminiLiveMessageError(msg);
        if (serverError) {
          console.error("Gemini Live menolak sesi:", serverError);
          failLiveConnection(`Gemini Live menolak sesi: ${serverError}`);
          return;
        }
        if (msg.setupComplete && !setupCompleted) {
          setupCompleted = true;
          clearLiveSetupTimer();
          const billingSessionId = liveBillingSessionRef.current;
          if (!billingSessionId) {
            failLiveConnection(
              "Cadangan diamond untuk sesi Live tidak ditemukan.",
            );
            return;
          }
          try {
            await apiJson("live-billing/started", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_id: billingSessionId }),
            });
            if (liveWsRef.current !== ws) return;
            ws.send(
              JSON.stringify({
                clientContent: {
                  turns: [
                    {
                      role: "user",
                      parts: [
                        {
                          text: `Begin the selected role-play now. You are Maya, acting as ${activeLiveTopic.teacherRole}. The learner is ${activeLiveTopic.learnerRole}. Start by greeting them naturally and asking: “${activeLiveTopic.opening}” Do not ask them to choose a different topic.`,
                        },
                      ],
                    },
                  ],
                  turnComplete: true,
                },
              }),
            );
            liveBillingStartedRef.current = true;
            liveStartedAtRef.current = Date.now();
            setLiveStatus("Maya is opening the topic…");
            setLiveOn(true);
            setLiveLoading(false);
          } catch (error) {
            failLiveConnection(
              error.message || "Sesi Live belum dapat ditagihkan.",
            );
            return;
          }
          try {
            const src = inputContext.createMediaStreamSource(stream);
            const proc = inputContext.createScriptProcessor(1024, 1, 1);
            const mute = inputContext.createGain();
            mute.gain.value = 0;
            src.connect(proc);
            proc.connect(mute);
            mute.connect(inputContext.destination);
            let firstFrameSent = false;
            let speechDetected = false;
            const microphoneWatchdog = window.setTimeout(() => {
              if (liveWsRef.current === ws && !firstFrameSent) {
                setLiveStatus("Connected · microphone audio is not flowing");
                toast.error(
                  "Gemini terhubung, tetapi browser belum mengirim audio mikrofon. Periksa izin dan perangkat mikrofon.",
                );
              }
            }, 5000);
            proc.onaudioprocess = (e) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const samples = e.inputBuffer.getChannelData(0);
              const data2 = encodePcm16Base64(samples, inputContext.sampleRate);
              try {
                ws.send(
                  JSON.stringify({
                    realtimeInput: {
                      audio: { data: data2, mimeType: "audio/pcm;rate=16000" },
                    },
                  }),
                );
              } catch (error) {
                failLiveConnection(
                  error?.message || "Audio gagal dikirim ke Gemini Live.",
                );
                return;
              }
              if (!firstFrameSent) {
                firstFrameSent = true;
                window.clearTimeout(microphoneWatchdog);
                setLiveStatus("Connected · microphone stream active");
              }
              if (!speechDetected) {
                let peak = 0;
                for (let i = 0; i < samples.length; i++)
                  peak = Math.max(peak, Math.abs(samples[i]));
                if (peak >= 0.012) {
                  speechDetected = true;
                  setLiveStatus("Voice detected · waiting for Gemini response");
                }
              }
            };
            liveSourceRef.current = src;
            liveProcessorRef.current = proc;
          } catch (error) {
            failLiveConnection(
              error?.message || "Gagal mengaktifkan mikrofon Live.",
            );
            return;
          }
        }
        const c = msg.serverContent;
        if (c) {
          const inputText =
            c.inputTranscription?.text || c.interimInputTranscription?.text;
          if (inputText) {
            appendLiveTranscriptChunk("learner", inputText);
            setLiveStatus("Live · learner speech received");
          }
          if (c.inputTranscription?.finished)
            finishLiveTranscriptLine("learner");
          if (c.outputTranscription?.text) {
            appendLiveTranscriptChunk("coach", c.outputTranscription.text);
            setLiveStatus("Gemini is responding…");
          }
          if (c.outputTranscription?.finished)
            finishLiveTranscriptLine("coach");
          if (c.turnComplete) {
            currentTurnHasAudio = false;
            finishLiveTranscriptLine(null);
            setLiveStatus("Connected · waiting for speech");
          }
          for (const part of c.modelTurn?.parts || []) {
            if (part.inlineData?.data) {
              if (!currentTurnHasAudio) {
                currentTurnHasAudio = true;
                setLiveStatus("Gemini is speaking…");
              }
              playLiveAudio(part.inlineData.data);
            }
          }
        }
      };
      ws.onerror = () => {
        if (liveWsRef.current !== ws) return;
        if (!setupCompleted) {
          failLiveConnection(
            "Koneksi Gemini Live gagal sebelum sesi siap. Periksa model dan Gemini API key di Admin.",
          );
          return;
        }
        setLiveStatus("Connection error");
        toast.error("Koneksi Gemini Live terputus.");
        void endLive();
      };
      ws.onclose = () => {
        if (liveWsRef.current !== ws) return;
        clearLiveSetupTimer();
        if (!setupCompleted) {
          failLiveConnection(
            "Gemini Live menutup koneksi sebelum sesi selesai disiapkan.",
          );
          return;
        }
        setLiveLoading(false);
        setLiveStatus("Disconnected");
        void endLive();
      };
    } catch (e) {
      const cancelled =
        useLearningStore.getState().page !== "live" ||
        e.message === "Live session start cancelled.";
      if (!cancelled) console.error("Gagal memulai Gemini Live:", e);
      applyDiamondBalance(e.diamonds);
      cleanupFailedLiveConnection();
      setLiveOn(false);
      setLiveLoading(false);
      setLiveStatus(cancelled ? "Sesi Live dibatalkan" : "Unavailable");
      void settleLiveBilling(true);
      if (!cancelled) toast.error(e.message || "Gemini Live gagal dimulai.");
    }
  }
  async function assessLiveTranscript(transcript) {
    const liveContext = liveCourseContextRef.current || {};
    const assessmentCourseId = liveContext.courseId || currentCourseId;
    const assessmentUnitId = liveContext.unitId || activeLiveTopic?.id || null;
    const assessmentCourse = courseCache[assessmentCourseId]?.course;
    setLiveLoading(true);
    setLiveAssessmentFailed(false);
    setLiveStatus("Mengirim transkrip untuk feedback sesi…");
    try {
      const response = await apiFetch("live-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: assessmentCourseId,
          unit_id: assessmentUnitId,
          transcript,
          level:
            assessmentCourse?.level || activeLiveTopic?.level || "unspecified",
        }),
      });
      setLiveStatus("Menerima feedback sesi…");
      const responseText = await response.text();
      let payload;
      try {
        payload = JSON.parse(responseText);
      } catch {
        const contentType = response.headers.get("content-type") || "unknown";
        console.error("Live assessment returned a non-JSON response", {
          status: response.status,
          contentType,
          bodyLength: responseText.length,
        });
        if ([502, 503, 504].includes(response.status))
          throw new Error(
            `Hosting gateway returned HTTP ${response.status} before feedback finished. Your transcript is still available; retry feedback without repeating the session.`,
          );
        throw new Error(
          `Feedback server returned an unexpected response (HTTP ${response.status}). You can retry without repeating the session.`,
        );
      }
      if (!response.ok)
        throw new Error(
          `${payload.error || "Feedback gagal dibuat."} You can retry without repeating the session.`,
        );
      if (!payload?.assessment || typeof payload.assessment !== "object")
        throw new Error(
          "Feedback server returned an invalid assessment. You can retry.",
        );
      setLiveAssessment(payload.assessment);
      setLiveStatus("Feedback ready");
      toast.success("Feedback sesi Live siap.");
    } catch (error) {
      setLiveAssessmentFailed(true);
      setLiveStatus("Session ended · feedback unavailable");
      toast.error(error.message || "Transkrip sesi tidak dapat dinilai.");
    } finally {
      setLiveLoading(false);
    }
  }
  function markLiveCourseComplete() {
    const context = liveCourseContextRef.current || {};
    const courseId = context.courseId || currentCourseId;
    const topicId = context.unitId || activeLiveTopic?.id;
    if (!topicId) return;
    setData((previous) => {
      const courseProgress = previous.courseProgress || {};
      const current = courseProgress[courseId] || {};
      const completed = current.liveCompleted || [];
      if (completed.includes(topicId)) return previous;
      return {
        ...previous,
        courseProgress: {
          ...courseProgress,
          [courseId]: { ...current, liveCompleted: [...completed, topicId] },
        },
      };
    });
    const completed =
      (data.courseProgress || {})[courseId]?.liveCompleted || [];
    if (!completed.includes(topicId)) incrementCourseProgress(courseId);
  }
  async function retryLiveAssessment() {
    const transcript = buildLearnerAssessmentTranscript(
      liveTranscriptLinesRef.current,
      maxTranscriptChars,
    );
    if (!transcript) {
      setLiveAssessmentFailed(false);
      toast.info("Belum ada transkrip ucapan untuk dinilai.");
      return;
    }
    await assessLiveTranscript(transcript);
  }
  async function endLive() {
    if (liveEndingRef.current) return;
    liveEndingRef.current = true;
    clearLiveSetupTimer();
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
    const inputContext = liveInputContextRef.current;
    liveInputContextRef.current = null;
    const outputContext = liveOutputContextRef.current;
    liveOutputContextRef.current = null;
    await Promise.all(
      [inputContext, outputContext]
        .filter((context) => context && context.state !== "closed")
        .map((context) => context.close().catch(() => {})),
    );
    setLiveOn(false);
    await settleLiveBilling(false);
    liveEndingRef.current = false;
    const transcript = buildLearnerAssessmentTranscript(
      liveTranscriptLinesRef.current,
      maxTranscriptChars,
    );
    if (!transcript) {
      setLiveStatus("Sesi berakhir");
      setLiveLoading(false);
      toast.info("Sesi ditutup. Belum ada transkrip ucapan untuk dinilai.");
      return;
    }
    markLiveCourseComplete();
    await assessLiveTranscript(transcript);
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
      result.user.role === "admin" && result.user.must_change_password
        ? "Akun admin siap. Ganti password awal sebelum melanjutkan."
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
    progressCourseLoadsRef.current.clear();
    setProgressCatalogLoading(false);
    setCourseList([]);
    setCourseCache({});
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
  if (user.role === "admin" && user.must_change_password)
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
    { id: "courses", label: "Course", icon: BookOpen },
    { id: "progress", label: "Achievement", icon: Sparkles },
    { id: "settings", label: "Settings", icon: Settings },
    ...(user.role === "admin"
      ? [{ id: "admin", label: "Studio Admin", icon: ShieldCheck }]
      : []),
  ];
  const activeMenuPage = [
    "course-detail",
    "listening",
    "practice",
    "live",
  ].includes(page)
    ? "courses"
    : page;
  const pageTitle =
    page === "course-detail"
      ? currentCoursePayload?.course?.name || "Course"
      : page === "listening"
        ? "Listening Lab"
        : page === "practice"
          ? "AI Lesson"
          : page === "live"
            ? "Live Lesson"
            : page === "shop"
              ? "Toko Diamond"
              : menu.find((item) => item.id === page)?.label || "SpeakUp";
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
              className={activeMenuPage === item.id ? "active" : ""}
              onClick={() => nav(item.id)}
              title={item.label}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.id === "live" && <span className="live-tag">BETA</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile-row" onClick={() => nav("settings")}>
            <span className="avatar">
              {user.name?.charAt(0)?.toUpperCase() || "S"}
            </span>
            <span>
              <b>{user.name}</b>
              <small>
                {user.role === "admin" ? "Administrator" : "Learner"}
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
            <button
              className="diamond-pill"
              onClick={() => nav("shop")}
              title={
                user?.unlimited_diamonds
                  ? "Akses Admin unlimited · saldo tidak berkurang"
                  : "Buka Toko Diamond"
              }
              aria-label={
                user?.unlimited_diamonds
                  ? "Akses Admin unlimited; fitur AI tidak memakai diamond"
                  : `Saldo ${Number(user.diamonds || 0)} diamond, buka Toko Diamond`
              }
            >
              <Gem size={16} />{" "}
              {user?.unlimited_diamonds
                ? "∞"
                : Number(user.diamonds || 0).toLocaleString("id-ID")}
            </button>
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
                  courses={courseList}
                  onOpenCourse={openCourse}
                  onContinueCourse={continueCourse}
                  nav={nav}
                />
              )}
              {page === "courses" && (
                <CoursesPage
                  courses={courseList}
                  ads={courseAds}
                  onOpenCourse={openCourse}
                  onContinueCourse={continueCourse}
                />
              )}
              {page === "course-detail" && (
                <CourseDetailPage
                  payload={courseCache[route?.courseId]}
                  loading={coursePageLoading}
                  error={coursePageError}
                  onBack={() => nav("courses")}
                  onEnroll={enrollCourse}
                  onPurchase={purchaseCourse}
                  onOpenActivity={openCourseActivity}
                  onContinue={continueCourse}
                />
              )}
              {page === "listening" && (
                <>
                  {route?.courseId && (
                    <ActivityHeader
                      course={currentCoursePayload?.course}
                      mode="listening"
                      onBack={() =>
                        openCourse(
                          currentCoursePayload?.course || {
                            id: currentCourseId,
                          },
                        )
                      }
                    />
                  )}
                  <ListeningPage
                    courseId={currentCourseId}
                    levels={curriculum}
                    lessons={listeningLessons}
                    initialLessonId={selectedListeningId}
                    onSelectLesson={(id) => startListening(id, currentCourseId)}
                    data={data}
                    setData={setData}
                    speak={speak}
                    ttsStatus={ttsStatus}
                    speechInputMode={appConfig.speech_input_mode}
                    speechScoringMode={appConfig.speech_scoring_mode}
                    maxRecordSeconds={maxRecordingSeconds}
                    maxAiAudioBytes={
                      Number(appConfig.courseware_policy?.max_ai_audio_bytes) ||
                      12 * 1024 * 1024
                    }
                    speechSimilarityThreshold={
                      appConfig.speech_similarity_threshold
                    }
                    aiProvider={appConfig.ai_provider}
                    unlimitedDiamonds={user?.unlimited_diamonds}
                    onDiamondsChanged={applyDiamondBalance}
                    onCourseProgress={incrementCourseProgress}
                  />
                </>
              )}
              {page === "shop" && (
                <ShopPage user={user} onBalanceChange={applyDiamondBalance} />
              )}
              {page === "practice" && activeUnit && (
                <>
                  {route?.courseId && (
                    <ActivityHeader
                      course={currentCoursePayload?.course}
                      mode="ai_lesson"
                      onBack={() =>
                        openCourse(
                          currentCoursePayload?.course || {
                            id: currentCourseId,
                          },
                        )
                      }
                    />
                  )}
                  <PracticePage
                    showBackButton={!route?.courseId}
                    onBack={() =>
                      route?.courseId
                        ? openCourse(
                            currentCoursePayload?.course || {
                              id: currentCourseId,
                            },
                          )
                        : nav("home")
                    }
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
                    clearHistory={clearPracticeHistory}
                    diamonds={user.diamonds}
                    unlimitedDiamonds={user?.unlimited_diamonds}
                    similarityThreshold={appConfig.speech_similarity_threshold}
                    sessionSaveAudio={sessionSaveAudio}
                    resetRecording={resetRecording}
                  />
                </>
              )}
              {page === "live" && (
                <>
                  {route?.courseId && (
                    <ActivityHeader
                      course={currentCoursePayload?.course}
                      mode="live_lesson"
                      onBack={() =>
                        openCourse(
                          currentCoursePayload?.course || {
                            id: currentCourseId,
                          },
                        )
                      }
                    />
                  )}
                  <LivePage
                    courseId={currentCourseId}
                    topics={currentLiveTopics}
                    liveMaxSeconds={liveMaxSeconds}
                    liveBlockMinutes={liveRuntimeBlockMinutes}
                    liveRate={liveRuntimeRate}
                    liveOn={liveOn}
                    liveSeconds={liveSeconds}
                    liveLines={liveLines}
                    liveStatus={liveStatus}
                    liveLoading={liveLoading}
                    liveAssessment={liveAssessment}
                    liveAssessmentFailed={liveAssessmentFailed}
                    diamonds={user.diamonds}
                    unlimitedAccess={user?.unlimited_diamonds}
                    liveTopicId={liveTopicId}
                    liveTopic={activeLiveTopic}
                    onLiveTopicChange={setLiveTopicId}
                    beginLive={beginLive}
                    endLive={endLive}
                    retryLiveAssessment={retryLiveAssessment}
                  />
                </>
              )}
              {page === "progress" && (
                <ProgressPage
                  data={data}
                  courses={courseList}
                  courseCatalogs={courseCache}
                  fallbackCatalog={activeCatalog}
                  progressCatalogLoading={progressCatalogLoading}
                  startUnit={startUnit}
                  startListening={startListening}
                  nav={nav}
                  hasLearningAccess={hasLearningAccess}
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
      {coursePurchase && (
        <CoursePurchaseDialog
          purchase={coursePurchase}
          settings={coursePaymentSettings}
          user={user}
          onClose={() => setCoursePurchase(null)}
          onContact={contactCoursePurchase}
          onRefresh={refreshCoursePurchase}
          refreshing={coursePurchaseRefreshing}
        />
      )}
      <nav className="mobile-nav" aria-label="Menu seluler">
        {menu
          .filter((item) =>
            ["home", "courses", "progress", "settings", "admin"].includes(
              item.id,
            ),
          )
          .map((item) => (
            <button
              key={item.id}
              className={activeMenuPage === item.id ? "active" : ""}
              onClick={() => nav(item.id)}
            >
              <item.icon size={21} />
              {item.label}
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
