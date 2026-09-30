import { useState } from "react";
import { AudioLines, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "./api";

export default function PasswordForm({
  required = false,
  onChanged,
  onLogout,
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (next !== confirm) return toast.error("Konfirmasi password tidak sama.");
    setBusy(true);
    try {
      const result = await apiJson("account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password berhasil diganti.");
      await onChanged?.(result.user);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form onSubmit={submit} className="password-form">
      <label>
        Password saat ini
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        Password baru <span>minimal 12 karakter</span>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={12}
          maxLength={200}
          required
        />
      </label>
      <label>
        Ulangi password baru
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={12}
          required
        />
      </label>
      <button className="btn-primary" disabled={busy}>
        {busy ? (
          "Menyimpan..."
        ) : (
          <>
            Ganti password <ArrowRight size={17} />
          </>
        )}
      </button>
    </form>
  );
  if (!required)
    return (
      <section className="settings-card password-card">
        <div className="setting-title">
          <div className="setting-icon lilac">
            <LockKeyhole size={19} />
          </div>
          <div>
            <b>Keamanan akun</b>
            <small>
              Ganti password secara berkala. Password tidak pernah disimpan
              sebagai teks biasa.
            </small>
          </div>
        </div>
        {form}
      </section>
    );
  return (
    <div className="password-gate">
      <header className="auth-brand">
        <span className="brand-mark">
          <AudioLines size={22} />
        </span>
        <div>
          <b>
            speak<span>up</span>
          </b>
          <small>ENGLISH ADVENTURE</small>
        </div>
      </header>
      <div className="password-gate-card">
        <span className="gate-icon">
          <ShieldCheck size={30} />
        </span>
        <div className="eyebrow">SATU LANGKAH LAGI</div>
        <h1>Amankan akun adminmu</h1>
        <p>
          Ini adalah password awal untuk pemasangan. Sebelum masuk ke aplikasi,
          buat password baru yang unik (minimal 12 karakter). Jangan gunakan
          kembali password awal.
        </p>
        {form}
        <button className="text-button" onClick={onLogout}>
          Keluar dari akun
        </button>
      </div>
    </div>
  );
}
