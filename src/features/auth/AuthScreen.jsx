import { useState, useEffect } from "react";
import {
  ArrowRight,
  AudioLines,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "../../api";
import { toast } from "sonner";

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState("checking");
  const [registrationClosed, setRegistrationClosed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [serverError, setServerError] = useState("");
  async function checkServer() {
    setServer("checking");
    setServerError("");
    try {
      const response = await apiFetch("health");
      const status = await response.json().catch(() => ({}));
      if (!response.ok || !status.ok) {
        const d = status.diagnostics || {};
        const hint =
          (d.pdo_sqlite === false && "pdo_sqlite belum aktif di PHP server") ||
          (d.directory_exists &&
            !d.directory_writable &&
            "direktori SQLite tidak bisa ditulis (WAL)") ||
          (d.database_exists &&
            !d.database_writable &&
            "file SQLite tidak bisa ditulis") ||
          status.code ||
          "periksa log PHP";
        throw new Error(`${status.error || "PHP API belum siap."} (${hint})`);
      }
      if (!status.auth_configured)
        throw new Error(
          "Isi APP_ENCRYPTION_KEY yang kuat di api/config.php agar login tersedia.",
        );
      setRegistrationClosed(!!status.registration_closed || !!status.lockdown);
      setLocked(!!status.lockdown);
      setServer("ready");
    } catch (error) {
      setServerError(error.message || "Tidak dapat terhubung ke PHP API.");
      setServer("offline");
    }
  }
  useEffect(() => {
    checkServer();
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onAuth(mode, { name, email, password });
    } catch (err) {
      toast.error(err.message || "Tidak dapat memproses akun.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <div className="auth-decoration deco-a" />
      <div className="auth-decoration deco-b" />
      <div className="auth-brand">
        <div className="brand-mark">
          <AudioLines size={22} />
        </div>
        <div>
          <b>
            speak<span>up</span>
          </b>
          <small>YOUR ENGLISH ADVENTURE</small>
        </div>
      </div>
      <div className="auth-layout">
        <div className="auth-story">
          <img
            className="auth-art"
            src="/learnenglish/images/speakup-adventure.png"
            alt=""
            aria-hidden="true"
          />
          <div className="eyebrow">
            <Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE
          </div>
          <h1>
            English you can
            <br />
            <em>actually speak.</em>
          </h1>
          <p>
            Belajar bahasa Inggris lewat misi kecil yang seru. Dengarkan, berani
            bicara, dan tumbuh dari A1 hingga C2.
          </p>
          <div className="auth-benefits">
            <div>
              <CheckCircle2 size={17} />
              <span>18 listening lesson gratis, selalu bisa diulang</span>
            </div>
            <div>
              <CheckCircle2 size={17} />
              <span>48 unit speaking & feedback AI untuk Premium</span>
            </div>
            <div>
              <ShieldCheck size={17} />
              <span>XP, badge & progres tersimpan di akunmu</span>
            </div>
          </div>
          <div className="auth-illustration">
            <span>✦ little steps, big progress</span>
          </div>
        </div>
        <div className="auth-card">
          <div className="auth-card-kicker">MULAI PERJALANANMU</div>
          <h2>
            {mode === "login" ? "Selamat datang kembali" : "Buat akun SpeakUp"}
          </h2>
          <p>
            {mode === "login"
              ? "Masuk untuk melanjutkan progres belajarmu."
              : "Daftar gratis dan progres akan tersimpan di server."}
          </p>
          <form onSubmit={submit}>
            {locked && (
              <div className="auth-lock-banner">
                Aplikasi sedang dikunci. Hanya akun admin yang dapat masuk untuk
                mengelola pengaturan.
              </div>
            )}
            {mode === "register" && (
              <label>
                Nama lengkap
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama kamu"
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                minLength={mode === "register" ? 10 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "register" ? "Minimal 10 karakter" : "Password akun"
                }
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            <button
              className="auth-submit"
              disabled={
                busy ||
                server !== "ready" ||
                (mode === "register" && registrationClosed)
              }
            >
              {busy ? (
                <>
                  <span className="spinner" /> Memproses...
                </>
              ) : (
                <>
                  {mode === "login" ? "Masuk ke akun" : "Buat akun"}{" "}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
          <div className="auth-switch">
            {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login"
                ? registrationClosed
                  ? "Pendaftaran ditutup"
                  : "Daftar sekarang"
                : "Masuk"}
            </button>
          </div>
          <div className={`api-status ${server}`}>
            <span />
            {server === "checking"
              ? "Memeriksa server..."
              : server === "ready"
                ? "Server SpeakUp siap"
                : "Backend belum tersedia \u2014 aktifkan PHP API"}
          </div>
          {mode === "register" && registrationClosed && (
            <div className="auth-lock-banner">
              Pendaftaran akun baru sedang ditutup oleh admin.
            </div>
          )}
          <small className="auth-terms">
            Dengan melanjutkan, progres dan rekaman pilihanmu akan disimpan pada
            server ini.
          </small>
          {server === "offline" && (
            <div className="auth-lock-banner" role="alert">
              <b>PHP API belum siap.</b> {serverError}
              <button
                type="button"
                className="auth-retry"
                onClick={checkServer}
              >
                Periksa lagi
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="auth-footer">
        SpeakUp · IELTS-inspired practice · Bukan layanan resmi IELTS
      </div>
    </div>
  );
}
