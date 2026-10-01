import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  Headphones,
  Plus,
  PenLine,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { apiJson } from "../../api";
import {
  generateKokoroAudio,
  generateKokoroCompositeAudio,
  KOKORO_VOICES,
} from "../../lib/ttsRocks";
import { saveSharedTtsAudio } from "../../lib/ttsCache";
import ModuleLoading from "../../components/ModuleLoading";
import DialogueEditor from "./DialogueEditor";

const emptyQuestion = () => ({
  prompt: "",
  options: ["", ""],
  answer: 0,
  explain: "",
});
const unitDraft = (level) => ({
  level,
  title: "",
  subtitle: "",
  emoji: "💬",
  duration: "3–4 menit",
  prompt: "",
  defaultVoice: "af_heart",
  ttsSegments: [],
  objective: "",
  part: "IELTS-style Part 1 · familiar topics",
  questionType: "Short personal questions",
  bandTarget: "IELTS-inspired practice · not an official score",
  prepSeconds: 0,
  responseSeconds: 60,
  image: "",
  imageContext: "",
  sortOrder: 100,
  published: true,
});
const listeningDraft = (level) => ({
  level,
  title: "",
  objective: "",
  script: "",
  defaultVoice: "af_heart",
  ttsSegments: [],
  image: "",
  sortOrder: 100,
  published: true,
  questions: [emptyQuestion()],
});

