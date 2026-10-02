import { useEffect, useState } from "react";
import { Check, Megaphone, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { apiJson } from "../../api";
import { toast } from "sonner";

export default function AdminAdsPanel() {
  const [ads, setAds] = useState([]);
  const [adDraft, setAdDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  async function loadAds() {
    setBusy(true);
    try {
      const data = await apiJson("admin/course-ads");
      setAds(Array.isArray(data?.ads) ? data.ads : []);
    } catch (error) {
      toast.error(error.message || "Gagal memuat iklan.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadAds();
  }, []);

  function editAd(ad = null) {
    setAdDraft(
      ad
        ? { ...ad }
        : {
            title: "",
            description: "",
            posterUrl: "",
            link: "",
            sortOrder: ads.length + 1,
            active: true,
          },
    );
  }

  async function saveAd() {
    if (!adDraft) return;
    if (!adDraft.title?.trim()) {
      toast.error("Judul iklan harus diisi.");
      return;
    }
    setBusy(true);
    try {
      const id = adDraft.id;
      const endpoint = id
        ? `admin/course-ads/${encodeURIComponent(id)}`
        : "admin/course-ads";
      const method = id ? "PUT" : "POST";
      await apiJson(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adDraft),
      });
      toast.success(id ? "Iklan diperbarui." : "Iklan berhasil dibuat.");
      setAdDraft(null);
      void loadAds();
    } catch (error) {
      toast.error(error.message || "Gagal menyimpan iklan.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAd(ad) {
    if (!window.confirm(`Hapus iklan “${ad.title}”?`)) return;
    try {
      await apiJson(`admin/course-ads/${encodeURIComponent(ad.id)}`, {
        method: "DELETE",
      });
      toast.success("Iklan dihapus.");
      void loadAds();
    } catch (error) {
      toast.error(error.message || "Gagal menghapus iklan.");
    }
  }

  return (
    <section className="course-admin-panel">
      <div className="course-admin-toolbar">
        <div>
          <h2>
            <Megaphone size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Iklan Course
          </h2>
          <p>
            Poster rasio 16:9, link eksternal, urutan, dan status active/inactive.
            Iklan aktif tampil berurutan di halaman Course.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="outline-btn" onClick={() => loadAds()} disabled={busy}>
            <RefreshCw size={15} /> Muat ulang
          </button>
          <button className="btn-primary" onClick={() => editAd()}>
            <Plus size={15} /> Buat iklan
          </button>
        </div>
      </div>

      {adDraft && (
        <div className="course-ad-editor">
          <div className="course-ad-editor-head">
            <b>{adDraft.id ? "Edit iklan" : "Iklan baru"}</b>
            <button className="course-icon-action" onClick={() => setAdDraft(null)}>
              <X size={16} />
            </button>
          </div>
          <div className="course-field-grid">
            <label>
              Judul
              <input
                className="text-field"
                value={adDraft.title}
                onChange={(event) =>
                  setAdDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Promo Spesial..."
              />
            </label>
            <label>
              Urutan
              <input
                className="text-field"
                type="number"
                min="0"
                value={adDraft.sortOrder}
                onChange={(event) =>
                  setAdDraft((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="span-2">
              Deskripsi
              <textarea
                className="text-field"
                rows={3}
                value={adDraft.description}
                onChange={(event) =>
                  setAdDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Penjelasan ringkas tentang iklan/promo..."
              />
            </label>
            <label className="span-2">
              Poster URL · 16:9
              <input
                className="text-field"
                value={adDraft.posterUrl}
                onChange={(event) =>
                  setAdDraft((current) => ({
                    ...current,
                    posterUrl: event.target.value,
                  }))
                }
                placeholder="https://…/poster.jpg"
              />
            </label>
            <label className="span-2">
              Tautan HTTPS eksternal
              <input
                className="text-field"
                value={adDraft.link}
                onChange={(event) =>
                  setAdDraft((current) => ({
                    ...current,
                    link: event.target.value,
                  }))
                }
                placeholder="https://example.com/promo"
              />
            </label>
            <label className="course-published-toggle">
              <input
                type="checkbox"
                checked={Boolean(adDraft.active)}
                onChange={(event) =>
                  setAdDraft((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
              />{" "}
              Aktif
            </label>
          </div>
          {adDraft.posterUrl && (
            <div className="course-ad-preview">
              <img src={adDraft.posterUrl} alt="Preview iklan" />
            </div>
          )}
          <div className="course-editor-actions">
            <button className="btn-primary" onClick={saveAd} disabled={busy}>
              <Check size={15} /> Simpan iklan
            </button>
            <button className="outline-btn" onClick={() => setAdDraft(null)}>
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="course-ad-admin-list">
        {ads.map((ad) => (
          <article key={ad.id} className="course-ad-admin-card">
            <img src={ad.posterUrl} alt="" />
            <div>
              <b>{ad.title}</b>
              <p>{ad.description}</p>
              <small>
                Urutan {ad.sortOrder} · {ad.active ? "Active" : "Inactive"} ·{" "}
                {ad.link}
              </small>
            </div>
            <span
              className={`course-status-pill ${ad.active ? "published" : "draft"}`}
            >
              {ad.active ? "active" : "inactive"}
            </span>
            <div className="course-editor-actions">
              <button className="outline-btn" onClick={() => editAd(ad)}>
                Edit
              </button>
              <button
                className="course-icon-action delete"
                onClick={() => removeAd(ad)}
                title="Hapus iklan"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </article>
        ))}
        {!ads.length && (
          <div className="course-studio-empty compact">
            Belum ada iklan. Klik tombol "Buat iklan" untuk menambahkan.
          </div>
        )}
      </div>
    </section>
  );
}
