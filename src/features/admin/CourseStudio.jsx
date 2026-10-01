import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  BookOpen,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileUp,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { apiJson } from "../../api";
import { toast } from "sonner";
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
  title: `Materi ${index + 1}`,
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
function mediaKind(url = "") {
  const value = String(url).trim();
  if (/youtube\.com|youtu\.be/i.test(value)) return "youtube";
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(value)) return "video";
  if (
    /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(value) ||
    value.startsWith("/learnenglish/images/") ||
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
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modality, setModality] = useState("listening");
  const [moduleDrafts, setModuleDrafts] = useState({});
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [contentText, setContentText] = useState("");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [userSort, setUserSort] = useState("name");
  const [courseUsers, setCourseUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [ads, setAds] = useState([]);
  const [adDraft, setAdDraft] = useState(null);
  const [adBusy, setAdBusy] = useState(false);
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
        setCourseDraft({ ...NEW_COURSE, ...result.course });
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
    const units = moduleDrafts[modality]?.units || [];
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
  const selectedUnit =
    currentModule.units?.find((unit) => unit.id === selectedUnitId) ||
    currentModule.units?.[0] ||
    null;
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
    const category = categoryTemplate(
      modality,
      currentModule.categories?.length || 0,
    );
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
    if (!currentModule.categories?.length) {
      toast.info("Buat kategori terlebih dahulu.");
      return;
    }
    const category =
      currentModule.categories[categoryIndex]?.id ||
      currentModule.categories[0].id;
    const unit = unitTemplate(
      modality,
      currentModule.units?.length || 0,
      category,
    );
    setModule((current) => ({
      ...current,
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
    toast.success("Materi dihapus dari draft. Simpan modul untuk menerapkan.");
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
      setContentText(
        JSON.stringify(
          imported.units.find((unit) => unit.id === selectedUnitId)?.content ||
            parsed,
          null,
          2,
        ),
      );
      toast.success(`${MODE_LABEL[modality]} tersimpan.`);
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
      const payload = JSON.parse(await file.text());
      const saved = await apiJson(
        `admin/courses/${encodeURIComponent(selectedId)}/content/${modality}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const next = saved.content || payload;
      setModuleDrafts((current) => ({
        ...current,
        [modality]: {
          categories: next.categories || [],
          units: next.units || [],
        },
      }));
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
  async function loadAds() {
    try {
      const result = await apiJson("admin/course-ads");
      setAds(result.ads || []);
    } catch (error) {
      toast.error(error.message || "Iklan gagal dimuat.");
    }
  }
  useEffect(() => {
    if (tab === "ads") void loadAds();
  }, [tab]);
  function editAd(ad = null) {
    setAdDraft(
      ad
        ? { ...ad }
        : {
            id: null,
            title: "",
            description: "",
            posterUrl: "",
            link: "https://",
            sortOrder: ads.length,
            active: true,
          },
    );
  }
  async function saveAd() {
    setAdBusy(true);
    try {
      const { id, ...body } = adDraft;
      const url = id
        ? `admin/course-ads/${encodeURIComponent(id)}`
        : "admin/course-ads";
      await apiJson(url, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setAdDraft(null);
      await loadAds();
      toast.success("Iklan disimpan.");
    } catch (error) {
      toast.error(error.message || "Iklan gagal disimpan.");
    } finally {
      setAdBusy(false);
    }
  }
  async function removeAd(ad) {
    if (!window.confirm(`Hapus iklan “${ad.title}”?`)) return;
    try {
      await apiJson(`admin/course-ads/${encodeURIComponent(ad.id)}`, {
        method: "DELETE",
      });
      await loadAds();
      toast.success("Iklan dihapus.");
    } catch (error) {
      toast.error(error.message || "Iklan gagal dihapus.");
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
        <button
          className="outline-btn"
          onClick={() => refresh()}
          disabled={loading}
        >
          <RefreshCw size={15} /> Perbarui
        </button>
      </div>
      <div className="course-studio-layout">
        <aside className="course-studio-list">
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
                  { id: "ads", label: "Iklan" },
                  { id: "usage", label: "Penggunaan" },
                ].map((item) => (
                  <button
                    key={item.id}
                    className={tab === item.id ? "active" : ""}
                    onClick={() => setTab(item.id)}
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
                  <div className="course-mode-toggles">
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(courseDraft.enableListening)}
                        onChange={(event) =>
                          editCourse("enableListening", event.target.checked)
                        }
                      />{" "}
                      Listening Lab
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(courseDraft.enableAiLesson)}
                        onChange={(event) =>
                          editCourse("enableAiLesson", event.target.checked)
                        }
                      />{" "}
                      AI Lesson
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(courseDraft.enableLiveLesson)}
                        onChange={(event) =>
                          editCourse("enableLiveLesson", event.target.checked)
                        }
                      />{" "}
                      Live Lesson
                    </label>
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
                      <h4>{MODE_LABEL[tab]} · kategori & materi</h4>
                      <p>
                        JSON import/export tersedia untuk kategori, units, bank
                        soal, dialog, dan prompt.
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
                  <div className="course-content-layout">
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
                    <section className="course-content-unit-editor">
                      <div className="course-subheading">
                        <b>Materi / unit</b>
                        <div>
                          <button
                            className="outline-btn"
                            onClick={addUnit}
                            disabled={!currentModule.categories?.length}
                          >
                            <Plus size={15} /> Tambah materi
                          </button>
                          {selectedUnit && (
                            <button
                              className="course-icon-action delete"
                              onClick={deleteUnit}
                              title="Hapus materi"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                      {(currentModule.units || []).length > 0 && (
                        <div className="course-unit-list">
                          {currentModule.units.map((unit) => (
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
                              <span>
                                <b>{unit.title}</b>
                                <small>
                                  {unit.id} ·{" "}
                                  {unit.published ? "Published" : "Draft"}
                                </small>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {selectedUnit ? (
                        <div className="course-unit-form">
                          <div className="course-field-grid">
                            <label>
                              ID materi
                              <input
                                className="text-field"
                                value={selectedUnit.id}
                                onChange={(event) =>
                                  patchUnit("id", safeSlug(event.target.value))
                                }
                              />
                            </label>
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
                                <video src={selectedUnit.mediaUrl} controls />
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
                            <label className="course-published-toggle">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedUnit.published)}
                                onChange={(event) =>
                                  patchUnit("published", event.target.checked)
                                }
                              />{" "}
                              Materi diterbitkan
                            </label>
                          </div>
                          <div className="course-content-help">
                            {modality === "listening"
                              ? "Bank soal disimpan di content.questions. Setiap soal memiliki prompt, options, answer (indeks mulai 0), dan explain."
                              : modality === "ai_lesson"
                                ? "Cue card ada pada content.prompt. Konten ttsSegments mendukung dialog multi-speaker dengan teks dan voice per segmen."
                                : "Atur content.teacherRole, learnerRole, situation, opening, dan responseStyle. Live Teacher membuka percakapan lebih dulu."}
                          </div>
                          <label className="course-json-label">
                            KONTEN MATERI · JSON OBJECT
                            <textarea
                              className="course-json-editor"
                              spellCheck={false}
                              value={contentText}
                              onChange={(event) =>
                                setContentText(event.target.value)
                              }
                              rows={15}
                            />
                          </label>
                          <div className="course-editor-actions course-module-save">
                            <button
                              className="btn-primary"
                              onClick={saveModule}
                              disabled={busy || isNew}
                            >
                              <Check size={15} />
                              {busy ? "Menyimpan…" : "Simpan modul"}
                            </button>
                            <button
                              className="outline-btn"
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
                          Pilih kategori lalu tambahkan unit materi.
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
              {tab === "ads" && (
                <div className="course-editor-panel">
                  <div className="course-module-toolbar">
                    <div>
                      <h4>Iklan Course</h4>
                      <p>
                        Poster rasio 16:9, link eksternal, urutan, dan status
                        active/inactive. Iklan aktif tampil berurutan di halaman
                        Course.
                      </p>
                    </div>
                    <button className="btn-primary" onClick={() => editAd()}>
                      <Plus size={15} /> Buat iklan
                    </button>
                  </div>
                  {adDraft && (
                    <div className="course-ad-editor">
                      <div className="course-ad-editor-head">
                        <b>{adDraft.id ? "Edit iklan" : "Iklan baru"}</b>
                        <button
                          className="course-icon-action"
                          onClick={() => setAdDraft(null)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="course-field-grid">
                        <label>
                          Judul
                          <input
                            className="text-field"
                            value={adDraft.title}
                            onChange={(event) =>
                              setAdDraft((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          Urutan
                          <input
                            className="text-field"
                            type="number"
                            min="0"
                            value={adDraft.sortOrder}
                            onChange={(event) =>
                              setAdDraft((current) => ({
                                ...current,
                                sortOrder: Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                        <label className="span-2">
                          Deskripsi
                          <textarea
                            className="text-field"
                            rows={3}
                            value={adDraft.description}
                            onChange={(event) =>
                              setAdDraft((current) => ({
                                ...current,
                                description: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="span-2">
                          Poster URL · 16:9
                          <input
                            className="text-field"
                            value={adDraft.posterUrl}
                            onChange={(event) =>
                              setAdDraft((current) => ({
                                ...current,
                                posterUrl: event.target.value,
                              }))
                            }
                            placeholder="https://…/poster.jpg"
                          />
                        </label>
                        <label className="span-2">
                          Tautan HTTPS eksternal
                          <input
                            className="text-field"
                            value={adDraft.link}
                            onChange={(event) =>
                              setAdDraft((current) => ({
                                ...current,
                                link: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="course-published-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(adDraft.active)}
                            onChange={(event) =>
                              setAdDraft((current) => ({
                                ...current,
                                active: event.target.checked,
                              }))
                            }
                          />{" "}
                          Aktif
                        </label>
                      </div>
                      {adDraft.posterUrl && (
                        <div className="course-ad-preview">
                          <img src={adDraft.posterUrl} alt="Preview iklan" />
                        </div>
                      )}
                      <div className="course-editor-actions">
                        <button
                          className="btn-primary"
                          onClick={saveAd}
                          disabled={adBusy}
                        >
                          <Check size={15} /> Simpan iklan
                        </button>
                        <button
                          className="outline-btn"
                          onClick={() => setAdDraft(null)}
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="course-ad-admin-list">
                    {ads.map((ad) => (
                      <article key={ad.id} className="course-ad-admin-card">
                        <img src={ad.posterUrl} alt="" />
                        <div>
                          <b>{ad.title}</b>
                          <p>{ad.description}</p>
                          <small>
                            Urutan {ad.sortOrder} ·{" "}
                            {ad.active ? "Active" : "Inactive"} · {ad.link}
                          </small>
                        </div>
                        <span
                          className={`course-status-pill ${ad.active ? "published" : "draft"}`}
                        >
                          {ad.active ? "active" : "inactive"}
                        </span>
                        <div className="course-editor-actions">
                          <button
                            className="outline-btn"
                            onClick={() => editAd(ad)}
                          >
                            Edit
                          </button>
                          <button
                            className="course-icon-action delete"
                            onClick={() => removeAd(ad)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                    {!ads.length && (
                      <div className="course-studio-empty compact">
                        Belum ada iklan. Backend dapat membuat satu contoh iklan
                        saat migrasi pertama.
                      </div>
                    )}
                  </div>
                </div>
              )}
              {tab === "usage" && (
                <div className="course-editor-panel">
                  <CourseUsageInline courses={courses} />
                </div>
              )}
            </>
          )}
        </main>
      </div>
      {adDraft && null}
    </div>
  );
}

function CourseUsageInline({ courses }) {
  const [query, setQuery] = useState("");
  return (
    <div className="course-usage-inline">
      <div className="course-module-toolbar">
        <div>
          <h4>Statistik penggunaan diamond</h4>
          <p>
            Filter user, course, mode, bagian/soal, tanggal, dan urutkan hasil.
          </p>
        </div>
      </div>
      <UsageTable courses={courses} query={query} setQuery={setQuery} />
    </div>
  );
}
function UsageTable({ courses, query, setQuery }) {
  const [filters, setFilters] = useState({
    course_id: "",
    modality: "",
    from: "",
    to: "",
    sort: "created_at",
    direction: "desc",
  });
  const [result, setResult] = useState({
    items: [],
    page: 1,
    pages: 1,
    total: 0,
    summary: {},
  });
  const [busy, setBusy] = useState(false);
  async function load(page = 1) {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        ...filters,
        search: query,
        page: String(page),
        page_size: "25",
      });
      setResult(await apiJson(`admin/course-usage?${params}`));
    } catch (error) {
      toast.error(error.message || "Statistik gagal dimuat.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load(1);
  }, []);
  return (
    <>
      <div className="course-usage-summary">
        <div>
          <span>Catatan</span>
          <b>{result.summary?.events ?? result.total}</b>
        </div>
        <div>
          <span>Diamond</span>
          <b>{result.summary?.diamonds ?? 0}</b>
        </div>
        <div>
          <span>Durasi audio (detik)</span>
          <b>{result.summary?.duration_seconds ?? 0}</b>
        </div>
      </div>
      <div className="course-admin-filters">
        <label className="course-admin-search">
          <Search size={16} />
          <input
            value={query}
            placeholder="User / course / materi / operasi"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          className="text-field"
          value={filters.course_id}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              course_id: event.target.value,
            }))
          }
        >
          <option value="">Semua course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
        <select
          className="text-field"
          value={filters.modality}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              modality: event.target.value,
            }))
          }
        >
          <option value="">Semua mode</option>
          <option value="listening">Listening</option>
          <option value="ai_lesson">AI Lesson</option>
          <option value="live_lesson">Live Lesson</option>
        </select>
        <input
          type="date"
          className="text-field"
          value={filters.from}
          onChange={(event) =>
            setFilters((current) => ({ ...current, from: event.target.value }))
          }
        />
        <input
          type="date"
          className="text-field"
          value={filters.to}
          onChange={(event) =>
            setFilters((current) => ({ ...current, to: event.target.value }))
          }
        />
        <select
          className="text-field"
          value={filters.sort}
          onChange={(event) =>
            setFilters((current) => ({ ...current, sort: event.target.value }))
          }
        >
          <option value="created_at">Waktu</option>
          <option value="diamond_cost">Diamond</option>
          <option value="modality">Mode</option>
          <option value="course_name">Course</option>
          <option value="user_name">User</option>
        </select>
        <select
          className="text-field"
          value={filters.direction}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              direction: event.target.value,
            }))
          }
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <button className="outline-btn" onClick={() => load(1)}>
          <Search size={14} /> Cari
        </button>
      </div>
      <button
        className="outline-btn"
        onClick={() => load(result.page)}
        disabled={busy}
      >
        <RefreshCw size={14} /> Muat ulang
      </button>
      <div className="course-admin-table-wrap">
        <table className="course-admin-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>User</th>
              <th>Course / mode</th>
              <th>Bagian / soal</th>
              <th>Input / durasi</th>
              <th>Diamond</th>
            </tr>
          </thead>
          <tbody>
            {result.items?.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleString("id-ID")}</td>
                <td>
                  {item.user_name}
                  <small>{item.email}</small>
                </td>
                <td>
                  {item.course_name || "—"}
                  <small>
                    {MODE_LABEL[item.modality] || item.modality} ·{" "}
                    {item.provider}
                  </small>
                </td>
                <td>
                  {item.unit_title || item.unit_id || "—"}
                  <small>{item.operation}</small>
                </td>
                <td>
                  {item.transcript_chars || 0} chars ·{" "}
                  {item.audio_bytes
                    ? `${Math.round(item.audio_bytes / 1024)} KB · `
                    : ""}
                  {item.duration_seconds || 0}s
                </td>
                <td>{item.diamond_cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="course-admin-pagination">
        <span>
          {result.total || 0} catatan · {result.page}/{result.pages}
        </span>
        <div>
          <button
            className="outline-btn"
            disabled={result.page <= 1 || busy}
            onClick={() => load(result.page - 1)}
          >
            <ArrowUpWideNarrow size={13} /> Sebelumnya
          </button>
          <button
            className="outline-btn"
            disabled={result.page >= result.pages || busy}
            onClick={() => load(result.page + 1)}
          >
            Berikutnya <ArrowDownWideNarrow size={13} />
          </button>
        </div>
      </div>
    </>
  );
}