function Input({
  label,
  value,
  onChange,
  required = false,
  multiline = false,
  rows = 3,
  hint,
  type = "text",
  ...other
}) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          required={required}
          {...other}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
          required={required}
          {...other}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export default function ContentStudio({ onCatalogChange }) {
  const [catalog, setCatalog] = useState(null);
  const [tab, setTab] = useState("speaking");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [generatingCache, setGeneratingCache] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [error, setError] = useState("");

  async function refresh(selectedType, selectedId) {
    try {
      const data = await apiJson("admin/catalog");
      setCatalog(data);
      setError("");
      if (selectedId) {
        const record =
          selectedType === "level"
            ? data.levels.find((l) => l.id === selectedId)
            : selectedType === "unit"
              ? data.levels
                  .flatMap((l) => l.units)
                  .find((u) => u.id === selectedId)
              : data.listening.find((l) => l.id === selectedId);
        if (record)
          setDraft({ type: selectedType, value: structuredClone(record) });
      }
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  const levels = catalog?.levels || [];
  const records = useMemo(() => {
    const list =
      tab === "levels"
        ? levels
        : tab === "speaking"
          ? levels.flatMap((l) => l.units)
          : catalog?.listening || [];
    return list.filter(
      (item) =>
        (filter === "All" ||
          tab === "levels" ||
          (item.level || item.id) === filter) &&
        `${item.id} ${item.title || item.label}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  }, [catalog, tab, filter, search]);
  const editing = draft?.value;
  const change = (key, value) =>
    setDraft((d) => ({ ...d, value: { ...d.value, [key]: value } }));
  const pick = (type, item) => {
    setGenerationStatus("");
    setDraft({ type, value: structuredClone(item) });
  };
  const persistedItem =
    editing?.id && draft?.type === "unit"
      ? catalog?.levels
          .flatMap((level) => level.units)
          .find((item) => item.id === editing.id)
      : editing?.id && draft?.type === "lesson"
        ? catalog?.listening.find((item) => item.id === editing.id)
        : null;
  const audioSourceField = draft?.type === "unit" ? "prompt" : "script";
  const audioSourceChanged =
    draft?.type !== "level" &&
    (!persistedItem ||
      editing?.[audioSourceField] !== persistedItem?.[audioSourceField] ||
      JSON.stringify(editing?.ttsSegments || []) !==
        JSON.stringify(persistedItem?.ttsSegments || []));
  const create = () =>
    pick(
      tab === "speaking" ? "unit" : "lesson",
      tab === "speaking"
        ? unitDraft(filter === "All" ? "A1" : filter)
        : listeningDraft(filter === "All" ? "A1" : filter),
    );
  const setQuestion = (index, key, value) =>
    change(
      "questions",
      editing.questions.map((q, i) =>
        i === index ? { ...q, [key]: value } : q,
      ),
    );
  const setOption = (i, j, value) =>
    setQuestion(
      i,
      "options",
      editing.questions[i].options.map((o, k) => (k === j ? value : o)),
    );

  async function save(event) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      const type = draft.type;
      const path =
        type === "level"
          ? `admin/levels/${editing.id}`
          : type === "unit"
            ? `admin/units${editing.id ? `/${editing.id}` : ""}`
            : `admin/listening${editing.id ? `/${editing.id}` : ""}`;
      const result = await apiJson(path, {
        method: type === "level" || editing.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      await refresh(type, editing.id || result.id);
      await onCatalogChange();
      toast.success(
        "Materi tersimpan di database dan langsung tersedia sesuai status publikasinya.",
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function generateCache() {
    if (!editing?.id || audioSourceChanged || generatingCache) return;
    const contentType = draft.type === "unit" ? "speaking" : "listening";
    const sourceText = editing.ttsSegments?.length
      ? editing.ttsSegments.map((turn) => turn.text).join(" ")
      : editing[draft.type === "unit" ? "prompt" : "script"];
    const item = {
      id: editing.id,
      ttsRevision: editing.ttsRevision,
    };
    if (!item.ttsRevision) {
      toast.error("Muat ulang materi sebelum membuat shared cache.");
      return;
    }
    const onStatus = (status) => {
      if (status?.message) setGenerationStatus(status.message);
    };
    setGeneratingCache(true);
    setGenerationStatus("Menyiapkan model Kokoro di browser admin…");
    try {
      for (let index = 0; index < KOKORO_VOICES.length; index += 1) {
        const voice = KOKORO_VOICES[index];
        setGenerationStatus(
          `Suara ${index + 1}/${KOKORO_VOICES.length}: ${voice.name}…`,
        );
        const audio = await generateKokoroAudio(sourceText, {
          voice: voice.id,
          compute: "auto",
          onStatus,
        });
        await saveSharedTtsAudio({
          contentType,
          item,
          voiceId: voice.id,
          audio,
        });
      }
      if (editing.ttsSegments?.length >= 2) {
        setGenerationStatus(
          "Merender dialog multi-speaker dengan jeda singkat…",
        );
        const audio = await generateKokoroCompositeAudio(editing.ttsSegments, {
          compute: "auto",
          pauseMs: 280,
          onStatus,
        });
        await saveSharedTtsAudio({
          contentType,
          item,
          voiceId: "multi",
          audio,
        });
      }
      setGenerationStatus("Shared Kokoro audio siap untuk akun bersama.");
      toast.success(
        editing.ttsSegments?.length >= 2
          ? "Empat voice tunggal dan dialog multi-speaker tersimpan di cache bersama."
          : "Empat voice tersimpan di cache bersama.",
      );
    } catch (generationError) {
      setGenerationStatus(generationError.message || "Pembuatan cache gagal.");
      toast.error(generationError.message || "Pembuatan cache gagal.");
    } finally {
      setGeneratingCache(false);
    }
  }

  async function archive() {
    if (!editing?.id || draft.type === "level") return;
    const confirm = await Swal.fire({
      title: "Arsipkan materi?",
      text: "Materi tidak tampil bagi murid, tetapi tetap di database dan dapat dipublikasikan lagi. Progres lama tidak dihapus.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Arsipkan",
      cancelButtonText: "Batal",
    });
    if (!confirm.isConfirmed) return;
    setBusy(true);
    try {
      await apiJson(
        `admin/${draft.type === "unit" ? "units" : "listening"}/${editing.id}`,
        { method: "DELETE" },
      );
      await refresh(draft.type, editing.id);
      await onCatalogChange();
      toast.success("Materi berhasil diarsipkan.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!catalog && !error)
    return <ModuleLoading label="katalog dan bank soal" />;
  return (
    <section className="studio-page">
      <div className="studio-heading">
        <div>
          <div className="eyebrow">CONTENT STUDIO · SQLITE</div>
          <h2>
            Kurikulum & bank soal <span>✦</span>
          </h2>
          <p>
            Edit materi tanpa build ulang frontend. Perubahan langsung tersimpan
            di server; arsip tidak menghapus progres yang sudah ada.
          </p>
        </div>
        <button
          type="button"
          className="outline-btn"
          onClick={() => refresh(draft?.type, editing?.id)}
        >
          <RotateCcw size={16} /> Muat ulang
        </button>
      </div>
      {error && (
        <div role="alert" className="studio-error">
          Gagal memuat katalog: {error}{" "}
          <button onClick={() => refresh()}>Coba lagi</button>
        </div>
      )}
      <div className="studio-tabs" role="tablist" aria-label="Jenis materi">
        {[
          ["speaking", <BookOpen size={16} />, "Speaking"],
          ["listening", <Headphones size={16} />, "Listening & soal"],
          ["levels", <Check size={16} />, "Jenjang A1–C2"],
        ].map(([key, icon, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setTab(key);
              setFilter("All");
              setSearch("");
              setDraft(null);
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      <div className="studio-layout">
        <aside className="studio-list-panel">
          <div className="studio-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Cari materi"
                placeholder="Cari materi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {tab !== "levels" && (
              <select
                aria-label="Filter level"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option>All</option>
                {levels.map((l) => (
                  <option key={l.id}>{l.id}</option>
                ))}
              </select>
            )}
          </div>
          {tab !== "levels" && (
            <button type="button" className="studio-add" onClick={create}>
              <Plus size={17} /> Tambah{" "}
              {tab === "speaking" ? "unit speaking" : "lesson listening"}
            </button>
          )}
          <div className="studio-list">
            {records.map((item) => {
              const selected = editing?.id === item.id && !!item.id;
              return (
                <button
                  type="button"
                  className={`studio-list-item ${selected ? "active" : ""}`}
                  key={item.id}
                  onClick={() =>
                    pick(
                      tab === "levels"
                        ? "level"
                        : tab === "speaking"
                          ? "unit"
                          : "lesson",
                      item,
                    )
                  }
                >
                  <span className="studio-id">
                    {tab === "levels" ? item.id : item.level}
                  </span>
                  <span>
                    <b>{item.title || item.label}</b>
                    <small>
                      {item.id} ·{" "}
                      {tab === "levels"
                        ? `${item.units.length} unit`
                        : item.published
                          ? "Publik"
                          : "Diarsipkan"}
                    </small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              );
            })}
            {!records.length && (
              <p className="studio-empty">
                Belum ada materi untuk filter ini. Coba buat yang baru.
              </p>
            )}
          </div>
        </aside>
        <div className="studio-editor-panel">
          {!editing ? (
            <div className="studio-placeholder">
              <div>
                <PenLine size={30} />
              </div>
              <h3>Kontenmu, ceritamu.</h3>
              <p>
                Pilih materi di samping untuk diedit atau tambah lesson baru.
                Perubahan tersimpan langsung ke SQLite, bukan ke kode frontend.
              </p>
            </div>
          ) : (
            <form
              onSubmit={save}
              className="studio-form"
              key={`${draft.type}-${editing.id || "new"}`}
            >
              <div className="studio-form-head">
                <div>
                  <span className="eyebrow">
                    {editing.id ? `EDIT ${editing.id}` : "KONTEN BARU"}
                  </span>
                  <h3>
                    {draft.type === "level"
                      ? "Detail jenjang"
                      : draft.type === "unit"
                        ? "Unit speaking"
                        : "Lesson & soal listening"}
                  </h3>
                </div>
                {draft.type !== "level" && (
                  <span
                    className={`publish-pill ${editing.published ? "" : "archived"}`}
                  >
                    {editing.published ? "● Publik" : "○ Arsip"}
                  </span>
                )}
              </div>
              {draft.type === "level" ? (
                <>
                  <Input
                    label="Nama jenjang"
                    value={editing.name}
                    onChange={(v) => change("name", v)}
                    required
                  />
                  <Input
                    label="Label / fokus"
                    value={editing.label}
                    onChange={(v) => change("label", v)}
                    required
                  />
                  <Input
                    label="Panduan band (bukan konversi resmi)"
                    value={editing.bandGuide}
                    onChange={(v) => change("bandGuide", v)}
                    multiline
                    required
                  />
                  <div className="studio-two">
                    <Input
                      label="Warna kartu (hex)"
                      value={editing.color}
                      onChange={(v) => change("color", v)}
                      required
                    />
                    <Input
                      label="Urutan"
                      type="number"
                      min="0"
                      value={editing.sortOrder}
                      onChange={(v) => change("sortOrder", v)}
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="studio-two">
                    <label className="studio-field">
                      <span>Level</span>
                      <select
                        value={editing.level}
                        onChange={(e) => change("level", e.target.value)}
                      >
                        {levels.map((l) => (
                          <option key={l.id}>{l.id}</option>
                        ))}
                      </select>
                    </label>
                    <Input
                      label="Urutan di level"
                      type="number"
                      min="0"
                      max="10000"
                      value={editing.sortOrder}
                      onChange={(v) => change("sortOrder", v)}
                      required
                    />
                  </div>
                  <Input
                    label="Judul lesson"
                    value={editing.title}
                    onChange={(v) => change("title", v)}
                    required
                  />
                  <Input
                    label={
                      draft.type === "unit"
                        ? "Deskripsi singkat"
                        : "Tujuan listening"
                    }
                    value={
                      draft.type === "unit"
                        ? editing.subtitle
                        : editing.objective
                    }
                    onChange={(v) =>
                      change(
                        draft.type === "unit" ? "subtitle" : "objective",
                        v,
                      )
                    }
                    required
                  />
                  <label className="studio-field">
                    <span>Default Kokoro voice · cached mode</span>
                    <select
                      value={editing.defaultVoice || "af_heart"}
                      onChange={(event) =>
                        change("defaultVoice", event.target.value)
                      }
                    >
                      {KOKORO_VOICES.map((voice) => (
                        <option key={voice.id} value={voice.id}>
                          {voice.name} · {voice.accent} ({voice.id})
                        </option>
                      ))}
                    </select>
                    <small>
                      Voice ini menjadi default untuk audio tunggal; dialog
                      multi-speaker memakai voice pada tiap giliran.
                    </small>
                  </label>
                  {draft.type === "unit" ? (
                    <>
                      <Input
                        label="Tujuan belajar"
                        value={editing.objective}
                        onChange={(v) => change("objective", v)}
                        required
                      />
                      <Input
                        label="Prompt / cue card"
                        value={editing.prompt}
                        onChange={(v) => change("prompt", v)}
                        multiline
                        rows={5}
                        required
                      />
                      <DialogueEditor
                        segments={editing.ttsSegments || []}
                        defaultVoice={editing.defaultVoice || "af_heart"}
                        onChange={(segments) => change("ttsSegments", segments)}
                      />
                      <div className="studio-two">
                        <Input
                          label="Format (Part 1 / Part 2 / Part 3)"
                          value={editing.part}
                          onChange={(v) => change("part", v)}
                          required
                        />
                        <Input
                          label="Tipe pertanyaan"
                          value={editing.questionType}
                          onChange={(v) => change("questionType", v)}
                          required
                        />
                      </div>
                      <Input
                        label="Panduan belajar (bukan band resmi)"
                        value={editing.bandTarget}
                        onChange={(v) => change("bandTarget", v)}
                        required
                      />
                      <div className="studio-three">
                        <Input
                          label="Emoji"
                          value={editing.emoji}
                          onChange={(v) => change("emoji", v)}
                          required
                        />
                        <Input
                          label="Estimasi durasi"
                          value={editing.duration}
                          onChange={(v) => change("duration", v)}
                          required
                        />
                        <Input
                          label="Persiapan (detik)"
                          type="number"
                          min="0"
                          max="120"
                          value={editing.prepSeconds}
                          onChange={(v) => change("prepSeconds", v)}
                          required
                        />
                      </div>
                      <Input
                        label="Batas respons (detik)"
                        type="number"
                        min="15"
                        max="840"
                        value={editing.responseSeconds}
                        onChange={(v) => change("responseSeconds", v)}
                        required
                      />
                      <Input
                        label="Konteks visual (opsional)"
                        value={editing.imageContext || ""}
                        onChange={(v) => change("imageContext", v)}
                        multiline
                        hint="Jelaskan hanya detail yang benar-benar terlihat pada ilustrasi."
                      />
                    </>
                  ) : (
                    <>
                      <Input
                        label="Naskah audio asli"
                        value={editing.script}
                        onChange={(v) => change("script", v)}
                        multiline
                        rows={7}
                        required
                        hint="Dibacakan oleh TTS perangkat; soal harus dapat dijawab dari naskah ini."
                      />
                      <DialogueEditor
                        segments={editing.ttsSegments || []}
                        defaultVoice={editing.defaultVoice || "af_heart"}
                        onChange={(segments) => change("ttsSegments", segments)}
                      />
                      <div className="question-editor">
                        <div className="question-title">
                          <b>Bank soal · {editing.questions.length}</b>
                          <button
                            type="button"
                            className="outline-btn"
                            disabled={editing.questions.length >= 12}
                            onClick={() =>
                              change("questions", [
                                ...editing.questions,
                                emptyQuestion(),
                              ])
                            }
                          >
                            <Plus size={15} /> Tambah soal
                          </button>
                        </div>
                        {editing.questions.map((q, i) => (
                          <div className="question-draft" key={i}>
                            <div className="question-draft-head">
                              <strong>Soal {i + 1}</strong>
                              <button
                                type="button"
                                aria-label={`Hapus soal ${i + 1}`}
                                disabled={editing.questions.length <= 1}
                                onClick={() =>
                                  change(
                                    "questions",
                                    editing.questions.filter((_, j) => i !== j),
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <Input
                              label="Pertanyaan"
                              value={q.prompt}
                              onChange={(v) => setQuestion(i, "prompt", v)}
                              required
                            />
                            <div className="question-options">
                              {q.options.map((option, j) => (
                                <div key={j}>
                                  <label className="studio-field">
                                    <span>
                                      Pilihan {String.fromCharCode(65 + j)}
                                    </span>
                                    <input
                                      value={option}
                                      onChange={(e) =>
                                        setOption(i, j, e.target.value)
                                      }
                                      required
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    aria-label={`Hapus pilihan ${j + 1}`}
                                    disabled={q.options.length <= 2}
                                    onClick={() => {
                                      const opts = q.options.filter(
                                        (_, k) => k !== j,
                                      );
                                      change(
                                        "questions",
                                        editing.questions.map((item, k) =>
                                          k === i
                                            ? {
                                                ...item,
                                                options: opts,
                                                answer: Math.min(
                                                  item.answer,
                                                  opts.length - 1,
                                                ),
                                              }
                                            : item,
                                        ),
                                      );
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="text-button"
                              disabled={q.options.length >= 5}
                              onClick={() =>
                                setQuestion(i, "options", [...q.options, ""])
                              }
                            >
                              <Plus size={14} /> Tambah pilihan
                            </button>
                            <label className="studio-field">
                              <span>Jawaban benar</span>
                              <select
                                value={q.answer}
                                onChange={(e) =>
                                  setQuestion(
                                    i,
                                    "answer",
                                    Number(e.target.value),
                                  )
                                }
                              >
                                {q.options.map((_, j) => (
                                  <option value={j} key={j}>
                                    Pilihan {String.fromCharCode(65 + j)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Input
                              label="Penjelasan jawaban"
                              value={q.explain}
                              onChange={(v) => setQuestion(i, "explain", v)}
                              multiline
                              rows={2}
                              required
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <Input
                    label="Path ilustrasi (opsional)"
                    value={editing.image || ""}
                    onChange={(v) => change("image", v)}
                    placeholder="/learnenglish/images/.../scene.jpg"
                    hint="Pakai aset lokal yang sudah diunggah ke public/images; tidak menerima URL eksternal."
                  />
                  <label className="studio-publish">
                    <input
                      type="checkbox"
                      checked={!!editing.published}
                      onChange={(e) => change("published", e.target.checked)}
                    />
                    <span>
                      <b>Terbitkan untuk murid</b>
                      <small>
                        Matikan untuk mengarsipkan tanpa menghapus riwayat
                        belajar.
                      </small>
                    </span>
                  </label>
                </>
              )}
              {draft.type !== "level" && (
                <section className="studio-cache-generator">
                  <div>
                    <b>
                      <AudioLines size={16} /> Shared Kokoro cache
                    </b>
                    <small>
                      {editing.ttsSegments?.length >= 2
                        ? "Membuat empat voice tunggal lalu satu file dialog multi-speaker."
                        : "Membuat empat voice Kokoro secara serial di browser admin."}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="outline-btn"
                    disabled={
                      busy ||
                      generatingCache ||
                      !editing.id ||
                      audioSourceChanged
                    }
                    onClick={generateCache}
                  >
                    {generatingCache ? (
                      <>
                        <span className="spinner" /> Membuat cache…
                      </>
                    ) : (
                      <>
                        <AudioLines size={15} /> Generate voice cache
                      </>
                    )}
                  </button>
                  {audioSourceChanged && editing.id && (
                    <p className="studio-cache-hint">
                      Simpan perubahan prompt/naskah atau giliran dialog dulu
                      agar cache dibuat untuk versi materi yang benar.
                    </p>
                  )}
                  {!editing.id && (
                    <p className="studio-cache-hint">
                      Simpan item baru sebelum membuat audio cache.
                    </p>
                  )}
                  {generationStatus && (
                    <p className="studio-cache-status" role="status">
                      {generationStatus}
                    </p>
                  )}
                </section>
              )}
              <div className="studio-actions">
                <button
                  className="btn-primary"
                  disabled={busy || generatingCache}
                >
                  {busy ? (
                    <>
                      <span className="spinner" /> Menyimpan...
                    </>
                  ) : (
                    <>
                      <Check size={17} /> Simpan ke database
                    </>
                  )}
                </button>
                {editing.id && draft.type !== "level" && editing.published && (
                  <button
                    type="button"
                    className="danger-button"
                    disabled={busy || generatingCache}
                    onClick={archive}
                  >
                    <Trash2 size={15} /> Arsipkan
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
