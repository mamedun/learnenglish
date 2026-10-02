import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpWideNarrow,
  AudioLines,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileUp,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { apiJson } from "../../api";
import { getSharedTtsAudio } from "../../lib/ttsCache";
import { toast } from "sonner";
import CourseContentEditor from "./CourseContentEditor";
import SharedTtsCacheGenerator from "./SharedTtsCacheGenerator";
import "./CourseStudio.css";

const NEW_COURSE = {
  id: "",
  name: "",
  description: "",
  posterUrl: "",
  bannerUrl: "",
  status: "draft",
  price: 0,
  color: "#F56B45",
  label: "",
  level: "",
  sortOrder: 0,
  enableListening: true,
  enableAiLesson: true,
  enableLiveLesson: true,
  progressionMode: "parallel",
  listeningProgressionMode: "parallel",
  aiLessonProgressionMode: "parallel",
};
const MODE_LABEL = {
  listening: "Listening",
  ai_lesson: "AI Lesson",
  live_lesson: "Live Lesson",
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const safeSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const categoryTemplate = (modality, index) => ({
  id: `${modality.replace("_lesson", "")}-group-${index + 1}`,
  name: `Kategori ${index + 1}`,
  label: "",
  guide: "",
  color: "#F56B45",
  sortOrder: index,
});
const unitTemplate = (modality, index, categoryId) => ({
  id: `${modality.replace("_lesson", "")}-unit-${index + 1}`,
  categoryId,
  title: `${modality === "live_lesson" ? "Topik" : "Materi"} ${index + 1}`,
  subtitle: "",
  masterPrompt: "",
  mediaUrl: "",
  sortOrder: index,
  published: true,
  content:
    modality === "listening"
      ? {
          objective: "",
          script: "",
          defaultVoice: "af_heart",
          questions: [
            {
              prompt: "Pertanyaan baru",
              options: ["Pilihan A", "Pilihan B"],
              answer: 0,
              explain: "Penjelasan jawaban",
            },
          ],
          ttsSegments: [],
        }
      : modality === "ai_lesson"
        ? {
            prompt:
              "Describe a topic that is important to you. Explain why it matters and give an example.",
            objective: "",
            part: "",
            imageContext: "",
            defaultVoice: "af_heart",
            ttsSegments: [],
          }
        : {
            teacherRole: "Teacher",
            learnerRole: "Learner",
            situation: "",
            opening: "Hello! What would you like to talk about?",
            responseStyle: "Warm, concise, and supportive.",
          },
});
function uniqueDraftId(base, records = []) {
  const used = new Set(
    records.map((record) =>
      String(typeof record === "string" ? record : record?.id || ""),
    ),
  );
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
function orderUnits(modality, units = []) {
  return modality === "live_lesson"
    ? [...units].sort(
        (a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0),
      )
    : units;
}
function unitAudioContentChanged(modality, currentContent, savedContent) {
  if (!savedContent) return true;
  if (modality !== "listening" && modality !== "ai_lesson") return false;
  const sourceField = modality === "ai_lesson" ? "prompt" : "script";
  const currentSegments = Array.isArray(currentContent?.ttsSegments)
    ? currentContent.ttsSegments
    : [];
  const savedSegments = Array.isArray(savedContent?.ttsSegments)
    ? savedContent.ttsSegments
    : [];
  return (
    currentContent?.[sourceField] !== savedContent?.[sourceField] ||
    (currentContent?.defaultVoice || "af_heart") !==
      (savedContent?.defaultVoice || "af_heart") ||
    JSON.stringify(currentSegments) !== JSON.stringify(savedSegments)
  );
}
function mediaKind(url = "") {
  const value = String(url).trim();
  if (/youtube\.com|youtu\.be/i.test(value)) return "youtube";
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(value)) return "video";
  if (
    /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(value) ||
    value.startsWith("data:image/")
  )
    return "image";
  if (value) return "external";
  return "empty";
}
function youtubeEmbed(url = "") {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be"))
      return `https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`;
    const id =
      parsed.searchParams.get("v") ||
      parsed.pathname.split("/").filter(Boolean).at(-1);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
  } catch {
    return "";
  }
}

