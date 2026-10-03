import React from "react";
import {
  Database,
  Cpu,
  Clock,
  Sparkles,
  Volume2,
} from "lucide-react";
import { appAsset } from "../lib/appPaths";
import "./KokoroDownloadModal.css";

export default function KokoroDownloadModal({
  isOpen,
  status = {},
  onSwitchToNative,
}) {
  if (!isOpen) return null;

  const phase = status?.phase || "download";
  const progress =
    Number.isFinite(status?.progress) && status?.progress !== null
      ? Math.max(0, Math.min(100, Math.round(status.progress)))
      : null;
  const loadedMB = status?.loaded
    ? (status.loaded / 1024 / 1024).toFixed(1)
    : null;
  const totalMB = status?.total
    ? (status.total / 1024 / 1024).toFixed(1)
    : "82.0";

  let statusTitle = "Mengunduh Model Kokoro Neural…";
  let statusDetail =
    "Mengunduh file bobot suara neural ~82 MB ke penyimpanan perangkat.";

  if (phase === "cache") {
    statusTitle = "Menyimpan ke IndexedDB…";
    statusDetail =
      "Model sedang diverifikasi dan disimpan ke memori lokal browser agar sesi berikutnya instan.";
  } else if (phase === "load-model" || phase === "initialize") {
    statusTitle = "Memuat ke Runtime WASM/GPU…";
    statusDetail =
      "Menginisialisasi pipeline neural synthesis untuk memulai suara tutor.";
  }

  return (
    <div
      className="kokoro-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kokoro-modal-title"
    >
      <div className="kokoro-modal-card">
        <div className="kokoro-modal-header">
          <div className="kokoro-avatar-wrap">
            <img
              src={appAsset("images/mascot/pip-audio.png")}
              alt="Pip Audio"
              className="kokoro-mascot-img"
            />
          </div>
          <div className="kokoro-badge-wrap">
            <span className="kokoro-one-time-badge">
              <Sparkles size={12} /> UNDUHAN AWAL · HANYA 1 KALI
            </span>
          </div>
        </div>

        <h3 id="kokoro-modal-title" className="kokoro-modal-title">
          Menyiapkan Natural Voice (Kokoro TTS)
        </h3>

        <p className="kokoro-modal-desc">
          Untuk menghasilkan suara pelafalan alami berkualitas studio, perangkatmu
          sedang mengunduh modul suara neural (<strong>~82 MB</strong>).
          <br />
          <span className="kokoro-highlight-note">
            Unduhan ini <strong>hanya dilakukan 1 kali</strong> dan disimpan di
            perangkatmu. Sesi berikutnya akan langsung instan tanpa mengunduh lagi!
          </span>
        </p>

        {/* Progress Box */}
        <div className="kokoro-progress-box">
          <div className="kokoro-progress-header">
            <span className="kokoro-engine-tag" title={status.message || statusTitle}>
              <Cpu size={13} /> {status.message || statusTitle}
            </span>
            <span className="kokoro-percent-text">
              {progress !== null ? `${progress}%` : "Memproses…"}
            </span>
          </div>

          <div className="kokoro-progress-track">
            {progress !== null ? (
              <div
                className="kokoro-progress-bar determinate"
                style={{ width: `${progress}%` }}
              />
            ) : (
              <div className="kokoro-progress-bar indeterminate" />
            )}
          </div>

          <div className="kokoro-progress-footer">
            <span>
              <Database size={12} />{" "}
              {loadedMB ? `${loadedMB} MB / ${totalMB} MB` : "~82 MB"}
            </span>
            <span>
              <Clock size={12} /> Butuh 30–60 detik
            </span>
          </div>
        </div>

        <div className="kokoro-tip-box">
          <Clock size={16} className="kokoro-tip-icon" />
          <p>
            Mohon tunggu dan jangan menutup atau merefresh halaman selama proses
            unduh awal ini berlangsung.
          </p>
        </div>

        {/* Quick alternative button */}
        {onSwitchToNative && (
          <div className="kokoro-actions-wrap">
            <button
              type="button"
              className="kokoro-switch-native-btn"
              onClick={onSwitchToNative}
            >
              <Volume2 size={15} />
              <span>Gunakan Browser Native Sekarang (Tanpa Menunggu)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
