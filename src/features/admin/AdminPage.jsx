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
  KeyRound,
  Pencil,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { apiFetch, apiJson } from "../../api";
import ModuleLoading from "../../components/ModuleLoading";
import ContentStudio from "./ContentStudio";
import { toast } from "sonner";
import Swal from "sweetalert2";

export default function AdminPage({
  user,
  onCatalogChange,
  onSpeechModeChange,
}) {
  const [adminTab, setAdminTab] = useState("content");
  const [settings, setSettings] = useState({
    ai_provider: "clario",
    speech_input_mode: "live_transcribe",
    clario_base_url: "https://clariohub.id/v1",
    clario_fallback_url: "https://api-direct.clariohub.id/v1",
    clario_model: "clario/gemini-3.7-flash",
    ichan_base_url: "",
    ichan_server: "SG1",
    ichan_model: "",
    gemini_live_model: "",
  });
  const [models, setModels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [ichanSecret, setIchanSecret] = useState("");
  const [ichanToken, setIchanToken] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersBusy, setUsersBusy] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    plan: "regular",
  });
  const [editingUser, setEditingUser] = useState(null);
  const [editMode, setEditMode] = useState("edit");
  const [editUser, setEditUser] = useState({
    name: "",
    email: "",
    password: "",
    plan: "regular",
  });
  async function loadUsers() {
    setUsersError("");
    try {
      const response = await apiFetch("admin/users");
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Daftar user gagal dimuat.");
      setUsers(body.users || []);
    } catch (error) {
      setUsersError(error.message || "Daftar user gagal dimuat.");
    }
  }
  useEffect(() => {
    loadUsers();
  }, []);
  async function setPlan(id, plan) {
    try {
      const response = await apiFetch("admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, plan }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Paket gagal diubah");
      setUsers((rows) =>
        rows.map((account) => (account.id === id ? body.user : account)),
      );
      toast.success("Tipe akun diperbarui.");
    } catch (error) {
      toast.error(error.message);
    }
  }
  async function createUser(event) {
    event.preventDefault();
    setUsersBusy(true);
    try {
      const response = await apiFetch("admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "User gagal dibuat.");
      setUsers((rows) => [body.user, ...rows]);
      setNewUser({ name: "", email: "", password: "", plan: "regular" });
      setShowCreateUser(false);
      toast.success(
        "Akun user berhasil dibuat. User akan diminta mengganti password saat masuk.",
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUsersBusy(false);
    }
  }
  function openEditUser(account, mode = "edit") {
    setEditingUser(account);
    setEditMode(mode);
    setEditUser({
      name: account.name,
      email: account.email,
      password: "",
      plan: account.plan || "regular",
    });
  }
  async function saveUserEdit(event) {
    event.preventDefault();
    if (!editingUser) return;
    setUsersBusy(true);
    try {
      const changes =
        editMode === "password"
          ? { id: editingUser.id, password: editUser.password }
          : { id: editingUser.id, ...editUser };
      const response = await apiFetch("admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Perubahan user gagal disimpan.");
      setUsers((rows) =>
        rows.map((account) =>
          account.id === editingUser.id ? body.user : account,
        ),
      );
      setEditingUser(null);
      setEditUser({ name: "", email: "", password: "", plan: "regular" });
      toast.success(
        editMode === "password"
          ? "Password diganti. User harus membuat password baru saat masuk."
          : "Data user berhasil diperbarui.",
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUsersBusy(false);
    }
  }
  async function deleteUser(account) {
    const confirmation = await Swal.fire({
      title: "Hapus akun user?",
      text: `${account.name} (${account.email}) dan progres/audio server terkait akan dihapus permanen.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus akun",
      cancelButtonText: "Batal",
      confirmButtonColor: "#c84343",
    });
    if (!confirmation.isConfirmed) return;
    try {
      const response = await apiFetch(`admin/users/${account.id}`, {
        method: "DELETE",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "User gagal dihapus.");
      setUsers((rows) => rows.filter((userRow) => userRow.id !== account.id));
      toast.success("Akun dan data terkait telah dihapus.");
    } catch (error) {
      toast.error(error.message);
    }
  }
  const [settingsError, setSettingsError] = useState("");
  async function loadSettings() {
    setReady(false);
    setSettingsError("");
    try {
      const s = await apiJson("admin/settings");
      setSettings(s.settings);
      if (s.settings?.ai_provider === "clario") {
        const m = await apiJson("models").catch(() => ({}));
        setModels(
          (m.data || m.models || [])
            .map((x) => (typeof x === "string" ? x : x.id))
            .filter((x) => String(x).startsWith("clario/")),
        );
      } else {
        setModels([]);
      }
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
          ichan_secret: ichanSecret,
          ichan_token: ichanToken,
          gemini_api_key: geminiKey,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal menyimpan");
      setApiKey("");
      setIchanSecret("");
      setIchanToken("");
      setGeminiKey("");
      onSpeechModeChange?.(settings.speech_input_mode || "live_transcribe");
      toast.success(
        settings.ai_provider === "ichanlabs"
          ? "Pengaturan IchanLabs disimpan. Adapter menunggu sample API resmi sebelum dapat mengirim request."
          : "Konfigurasi global disimpan terenkripsi di server.",
      );
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
                <div className="setting-icon blue">
                  <Cloud size={18} />
                </div>
                <div>
                  <b>Server AI global</b>
                  <small>
                    Hanya provider yang dipilih yang boleh menerima request
                    user.
                  </small>
                </div>
              </div>
              <label className="field-label" htmlFor="global-ai-provider">
                PROVIDER AKTIF UNTUK SEMUA USER
              </label>
              <div className="select-wrap">
                <select
                  id="global-ai-provider"
                  className="text-field"
                  value={settings.ai_provider || "clario"}
                  onChange={(event) =>
                    change("ai_provider", event.target.value)
                  }
                >
                  <option value="clario">Clario · OpenAI-compatible API</option>
                  <option value="ichanlabs">IchanLabs · SG1–SG10</option>
                </select>
                <ChevronDown size={16} />
              </div>
              {settings.ai_provider === "ichanlabs" && (
                <div className="ichan-config-panel">
                  <div className="field-label">KONFIGURASI ICHANLABS</div>
                  <p className="admin-provider-warning">
                    Sample kontrak API IchanLabs belum tersedia di repository.
                    Endpoint, header, path, dan payload sengaja tidak ditebak.
                    Pengaturan dapat disimpan, tetapi request AI IchanLabs belum
                    akan dikirim; Clario juga tidak menjadi fallback.
                  </p>
                  <label className="field-label" htmlFor="ichan-server">
                    SERVER
                  </label>
                  <div className="select-wrap">
                    <select
                      id="ichan-server"
                      className="text-field"
                      value={settings.ichan_server || "SG1"}
                      onChange={(event) =>
                        change("ichan_server", event.target.value)
                      }
                    >
                      {Array.from(
                        { length: 10 },
                        (_, index) => `SG${index + 1}`,
                      ).map((server) => (
                        <option key={server}>{server}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </div>
                  <label className="field-label" htmlFor="ichan-url">
                    ENDPOINT / BASE URL
                  </label>
                  <input
                    id="ichan-url"
                    className="text-field"
                    value={settings.ichan_base_url || ""}
                    onChange={(event) =>
                      change("ichan_base_url", event.target.value)
                    }
                    placeholder="Endpoint dari sample resmi IchanLabs"
                  />
                  <label className="field-label" htmlFor="ichan-model">
                    MODEL ID
                  </label>
                  <input
                    id="ichan-model"
                    className="text-field"
                    value={settings.ichan_model || ""}
                    onChange={(event) =>
                      change("ichan_model", event.target.value)
                    }
                    placeholder="Model sesuai kontrak IchanLabs"
                  />
                  <label className="field-label" htmlFor="ichan-secret">
                    SECRET{" "}
                    {settings.ichan_secret_masked && (
                      <span className="key-current">
                        · Tersimpan {settings.ichan_secret_masked}
                      </span>
                    )}
                  </label>
                  <input
                    id="ichan-secret"
                    className="text-field"
                    type="password"
                    autoComplete="new-password"
                    value={ichanSecret}
                    onChange={(event) => setIchanSecret(event.target.value)}
                    placeholder={
                      settings.ichan_secret_configured
                        ? "Kosongkan untuk mempertahankan secret"
                        : "Secret IchanLabs"
                    }
                  />
                  <label className="field-label" htmlFor="ichan-token">
                    TOKEN{" "}
                    {settings.ichan_token_masked && (
                      <span className="key-current">
                        · Tersimpan {settings.ichan_token_masked}
                      </span>
                    )}
                  </label>
                  <input
                    id="ichan-token"
                    className="text-field"
                    type="password"
                    autoComplete="new-password"
                    value={ichanToken}
                    onChange={(event) => setIchanToken(event.target.value)}
                    placeholder={
                      settings.ichan_token_configured
                        ? "Kosongkan untuk mempertahankan token"
                        : "Token IchanLabs"
                    }
                  />
                </div>
              )}
              <div className="admin-divider" />
              <div className="setting-title">
                <div className="setting-icon lilac">
                  <AudioLines size={18} />
                </div>
                <div>
                  <b>Mode jawaban speaking global</b>
                  <small>
                    Digunakan bersama oleh seluruh user pada lesson speaking.
                  </small>
                </div>
              </div>
              <label className="field-label" htmlFor="speech-input-mode">
                MODE INPUT
              </label>
              <div className="select-wrap">
                <select
                  id="speech-input-mode"
                  className="text-field"
                  value={settings.speech_input_mode || "live_transcribe"}
                  onChange={(event) =>
                    change("speech_input_mode", event.target.value)
                  }
                >
                  <option value="live_transcribe">
                    Live transcription · browser
                  </option>
                  <option value="ai_audio">
                    Rekam audio · evaluasi server AI
                  </option>
                </select>
                <ChevronDown size={16} />
              </div>
              <div className="info-box speech-mode-info">
                <CircleHelp size={15} />
                <span>
                  {settings.speech_input_mode === "ai_audio"
                    ? "Audio dikirim hanya setelah persetujuan user ke provider global. Model/provider aktif harus mendukung input audio; transkrip baru tampil setelah AI selesai."
                    : "Transkrip browser bersifat read-only. Tergantung browser/OS, Web Speech dapat memproses audio melalui layanan vendor browser; audio tidak dikirim ke server SpeakUp."}
                </span>
              </div>
              <div className="admin-divider" />
              <div className="setting-title">
                <div className="setting-icon green">
                  <Cloud size={18} />
                </div>
                <div>
                  <b>Clario · OpenAI-compatible API</b>
                  <small>
                    {settings.ai_provider === "clario"
                      ? "Provider aktif untuk seluruh user · key AES-256-GCM"
                      : "Tidak digunakan sampai Clario dipilih sebagai provider global"}
                  </small>
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
                disabled={settings.ai_provider !== "clario"}
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
              <div className="admin-user-toolbar">
                <div>
                  <b>{users.length} akun</b>
                  <small>
                    Tambah, edit, reset password, ubah tipe atau hapus user.
                  </small>
                </div>
                <button
                  className="outline-btn"
                  onClick={() => {
                    setShowCreateUser((value) => !value);
                    setEditingUser(null);
                  }}
                >
                  {showCreateUser ? <X size={15} /> : <UserPlus size={15} />}
                  {showCreateUser ? "Tutup" : "Tambah user"}
                </button>
              </div>
              {usersError && (
                <div className="studio-error" role="alert">
                  {usersError} <button onClick={loadUsers}>Coba lagi</button>
                </div>
              )}
              {showCreateUser && (
                <form className="admin-user-form" onSubmit={createUser}>
                  <b>Buat akun user</b>
                  <label>
                    Nama
                    <input
                      className="text-field"
                      value={newUser.name}
                      onChange={(event) =>
                        setNewUser((value) => ({
                          ...value,
                          name: event.target.value,
                        }))
                      }
                      maxLength={100}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      className="text-field"
                      type="email"
                      autoComplete="off"
                      value={newUser.email}
                      onChange={(event) =>
                        setNewUser((value) => ({
                          ...value,
                          email: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Password awal
                    <input
                      className="text-field"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      value={newUser.password}
                      onChange={(event) =>
                        setNewUser((value) => ({
                          ...value,
                          password: event.target.value,
                        }))
                      }
                      required
                    />
                    <small>
                      Minimal 10 karakter; user harus mengganti password saat
                      login pertama.
                    </small>
                  </label>
                  <label>
                    Tipe akun
                    <select
                      className="text-field"
                      value={newUser.plan}
                      onChange={(event) =>
                        setNewUser((value) => ({
                          ...value,
                          plan: event.target.value,
                        }))
                      }
                    >
                      <option value="regular">Regular</option>
                      <option value="premium">Premium</option>
                    </select>
                  </label>
                  <div className="admin-user-form-actions">
                    <button
                      className="btn-primary"
                      type="submit"
                      disabled={usersBusy}
                    >
                      {usersBusy ? "Membuat…" : "Buat akun"}
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setShowCreateUser(false)}
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}
              {editingUser && (
                <form className="admin-user-form" onSubmit={saveUserEdit}>
                  <div className="admin-user-form-heading">
                    <b>
                      {editMode === "password"
                        ? `Ganti password · ${editingUser.name}`
                        : `Edit user · ${editingUser.name}`}
                    </b>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setEditingUser(null)}
                    >
                      <X size={15} /> Tutup
                    </button>
                  </div>
                  {editMode !== "password" && (
                    <>
                      <label>
                        Nama
                        <input
                          className="text-field"
                          value={editUser.name}
                          onChange={(event) =>
                            setEditUser((value) => ({
                              ...value,
                              name: event.target.value,
                            }))
                          }
                          maxLength={100}
                          required
                        />
                      </label>
                      <label>
                        Email
                        <input
                          className="text-field"
                          type="email"
                          value={editUser.email}
                          onChange={(event) =>
                            setEditUser((value) => ({
                              ...value,
                              email: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Tipe akun
                        <select
                          className="text-field"
                          value={editUser.plan}
                          onChange={(event) =>
                            setEditUser((value) => ({
                              ...value,
                              plan: event.target.value,
                            }))
                          }
                        >
                          <option value="regular">Regular</option>
                          <option value="premium">Premium</option>
                        </select>
                      </label>
                    </>
                  )}
                  <label>
                    {editMode === "password"
                      ? "Password baru"
                      : "Password baru (opsional)"}
                    <input
                      className="text-field"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      value={editUser.password}
                      onChange={(event) =>
                        setEditUser((value) => ({
                          ...value,
                          password: event.target.value,
                        }))
                      }
                      required={editMode === "password"}
                    />
                    <small>
                      Jika diisi, user wajib mengatur password baru saat login
                      berikutnya.
                    </small>
                  </label>
                  <div className="admin-user-form-actions">
                    <button
                      className="btn-primary"
                      type="submit"
                      disabled={usersBusy}
                    >
                      {usersBusy
                        ? "Menyimpan…"
                        : editMode === "password"
                          ? "Ganti password"
                          : "Simpan perubahan"}
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => setEditingUser(null)}
                    >
                      Batal
                    </button>
                  </div>
                </form>
              )}
              <div className="admin-users-table-wrap">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>USER</th>
                      <th>TIPE</th>
                      <th>AKSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((account) => (
                      <tr key={account.id}>
                        <td>
                          <b>{account.name}</b>
                          <small>{account.email}</small>
                        </td>
                        <td>
                          {account.role === "admin" ? (
                            <span className="secure-chip">ADMIN</span>
                          ) : (
                            <select
                              aria-label={`Tipe akun ${account.email}`}
                              className="text-field plan-select"
                              value={account.plan || "regular"}
                              onChange={(event) =>
                                setPlan(account.id, event.target.value)
                              }
                            >
                              <option value="regular">Regular</option>
                              <option value="premium">Premium</option>
                            </select>
                          )}
                        </td>
                        <td>
                          {account.role === "admin" ? (
                            <span className="admin-action-disabled">
                              Admin dilindungi
                            </span>
                          ) : (
                            <div className="admin-user-actions">
                              <button
                                className="icon-action"
                                title="Edit user"
                                aria-label={`Edit ${account.email}`}
                                onClick={() => {
                                  setShowCreateUser(false);
                                  openEditUser(account, "edit");
                                }}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                className="icon-action"
                                title="Ganti password"
                                aria-label={`Ganti password ${account.email}`}
                                onClick={() => {
                                  setShowCreateUser(false);
                                  openEditUser(account, "password");
                                }}
                              >
                                <KeyRound size={15} />
                              </button>
                              <button
                                className="icon-action danger"
                                title="Hapus user"
                                aria-label={`Hapus ${account.email}`}
                                onClick={() => deleteUser(account)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!users.length && (
                      <tr>
                        <td colSpan={3} className="admin-empty-users">
                          Belum ada user terdaftar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
