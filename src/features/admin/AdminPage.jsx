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
  Users,
  ShoppingBag,
} from "lucide-react";
import { apiFetch, apiJson } from "../../api";
import ModuleLoading from "../../components/ModuleLoading";
import ContentStudio from "./ContentStudio";
import AdminAudioCache from "./AdminAudioCache";
import AdminUsersPanel from "./AdminUsersPanel";
import AdminPurchasesPanel from "./AdminPurchasesPanel";
import { toast } from "sonner";

const FREE_DEFAULT_POOL = Array.from(
  { length: 10 },
  (_, index) => `https://sg${index + 1}.ichsanlabs.com`,
).join("\n");

export default function AdminPage({
  user,
  onCatalogChange,
  onSpeechScoringModeChange,
  onSpeechSimilarityThresholdChange,
  onAIProviderChange,
}) {
  const [adminTab, setAdminTab] = useState("content");
  const [settings, setSettings] = useState({
    ai_provider: "clario",
    speech_input_mode: "live_transcribe",
    speech_scoring_mode: "local",
    speech_similarity_threshold: 90,
    payment_qris_payload: "",
    payment_tax_percent: 0,
    payment_admin_fee: 0,
    payment_whatsapp: "",
    payment_static_qr_available: false,
    clario_base_url: "https://clariohub.id/v1",
    clario_fallback_url: "https://api-direct.clariohub.id/v1",
    clario_model: "clario/gemini-3.7-flash",
    free_pool: FREE_DEFAULT_POOL,
    free_ttl_min: 30,
    free_sub: "api-client",
    free_token_mode: "auto",
    free_browser_debug: false,
    gemini_live_model: "",
  });
  const [models, setModels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [freeApiKey, setFreeApiKey] = useState("");
  const [freeJwtSecret, setFreeJwtSecret] = useState("");
  const [freeManualToken, setFreeManualToken] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [paymentQrBusy, setPaymentQrBusy] = useState(false);
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
  async function uploadStaticQr(event) {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image) return;
    setPaymentQrBusy(true);
    try {
      const form = new FormData();
      form.append("image", image, image.name);
      const response = await apiFetch("admin/payment-qr", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "QR statis gagal diunggah.");
      setSettings((current) => ({
        ...current,
        payment_static_qr_available: true,
      }));
      toast.success("QR statis berhasil disimpan sebagai alternatif.");
    } catch (error) {
      toast.error(error.message || "QR statis gagal diunggah.");
    } finally {
      setPaymentQrBusy(false);
    }
  }
  async function removeStaticQr() {
    setPaymentQrBusy(true);
    try {
      const response = await apiFetch("admin/payment-qr", { method: "DELETE" });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "QR statis gagal dihapus.");
      setSettings((current) => ({
        ...current,
        payment_static_qr_available: false,
      }));
      toast.success("QR statis dihapus.");
    } catch (error) {
      toast.error(error.message || "QR statis gagal dihapus.");
    } finally {
      setPaymentQrBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const { speech_input_mode: _legacyMode, ...saveSettings } = settings;
      const r = await apiFetch("admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...saveSettings,
          clario_api_key: apiKey,
          free_api_key: freeApiKey,
          free_jwt_secret: freeJwtSecret,
          free_manual_token: freeManualToken,
          gemini_api_key: geminiKey,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gagal menyimpan");
      setApiKey("");
      setFreeApiKey("");
      setFreeJwtSecret("");
      setFreeManualToken("");
      setGeminiKey("");
      await loadSettings();
      onSpeechScoringModeChange?.(settings.speech_scoring_mode || "local");
      onSpeechSimilarityThresholdChange?.(
        Number(settings.speech_similarity_threshold) || 90,
      );
      onAIProviderChange?.(settings.ai_provider || "clario");
      toast.success(
        "Pengaturan global disimpan; credential rahasia terenkripsi di server.",
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
        Konfigurasi berlaku global untuk akun belajar. Credential rahasia
        dienkripsi sebelum disimpan.
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
          aria-selected={adminTab === "audio"}
          className={adminTab === "audio" ? "active" : ""}
          onClick={() => setAdminTab("audio")}
        >
          <AudioLines size={17} /> Audio cache
        </button>
        <button
          role="tab"
          aria-selected={adminTab === "users"}
          className={adminTab === "users" ? "active" : ""}
          onClick={() => setAdminTab("users")}
        >
          <Users size={17} /> Users
        </button>
        <button
          role="tab"
          aria-selected={adminTab === "purchases"}
          className={adminTab === "purchases" ? "active" : ""}
          onClick={() => setAdminTab("purchases")}
        >
          <ShoppingBag size={17} /> Pembelian
        </button>
        <button
          role="tab"
          aria-selected={adminTab === "access"}
          className={adminTab === "access" ? "active" : ""}
          onClick={() => setAdminTab("access")}
        >
          <Settings size={17} /> Akses & pembayaran
        </button>
      </div>
      {adminTab === "content" ? (
        <ContentStudio onCatalogChange={onCatalogChange} />
      ) : adminTab === "audio" ? (
        <AdminAudioCache />
      ) : adminTab === "users" ? (
        <AdminUsersPanel />
      ) : adminTab === "purchases" ? (
        <AdminPurchasesPanel />
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
                  Memutus akses API seluruh akun learner, termasuk sesi yang
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
                  <option value="free">Free API Key · SG1–SG10</option>
                </select>
                <ChevronDown size={16} />
              </div>
              {settings.ai_provider === "free" && (
                <div className="free-config-panel">
                  <div className="field-label">
                    KONFIGURASI FREE API KEY · MULTI-POOL
                  </div>
                  <p className="admin-provider-warning">
                    Kunci API, JWT secret, dan manual token hanya dikirim ke
                    server SpeakUp dan dienkripsi saat disimpan. Jangan memakai
                    credential contoh yang tertanam pada sample.
                  </p>
                  <label className="field-label" htmlFor="free-pool">
                    SERVER NODE POOL · SATU URL PER BARIS
                  </label>
                  <textarea
                    id="free-pool"
                    className="text-field"
                    rows={8}
                    spellCheck={false}
                    value={settings.free_pool || FREE_DEFAULT_POOL}
                    onChange={(event) =>
                      change("free_pool", event.target.value)
                    }
                    placeholder={FREE_DEFAULT_POOL}
                  />
                  <small className="field-hint">
                    Tiap request memilih satu node secara acak. Hanya HTTPS
                    sg1–sg10.ichsanlabs.com yang diizinkan.
                  </small>
                  <label className="field-label" htmlFor="free-api-key">
                    API KEY{" "}
                    {settings.free_api_key_masked && (
                      <span className="key-current">
                        · Tersimpan {settings.free_api_key_masked}
                      </span>
                    )}
                  </label>
                  <input
                    id="free-api-key"
                    className="text-field"
                    type="password"
                    autoComplete="new-password"
                    value={freeApiKey}
                    onChange={(event) => setFreeApiKey(event.target.value)}
                    placeholder={
                      settings.free_api_key_configured
                        ? "Kosongkan untuk mempertahankan API key"
                        : "Masukkan Free API Key"
                    }
                  />
                  <label className="field-label" htmlFor="free-jwt-secret">
                    JWT SECRET{" "}
                    {settings.free_jwt_secret_masked && (
                      <span className="key-current">
                        · Tersimpan {settings.free_jwt_secret_masked}
                      </span>
                    )}
                  </label>
                  <input
                    id="free-jwt-secret"
                    className="text-field"
                    type="password"
                    autoComplete="new-password"
                    value={freeJwtSecret}
                    onChange={(event) => setFreeJwtSecret(event.target.value)}
                    placeholder={
                      settings.free_jwt_secret_configured
                        ? "Kosongkan untuk mempertahankan JWT secret"
                        : "Diperlukan untuk mode token otomatis"
                    }
                  />
                  <div className="free-token-options">
                    <label className="field-label" htmlFor="free-ttl">
                      TTL TOKEN (MENIT)
                      <input
                        id="free-ttl"
                        className="text-field"
                        type="number"
                        min={1}
                        max={1440}
                        value={settings.free_ttl_min ?? 30}
                        onChange={(event) =>
                          change("free_ttl_min", Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="field-label" htmlFor="free-sub">
                      SUBJECT (SUB)
                      <input
                        id="free-sub"
                        className="text-field"
                        maxLength={128}
                        value={settings.free_sub || "api-client"}
                        onChange={(event) =>
                          change("free_sub", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <label className="field-label" htmlFor="free-token-mode">
                    TOKEN MODE
                  </label>
                  <div className="select-wrap">
                    <select
                      id="free-token-mode"
                      className="text-field"
                      value={settings.free_token_mode || "auto"}
                      onChange={(event) => {
                        change("free_token_mode", event.target.value);
                        if (event.target.value === "manual")
                          change("free_browser_debug", false);
                      }}
                    >
                      <option value="auto">Auto · JWT HS256 di server</option>
                      <option value="manual">Manual token</option>
                    </select>
                    <ChevronDown size={16} />
                  </div>
                  {settings.free_token_mode === "manual" && (
                    <>
                      <label
                        className="field-label"
                        htmlFor="free-manual-token"
                      >
                        MANUAL TOKEN{" "}
                        {settings.free_manual_token_masked && (
                          <span className="key-current">
                            · Tersimpan {settings.free_manual_token_masked}
                          </span>
                        )}
                      </label>
                      <input
                        id="free-manual-token"
                        className="text-field"
                        type="password"
                        autoComplete="new-password"
                        value={freeManualToken}
                        onChange={(event) =>
                          setFreeManualToken(event.target.value)
                        }
                        placeholder={
                          settings.free_manual_token_configured
                            ? "Kosongkan untuk mempertahankan token"
                            : "Masukkan JWT manual"
                        }
                      />
                    </>
                  )}
                  <div className="info-box">
                    <CircleHelp size={15} />
                    <span>
                      Mode otomatis membuat JWT HS256 di server (iss, sub, exp,
                      apiKey), lalu mengirim Authorization: Bearer dan
                      X-API-Key. Audio dan prompt dikirim sebagai FormData ke
                      node /chat.
                    </span>
                  </div>
                  <div className="free-browser-debug-setting">
                    <div>
                      <b>Debug request langsung dari browser</b>
                      <small>
                        Hanya sesi Admin; menampilkan respons mentah Free API
                        untuk diagnosis, tanpa menyimpan hasil lesson.
                      </small>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-label="Debug Free API langsung dari browser untuk Admin"
                      aria-checked={Boolean(settings.free_browser_debug)}
                      className="free-browser-debug-switch"
                      disabled={
                        settings.free_token_mode === "manual" &&
                        !settings.free_browser_debug
                      }
                      onClick={() =>
                        change(
                          "free_browser_debug",
                          !settings.free_browser_debug,
                        )
                      }
                    >
                      <span />
                    </button>
                  </div>
                  {settings.free_token_mode === "manual" && (
                    <small className="field-hint">
                      Direct browser debug hanya memakai Auto JWT sementara;
                      manual token tidak pernah dibagikan ke browser.
                    </small>
                  )}
                  {settings.free_browser_debug && (
                    <p className="admin-provider-warning free-browser-debug-warning">
                      Saat Admin menjalankan assessment AI audio, PHP hanya
                      menyiapkan prompt dan Bearer JWT sementara. Browser lalu
                      mengirim audio langsung ke node Free. API key X-API-Key
                      terlihat di DevTools; JWT otomatis berlaku 5 menit. Debug
                      hanya mendukung token mode Auto, bukan token manual. Siswa
                      tetap memakai jalur PHP. Matikan setelah pengujian. Jika
                      provider tidak mengizinkan CORS untuk situs ini, browser
                      akan memblokir request.
                    </p>
                  )}
                </div>
              )}
              <div className="admin-divider" />
              <div className="setting-title">
                <div className="setting-icon lilac">
                  <AudioLines size={18} />
                </div>
                <div>
                  <b>Listening Lab · penilaian speaking</b>
                  <small>
                    Metode ini berlaku untuk pencocokan read-aloud; tidak
                    mengubah pilihan per jawaban di AI Lesson.
                  </small>
                </div>
              </div>
              <label className="field-label" htmlFor="speech-scoring-mode">
                METODE PENCOCOKAN TRANSKRIP
              </label>
              <div className="select-wrap">
                <select
                  id="speech-scoring-mode"
                  className="text-field"
                  value={settings.speech_scoring_mode || "local"}
                  onChange={(event) =>
                    change("speech_scoring_mode", event.target.value)
                  }
                >
                  <option value="local">Cocokkan secara lokal · gratis</option>
                  <option value="ai">AI provider global · 1 diamond</option>
                </select>
                <ChevronDown size={16} />
              </div>
              <div className="info-box speech-mode-info speech-scoring-info">
                <CircleHelp size={15} />
                <span>
                  Mode lokal menghitung kemiripan di browser tanpa AI. Mode AI
                  mengirim hanya naskah dan transkrip teks ke provider global
                  dan memakai 1 diamond. Audio tidak dikirim ke AI untuk
                  pencocokan teks. Gemini Live tetap memakai Gemini; feedback
                  pasca-sesi memakai provider global.
                </span>
              </div>
              <label
                className="field-label"
                htmlFor="speech-similarity-threshold"
              >
                AMBANG KEMIRIPAN UNTUK LULUS (%)
              </label>
              <input
                id="speech-similarity-threshold"
                className="text-field"
                type="number"
                min={50}
                max={100}
                step={1}
                value={settings.speech_similarity_threshold ?? 90}
                onChange={(event) =>
                  change(
                    "speech_similarity_threshold",
                    Number(event.target.value),
                  )
                }
              />
              <p className="field-help">
                Berlaku secara global untuk latihan read-aloud Listening Lab
                dengan transkrip browser. Default 90%; tidak memengaruhi AI
                Lesson atau Gemini Live.
              </p>
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
              <div className="admin-divider" />
              <div className="setting-title">
                <div className="setting-icon orange">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <b>Pembayaran diamond</b>
                  <small>
                    QRIS dinamis berdasarkan total, dengan QR statis sebagai
                    fallback atau alternatif tersembunyi.
                  </small>
                </div>
              </div>
              <label className="field-label" htmlFor="payment-qris-payload">
                TEKS QRIS STATIS MERCHANT
              </label>
              <textarea
                id="payment-qris-payload"
                className="text-field payment-qris-input"
                rows={4}
                maxLength={4000}
                spellCheck={false}
                value={settings.payment_qris_payload || ""}
                onChange={(event) =>
                  change("payment_qris_payload", event.target.value)
                }
                placeholder="000201..."
              />
              <small className="field-hint">
                Tempel string QRIS mentah hasil ekspor/scan merchant. Backend
                memvalidasi TLV dan CRC lalu mengganti nominal menjadi total
                pesanan.
              </small>
              <div className="payment-config-grid">
                <label className="field-label">
                  PPN (%)
                  <input
                    className="text-field"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={settings.payment_tax_percent ?? 0}
                    onChange={(event) =>
                      change("payment_tax_percent", Number(event.target.value))
                    }
                  />
                </label>
                <label className="field-label">
                  BIAYA ADMIN (Rp)
                  <input
                    className="text-field"
                    type="number"
                    min={0}
                    step={1}
                    value={settings.payment_admin_fee ?? 0}
                    onChange={(event) =>
                      change("payment_admin_fee", Number(event.target.value))
                    }
                  />
                </label>
              </div>
              <label className="field-label" htmlFor="payment-whatsapp">
                NOMOR WHATSAPP ADMIN
              </label>
              <input
                id="payment-whatsapp"
                className="text-field"
                inputMode="tel"
                value={settings.payment_whatsapp || ""}
                onChange={(event) =>
                  change("payment_whatsapp", event.target.value)
                }
                placeholder="6281234567890"
              />
              <div className="admin-static-qr-row">
                <span>
                  {settings.payment_static_qr_available
                    ? "QR statis sudah diunggah · PNG, JPG, atau WebP (maks. 5 MB)"
                    : "Belum ada QR statis · opsional jika QRIS dinamis tersedia"}
                </span>
                <div>
                  <label className="outline-btn admin-file-button">
                    {paymentQrBusy ? "Memproses…" : "Unggah QR statis"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={uploadStaticQr}
                      disabled={paymentQrBusy}
                    />
                  </label>
                  {settings.payment_static_qr_available && (
                    <button
                      className="text-button danger-text"
                      type="button"
                      onClick={removeStaticQr}
                      disabled={paymentQrBusy}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              </div>
              <div className="admin-divider" />
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
