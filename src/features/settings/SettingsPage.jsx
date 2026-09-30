import {
  ArrowDownToLine,
  ArrowRight,
  CircleHelp,
  Download,
  FileAudio2,
  Play,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import PasswordForm from "../auth/PasswordForm";
import { toast } from "sonner";
import Swal from "sweetalert2";

export default function SettingsPage({
  data,
  setData,
  voices,
  fileInput,
  handleImport,
  resetData,
  exportBackup: exportBackup2,
  speak,
  user,
  onLogout,
  onAdmin,
  onPasswordChanged,
}) {
  const update = (key, value) =>
    setData((p) => ({ ...p, settings: { ...p.settings, [key]: value } }));
  async function makeBackup() {
    try {
      const count = data.sessions
        .flatMap((s) => s.turns || [])
        .filter((t) => t.audioId).length;
      let includeAudio = false;
      if (count) {
        const choice = await Swal.fire({
          title: "Sertakan rekaman?",
          text: `Ada ${count} rekaman yang tersimpan. Pilih apakah audio ikut masuk ke ZIP.`,
          input: "radio",
          inputOptions: {
            no: "Tanpa audio (file lebih kecil)",
            yes: "Sertakan audio",
          },
          inputValue: data.settings.saveAudio ? "yes" : "no",
          showCancelButton: true,
          confirmButtonText: "Ekspor ZIP",
          cancelButtonText: "Batal",
          confirmButtonColor: "#315c45",
        });
        if (!choice.isConfirmed) return;
        includeAudio = choice.value === "yes";
      }
      await exportBackup2(data, includeAudio);
      toast.success("Backup akun berhasil dibuat.");
    } catch (e) {
      toast.error(e.message || "Ekspor gagal.");
    }
  }
  return (
    <div className="settings-page">
      <div className="eyebrow">PREFERENSI AKUN</div>
      <h1>
        Pengaturan{" "}
        <span>
          <Settings size={27} />
        </span>
      </h1>
      <p className="page-intro">
        Akun dan progres tersimpan di server SpeakUp.
      </p>
      <div className="settings-grid">
        <div className="settings-main">
          <section className="settings-card">
            <div className="setting-title">
              <div className="setting-icon green">
                <Volume2 size={18} />
              </div>
              <div>
                <b>Suara tutor</b>
                <small>Balasan percakapan dibacakan lewat perangkatmu</small>
              </div>
            </div>
            <label className="field-label">TEXT-TO-SPEECH ENGINE</label>
            <div className="tts-options">
              <div className="tts-option selected">
                <span className="radio-dot" />
                <span>
                  <b>Browser Native</b>
                  <small>Siap dipakai tanpa model tambahan</small>
                </span>
                <span className="ready-tag">READY</span>
              </div>
            </div>
            <label className="field-label">VOICE</label>
            <div className="voice-row">
              <select
                className="text-field"
                value={data.settings.voice}
                onChange={(e) => update("voice", e.target.value)}
              >
                <option value="">English voice (default)</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} · {v.lang}
                  </option>
                ))}
              </select>
              <button
                className="sample-btn"
                onClick={() =>
                  speak(
                    "Hello! It is lovely to practice English with you today.",
                  )
                }
              >
                <Play size={14} fill="currentColor" /> Listen sample
              </button>
            </div>
            <div className="info-box">
              <CircleHelp size={15} />
              <span>
                Suara yang tersedia dan pemrosesan offline bergantung pada
                browser dan sistem operasimu.
              </span>
            </div>
          </section>
          <section className="settings-card">
            <div className="setting-title">
              <div className="setting-icon orange">
                <FileAudio2 size={18} />
              </div>
              <div>
                <b>Privasi & rekaman</b>
                <small>Atur penyimpanan untuk setiap sesi</small>
              </div>
            </div>
            <label className="toggle-row">
              <span>
                <b>Default persetujuan simpan audio</b>
                <small>
                  Ditanyakan lagi tiap sesi. Jika disetujui, file disimpan di
                  /learnenglish/api/uploads/{user.id}/ dan DB hanya menyimpan
                  metadata/referensi.
                </small>
              </span>
              <button
                className={`switch ${data.settings.saveAudio ? "on" : ""}`}
                onClick={() => update("saveAudio", !data.settings.saveAudio)}
              >
                <i />
              </button>
            </label>
            <div className="info-box">
              <CircleHelp size={15} />
              <span>
                Speech recognition lokal/offline belum disertakan. SpeakUp tidak
                mengaktifkan SpeechRecognition browser/cloud. Jika memilih
                evaluasi audio, rekaman hanya dikirim ke Gemini setelah
                persetujuan satu kali.
              </span>
            </div>
            <div className="privacy-note">
              <ShieldCheck size={16} />
              <p>
                Audio arsip tidak pernah dikirim ulang otomatis. Evaluasi audio
                AI adalah tindakan terpisah, satu kali, dan memerlukan
                persetujuan sebelum dikirim ke Google Gemini.
              </p>
            </div>
          </section>
          <section className="settings-card">
            <div className="setting-title">
              <div className="setting-icon blue">
                <Download size={18} />
              </div>
              <div>
                <b>Backup & restore</b>
                <small>Ekspor atau pindahkan akun ke perangkat lain</small>
              </div>
            </div>
            <p className="backup-description">
              Progres tersimpan di SQLite server. Backup ZIP dapat menyertakan
              file audio pilihanmu. Impor akan mengganti progres akun ini.
            </p>
            <div className="backup-actions">
              <button className="btn-primary" onClick={makeBackup}>
                <ArrowDownToLine size={16} /> Ekspor backup ZIP
              </button>
              <button
                className="outline-btn"
                onClick={() => fileInput.current?.click()}
              >
                <Upload size={16} /> Impor backup
              </button>
            </div>
          </section>
          <PasswordForm onChanged={onPasswordChanged} />
          <section className="settings-card account-card">
            <div className="setting-title">
              <div className="setting-icon lilac">
                <ShieldCheck size={18} />
              </div>
              <div>
                <b>Akun SpeakUp</b>
                <small>Login tanpa membagikan kredensial ke AI</small>
              </div>
            </div>
            <div className="account-data">
              <div className="avatar">👩🏻‍🎓</div>
              <div>
                <b>{user.name}</b>
                <small>
                  {user.email} ·{" "}
                  {user.role === "admin"
                    ? "Administrator"
                    : user.plan === "premium"
                      ? "Premium"
                      : "Regular \xB7 Listening"}
                </small>
              </div>
            </div>
            <div className="backup-actions account-buttons">
              {user.role === "admin" && (
                <button className="outline-btn" onClick={onAdmin}>
                  <ShieldCheck size={15} /> Pengaturan admin
                </button>
              )}
              <button className="outline-btn" onClick={onLogout}>
                Logout <ArrowRight size={15} />
              </button>
            </div>
          </section>
        </div>
        <aside className="settings-side">
          <div className="settings-help">
            <div className="help-spark">✦</div>
            <h3>Belajar dengan nyaman</h3>
            <p>
              Progress disimpan ke akunmu di server, bukan hanya browser ini.
            </p>
            <div className="local-badge">
              <ShieldCheck size={15} /> SERVER-SAVED
            </div>
          </div>
          <div className="settings-card danger-card">
            <div className="setting-title">
              <div className="setting-icon red">
                <Trash2 size={17} />
              </div>
              <div>
                <b>Zona berbahaya</b>
                <small>Hapus progres dan audio akun</small>
              </div>
            </div>
            <button className="danger-button" onClick={resetData}>
              Hapus semua progres <Trash2 size={14} />
            </button>
          </div>
          <div className="version-info">
            SpeakUp · Versi 1.1.0
            <br />
            IELTS-inspired speaking practice · bukan ujian resmi
          </div>
        </aside>
      </div>
    </div>
  );
}
