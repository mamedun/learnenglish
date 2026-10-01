import { useEffect, useState } from "react";
import { Database, RefreshCw, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { apiJson } from "../../api";
import ModuleLoading from "../../components/ModuleLoading";

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export default function AdminAudioCache() {
  const [cache, setCache] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setError("");
    try {
      const result = await apiJson("admin/tts-cache");
      setCache(result.cache);
    } catch (loadError) {
      setError(loadError.message || "Statistik cache gagal dimuat.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function clearCache() {
    const confirmation = await Swal.fire({
      title: "Kosongkan shared audio cache?",
      text: "Seluruh WAV Kokoro untuk semua murid akan dihapus. Cache model di perangkat pengguna tidak terpengaruh.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus semua audio",
      cancelButtonText: "Batal",
      confirmButtonColor: "#b94f59",
    });
    if (!confirmation.isConfirmed) return;
    setBusy(true);
    try {
      const result = await apiJson("admin/tts-cache/clear", {
        method: "POST",
      });
      setCache(result.cache);
      toast.success("Shared audio cache berhasil dikosongkan.");
    } catch (clearError) {
      toast.error(clearError.message || "Cache gagal dikosongkan.");
    } finally {
      setBusy(false);
    }
  }

  if (!cache && !error) return <ModuleLoading label="statistik audio cache" />;
  const usage = cache?.limit_bytes
    ? Math.min(100, (cache.bytes / cache.limit_bytes) * 100)
    : 0;

  return (
    <section className="admin-audio-cache">
      <div className="studio-heading">
        <div>
          <div className="eyebrow">SHARED KOKORO STORAGE</div>
          <h2>Audio cache bersama</h2>
          <p>
            File WAV authored prompt, cue card, naskah listening, dan dialog
            multi-speaker dapat digunakan ulang oleh seluruh akun. Teks balasan
            AI tutor tidak disimpan di cache.
          </p>
        </div>
        <button
          type="button"
          className="outline-btn"
          onClick={refresh}
          disabled={busy}
        >
          <RefreshCw size={15} /> Muat ulang
        </button>
      </div>
      {error && (
        <div className="studio-error" role="alert">
          {error} <button onClick={refresh}>Coba lagi</button>
        </div>
      )}
      {cache && (
        <div className="settings-card admin-audio-cache-card">
          <div className="admin-audio-cache-title">
            <span className="setting-icon blue">
              <Database size={18} />
            </span>
            <div>
              <b>Penggunaan penyimpanan</b>
              <small>
                Hard limit 1 GB · penghapusan otomatis least-recently-used
              </small>
            </div>
          </div>
          <div className="admin-audio-cache-numbers">
            <strong>{formatBytes(cache.bytes)}</strong>
            <span>dari {formatBytes(cache.limit_bytes)}</span>
          </div>
          <div
            className="admin-audio-cache-meter"
            role="progressbar"
            aria-label="Penggunaan shared audio cache"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usage)}
          >
            <i style={{ width: `${usage}%` }} />
          </div>
          <div className="admin-audio-cache-meta">
            <span>{cache.items.toLocaleString()} file audio</span>
            <span>{Math.round(usage)}% terpakai</span>
          </div>
          <div className="info-box">
            File yang paling lama tidak dipakai akan dihapus saat ada audio baru
            yang perlu ruang. Mengedit prompt, cue card, atau script juga
            menghapus cache item tersebut.
          </div>
          <button
            type="button"
            className="danger-button admin-audio-cache-clear"
            onClick={clearCache}
            disabled={busy || cache.items === 0}
          >
            {busy ? (
              <>
                <span className="spinner" /> Menghapus cache…
              </>
            ) : (
              <>
                <Trash2 size={15} /> Kosongkan semua audio cache
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
