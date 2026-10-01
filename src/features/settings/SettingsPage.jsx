import {
  ArrowDownToLine,
  ArrowRight,
  CircleHelp,
  Download,
  Cpu,
  Database,
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
import { useEffect, useState } from "react";
import {
  getKokoroCacheInfo,
  isTtsBusy,
  KOKORO_VOICES,
} from "../../lib/ttsRocks";

export default function SettingsPage({
  data,
  setData,
  voices,
  fileInput,
  handleImport,
  resetData,
  exportBackup: exportBackup2,
  importingBackup = false,
  speak,
  preloadTTS,
  ttsStatus,
  user,
  onLogout,
  onAdmin,
  onPasswordChanged,
}) {
  const [cacheInfo, setCacheInfo] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const ttsBusy = isTtsBusy(ttsStatus);
  useEffect(() => {
    getKokoroCacheInfo().then(setCacheInfo);
  }, [ttsStatus?.phase]);
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
      setBackupBusy(true);
      await exportBackup2(data, includeAudio);
      toast.success("Backup akun berhasil dibuat.");
    } catch (e) {
      toast.error(e.message || "Ekspor gagal.");
    } finally {
      setBackupBusy(false);
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
            <div
              className="tts-options"
              role="group"
              aria-label="Mesin text to speech"
            >
              <button
                type="button"
                className={`tts-option ${data.settings.tts !== "native" ? "selected" : ""}`}
                aria-pressed={data.settings.tts !== "native"}
                onClick={() => update("tts", "kokoro")}
              >
                <span className="radio-dot" />
                <span>
                  <b>Kokoro · TTS.Rocks</b>
                  <small>Suara neural lokal · WebGPU atau WASM</small>
                </span>
                <span className="ready-tag">DEFAULT</span>
              </button>
              <button
                type="button"
                className={`tts-option ${data.settings.tts === "native" ? "selected" : ""}`}
                aria-pressed={data.settings.tts === "native"}
                onClick={() => update("tts", "native")}
              >
                <span className="radio-dot" />
                <span>
                  <b>Browser Native</b>
                  <small>Suara sistem operasi · tanpa unduhan model</small>
                </span>
                <span className="ready-tag">READY</span>
              </button>
            </div>
            {data.settings.tts !== "native" ? (
              <>
                <div className="toggle-row cached-voice-toggle">
                  <span>
                    <b>Gunakan cached voice</b>
                    <small>
                      Untuk prompt/cue card dan naskah listening. Aktif: putar
                      WAV bersama; cache miss memakai Browser Native. Nonaktif:
                      cek cache dulu, lalu Kokoro lokal membuat dan mengunggah
                      WAV saat miss. Balasan tutor dinamis tidak disimpan.
                    </small>
                  </span>
                  <button
                    type="button"
                    className={`switch ${data.settings.useCachedVoice !== false ? "on" : ""}`}
                    aria-label="Gunakan cached voice"
                    aria-pressed={data.settings.useCachedVoice !== false}
                    onClick={() =>
                      update(
                        "useCachedVoice",
                        data.settings.useCachedVoice === false,
                      )
                    }
                  >
                    <i />
                  </button>
                </div>
                <label className="field-label">
                  KOKORO VOICE · SAAT CACHE NONAKTIF
                </label>
                <div className="voice-row">
                  <select
                    className="text-field"
                    value={data.settings.voice || "af_heart"}
                    disabled={data.settings.useCachedVoice !== false}
                    onChange={(e) => update("voice", e.target.value)}
                  >
                    {KOKORO_VOICES.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} · {voice.accent} ({voice.id})
                      </option>
                    ))}
                  </select>
                  <button
                    className="sample-btn"
                    onClick={() =>
                      speak(
                        "Hello! It is lovely to practice English with you today.",
                        { forceKokoro: true },
                      )
                    }
                    disabled={ttsBusy}
                  >
                    {ttsBusy ? (
                      <>
                        <span className="spinner" /> Menyiapkan…
                      </>
                    ) : (
                      <>
                        <Play size={14} fill="currentColor" /> Listen sample
                      </>
                    )}
                  </button>
                </div>
                <label className="field-label">COMPUTE MODE</label>
                <div className="select-wrap">
                  <select
                    className="text-field"
                    value={data.settings.ttsCompute || "auto"}
                    onChange={(e) => update("ttsCompute", e.target.value)}
                  >
                    <option value="auto">
                      Otomatis · WebGPU jika tersedia, selain itu WASM
                    </option>
                    <option value="webgpu">
                      WebGPU · fallback ke WASM jika tidak tersedia
                    </option>
                    <option value="wasm">
                      WASM · kompatibilitas lebih luas
                    </option>
                  </select>
                  <Cpu size={16} />
                </div>
                <div className="tts-cache-row">
                  <span
                    className={`cache-indicator ${cacheInfo?.cached ? "cached" : ""}`}
                  >
                    <Database size={15} />
                    {cacheInfo?.cached
                      ? `Model tersimpan di perangkat · ${(cacheInfo.bytes / 1024 / 1024).toFixed(0)} MB`
                      : "Model akan diunduh sekali lalu disimpan di IndexedDB"}
                  </span>
                  <button
                    className="outline-btn"
                    onClick={preloadTTS}
                    disabled={ttsBusy}
                  >
                    {ttsBusy ? (
                      <>
                        <span className="spinner" />
                        {ttsStatus?.phase === "speaking"
                          ? "Memutar audio…"
                          : "Menyiapkan model…"}
                      </>
                    ) : (
                      <>
                        <Download size={14} /> Unduh / muat model
                      </>
                    )}
                  </button>
                </div>
                <p
                  className={`tts-status ${ttsBusy ? "tts-status-loading" : ""}`}
                  role="status"
                >
                  {ttsBusy && <span className="processing-status-spinner" />}
                  {ttsStatus?.message ||
                    "Model dimuat otomatis saat suara pertama kali diputar."}
                </p>
                <div className="info-box">
                  <CircleHelp size={15} />
                  <span>
                    Download awal sekitar 82 MB. File model diproses lokal dan
                    dicache pada browser/perangkat ini; browser dapat menghapus
                    cache jika ruang penyimpanan terbatas.
                  </span>
                </div>
              </>
            ) : (
              <>
                <label className="field-label">BROWSER VOICE</label>
                <div className="voice-row">
                  <select
                    className="text-field"
                    value={data.settings.nativeVoice || ""}
                    onChange={(e) => update("nativeVoice", e.target.value)}
                  >
                    <option value="">English voice (default)</option>
                    {voices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} · {voice.lang}
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
                    disabled={ttsBusy}
                  >
                    {ttsBusy ? (
                      <>
                        <span className="spinner" /> Menyiapkan…
                      </>
                    ) : (
                      <>
                        <Play size={14} fill="currentColor" /> Listen sample
                      </>
                    )}
                  </button>
                </div>
                <div className="info-box">
                  <CircleHelp size={15} />
                  <span>
                    Daftar suara tergantung browser dan sistem operasi. Kokoro
                    tetap dapat dipilih kapan saja di pengaturan ini.
                  </span>
                </div>
              </>
            )}
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
                  private server storage dan DB hanya menyimpan
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
                Mode input untuk AI Lesson dan latihan membaca nyaring
                ditentukan admin secara global: transkripsi langsung browser
                atau rekaman audio yang dikirim ke server AI setelah
                persetujuan.
              </span>
            </div>
            <div className="privacy-note">
              <ShieldCheck size={16} />
              <p>
                Audio tidak pernah dikirim atau diarsipkan diam-diam. Mode
                rekaman meminta persetujuan sebelum mengirim ke server AI; arsip
                audio memerlukan persetujuan terpisah.
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
              <button
                className="btn-primary"
                onClick={makeBackup}
                disabled={backupBusy || importingBackup}
              >
                {backupBusy ? (
                  <>
                    <span className="spinner" /> Membuat backup…
                  </>
                ) : (
                  <>
                    <ArrowDownToLine size={16} /> Ekspor backup ZIP
                  </>
                )}
              </button>
              <button
                className="outline-btn"
                onClick={() => fileInput.current?.click()}
                disabled={backupBusy || importingBackup}
              >
                {importingBackup ? (
                  <>
                    <span className="spinner" /> Mengimpor…
                  </>
                ) : (
                  <>
                    <Upload size={16} /> Impor backup
                  </>
                )}
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
                  {user.role === "admin" ? "Administrator" : "Learner"}
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