function CourseStudioAudioPreview({
  contentType,
  item,
  cacheStatus,
  cacheStatusLoading,
  cacheStatusError,
  sourceChanged,
  disabled,
  onCacheMissing,
}) {
  const audioRef = useRef(null);
  const audioUrlRef = useRef("");
  const previewRequestRef = useRef(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cacheAvailable =
    cacheStatus?.available === true &&
    !cacheStatusLoading &&
    !cacheStatusError &&
    !sourceChanged;

  function clearPreview() {
    previewRequestRef.current += 1;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = "";
    setAudioUrl("");
    setLoading(false);
  }

  useEffect(() => {
    if (sourceChanged) {
      clearPreview();
      setError("");
    }
  }, [item?.courseId, item?.id, item?.ttsRevision, sourceChanged]);

  useEffect(
    () => () => {
      previewRequestRef.current += 1;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [],
  );

  async function loadPreview() {
    if (!cacheAvailable || disabled || loading) return;
    const requestId = ++previewRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const audio = await getSharedTtsAudio(contentType, item, "auto");
      if (requestId !== previewRequestRef.current) return;
      if (!audio) {
        setError(
          "Audio cache tidak ditemukan. Muat ulang status atau generate kembali.",
        );
        onCacheMissing?.();
        return;
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const nextUrl = URL.createObjectURL(audio);
      audioUrlRef.current = nextUrl;
      setAudioUrl(nextUrl);
    } catch (previewError) {
      if (requestId === previewRequestRef.current)
        setError(previewError.message || "Preview audio gagal dimuat.");
    } finally {
      if (requestId === previewRequestRef.current) setLoading(false);
    }
  }

  async function playPreview() {
    try {
      await audioRef.current?.play();
    } catch {
      setError(
        "Tekan tombol Play pada pemutar audio untuk mulai mendengarkan.",
      );
    }
  }

  return (
    <section className="course-audio-preview">
      <div className="course-audio-preview-heading">
        <div>
          <b>
            <AudioLines size={15} /> Preview shared audio
          </b>
          <small>
            {sourceChanged
              ? "Simpan perubahan materi terlebih dahulu sebelum memakai cache."
              : cacheAvailable
                ? cacheStatus.voice === "multi"
                  ? "Audio dialog gabungan multi-speaker siap didengarkan."
                  : `Audio voice ${cacheStatus.voice} siap didengarkan.`
                : cacheStatusLoading
                  ? "Memeriksa status audio cache…"
                  : cacheStatusError
                    ? "Status audio cache belum dapat diperiksa."
                    : "Belum ada audio cache untuk materi ini."}
          </small>
        </div>
        <div className="course-audio-preview-actions">
          <button
            type="button"
            className="outline-btn"
            disabled={!cacheAvailable || disabled || loading}
            onClick={loadPreview}
          >
            {loading ? (
              <>
                <span className="spinner" /> Memuat preview…
              </>
            ) : (
              <>
                <AudioLines size={14} />
                {audioUrl ? "Muat ulang preview" : "Preview audio"}
              </>
            )}
          </button>
          {audioUrl && (
            <button type="button" className="outline-btn" onClick={playPreview}>
              <Play size={14} /> Putar
            </button>
          )}
        </div>
      </div>
      {audioUrl && (
        <audio
          ref={audioRef}
          className="course-audio-preview-player"
          controls
          preload="metadata"
          src={audioUrl}
          aria-label={`Preview audio ${item?.title || item?.id || "materi"}`}
        />
      )}
      {error && (
        <small className="course-audio-preview-error" role="alert">
          {error}
        </small>
      )}
      {!cacheAvailable &&
        !cacheStatusLoading &&
        !sourceChanged &&
        !cacheStatusError && (
          <small className="course-audio-preview-hint">
            Generate satu audio pada materi ini untuk mengaktifkan preview.
          </small>
        )}
    </section>
  );
}

export default function CourseStudio({ onCatalogChange = () => {} }) {
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [selectedId, setSelectedId] = useState(null);
  const [courseData, setCourseData] = useState(null);
  const [courseDraft, setCourseDraft] = useState(NEW_COURSE);
  const [isNew, setIsNew] = useState(false);
  const [tab, setTab] = useState("settings");
  const [courseListCollapsed, setCourseListCollapsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generatingCache, setGeneratingCache] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modality, setModality] = useState("listening");
  const [moduleDrafts, setModuleDrafts] = useState({});
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [ttsCacheStatus, setTtsCacheStatus] = useState({});
  const [ttsCacheStatusLoading, setTtsCacheStatusLoading] = useState(false);
  const [ttsCacheStatusError, setTtsCacheStatusError] = useState("");
  const [ttsCacheStatusRefresh, setTtsCacheStatusRefresh] = useState(0);
  const [contentText, setContentText] = useState("");
  const [contentView, setContentView] = useState("visual");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [userSort, setUserSort] = useState("name");
  const [courseUsers, setCourseUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const importModalityRef = useRef(null);
  async function loadCourses(chooseId = undefined) {
    try {
      const response = await apiJson("admin/courses");
      const rows = response.courses || [];
      setCourses(rows);
      const next =
        chooseId === null
          ? rows[0]?.id || null
          : chooseId || selectedId || rows[0]?.id || null;
      setSelectedId(next);
    } catch (error) {
      toast.error(error.message || "Daftar course gagal dimuat.");
    }
  }
  useEffect(() => {
    void loadCourses();
  }, []);
  useEffect(() => {
    if (!selectedId || isNew) return;
    let active = true;
    setLoading(true);
    apiJson(`admin/courses/${encodeURIComponent(selectedId)}`)
      .then((result) => {
        if (!active) return;
        setCourseData(result);
        setCourseDraft({
          ...NEW_COURSE,
          ...result.course,
          listeningProgressionMode:
            result.course?.listeningProgressionMode ||
            result.course?.progressionMode ||
            "parallel",
          aiLessonProgressionMode:
            result.course?.aiLessonProgressionMode ||
            result.course?.progressionMode ||
            "parallel",
        });
        setModuleDrafts(result.modules || {});
        setSelectedUnitId("");
      })
      .catch((error) => {
        if (active) toast.error(error.message || "Course gagal dibuka.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, isNew]);
  useEffect(() => {
    if (!selectedId || isNew) {
      setTtsCacheStatus({});
      setTtsCacheStatusLoading(false);
      setTtsCacheStatusError("");
      return;
    }
    let active = true;
    setTtsCacheStatus({});
    setTtsCacheStatusLoading(true);
    setTtsCacheStatusError("");
    apiJson(
      `admin/tts-cache/status?course_id=${encodeURIComponent(selectedId)}`,
    )
      .then((result) => {
        if (active) setTtsCacheStatus(result.status || {});
      })
      .catch((error) => {
        if (active)
          setTtsCacheStatusError(
            error.message || "Status audio cache gagal dimuat.",
          );
      })
      .finally(() => {
        if (active) setTtsCacheStatusLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId, isNew, ttsCacheStatusRefresh]);
  useEffect(() => {
    const units = orderUnits(modality, moduleDrafts[modality]?.units || []);
    const selected =
      units.find((unit) => unit.id === selectedUnitId) || units[0];
    if (selected) {
      if (selectedUnitId !== selected.id) setSelectedUnitId(selected.id);
      setContentText(JSON.stringify(selected.content || {}, null, 2));
    } else {
      setSelectedUnitId("");
      setContentText("");
    }
  }, [
    modality,
    selectedUnitId,
    moduleDrafts[modality]?.units?.find((unit) => unit.id === selectedUnitId)
      ?.content,
    moduleDrafts[modality]?.units?.[0]?.content,
  ]);
  async function refresh() {
    await loadCourses(selectedId);
    onCatalogChange?.();
  }
  const visibleCourses = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return courses
      .filter(
        (course) =>
          (statusFilter === "all" || course.status === statusFilter) &&
          (!needle ||
            `${course.name} ${course.id} ${course.label} ${course.level}`
              .toLowerCase()
              .includes(needle)),
      )
      .sort((a, b) =>
        sort === "price"
          ? Number(a.price) - Number(b.price) || a.name.localeCompare(b.name)
          : sort === "status"
            ? a.status.localeCompare(b.status) || a.name.localeCompare(b.name)
            : sort === "order"
              ? Number(a.sortOrder) - Number(b.sortOrder) ||
                a.name.localeCompare(b.name)
              : a.name.localeCompare(b.name),
      );
  }, [courses, search, statusFilter, sort]);
  function startNew() {
    setIsNew(true);
    setSelectedId(null);
    setCourseData(null);
    setCourseDraft({ ...NEW_COURSE });
    setTab("settings");
    setModuleDrafts({
      listening: { categories: [], units: [] },
      ai_lesson: { categories: [], units: [] },
      live_lesson: { categories: [], units: [] },
    });
  }
  function editCourse(key, value) {
    setCourseDraft((current) => ({ ...current, [key]: value }));
  }
  async function saveCourse() {
    setBusy(true);
    try {
      const body = {
        ...courseDraft,
        price: Number(courseDraft.price) || 0,
        sortOrder: Math.max(0, Number(courseDraft.sortOrder) || 0),
      };
      const response = await apiJson(
        isNew
          ? "admin/courses"
          : `admin/courses/${encodeURIComponent(selectedId)}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const id = response.id || selectedId;
      setIsNew(false);
      setSelectedId(id);
      await loadCourses(id);
      if (!isNew)
        setCourseData(
          response.course
            ? { ...courseData, course: response.course }
            : courseData,
        );
      onCatalogChange?.();
      toast.success("Pengaturan course tersimpan.");
    } catch (error) {
      toast.error(error.message || "Course gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }
  async function deleteCourse() {
    if (!selectedId || selectedId === "ielts") return;
    if (
      !window.confirm(
        `Hapus course “${courseDraft.name}”? Course dengan riwayat enrollment/pembelian harus ditutup, bukan dihapus.`,
      )
    )
      return;
    setBusy(true);
    try {
      await apiJson(`admin/courses/${encodeURIComponent(selectedId)}`, {
        method: "DELETE",
      });
      toast.success("Course dihapus.");
      setCourseData(null);
      setSelectedId(null);
      await loadCourses(null);
      onCatalogChange?.();
    } catch (error) {
      toast.error(error.message || "Course tidak dapat dihapus.");
    } finally {
      setBusy(false);
    }
  }
  const currentModule = moduleDrafts[modality] || { categories: [], units: [] };
  const displayedUnits = orderUnits(modality, currentModule.units || []);
  const selectedUnit =
    displayedUnits.find((unit) => unit.id === selectedUnitId) ||
    displayedUnits[0] ||
    null;
  const contentParseState = useMemo(() => {
    try {
      const parsed = contentText.trim() ? JSON.parse(contentText) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Isi harus berupa JSON object.");
      }
      return { content: parsed, error: "" };
    } catch (error) {
      const savedContent = selectedUnit?.content;
      return {
        content:
          savedContent &&
          typeof savedContent === "object" &&
          !Array.isArray(savedContent)
            ? savedContent
            : {},
        error: error.message,
      };
    }
  }, [contentText, selectedUnit?.content]);
  const contentDraft = contentParseState.content;
  const contentParseError = contentParseState.error;
  const savedUnit = courseData?.modules?.[modality]?.units?.find(
    (unit) => unit.id === selectedUnit?.id,
  );
  const audioSourceField = modality === "ai_lesson" ? "prompt" : "script";
  const draftSegments = Array.isArray(contentDraft.ttsSegments)
    ? contentDraft.ttsSegments
    : [];
  const savedSegments = Array.isArray(savedUnit?.content?.ttsSegments)
    ? savedUnit.content.ttsSegments
    : [];
  const audioSourceChanged =
    Boolean(contentParseError) ||
    !selectedUnit?.ttsRevision ||
    !savedUnit ||
    contentDraft[audioSourceField] !== savedUnit.content?.[audioSourceField] ||
    (contentDraft.defaultVoice || "af_heart") !==
      (savedUnit.content?.defaultVoice || "af_heart") ||
    JSON.stringify(draftSegments) !== JSON.stringify(savedSegments);
  function patchContent(patch) {
    if (contentParseError) {
      setContentView("json");
      toast.error(
        "Perbaiki JSON yang belum valid sebelum memakai editor visual.",
      );
      return;
    }
    setContentText(JSON.stringify({ ...contentDraft, ...patch }, null, 2));
  }
  function selectStudioTab(nextTab) {
    setTab(nextTab);
    if (MODE_LABEL[nextTab]) {
      setModality(nextTab);
      setCategoryIndex(0);
      setSelectedUnitId("");
    }
  }
  function setModule(next) {
    setModuleDrafts((current) => ({
      ...current,
      [modality]:
        typeof next === "function"
          ? next(current[modality] || { categories: [], units: [] })
          : next,
    }));
  }
  function patchUnit(key, value) {
    if (key === "id") setSelectedUnitId(value);
    setModule((current) => ({
      ...current,
      units: (current.units || []).map((unit) =>
        unit.id === selectedUnitId ? { ...unit, [key]: value } : unit,
      ),
    }));
  }
  function patchCategory(index, key, value) {
    setModule((current) => ({
      ...current,
      categories: (current.categories || []).map((category, i) =>
        i === index ? { ...category, [key]: value } : category,
      ),
    }));
  }
  function addCategory() {
    const categories = currentModule.categories || [];
    const category = categoryTemplate(modality, categories.length);
    category.id = uniqueDraftId(category.id, categories);
    setModule((current) => ({
      ...current,
      categories: [...(current.categories || []), category],
    }));
    setCategoryIndex((currentModule.categories || []).length);
  }
  function removeCategory(index) {
    const category = currentModule.categories?.[index];
    if (
      category &&
      (currentModule.units || []).some(
        (unit) => unit.categoryId === category.id,
      )
    ) {
      toast.error(
        "Pindahkan atau hapus materi di kategori ini terlebih dahulu.",
      );
      return;
    }
    setModule((current) => ({
      ...current,
      categories: current.categories.filter((_, i) => i !== index),
    }));
  }
  function addUnit() {
    const isLiveTopic = modality === "live_lesson";
    const categories = currentModule.categories || [];
    let hiddenLiveCategory = null;
    if (!isLiveTopic && !categories.length) {
      toast.info("Buat kategori terlebih dahulu.");
      return;
    }
    if (isLiveTopic && !categories.length) {
      hiddenLiveCategory = {
        ...categoryTemplate(modality, 0),
        id: "live-topics",
        name: "Live topics",
        label: "",
      };
    }
    const categoryId = isLiveTopic
      ? categories[0]?.id || hiddenLiveCategory.id
      : categories[categoryIndex]?.id || categories[0].id;
    const currentUnits = currentModule.units || [];
    const currentOrders = currentUnits.map((item, index) => {
      const order = Number(item.sortOrder);
      return Number.isFinite(order) ? order : index;
    });
    const nextOrder =
      isLiveTopic && currentOrders.length
        ? Math.max(-1, ...currentOrders) + 1
        : currentUnits.length;
    const unit = unitTemplate(modality, nextOrder, categoryId);
    unit.id = uniqueDraftId(unit.id, currentUnits);
    setModule((current) => ({
      ...current,
      categories:
        current.categories?.length || !hiddenLiveCategory
          ? current.categories || []
          : [hiddenLiveCategory],
      units: [...(current.units || []), unit],
    }));
    setSelectedUnitId(unit.id);
    setContentText(JSON.stringify(unit.content, null, 2));
  }
  function deleteUnit() {
    if (!selectedUnit) return;
    setModule((current) => ({
      ...current,
      units: current.units.filter((unit) => unit.id !== selectedUnit.id),
    }));
    setSelectedUnitId("");
    toast.success(
      `${modality === "live_lesson" ? "Topik" : "Materi"} dihapus dari draft. Simpan modul untuk menerapkan.`,
    );
  }
  function moveUnit(unitId, direction) {
    setModule((current) => {
      const units = [...(current.units || [])]
        .map((unit, index) => ({ unit, index }))
        .sort(
          (a, b) =>
            Number(a.unit.sortOrder ?? a.index) -
              Number(b.unit.sortOrder ?? b.index) || a.index - b.index,
        )
        .map(({ unit }) => unit);
      const from = units.findIndex((unit) => unit.id === unitId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= units.length) return current;
      [units[from], units[to]] = [units[to], units[from]];
      return {
        ...current,
        units: units.map((unit, index) => ({ ...unit, sortOrder: index })),
      };
    });
  }
  async function saveModule() {
    if (!selectedId || isNew) {
      toast.info("Simpan course terlebih dahulu.");
      return;
    }
    let parsed;
    try {
      parsed = contentText.trim() ? JSON.parse(contentText) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("Isi harus berupa JSON object.");
    } catch (error) {
      toast.error(`Konten JSON tidak valid: ${error.message}`);
      return;
    }
    const units = (currentModule.units || []).map((unit) =>
      unit.id === selectedUnitId ? { ...unit, content: parsed } : unit,
    );
    const body = { categories: currentModule.categories || [], units };
    setBusy(true);
    try {
      const response = await apiJson(
        `admin/courses/${encodeURIComponent(selectedId)}/content/${modality}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const imported = {
        categories: response.content?.categories || body.categories,
        units: response.content?.units || body.units,
      };
      setModuleDrafts((current) => ({ ...current, [modality]: imported }));
      setCourseData((current) =>
        current
          ? {
              ...current,
              modules: { ...(current.modules || {}), [modality]: imported },
            }
          : current,
      );
      setContentText(
        JSON.stringify(
          imported.units.find((unit) => unit.id === selectedUnitId)?.content ||
            parsed,
          null,
          2,
        ),
      );
      toast.success(`${MODE_LABEL[modality]} tersimpan.`);
      setTtsCacheStatusRefresh((current) => current + 1);
      onCatalogChange?.();
    } catch (error) {
      toast.error(error.message || "Materi gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }
  async function exportModule() {
    if (!selectedId || isNew) return;
    try {
      const payload = await apiJson(
        `admin/courses/${encodeURIComponent(selectedId)}/content/${modality}`,
      );
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selectedId}-${modality}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("JSON materi diekspor.");
    } catch (error) {
      toast.error(error.message || "Export gagal.");
    }
  }
  async function importModule(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      let payload = JSON.parse(await file.text());
      if (
        modality === "live_lesson" &&
        payload &&
        Array.isArray(payload.units) &&
        payload.units.length
      ) {
        const categories = Array.isArray(payload.categories)
          ? payload.categories
          : [];
        const hiddenCategory = categories[0] || {
          ...categoryTemplate(modality, 0),
          id: "live-topics",
          name: "Live topics",
          label: "",
        };
        payload = {
          ...payload,
          categories: categories.length ? categories : [hiddenCategory],
          units: payload.units.map((unit, index) => ({
            ...unit,
            categoryId: categories.length
              ? unit.categoryId || hiddenCategory.id
              : hiddenCategory.id,
            sortOrder: unit.sortOrder ?? index,
          })),
        };
      }
      const saved = await apiJson(
        `admin/courses/${encodeURIComponent(selectedId)}/content/${modality}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const next = saved.content || payload;
      const imported = {
        categories: next.categories || [],
        units: next.units || [],
      };
      setModuleDrafts((current) => ({
        ...current,
        [modality]: imported,
      }));
      setCourseData((current) =>
        current
          ? {
              ...current,
              modules: { ...(current.modules || {}), [modality]: imported },
            }
          : current,
      );
      setSelectedUnitId(next.units?.[0]?.id || "");
      toast.success("JSON modul berhasil diimpor.");
      onCatalogChange?.();
    } catch (error) {
      toast.error(error.message || "Import JSON gagal.");
    }
  }
  useEffect(() => {
    if (tab !== "users" || !selectedId || isNew) return;
    let active = true;
    setUsersLoading(true);
    const timer = setTimeout(
      () =>
        apiJson(
          `admin/courses/${encodeURIComponent(selectedId)}/users?search=${encodeURIComponent(userSearch)}&sort=${encodeURIComponent(userSort)}`,
        )
          .then((result) => {
            if (active) setCourseUsers(result.users || []);
          })
          .catch((error) => {
            if (active)
              toast.error(error.message || "Daftar user gagal dimuat.");
          })
          .finally(() => {
            if (active) setUsersLoading(false);
          }),
      250,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tab, selectedId, isNew, userSearch, userSort]);
  async function toggleEnrollment(person) {
    try {
      await apiJson(
        `admin/courses/${encodeURIComponent(selectedId)}/users/${person.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrolled: !person.enrolled }),
        },
      );
      setCourseUsers((current) =>
        current.map((row) =>
          row.id === person.id ? { ...row, enrolled: !person.enrolled } : row,
        ),
      );
      toast.success(
        person.enrolled ? "Enrollment dicabut." : "Learner berhasil di-enroll.",
      );
    } catch (error) {
      toast.error(error.message || "Status enrollment gagal diubah.");
    }
  }
  const previewKind = mediaKind(selectedUnit?.mediaUrl || "");
  return (
    <div className="course-studio">
      <div className="course-studio-header">
        <div>
          <div className="eyebrow">
            <BookOpen size={15} /> COURSE STUDIO
          </div>
          <h2>Kelola course dinamis</h2>
          <p>
            Susun jalur belajar, materi, enrollment, dan promosi dari satu
            ruang.
          </p>
        </div>
        <div className="course-studio-header-actions">
          <button
            className="outline-btn course-studio-list-toggle"
            onClick={() => setCourseListCollapsed((collapsed) => !collapsed)}
            aria-expanded={!courseListCollapsed}
            aria-controls="course-studio-course-list"
          >
            {courseListCollapsed ? (
              <ChevronRight size={15} />
            ) : (
              <ChevronLeft size={15} />
            )}
            {courseListCollapsed
              ? "Tampilkan daftar course"
              : "Sembunyikan daftar"}
          </button>
          <button
            className="outline-btn"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw size={15} /> Perbarui
          </button>
        </div>
      </div>
      <div
        className={`course-studio-layout ${courseListCollapsed ? "is-list-collapsed" : ""}`}
      >
        <aside
          id="course-studio-course-list"
          className="course-studio-list"
          aria-hidden={courseListCollapsed}
        >
          <div className="course-studio-list-top">
            <b>Course</b>
            <button className="course-add-btn" onClick={startNew}>
              <Plus size={15} /> Baru
            </button>
          </div>
          <label className="course-studio-search">
            <Search size={15} />
            <input
              placeholder="Cari course…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="course-studio-list-filters">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Semua status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="name">Nama A–Z</option>
              <option value="price">Harga ↑</option>
              <option value="status">Status</option>
              <option value="order">Urutan</option>
            </select>
          </div>
          <div className="course-studio-course-list">
            {visibleCourses.map((course) => (
              <button
                key={course.id}
                className={`course-studio-course-item ${selectedId === course.id && !isNew ? "active" : ""}`}
                onClick={() => {
                  setIsNew(false);
                  setSelectedId(course.id);
                  setTab("settings");
                }}
              >
                <span
                  className="course-studio-swatch"
                  style={{ background: course.color }}
                />
                <span>
                  <b>{course.name}</b>
                  <small>
                    {course.id} · {course.status} ·{" "}
                    {Number(course.price)
                      ? `Rp${Number(course.price).toLocaleString("id-ID")}`
                      : "Gratis"}
                  </small>
                </span>
                <ChevronDown size={14} />
              </button>
            ))}
            {!visibleCourses.length && (
              <div className="course-table-empty">Tidak ada course.</div>
            )}
          </div>
          <div className="course-studio-side-note">
            <ShieldCheck size={15} /> IELTS default tidak dapat dihapus.
          </div>
        </aside>
        <main className="course-studio-main">
          {loading && !isNew ? (
            <div className="course-studio-empty">
              <span className="spinner" /> Memuat course…
            </div>
          ) : !courseData && !isNew ? (
            <div className="course-studio-empty">
              <BookOpen size={28} />
              <h3>Pilih course untuk diedit</h3>
              <p>Atau buat course baru menggunakan tombol “Baru”.</p>
            </div>
          ) : (
            <>
              <div className="course-editor-top">
                <div>
                  <div className="eyebrow">
                    {isNew ? "COURSE BARU" : courseDraft.status?.toUpperCase()}
                  </div>
                  <h3>{courseDraft.name || "Course tanpa nama"}</h3>
                  <small>
                    {courseDraft.id || "ID dibuat saat course disimpan"}
                  </small>
                </div>
                <div className="course-editor-actions">
                  <button
                    className="btn-primary"
                    onClick={saveCourse}
                    disabled={busy}
                  >
                    <Check size={15} />
                    {busy ? "Menyimpan…" : "Simpan course"}
                  </button>
                  {!isNew && selectedId !== "ielts" && (
                    <button
                      className="course-icon-action delete"
                      title="Hapus course"
                      onClick={deleteCourse}
                      disabled={busy}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
              <div className="course-studio-tabs" role="tablist">
                {[
                  { id: "settings", label: "Settings" },
                  { id: "listening", label: "Listening" },
                  { id: "ai_lesson", label: "AI Lesson" },
                  { id: "live_lesson", label: "Live Lesson" },
                  { id: "users", label: "User" },
                ].map((item) => (
                  <button
                    key={item.id}
                    className={tab === item.id ? "active" : ""}
                    onClick={() => selectStudioTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {tab === "settings" && (
                <div className="course-editor-panel">
                  <div className="course-field-grid">
                    <label>
                      Nama course
                      <input
                        className="text-field"
                        value={courseDraft.name || ""}
                        onChange={(event) =>
                          editCourse("name", event.target.value)
                        }
                        placeholder="English for…"
                      />
                    </label>
                    <label>
                      ID unik
                      <input
                        className="text-field"
                        disabled={!isNew}
                        value={courseDraft.id || ""}
                        onChange={(event) =>
                          editCourse("id", safeSlug(event.target.value))
                        }
                        placeholder="remote-worker"
                      />
                    </label>
                    <label className="span-2">
                      Deskripsi
                      <textarea
                        className="text-field"
                        rows={4}
                        value={courseDraft.description || ""}
                        onChange={(event) =>
                          editCourse("description", event.target.value)
                        }
                        placeholder="Tujuan dan isi course"
                      />
                    </label>
                    <label>
                      Poster URL · 16:9
                      <input
                        className="text-field"
                        value={courseDraft.posterUrl || ""}
                        onChange={(event) =>
                          editCourse("posterUrl", event.target.value)
                        }
                        placeholder="https://…/poster.jpg"
                      />
                    </label>
                    <label>
                      Banner URL · 16:9
                      <input
                        className="text-field"
                        value={courseDraft.bannerUrl || ""}
                        onChange={(event) =>
                          editCourse("bannerUrl", event.target.value)
                        }
                        placeholder="https://…/banner.jpg"
                      />
                    </label>
                    <div className="course-media-preview">
                      <div className="course-media-preview-title">
                        Preview poster
                      </div>
                      {courseDraft.posterUrl ? (
                        <img src={courseDraft.posterUrl} alt="Preview poster" />
                      ) : (
                        <div className="course-media-empty">Poster 16:9</div>
                      )}
                    </div>
                    <div className="course-media-preview">
                      <div className="course-media-preview-title">
                        Preview banner
                      </div>
                      {courseDraft.bannerUrl ? (
                        <img src={courseDraft.bannerUrl} alt="Preview banner" />
                      ) : (
                        <div className="course-media-empty">Banner 16:9</div>
                      )}
                    </div>
                    <label>
                      Status
                      <select
                        className="text-field"
                        value={courseDraft.status || "draft"}
                        onChange={(event) =>
                          editCourse("status", event.target.value)
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="closed">Closed</option>
                      </select>
                    </label>
                    <label>
                      Harga (Rupiah)
                      <input
                        className="text-field"
                        type="number"
                        min="0"
                        step="1000"
                        value={courseDraft.price ?? 0}
                        onChange={(event) =>
                          editCourse("price", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Label
                      <input
                        className="text-field"
                        value={courseDraft.label || ""}
                        onChange={(event) =>
                          editCourse("label", event.target.value)
                        }
                        placeholder="IELTS, Business English…"
                      />
                    </label>
                    <label>
                      Level
                      <input
                        className="text-field"
                        value={courseDraft.level || ""}
                        onChange={(event) =>
                          editCourse("level", event.target.value)
                        }
                        placeholder="Beginner · A1"
                      />
                    </label>
                    <label>
                      Warna utama
                      <input
                        className="course-color-input"
                        type="color"
                        value={
                          /^#[0-9a-fA-F]{6}$/.test(courseDraft.color || "")
                            ? courseDraft.color
                            : "#F56B45"
                        }
                        onChange={(event) =>
                          editCourse("color", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Urutan tampil
                      <input
                        className="text-field"
                        type="number"
                        min="0"
                        value={courseDraft.sortOrder || 0}
                        onChange={(event) =>
                          editCourse("sortOrder", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="course-mode-toggles-container" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ border: "1px solid #e7e2f7", borderRadius: 10, padding: "12px 16px", background: courseDraft.enableListening ? "#ffffff" : "#fbfafd" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#2d2854" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(courseDraft.enableListening)}
                          onChange={(event) =>
                            editCourse("enableListening", event.target.checked)
                          }
                        />{" "}
                        Listening Lab
                      </label>
                      {courseDraft.enableListening && (
                        <div style={{ marginTop: 10, paddingLeft: 26, display: "flex", flexDirection: "column", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#6e6796" }}>
                            Alur Progres Listening Lab:
                          </span>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#443e62" }}>
                              <input
                                type="radio"
                                name="course_listening_progression_mode"
                                checked={courseDraft.listeningProgressionMode !== "linear"}
                                onChange={() => editCourse("listeningProgressionMode", "parallel")}
                              />
                              Belajar Paralel (bebas memilih materi)
                            </label>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#443e62" }}>
                              <input
                                type="radio"
                                name="course_listening_progression_mode"
                                checked={courseDraft.listeningProgressionMode === "linear"}
                                onChange={() => editCourse("listeningProgressionMode", "linear")}
                              />
                              Belajar Linear (wajib bertahap / berurutan)
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ border: "1px solid #e7e2f7", borderRadius: 10, padding: "12px 16px", background: courseDraft.enableAiLesson ? "#ffffff" : "#fbfafd" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#2d2854" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(courseDraft.enableAiLesson)}
                          onChange={(event) =>
                            editCourse("enableAiLesson", event.target.checked)
                          }
                        />{" "}
                        AI Lesson
                      </label>
                      {courseDraft.enableAiLesson && (
                        <div style={{ marginTop: 10, paddingLeft: 26, display: "flex", flexDirection: "column", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#6e6796" }}>
                            Alur Progres AI Lesson:
                          </span>
                          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#443e62" }}>
                              <input
                                type="radio"
                                name="course_ai_lesson_progression_mode"
                                checked={courseDraft.aiLessonProgressionMode !== "linear"}
                                onChange={() => {
                                  editCourse("aiLessonProgressionMode", "parallel");
                                  editCourse("progressionMode", "parallel");
                                }}
                              />
                              Belajar Paralel (bebas memilih materi)
                            </label>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#443e62" }}>
                              <input
                                type="radio"
                                name="course_ai_lesson_progression_mode"
                                checked={courseDraft.aiLessonProgressionMode === "linear"}
                                onChange={() => {
                                  editCourse("aiLessonProgressionMode", "linear");
                                  editCourse("progressionMode", "linear");
                                }}
                              />
                              Belajar Linear (wajib bertahap / berurutan)
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ border: "1px solid #e7e2f7", borderRadius: 10, padding: "12px 16px", background: courseDraft.enableLiveLesson ? "#ffffff" : "#fbfafd" }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#2d2854" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(courseDraft.enableLiveLesson)}
                          onChange={(event) =>
                            editCourse("enableLiveLesson", event.target.checked)
                          }
                        />{" "}
                        Live Lesson
                      </label>
                      <div style={{ marginTop: 6, paddingLeft: 26, fontSize: 12, color: "#777196" }}>
                        Sesi tatap muka langsung sesuai jadwal kelas.
                      </div>
                    </div>
                  </div>
                  <div className="course-studio-tip">
                    Mode dapat disembunyikan per course. Status <b>closed</b>{" "}
                    menghentikan pembelian/enrollment baru tanpa menghapus
                    riwayat.
                  </div>
                </div>
              )}
              {["listening", "ai_lesson", "live_lesson"].includes(tab) && (
                <div className="course-editor-panel course-content-editor">
                  <div className="course-module-toolbar">
                    <div>
                      <h4>
                        {MODE_LABEL[tab]} ·{" "}
                        {modality === "live_lesson"
                          ? "topik"
                          : "kategori & materi"}
                      </h4>
                      <p>
                        {modality === "live_lesson"
                          ? "Kelola topik role-play, urutkan percakapan, dan atur peran serta pembuka teacher. Kategori internal tetap disimpan agar format API lama kompatibel."
                          : "Kategori dan materi tersimpan terpisah untuk tiap modality. JSON import/export mendukung units, bank soal, dialog, dan prompt."}
                      </p>
                    </div>
                    <div className="course-editor-actions">
                      <button
                        className="outline-btn"
                        onClick={exportModule}
                        disabled={isNew}
                      >
                        <Download size={15} /> Export JSON
                      </button>
                      <button
                        className="outline-btn"
                        onClick={() => importModalityRef.current?.click()}
                        disabled={isNew}
                      >
                        <FileUp size={15} /> Import JSON
                      </button>
                      <input
                        ref={importModalityRef}
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={importModule}
                      />
                    </div>
                  </div>
                  <div
                    className={`course-content-layout ${modality === "live_lesson" ? "course-content-layout-live" : ""}`}
                  >
                    {modality !== "live_lesson" && (
                      <aside className="course-content-categories">
                        <div className="course-subheading">
                          <b>Kategori</b>
                          <button
                            className="course-icon-action"
                            onClick={addCategory}
                            title="Tambah kategori"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        {(currentModule.categories || []).map(
                          (category, index) => (
                            <div
                              className={`course-category-row ${categoryIndex === index ? "active" : ""}`}
                              key={`${category.id}-${index}`}
                            >
                              <button
                                className="course-category-select"
                                onClick={() => setCategoryIndex(index)}
                              >
                                <span
                                  className="course-studio-swatch"
                                  style={{ background: category.color }}
                                />
                                <span>
                                  <b>{category.name || category.id}</b>
                                  <small>{category.id}</small>
                                </span>
                              </button>
                              <button
                                className="course-icon-action delete"
                                title="Hapus kategori"
                                onClick={() => removeCategory(index)}
                              >
                                <X size={14} />
                              </button>
                              <div className="course-category-edit">
                                <input
                                  value={category.id}
                                  readOnly
                                  aria-label="ID kategori"
                                  title="ID kategori stabil untuk menjaga materi yang terhubung"
                                />
                                <input
                                  value={category.name}
                                  onChange={(event) =>
                                    patchCategory(
                                      index,
                                      "name",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Nama kategori"
                                />
                                <input
                                  value={category.label || ""}
                                  onChange={(event) =>
                                    patchCategory(
                                      index,
                                      "label",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Label"
                                />
                                <textarea
                                  value={category.guide || ""}
                                  onChange={(event) =>
                                    patchCategory(
                                      index,
                                      "guide",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Panduan kategori"
                                  rows={2}
                                />
                                <div>
                                  <input
                                    type="color"
                                    value={category.color || "#F56B45"}
                                    onChange={(event) =>
                                      patchCategory(
                                        index,
                                        "color",
                                        event.target.value,
                                      )
                                    }
                                  />
                                  <input
                                    type="number"
                                    value={category.sortOrder ?? index}
                                    onChange={(event) =>
                                      patchCategory(
                                        index,
                                        "sortOrder",
                                        Number(event.target.value),
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          ),
                        )}
                        {!currentModule.categories?.length && (
                          <p className="course-studio-tip">
                            Tambahkan kategori sebelum membuat materi.
                          </p>
                        )}
                      </aside>
                    )}
                    <section className="course-content-unit-editor">
                      <div className="course-subheading">
                        <b>
                          {modality === "live_lesson"
                            ? "Topik percakapan"
                            : "Materi / unit"}
                        </b>
                        <div>
                          <button
                            className="outline-btn"
                            onClick={addUnit}
                            disabled={
                              modality !== "live_lesson" &&
                              !currentModule.categories?.length
                            }
                          >
                            <Plus size={15} />
                            {modality === "live_lesson"
                              ? "Tambah topik"
                              : "Tambah materi"}
                          </button>
                          {selectedUnit && (
                            <button
                              className="course-icon-action delete"
                              onClick={deleteUnit}
                              title={`Hapus ${modality === "live_lesson" ? "topik" : "materi"}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                      {displayedUnits.length > 0 && (
                        <div
                          className={`course-unit-list ${modality === "live_lesson" ? "course-live-topic-list" : ""}`}
                        >
                          {displayedUnits.map((unit, index) => {
                            if (modality === "live_lesson") {
                              return (
                                <div
                                  className="course-live-topic-row"
                                  key={unit.id}
                                >
                                  <button
                                    className={`course-live-topic-select ${unit.id === selectedUnitId ? "active" : ""}`}
                                    onClick={() => setSelectedUnitId(unit.id)}
                                  >
                                    <span className="course-unit-order">
                                      {index + 1}
                                    </span>
                                    <span>
                                      <b>{unit.title}</b>
                                      <small>
                                        {unit.subtitle || unit.id} ·{" "}
                                        {unit.published ? "Published" : "Draft"}
                                      </small>
                                    </span>
                                  </button>
                                  <div className="course-live-topic-actions">
                                    <button
                                      className="course-icon-action"
                                      type="button"
                                      aria-label={`Pindahkan ${unit.title} ke atas`}
                                      title="Pindahkan ke atas"
                                      disabled={index === 0}
                                      onClick={() => moveUnit(unit.id, -1)}
                                    >
                                      <ArrowUp size={14} />
                                    </button>
                                    <button
                                      className="course-icon-action"
                                      type="button"
                                      aria-label={`Pindahkan ${unit.title} ke bawah`}
                                      title="Pindahkan ke bawah"
                                      disabled={
                                        index === displayedUnits.length - 1
                                      }
                                      onClick={() => moveUnit(unit.id, 1)}
                                    >
                                      <ArrowDown size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            const savedAudioUnit = courseData?.modules?.[
                              modality
                            ]?.units?.find((item) => item.id === unit.id);
                            const draftAudioChanged =
                              unit.id === selectedUnit?.id
                                ? audioSourceChanged
                                : unitAudioContentChanged(
                                    modality,
                                    unit.content,
                                    savedAudioUnit?.content,
                                  );
                            const audioStatus =
                              ttsCacheStatus[modality]?.[unit.id];
                            const badgeState = draftAudioChanged
                              ? "pending"
                              : audioStatus?.available
                                ? "ready"
                                : ttsCacheStatusLoading
                                  ? "checking"
                                  : ttsCacheStatusError
                                    ? "unknown"
                                    : "missing";
                            const badgeLabel = draftAudioChanged
                              ? "Perubahan belum disimpan"
                              : audioStatus?.available
                                ? audioStatus.voice === "multi"
                                  ? "Audio siap · multi"
                                  : "Audio siap"
                                : ttsCacheStatusLoading
                                  ? "Memeriksa cache…"
                                  : ttsCacheStatusError
                                    ? "Status tidak tersedia"
                                    : "Belum digenerate";
                            return (
                              <button
                                key={unit.id}
                                className={
                                  unit.id === selectedUnitId ? "active" : ""
                                }
                                onClick={() => setSelectedUnitId(unit.id)}
                              >
                                <span className="course-unit-order">
                                  {Number(unit.sortOrder) + 1}
                                </span>
                                <span className="course-unit-card-info">
                                  <b>{unit.title}</b>
                                  <small>
                                    {unit.id} ·{" "}
                                    {unit.published ? "Published" : "Draft"}
                                  </small>
                                  <span
                                    className={`course-unit-audio-badge is-${badgeState}`}
                                    title={
                                      audioStatus?.available
                                        ? `Audio cache ${audioStatus.voice}`
                                        : badgeLabel
                                    }
                                  >
                                    <AudioLines size={12} />
                                    {badgeLabel}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {selectedUnit ? (
                        <div className="course-unit-form">
                          <div className="course-field-grid">
                            <label>
                              {modality === "live_lesson"
                                ? "ID topik"
                                : "ID materi"}
                              <input
                                className="text-field"
                                value={selectedUnit.id}
                                onChange={(event) =>
                                  patchUnit("id", safeSlug(event.target.value))
                                }
                              />
                            </label>
                            {modality !== "live_lesson" && (
                              <label>
                                Kategori
                                <select
                                  className="text-field"
                                  value={selectedUnit.categoryId}
                                  onChange={(event) =>
                                    patchUnit("categoryId", event.target.value)
                                  }
                                >
                                  {(currentModule.categories || []).map(
                                    (category) => (
                                      <option
                                        key={category.id}
                                        value={category.id}
                                      >
                                        {category.name}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>
                            )}
                            <label>
                              Judul
                              <input
                                className="text-field"
                                value={selectedUnit.title || ""}
                                onChange={(event) =>
                                  patchUnit("title", event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Urutan
                              <input
                                className="text-field"
                                type="number"
                                min="0"
                                value={selectedUnit.sortOrder ?? 0}
                                onChange={(event) =>
                                  patchUnit(
                                    "sortOrder",
                                    Number(event.target.value),
                                  )
                                }
                              />
                            </label>
                            <label className="span-2">
                              Deskripsi singkat
                              <input
                                className="text-field"
                                value={selectedUnit.subtitle || ""}
                                onChange={(event) =>
                                  patchUnit("subtitle", event.target.value)
                                }
                              />
                            </label>
                            <label className="span-2">
                              Master prompt / instruksi global
                              <textarea
                                className="text-field"
                                rows={3}
                                value={selectedUnit.masterPrompt || ""}
                                onChange={(event) =>
                                  patchUnit("masterPrompt", event.target.value)
                                }
                                placeholder="Instruksi khusus untuk mode ini"
                              />
                            </label>
                            {modality !== "live_lesson" && (
                              <>
                                <label className="span-2">
                                  Ilustrasi / video / YouTube / URL eksternal
                                  <input
                                    className="text-field"
                                    value={selectedUnit.mediaUrl || ""}
                                    onChange={(event) =>
                                      patchUnit("mediaUrl", event.target.value)
                                    }
                                    placeholder="https://… (YouTube, MP4, gambar)"
                                  />
                                </label>
                                <div className="course-media-preview span-2">
                                  <div className="course-media-preview-title">
                                    Preview media · 16:9
                                  </div>
                                  {previewKind === "youtube" ? (
                                    <iframe
                                      src={youtubeEmbed(selectedUnit.mediaUrl)}
                                      title="Preview video"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  ) : previewKind === "video" ? (
                                    <video
                                      src={selectedUnit.mediaUrl}
                                      controls
                                    />
                                  ) : previewKind === "image" ? (
                                    <a
                                      href={selectedUnit.mediaUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <img
                                        src={selectedUnit.mediaUrl}
                                        alt="Preview media"
                                      />
                                      <span>
                                        <ExternalLink size={14} /> Buka media
                                        eksternal
                                      </span>
                                    </a>
                                  ) : previewKind === "external" ? (
                                    <a
                                      href={selectedUnit.mediaUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <div className="course-media-empty">
                                        <ExternalLink size={14} />
                                        <span>Buka URL media eksternal</span>
                                      </div>
                                    </a>
                                  ) : (
                                    <div className="course-media-empty">
                                      Media ilustrasi 16:9 · gambar, video, URL,
                                      atau YouTube
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                            <label className="course-published-toggle">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedUnit.published)}
                                onChange={(event) =>
                                  patchUnit("published", event.target.checked)
                                }
                              />{" "}
                              {modality === "live_lesson"
                                ? "Topik diterbitkan"
                                : "Materi diterbitkan"}
                            </label>
                          </div>
                          <div className="course-content-help">
                            {modality === "listening"
                              ? "Atur tujuan, naskah, bank soal, dan suara. Dialog multi-speaker dapat memakai nama serta voice Kokoro berbeda di setiap giliran."
                              : modality === "ai_lesson"
                                ? "Buat cue card dan pengaturan latihan; dialog ttsSegments mendukung beberapa speaker dengan teks dan voice masing-masing."
                                : "Atur role, situasi, pembuka teacher, dan gaya balasan. Live Teacher memulai percakapan berdasarkan topik yang dipilih."}
                          </div>
                          <div
                            className="course-content-view-toggle"
                            role="group"
                            aria-label="Mode penyuntingan konten"
                          >
                            <button
                              type="button"
                              aria-pressed={contentView === "visual"}
                              onClick={() => setContentView("visual")}
                            >
                              Editor visual
                            </button>
                            <button
                              type="button"
                              aria-pressed={contentView === "json"}
                              onClick={() => setContentView("json")}
                            >
                              JSON
                            </button>
                            <button
                              type="button"
                              aria-pressed={contentView === "both"}
                              onClick={() => setContentView("both")}
                            >
                              Berdampingan
                            </button>
                          </div>
                          {contentParseError && (
                            <div
                              className="course-content-json-error"
                              role="alert"
                            >
                              <span>
                                JSON konten belum valid: {contentParseError}.
                                Editor visual sementara tidak tersedia.
                              </span>
                              {contentView !== "json" && (
                                <button
                                  type="button"
                                  onClick={() => setContentView("json")}
                                >
                                  Buka JSON untuk memperbaiki
                                </button>
                              )}
                            </div>
                          )}
                          <div
                            className={`course-content-authoring ${contentView === "both" ? "is-split" : ""}`}
                          >
                            {contentView !== "json" && (
                              <div className="course-content-visual">
                                {!contentParseError && (
                                  <CourseContentEditor
                                    modality={modality}
                                    content={contentDraft}
                                    onChange={patchContent}
                                  />
                                )}
                              </div>
                            )}
                            {contentView !== "visual" && (
                              <label className="course-json-label course-content-json-panel">
                                {modality === "live_lesson"
                                  ? "KONTEN TOPIK · JSON OBJECT"
                                  : "KONTEN MATERI · JSON OBJECT"}
                                <textarea
                                  className="course-json-editor"
                                  aria-label={
                                    modality === "live_lesson"
                                      ? "Konten topik dalam JSON"
                                      : "Konten materi dalam JSON"
                                  }
                                  spellCheck={false}
                                  value={contentText}
                                  onChange={(event) =>
                                    setContentText(event.target.value)
                                  }
                                  rows={18}
                                />
                              </label>
                            )}
                          </div>
                          {modality !== "live_lesson" && selectedUnit && (
                            <SharedTtsCacheGenerator
                              key={`${selectedId}:${modality}:${selectedUnit.id}`}
                              contentType={
                                modality === "ai_lesson"
                                  ? "speaking"
                                  : "listening"
                              }
                              item={{
                                ...selectedUnit,
                                defaultVoice:
                                  contentDraft.defaultVoice || "af_heart",
                                courseId: selectedUnit.courseId || selectedId,
                              }}
                              sourceText={
                                draftSegments.length >= 2
                                  ? draftSegments
                                      .map((turn) => turn.text)
                                      .join(" ")
                                  : contentDraft[audioSourceField]
                              }
                              segments={draftSegments}
                              sourceChanged={audioSourceChanged}
                              disabled={
                                busy || loading || isNew || generatingCache
                              }
                              onGeneratingChange={setGeneratingCache}
                              onCacheGenerated={() => {
                                setTtsCacheStatusRefresh(
                                  (current) => current + 1,
                                );
                                setTtsCacheStatusError("");
                              }}
                            />
                          )}
                          {modality !== "live_lesson" && selectedUnit && (
                            <CourseStudioAudioPreview
                              key={`${selectedId}:${modality}:${selectedUnit.id}:${selectedUnit.ttsRevision || "draft"}`}
                              contentType={
                                modality === "ai_lesson"
                                  ? "speaking"
                                  : "listening"
                              }
                              item={{
                                ...selectedUnit,
                                defaultVoice:
                                  contentDraft.defaultVoice || "af_heart",
                                courseId: selectedUnit.courseId || selectedId,
                              }}
                              cacheStatus={
                                ttsCacheStatus[modality]?.[selectedUnit.id]
                              }
                              cacheStatusLoading={ttsCacheStatusLoading}
                              cacheStatusError={ttsCacheStatusError}
                              sourceChanged={audioSourceChanged}
                              disabled={
                                busy ||
                                loading ||
                                isNew ||
                                generatingCache ||
                                Boolean(contentParseError)
                              }
                              onCacheMissing={() =>
                                setTtsCacheStatusRefresh(
                                  (current) => current + 1,
                                )
                              }
                            />
                          )}
                          <div className="course-editor-actions course-module-save">
                            <button
                              className="btn-primary"
                              onClick={saveModule}
                              disabled={busy || isNew || generatingCache}
                            >
                              <Check size={15} />
                              {busy
                                ? "Menyimpan…"
                                : modality === "live_lesson"
                                  ? "Simpan topik"
                                  : "Simpan modul"}
                            </button>
                            <button
                              className="outline-btn"
                              disabled={busy || generatingCache}
                              onClick={() =>
                                setContentText(
                                  JSON.stringify(
                                    selectedUnit.content || {},
                                    null,
                                    2,
                                  ),
                                )
                              }
                            >
                              Batalkan perubahan konten
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="course-studio-empty compact">
                          {modality === "live_lesson"
                            ? "Belum ada topik. Tambahkan topik pertama untuk memulai."
                            : "Pilih kategori lalu tambahkan unit materi."}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
              {tab === "users" && (
                <div className="course-editor-panel">
                  <div className="course-module-toolbar">
                    <div>
                      <h4>
                        <Users size={17} /> Enrollment learner
                      </h4>
                      <p>
                        Enrol atau cabut akses secara manual; progress tersimpan
                        tetap tidak dihapus.
                      </p>
                    </div>
                  </div>
                  <div className="course-admin-filters">
                    <label className="course-admin-search">
                      <Search size={16} />
                      <input
                        placeholder="Cari nama atau email learner"
                        value={userSearch}
                        onChange={(event) => setUserSearch(event.target.value)}
                      />
                    </label>
                    <select
                      className="text-field"
                      value={userSort}
                      onChange={(event) => setUserSort(event.target.value)}
                    >
                      <option value="name">Nama A–Z</option>
                      <option value="email">Email A–Z</option>
                      <option value="enrolled">Enrollment terbaru</option>
                    </select>
                  </div>
                  <div className="course-admin-table-wrap">
                    <table className="course-admin-table">
                      <thead>
                        <tr>
                          <th>Learner</th>
                          <th>Dibuat</th>
                          <th>Enrollment</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courseUsers.map((person) => (
                          <tr key={person.id}>
                            <td>
                              <b>{person.name}</b>
                              <small>{person.email}</small>
                            </td>
                            <td>
                              {person.createdAt
                                ? new Date(person.createdAt).toLocaleDateString(
                                    "id-ID",
                                  )
                                : "—"}
                            </td>
                            <td>
                              <span
                                className={`course-status-pill ${person.enrolled ? "paid" : "draft"}`}
                              >
                                {person.enrolled ? "enrolled" : "not enrolled"}
                              </span>
                              <small>
                                {person.enrolledAt
                                  ? new Date(person.enrolledAt).toLocaleString(
                                      "id-ID",
                                    )
                                  : "—"}
                              </small>
                            </td>
                            <td>
                              <button
                                className={
                                  person.enrolled
                                    ? "outline-btn course-unenroll"
                                    : "outline-btn course-enroll"
                                }
                                disabled={
                                  selectedId === "ielts" && person.enrolled
                                }
                                onClick={() => toggleEnrollment(person)}
                              >
                                {person.enrolled
                                  ? "Cabut enrollment"
                                  : "Enroll learner"}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!courseUsers.length && (
                          <tr>
                            <td colSpan="4" className="course-table-empty">
                              {usersLoading
                                ? "Memuat learner…"
                                : "Tidak ada learner yang cocok."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
