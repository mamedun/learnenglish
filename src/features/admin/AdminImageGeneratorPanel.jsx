import { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  X,
  ExternalLink,
  Layers,
  Ratio,
  Maximize2,
} from "lucide-react";
import { apiFetch } from "../../api";
import { toast } from "sonner";
import Swal from "sweetalert2";

const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1 Persegi", desc: "1024×1024 · Cocok untuk ikon & ilustrasi kotak" },
  { id: "16:9", label: "16:9 Landscape", desc: "1024×576 · Cocok untuk banner & poster" },
  { id: "4:3", label: "4:3 Standar", desc: "1024×768 · Cocok untuk gambar latihan soal" },
  { id: "9:16", label: "9:16 Portrait", desc: "576×1024 · Format vertikal / story" },
  { id: "3:4", label: "3:4 Buku", desc: "768×1024 · Format vertikal poster / sampul" },
];

export default function AdminImageGeneratorPanel({ activeProvider = "free" }) {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null); // base64 data url
  const [generationMeta, setGenerationMeta] = useState(null);

  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState("");
  const [copiedSaved, setCopiedSaved] = useState(false);

  // Gallery of existing media
  const [mediaList, setMediaList] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [copiedModal, setCopiedModal] = useState(false);

  useEffect(() => {
    loadMedia();
  }, []);

  async function loadMedia() {
    setLoadingMedia(true);
    try {
      const res = await apiFetch("admin/media");
      const json = await res.json();
      if (res.ok && Array.isArray(json.media)) {
        setMediaList(json.media);
      } else {
        toast.error(json.error || "Gagal memuat galeri media.");
      }
    } catch {
      toast.error("Gagal terhubung ke server media.");
    } finally {
      setLoadingMedia(false);
    }
  }

  async function handleGenerate(e) {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      toast.error("Tuliskan deskripsi prompt gambar terlebih dahulu.");
      return;
    }

    setGenerating(true);
    setGeneratedImage(null);
    setSavedUrl("");
    setCopiedSaved(false);

    try {
      const res = await apiFetch("admin/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspect_ratio: aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal menghasilkan gambar.");
      }

      setGeneratedImage(data.image_data);
      setGenerationMeta({
        provider: data.provider || activeProvider,
        aspectRatio,
        prompt: prompt.trim(),
      });
      toast.success("Gambar berhasil dihasilkan! Silakan tinjau sebelum disimpan.");
    } catch (err) {
      toast.error(err.message || "Gagal membuat gambar.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveImage() {
    if (!generatedImage) return;
    setSaving(true);
    try {
      const res = await apiFetch("admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_data: generatedImage,
          prompt: generationMeta?.prompt || prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal menyimpan gambar ke server.");
      }

      const fileUrl = data.relative_url || data.url;
      setSavedUrl(fileUrl);
      toast.success("Gambar berhasil disimpan ke api/uploads/media/!");
      loadMedia();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan gambar.");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setGeneratedImage(null);
    setSavedUrl("");
  }

  function handleNewGeneration() {
    setGeneratedImage(null);
    setSavedUrl("");
    setCopiedSaved(false);
    setPrompt("");
  }

  async function copyToClipboard(text, isModal = false) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (isModal) {
        setCopiedModal(true);
        setTimeout(() => setCopiedModal(false), 2000);
      } else {
        setCopiedSaved(true);
        setTimeout(() => setCopiedSaved(false), 2000);
      }
      toast.success("URL gambar berhasil disalin ke clipboard!");
    } catch {
      toast.error("Gagal menyalin otomatis. Silakan salin secara manual.");
    }
  }

  async function handleDeleteMedia(item) {
    if (!item?.filename) return;
    const confirm = await Swal.fire({
      title: "Hapus gambar ini?",
      text: `File "${item.filename}" akan dihapus permanen dari api/uploads/media/.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#d33",
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await apiFetch(`admin/media/${encodeURIComponent(item.filename)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Gagal menghapus file.");
      }
      toast.success("Gambar berhasil dihapus.");
      setSelectedMedia(null);
      loadMedia();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus gambar.");
    }
  }

  return (
    <div className="admin-image-gen-panel">
      {/* Top Generator Card */}
      <div className="admin-gen-card">
        <div className="admin-gen-header">
          <div className="setting-icon emerald">
            <Sparkles size={20} />
          </div>
          <div>
            <h3>AI Image Generator & Media Manager</h3>
            <p>
              Buat gambar ilustrasi soal, poster kursus, dan banner menggunakan model AI provider aktif{" "}
              <b className="provider-badge">({activeProvider.toUpperCase()})</b>.
            </p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="admin-gen-form">
          <div className="form-group">
            <label className="field-label" htmlFor="image-prompt-textarea">
              PROMPT DESKRIPSI GAMBAR
            </label>
            <textarea
              id="image-prompt-textarea"
              className="text-field gen-prompt-textarea"
              rows={3}
              placeholder="Contoh: A cheerful London cafe barista handing coffee to a customer, warm natural sunlight, clean modern 3D illustration style, vibrant colors..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={generating || saving}
            />
          </div>

          <div className="form-group">
            <label className="field-label">ASPECT RATIO (PROPORSI UKURAN)</label>
            <div className="aspect-ratio-selector">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  type="button"
                  key={ratio.id}
                  className={`ratio-pill ${aspectRatio === ratio.id ? "active" : ""}`}
                  onClick={() => setAspectRatio(ratio.id)}
                  disabled={generating || saving}
                >
                  <Ratio size={14} />
                  <span>{ratio.label}</span>
                </button>
              ))}
            </div>
            <span className="aspect-ratio-hint">
              {ASPECT_RATIOS.find((r) => r.id === aspectRatio)?.desc}
            </span>
          </div>

          <div className="gen-form-actions">
            <button
              type="submit"
              className="primary-btn gen-submit-btn"
              disabled={generating || saving || !prompt.trim()}
            >
              {generating ? (
                <>
                  <span className="spinner" /> Sedang Menghasilkan Gambar…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Hasilkan Gambar
                </>
              )}
            </button>
          </div>
        </form>

        {/* Preview of Generated Image */}
        {generating && (
          <div className="gen-loading-box">
            <span className="spinner large-spinner" />
            <p>Model AI sedang melukis ilustrasi berdasarkan prompt Anda…</p>
            <small>Ini mungkin membutuhkan waktu 5–20 detik tergantung provider.</small>
          </div>
        )}

        {generatedImage && !generating && (
          <div className="gen-result-container">
            <div className="gen-preview-card">
              <div className="gen-preview-image-wrapper">
                <img
                  src={generatedImage}
                  alt="Generated Result"
                  className="gen-preview-img"
                />
              </div>

              {!savedUrl ? (
                <div className="gen-confirmation-box">
                  <div className="gen-confirm-text">
                    <strong>Simpan gambar ini ke server?</strong>
                    <p>Gambar akan disimpan permanen ke direktori <code>api/uploads/media/</code> dan dapat digunakan di Course Studio.</p>
                  </div>
                  <div className="gen-confirm-buttons">
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={handleSaveImage}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <span className="spinner" /> Menyimpan…
                        </>
                      ) : (
                        <>
                          <Download size={16} /> Ya, Simpan Gambar Ini
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="outline-btn"
                      onClick={handleDiscard}
                      disabled={saving}
                    >
                      Buang / Coba Lagi
                    </button>
                  </div>
                </div>
              ) : (
                <div className="gen-saved-box">
                  <div className="gen-saved-success-header">
                    <Check size={18} className="success-icon" />
                    <strong>Gambar Berhasil Disimpan ke Server!</strong>
                  </div>
                  <div className="gen-url-copy-row">
                    <input
                      type="text"
                      readOnly
                      value={savedUrl}
                      className="text-field gen-url-input"
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      className="primary-btn copy-btn"
                      onClick={() => copyToClipboard(savedUrl, false)}
                    >
                      {copiedSaved ? (
                        <>
                          <Check size={15} /> Tersalin!
                        </>
                      ) : (
                        <>
                          <Copy size={15} /> Salin URL
                        </>
                      )}
                    </button>
                  </div>
                  <div className="gen-post-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={handleNewGeneration}
                    >
                      <Sparkles size={15} /> Buat Gambar Baru
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Media Library Gallery Section */}
      <div className="admin-media-gallery-section">
        <div className="gallery-header-row">
          <div>
            <h3>Galeri Media Tersimpan (<code>api/uploads/media/</code>)</h3>
            <p>Daftar semua gambar yang telah disimpan dan siap digunakan di Course Studio & materi soal.</p>
          </div>
          <button
            type="button"
            className="secondary-btn refresh-media-btn"
            onClick={loadMedia}
            disabled={loadingMedia}
          >
            <RefreshCw size={15} className={loadingMedia ? "spin" : ""} />
            <span>Segarkan Galeri</span>
          </button>
        </div>

        {loadingMedia && mediaList.length === 0 ? (
          <div className="gallery-empty-state">
            <span className="spinner" />
            <p>Memuat daftar gambar dari server…</p>
          </div>
        ) : mediaList.length === 0 ? (
          <div className="gallery-empty-state">
            <ImageIcon size={44} className="empty-gallery-icon" />
            <p>Belum ada gambar yang tersimpan di <code>api/uploads/media/</code>.</p>
            <small>Gunakan form generator di atas untuk membuat dan menyimpan gambar pertama Anda.</small>
          </div>
        ) : (
          <div className="admin-media-grid">
            {mediaList.map((item) => (
              <div
                key={item.filename}
                className="admin-media-item-card"
                onClick={() => setSelectedMedia(item)}
              >
                <div className="media-item-thumbnail">
                  <img src={item.url} alt={item.filename} loading="lazy" />
                  <div className="media-item-hover-overlay">
                    <Maximize2 size={18} />
                    <span>Lihat Detail</span>
                  </div>
                </div>
                <div className="media-item-details">
                  <span className="media-item-name" title={item.filename}>
                    {item.filename}
                  </span>
                  <div className="media-item-sub">
                    <span>{(item.size / 1024).toFixed(0)} KB</span>
                    <span>
                      {item.modified_at
                        ? new Date(item.modified_at).toLocaleDateString("id-ID")
                        : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal View for Selected Media Item */}
      {selectedMedia && (
        <div className="media-modal-backdrop" onClick={() => setSelectedMedia(null)} role="dialog" aria-modal="true">
          <div className="media-detail-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="media-modal-header">
              <div className="media-modal-title">
                <ImageIcon size={20} className="media-title-icon" />
                <h3>Detail Gambar: {selectedMedia.filename}</h3>
              </div>
              <button
                type="button"
                className="icon-btn media-close-btn"
                onClick={() => setSelectedMedia(null)}
                aria-label="Tutup"
              >
                <X size={19} />
              </button>
            </div>

            <div className="media-detail-modal-body">
              <div className="media-detail-preview-frame">
                <img
                  src={selectedMedia.url}
                  alt={selectedMedia.filename}
                  className="media-detail-img"
                />
              </div>

              <div className="media-detail-meta-box">
                <div className="meta-row">
                  <span className="meta-label">Nama File:</span>
                  <span className="meta-val">{selectedMedia.filename}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Ukuran:</span>
                  <span className="meta-val">{(selectedMedia.size / 1024).toFixed(1)} KB</span>
                </div>
                {selectedMedia.modified_at && (
                  <div className="meta-row">
                    <span className="meta-label">Diperbarui:</span>
                    <span className="meta-val">
                      {new Date(selectedMedia.modified_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                )}
                <div className="meta-row url-meta-row">
                  <span className="meta-label">Lokasi / URL Relatif:</span>
                  <div className="url-copy-input-group">
                    <input
                      type="text"
                      readOnly
                      value={selectedMedia.relative_url || selectedMedia.url}
                      className="text-field"
                      onClick={(e) => e.target.select()}
                    />
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() =>
                        copyToClipboard(selectedMedia.relative_url || selectedMedia.url, true)
                      }
                    >
                      {copiedModal ? (
                        <>
                          <Check size={14} /> Tersalin!
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Salin URL
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="media-detail-modal-footer">
              <button
                type="button"
                className="danger-btn delete-media-btn"
                onClick={() => handleDeleteMedia(selectedMedia)}
              >
                <Trash2 size={16} /> Hapus Gambar Ini
              </button>
              <div className="footer-right-buttons">
                <a
                  href={selectedMedia.url}
                  target="_blank"
                  rel="noreferrer"
                  className="outline-btn"
                >
                  <ExternalLink size={15} /> Buka Tab Baru
                </a>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => setSelectedMedia(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
