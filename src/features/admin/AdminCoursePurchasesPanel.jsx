import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, RefreshCw, Search, Trash2 } from "lucide-react";
import { apiJson } from "../../api";
import { toast } from "sonner";

const money = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
export default function AdminCoursePurchasesPanel() {
  const [items,setItems]=useState([]);const [search,setSearch]=useState("");const [status,setStatus]=useState("pending");const [page,setPage]=useState(1);const [pages,setPages]=useState(1);const [total,setTotal]=useState(0);const [busy,setBusy]=useState(false);
  async function load(nextPage=page){setBusy(true);try{const params=new URLSearchParams({search,status,page:String(nextPage)});const result=await apiJson(`admin/course-purchases?${params}`);setItems(result.items||[]);setPage(result.page||1);setPages(result.pages||1);setTotal(result.total||0);}catch(error){toast.error(error.message||"Pembelian course gagal dimuat.");}finally{setBusy(false);}}
  useEffect(()=>{void load(1);},[status]);
  async function approve(item){if(!window.confirm(`Setujui pembayaran ${item.course_name} untuk ${item.name||item.email}? Enrollment akan aktif otomatis.`))return;try{await apiJson(`admin/course-purchases/${item.id}/approve`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});toast.success("Pembayaran disetujui; learner otomatis terdaftar.");await load();}catch(error){toast.error(error.message||"Approval gagal.");}}
  async function remove(item){if(!window.confirm("Hapus pesanan pending/expired ini?"))return;try{await apiJson(`admin/course-purchases/${item.id}`,{method:"DELETE"});toast.success("Pesanan dihapus.");await load();}catch(error){toast.error(error.message||"Pesanan gagal dihapus.");}}
  return (
    <section className="course-admin-panel settings-card">
      <div className="course-admin-toolbar">
        <div>
          <h2>Pembelian course</h2>
          <p>Approval manual QRIS · approval otomatis memberikan enrollment.</p>
        </div>
        <button className="outline-btn" onClick={() => load()} disabled={busy}>
          <RefreshCw size={15} className={busy ? "spin" : ""} /> Muat ulang
        </button>
      </div>
      <div className="course-admin-filters">
        <label className="admin-search-box">
          <Search size={16} />
          <input
            value={search}
            placeholder="Cari learner, email, course, ID…"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && load(1)}
          />
        </label>
        <select
          className="admin-select-filter"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Semua status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="expired">Expired</option>
        </select>
        <button className="btn-primary admin-filter-btn" onClick={() => load(1)}>
          <Search size={15} /> Cari
        </button>
      </div>
      <div className="course-admin-table-wrap">
        <table className="course-admin-table">
          <thead>
            <tr>
              <th>Learner</th>
              <th>Course</th>
              <th>Total</th>
              <th>Status</th>
              <th>Dibuat</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.name || "Learner"}</b>
                  <small>
                    {item.email}
                    <br />
                    {item.id}
                  </small>
                </td>
                <td>{item.course_name}</td>
                <td>
                  {money(item.total_amount)}
                  <small>
                    Kode unik Rp{String(item.unique_code).padStart(3, "0")}
                  </small>
                </td>
                <td>
                  <span className={`course-status-pill ${item.status}`}>
                    {item.status}
                  </span>
                </td>
                <td>
                  {new Date(item.created_at).toLocaleString("id-ID")}
                  <small>
                    Hingga {new Date(item.expires_at).toLocaleString("id-ID")}
                  </small>
                </td>
                <td>
                  <div className="course-table-actions">
                    {item.status === "pending" && (
                      <button
                        className="course-icon-action approve"
                        title="Setujui"
                        onClick={() => approve(item)}
                      >
                        <Check size={16} />
                      </button>
                    )}
                    {["pending", "expired"].includes(item.status) && (
                      <button
                        className="course-icon-action delete"
                        title="Hapus"
                        onClick={() => remove(item)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan="6" className="course-table-empty">
                  {busy
                    ? "Memuat…"
                    : "Tidak ada pembelian course untuk filter ini."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="course-admin-pagination">
        <span>
          {total} transaksi · halaman {page}/{pages}
        </span>
        <div>
          <button
            className="outline-btn"
            disabled={page <= 1 || busy}
            onClick={() => load(page - 1)}
          >
            <ChevronLeft size={15} /> Sebelumnya
          </button>
          <button
            className="outline-btn"
            disabled={page >= pages || busy}
            onClick={() => load(page + 1)}
          >
            Berikutnya <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
