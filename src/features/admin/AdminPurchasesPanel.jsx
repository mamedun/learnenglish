import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { apiFetch } from "../../api";

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
const statusName = {
  pending: "Menunggu",
  paid: "Lunas",
  expired: "Kedaluwarsa",
  deleted: "Dihapus",
};

export default function AdminPurchasesPanel() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load(requestedPage = page) {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search: search.trim(),
        status,
        page: String(requestedPage),
      });
      const response = await apiFetch(`admin/purchases?${query}`);
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Pembelian gagal dimuat.");
      setItems(body.items || []);
      setPage(Number(body.page) || 1);
      setPages(Number(body.pages) || 1);
      setTotal(Number(body.total) || 0);
    } catch (error) {
      toast.error(error.message || "Pembelian gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 220);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  async function approve(item) {
    const confirmation = await Swal.fire({
      title: "Setujui pembayaran?",
      text: `${item.name} akan menerima ${Number(item.diamond_amount).toLocaleString("id-ID")} diamond. Total pembayaran: ${money(item.total_amount)}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Setujui & kreditkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#315c45",
    });
    if (!confirmation.isConfirmed) return;
    try {
      const response = await apiFetch(`admin/purchases/${item.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Pembelian tidak dapat disetujui.");
      toast.success(
        `Pembayaran disetujui. Saldo pengguna kini ${body.diamonds} diamond.`,
      );
      await load(page);
    } catch (error) {
      toast.error(error.message || "Pembelian tidak dapat disetujui.");
    }
  }

  async function remove(item) {
    const confirmation = await Swal.fire({
      title: "Hapus pesanan?",
      text: `Pesanan ${item.id.slice(0, 10)}… akan ditandai dihapus. Saldo diamond tidak berubah.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus pesanan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#c84343",
    });
    if (!confirmation.isConfirmed) return;
    try {
      const response = await apiFetch(`admin/purchases/${item.id}`, {
        method: "DELETE",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Pesanan tidak dapat dihapus.");
      toast.success("Pesanan dihapus dari antrean.");
      await load(page);
    } catch (error) {
      toast.error(error.message || "Pesanan tidak dapat dihapus.");
    }
  }

  return (
    <section className="settings-card admin-purchases-panel">
      <div className="setting-title">
        <div className="setting-icon orange">
          <Check size={18} />
        </div>
        <div>
          <b>Konfirmasi pembelian diamond</b>
          <small>
            Cari pesanan, verifikasi transfer melalui WhatsApp, lalu setujui
            atau hapus.
          </small>
        </div>
      </div>
      <div className="admin-purchases-toolbar">
        <label className="admin-search-box">
          <Search size={16} />
          <input
            className="text-field"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Cari nama, email, atau ID pesanan…"
            aria-label="Cari pembelian"
          />
        </label>
        <select
          className="text-field admin-status-filter"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Filter status pembelian"
        >
          <option value="pending">Menunggu</option>
          <option value="paid">Lunas</option>
          <option value="expired">Kedaluwarsa</option>
          <option value="">Semua aktif</option>
        </select>
        <span className="admin-user-total">{total} pesanan</span>
      </div>
      <div className="admin-users-table-wrap">
        <table className="admin-users-table admin-purchases-table">
          <thead>
            <tr>
              <th>PENGGUNA / PESANAN</th>
              <th>RINCIAN</th>
              <th>STATUS</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.name}</b>
                  <small>{item.email}</small>
                  <small className="purchase-id">
                    #{item.id.slice(0, 12)} ·{" "}
                    {new Date(item.created_at).toLocaleString("id-ID")}
                  </small>
                  {item.contacted_at && (
                    <small className="purchase-contacted">
                      Konfirmasi WhatsApp{" "}
                      {new Date(item.contacted_at).toLocaleString("id-ID")}
                    </small>
                  )}
                </td>
                <td>
                  <b>{Number(item.diamond_amount).toLocaleString("id-ID")} ◆</b>
                  <small>Dasar {money(item.base_amount)}</small>
                  <small>
                    PPN {money(item.tax_amount)} · admin {money(item.admin_fee)}
                  </small>
                  <small>
                    Kode unik Rp{String(item.unique_code).padStart(3, "0")}
                  </small>
                  <strong>{money(item.total_amount)}</strong>
                  <small>
                    Kedaluwarsa{" "}
                    {new Date(item.expires_at).toLocaleString("id-ID")}
                  </small>
                </td>
                <td>
                  <span className={`purchase-status ${item.status}`}>
                    {statusName[item.status] || item.status}
                  </span>
                </td>
                <td>
                  {item.status === "pending" ? (
                    <div className="admin-purchase-actions">
                      <button
                        className="icon-action wallet-action"
                        title="Setujui dan kreditkan diamond"
                        aria-label={`Setujui pesanan ${item.id}`}
                        onClick={() => void approve(item)}
                      >
                        <Check size={15} />
                      </button>
                      <button
                        className="icon-action danger"
                        title="Hapus pesanan"
                        aria-label={`Hapus pesanan ${item.id}`}
                        onClick={() => void remove(item)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : item.status === "expired" ? (
                    <button
                      className="icon-action danger"
                      title="Hapus pesanan kedaluwarsa"
                      aria-label={`Hapus pesanan ${item.id}`}
                      onClick={() => void remove(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : (
                    <span className="admin-action-disabled">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="admin-empty-users">
                  Tidak ada pesanan yang cocok.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={4} className="admin-empty-users">
                  Memuat pembelian…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="admin-pagination">
        <span>
          Halaman {page} dari {pages}
        </span>
        <div>
          <button
            className="outline-btn"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1 || loading}
          >
            <ChevronLeft size={15} /> Sebelumnya
          </button>
          <button
            className="outline-btn"
            onClick={() => setPage((value) => Math.min(pages, value + 1))}
            disabled={page >= pages || loading}
          >
            Berikutnya <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
