import { useState, useEffect } from "react";
import {
  ArrowRight,
  AudioLines,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
  Play,
  RotateCcw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { apiFetch, apiJson } from "../../api";
import ModuleLoading from "../../components/ModuleLoading";
import ContentStudio from "./ContentStudio";
import { toast } from "sonner";

export default function AdminPage({ user, onCatalogChange }) {
  const [adminTab, setAdminTab] = useState("content");
  const [settings, setSettings] = useState({
    clario_base_url: "https://clariohub.id/v1",
    clario_fallback_url: "https://api-direct.clariohub.id/v1",
    clario_model: "clario/gemini-3.7-flash",
    gemini_live_model: "",
  });
  const [models, setModels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [users, setUsers] = useState([]);
  useEffect(() => {
    apiFetch("admin/users")
      .then((r) => r.json())
      .then((j) => setUsers(j.users || []))
      .catch(() => {});
  }, []);
  async function setPlan(id, plan) {
    try {
      const r = await apiFetch("admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, plan }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Paket gagal diubah");
      setUsers((xs) => xs.map((u) => (u.id === id ? { ...u, plan } : u)));
      toast.success("Paket akun diperbarui.");
    } catch (e) {
      toast.error(e.message);
    }
  }
  const [settingsError, setSettingsError] = useState("");
  async function loadSettings() {
    setReady(false);
    setSettingsError("");
    try {
      const [s, m] = await Promise.all([
        apiJson("admin/settings"),
        apiJson("models").catch(() => ({})),
      ]);
      setSettings(s.settings);
      setModels(
        (m.data || m.models || [])
          .map((x) => (typeof x === "string" ? x : x.id))
          .filter((x) => String(x).startsWith("clario/")),
      );
      setReady(true);
    } catch (error) {
      setSettingsError(error.message || "Gagal memuat pengaturan admin.");
    }
  }
  useEffect(() => {
    loadSettings();
  }, []);
  function change(k, v) {
    setSettings((p) => ({ ...p, [k]: v }));
  }
  async function save() {
    setBusy(true);
    try {
      const r = await apiFetch("admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          clario_api_key: apiKey,
          gemini_api_key: geminiKey,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal menyimpan");
      setApiKey("");
      setGeminiKey("");
      toast.success("Konfigurasi provider tersimpan terenkripsi di SQLite.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-page">
      <div className="eyebrow">
        <ShieldCheck size={14} /> ADMINISTRATION
      </div>
      <h1>
        Panel admin{" "}
        <span>
          <ShieldCheck size={27} />
        </span>
      </h1>
      <p className="page-intro">
        Konfigurasi berlaku global untuk akun belajar. API key terenkripsi
        sebelum disimpan.
      </p>
      <div
        className="admin-tabs"
        role="tablist"
        aria-label="Panel administrasi"
      >
        <button
          role="tab"
          aria-selected={adminTab === "content"}
          className={adminTab === "content" ? "active" : ""}
          onClick={() => setAdminTab("content")}
        >
          <BookOpen size={17} /> Studio konten
        </button>
        <button
          role="tab"
          aria-selected={adminTab === "access"}
          className={adminTab === "access" ? "active" : ""}
          onClick={() => setAdminTab("access")}
        >
          <Settings size={17} /> Akses & provider
        </button>
      </div>
      {adminTab === "content" ? (
        <ContentStudio onCatalogChange={onCatalogChange} />
      ) : settingsError ? (
        <div className="studio-error" role="alert">
          {settingsError} <button onClick={loadSettings}>Coba lagi</button>
        </div>
      ) : !ready ? (
        <ModuleLoading label="pengaturan admin" />
      ) : (
        <>
          <div className="admin-summary">
            <div>
              <span className="admin-avatar">
                <ShieldCheck size={19} />
              </span>
              <div>
                <b>{user.name}</b>
                <small>{user.email} · Administrator</small>
              </div>
            </div>
            <span className="secure-chip">
              <ShieldCheck size={13} /> ADMIN ONLY
            </span>
          </div>
          <section className="settings-card admin-control-card">
            <div className="setting-title">
              <div className="setting-icon red">
                <ShieldCheck size={18} />
              </div>
              <div>
                <b>Kontrol akses aplikasi</b>
                <small>
                  Perubahan berlaku setelah tombol Simpan konfigurasi.
                </small>
              </div>
            </div>
            <label className="toggle-row">
              <span>
                <b>Kunci aplikasi untuk non-admin</b>
                <small>
                  Memutus akses API pengguna reguler/premium, termasuk sesi yang
                  sudah login. Admin tetap bisa mengelola.
                </small>
              </span>
              <button
                className={`switch ${settings.lockdown ? "on" : ""}`}
                onClick={() => change("lockdown", !settings.lockdown)}
              >
                <i />
              </button>
            </label>
            <label className="toggle-row">
              <span>
                <b>Tutup pendaftaran baru</b>
                <small>
                  Pengguna lama tetap dapat login selama aplikasi tidak dikunci.
                </small>
              </span>
              <button
                className={`switch ${settings.stop_registration ? "on" : ""}`}
                onClick={() =>
                  change("stop_registration", !settings.stop_registration)
                }
              >
                <i />
              </button>
            </label>
          </section>
          <div className="admin-grid">
            <section className="settings-card">
              <div className="setting-title">
                <div className="setting-icon green">
                  <Cloud size={18} />
                </div>
                <div>
                  <b>Clario · OpenAI-compatible API</b>
                  <small>Key disimpan dengan AES-256-GCM di server</small>
                </div>
              </div>
              <label className="field-label">PRIMARY BASE URL</label>
              <input
                className="text-field"
                value={settings.clario_base_url || ""}
                onChange={(e) => change("clario_base_url", e.target.value)}
              />
              <label className="field-label">
                FALLBACK BASE URL (403 / WAF)
              </label>
              <input
                className="text-field"
                value={settings.clario_fallback_url || ""}
                onChange={(e) => change("clario_fallback_url", e.target.value)}
              />
              <label className="field-label">
                API KEY{" "}
                {settings.clario_key_masked && (
                  <span className="key-current">
                    · Tersimpan {settings.clario_key_masked}
                  </span>
                )}
              </label>
              <div className="secret-field">
                <input
                  className="text-field"
                  type={showKey ? "text" : "password"}
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    settings.clario_key_configured
                      ? "Kosongkan untuk mempertahankan key saat ini"
                      : "Tempel API key baru"
                  }
                />
                <button onClick={() => setShowKey(!showKey)}>
                  {showKey ? "Sembunyikan" : "Lihat"}
                </button>
              </div>
              <label className="field-label">MODEL TUTOR</label>
              <div className="select-wrap">
                <select
                  className="text-field"
                  value={settings.clario_model || ""}
                  onChange={(e) => change("clario_model", e.target.value)}
                >
                  {[
                    ...new Set(
                      [settings.clario_model, ...models].filter(Boolean),
                    ),
                  ].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </div>
              <button
                className="outline-btn model-refresh"
                onClick={() =>
                  apiFetch("models")
                    .then((r) => r.json())
                    .then((j) =>
                      setModels(
                        (j.data || [])
                          .map((m) => m.id)
                          .filter((x) => x?.startsWith("clario/")),
                      ),
                    )
                    .catch(() => toast.error("Katalog gagal diambil."))
                }
              >
                <RotateCcw size={14} /> Refresh katalog model
              </button>
              <div className="admin-divider" />
              <div className="setting-title">
                <div className="setting-icon lilac">
                  <AudioLines size={18} />
                </div>
                <div>
                  <b>Gemini Live</b>
                  <small>
                    Long-lived key terenkripsi; browser menerima token Live
                    sementara
                  </small>
                </div>
              </div>
              <label className="field-label">
                GEMINI API KEY{" "}
                {settings.gemini_key_masked && (
                  <span className="key-current">
                    · Tersimpan {settings.gemini_key_masked}
                  </span>
                )}
              </label>
              <input
                className="text-field"
                type="password"
                autoComplete="new-password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={
                  settings.gemini_key_configured
                    ? "Kosongkan untuk mempertahankan key"
                    : "Opsional \xB7 key Gemini baru"
                }
              />
              <label className="field-label">LIVE MODEL ID</label>
              <input
                className="text-field"
                value={settings.gemini_live_model || ""}
                onChange={(e) => change("gemini_live_model", e.target.value)}
                placeholder="Masukkan ID model Live yang tersedia"
              />
              <div className="info-box">
                <CircleHelp size={15} />
                <span>
                  Browser Live menggunakan token sementara yang ditandatangani
                  backend; long-lived API key tetap tersimpan terenkripsi dan
                  tidak dikirim ke browser.
                </span>
              </div>
              <button
                className="btn-primary admin-save"
                onClick={save}
                disabled={busy || !ready}
              >
                {busy ? (
                  <>
                    <span className="spinner" /> Menyimpan...
                  </>
                ) : (
                  <>
                    Simpan konfigurasi <Check size={15} />
                  </>
                )}
              </button>
              <div className="admin-divider" />
              <div className="setting-title">
                <div className="setting-icon blue">
                  <Settings size={17} />
                </div>
                <div>
                  <b>Akun & paket akses</b>
                  <small>
                    Premium ditetapkan manual, tanpa pembayaran di versi ini
                  </small>
                </div>
              </div>
              <div className="admin-users-list">
                {users.map((account) => (
                  <div className="admin-user-row" key={account.id}>
                    <span>
                      <b>{account.name}</b>
                      <small>
                        {account.email} ·{" "}
                        {account.role === "admin" ? "Admin" : "Regular"}
                      </small>
                    </span>
                    {account.role === "admin" ? (
                      <span className="secure-chip">ADMIN</span>
                    ) : (
                      <select
                        className="text-field plan-select"
                        value={account.plan || "regular"}
                        onChange={(e) => setPlan(account.id, e.target.value)}
                      >
                        <option value="regular">Regular</option>
                        <option value="premium">Premium</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <aside className="admin-side">
              <div className="settings-card">
                <div className="setting-title">
                  <div className="setting-icon blue">
                    <BarChart3 size={17} />
                  </div>
                  <div>
                    <b>Status penyimpanan</b>
                    <small>Database server</small>
                  </div>
                </div>
                <div className="admin-fact">
                  <span>Database</span>
                  <b>
                    {settings.database ||
                      "SQLite \xB7 /learnenglish/api/db/data.db"}
                  </b>
                </div>
                <div className="admin-fact">
                  <span>Akun aktif</span>
                  <b>Role: admin</b>
                </div>
                <div className="admin-fact">
                  <span>Audio</span>
                  <b>/learnenglish/api/uploads/{user.id}/</b>
                </div>
                <div className="admin-fact">
                  <span>Video lessons</span>
                  <b>Belum ada soal terverifikasi</b>
                </div>
              </div>
              <div className="settings-card video-curation">
                <div className="setting-title">
                  <div className="setting-icon orange">
                    <Play size={16} />
                  </div>
                  <div>
                    <b>Video YouTube</b>
                    <small>Soal hanya untuk sumber yang diverifikasi</small>
                  </div>
                </div>
                <p>
                  Belum ada video pendek spesifik yang lolos kurasi sumber,
                  durasi, subtitle, dan kecocokan level. Modul video sengaja
                  dilewati—tidak ada video atau pertanyaan yang dikarang.
                </p>
                <a
                  href="https://www.youtube.com/@IELTSbyIDP"
                  target="_blank"
                  rel="noreferrer"
                >
                  Jelajahi IELTS by IDP <ArrowRight size={13} />
                </a>
              </div>
              <div className="privacy-note">
                <ShieldCheck size={16} />
                <p>
                  Gunakan APP_ENCRYPTION_KEY kuat dan backup data.db. API key
                  tidak pernah ditampilkan kembali.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
