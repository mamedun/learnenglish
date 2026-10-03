import { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  Check,
  X,
  Search,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "../api";
import { toast } from "sonner";

export default function MediaLibraryModal({
  isOpen,
  onClose,
  onSelect,
  title = "Pilih Gambar dari Media Library",
}) {
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadMedia();
      setSelectedItem(null);
    }
  }, [isOpen]);

  async function loadMedia() {
    setLoading(true);
    try {
      const res = await apiFetch("admin/media");
      const json = await res.json();
      if (res.ok && Array.isArray(json.media)) {
        setMediaList(json.media);
      } else {
        toast.error(json.error || "Gagal memuat daftar media.");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server media.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const filtered = mediaList.filter((m) =>
    m.filename.toLowerCase().includes(search.toLowerCase()),
  );

  const handleConfirm = () => {
    if (!selectedItem) {
      toast.error("Pilih gambar terlebih dahulu.");
      return;
    }
    onSelect(selectedItem.relative_url || selectedItem.url);
    onClose();
  };

  return (
    <div className="media-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="media-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="media-modal-header">
          <div className="media-modal-title">
            <ImageIcon size={20} className="media-title-icon" />
            <h3>{title}</h3>
          </div>
          <button type="button" className="icon-btn media-close-btn" onClick={onClose} aria-label="Tutup">
            <X size={19} />
          </button>
        </div>

        <div className="media-modal-toolbar">
          <div className="media-search-box">
            <Search size={16} className="media-search-icon" />
            <input
              type="text"
              placeholder="Cari nama gambar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-field media-search-input"
            />
          </div>
          <button
            type="button"
            className="secondary-btn media-refresh-btn"
            onClick={loadMedia}
            disabled={loading}
            title="Muat ulang media"
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            <span>Segarkan</span>
          </button>
        </div>

        <div className="media-modal-body">
          {loading && mediaList.length === 0 ? (
            <div className="media-empty-state">
              <span className="spinner" />
              <p>Memuat daftar gambar dari server…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="media-empty-state">
              <ImageIcon size={40} className="media-empty-icon" />
              <p>
                {search
                  ? "Tidak ada gambar yang cocok dengan kata kunci pencarian."
                  : "Belum ada gambar yang tersimpan di api/uploads/media/. Gunakan tab Image Generator untuk membuat gambar baru."}
              </p>
            </div>
          ) : (
            <div className="media-grid">
              {filtered.map((item) => {
                const isSelected = selectedItem?.filename === item.filename;
                return (
                  <div
                    key={item.filename}
                    className={`media-card ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedItem(item)}
                    onDoubleClick={() => {
                      setSelectedItem(item);
                      onSelect(item.relative_url || item.url);
                      onClose();
                    }}
                  >
                    <div className="media-thumb-wrapper">
                      <img
                        src={item.url}
                        alt={item.filename}
                        loading="lazy"
                        className="media-thumb-img"
                      />
                      {isSelected && (
                        <div className="media-selected-badge">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                    <div className="media-card-info">
                      <span className="media-card-name" title={item.filename}>
                        {item.filename}
                      </span>
                      <span className="media-card-meta">
                        {(item.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="media-modal-footer">
          <div className="media-selected-preview">
            {selectedItem ? (
              <span className="media-selected-text">
                Terpilih: <b>{selectedItem.filename}</b>
              </span>
            ) : (
              <span className="media-hint-text">
                Klik pada gambar untuk memilih, atau klik dua kali untuk memilih langsung.
              </span>
            )}
          </div>
          <div className="media-footer-actions">
            <button type="button" className="outline-btn" onClick={onClose}>
              Batal
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={handleConfirm}
              disabled={!selectedItem}
            >
              <Check size={16} /> Pilih Gambar Ini
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
