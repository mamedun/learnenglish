import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "sonner";
import { apiFetch } from "../../api";

const emptyUser = { name: "", email: "", password: "" };

export default function AdminUsersPanel() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState(emptyUser);

  async function loadUsers(requestedPage = page) {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        search: search.trim(),
        page: String(requestedPage),
        page_size: "10",
      });
      const response = await apiFetch(`admin/users?${query}`);
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Daftar akun gagal dimuat.");
      setUsers(body.users || []);
      setPage(Number(body.page) || 1);
      setPages(Number(body.pages) || 1);
      setTotal(Number(body.total) || 0);
    } catch (requestError) {
      setError(requestError.message || "Daftar akun gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(page), 220);
    return () => window.clearTimeout(timer);
    // Server-side search and page changes are the only query inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  function startCreate() {
    setSelectedUser(null);
    setForm({ ...emptyUser });
    setFormMode("create");
  }

  function startEdit(account, mode = "edit") {
    setSelectedUser(account);
    setForm({
      name: account.name || "",
      email: account.email || "",
      password: "",
    });
    setFormMode(mode);
  }

  async function submitUser(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const isCreate = formMode === "create";
      const changes = isCreate
        ? { ...form }
        : formMode === "password"
          ? { id: selectedUser.id, password: form.password }
          : {
              id: selectedUser.id,
              name: form.name,
              email: form.email,
              password: form.password,
            };
      const response = await apiFetch("admin/users", {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Perubahan akun gagal disimpan.");
      setFormMode("");
      setSelectedUser(null);
      setForm({ ...emptyUser });
      toast.success(
        isCreate
          ? "Akun dibuat. Pengguna akan diminta mengganti password saat login."
          : formMode === "password"
            ? "Password direset. Pengguna wajib menggantinya saat login."
            : "Data akun diperbarui.",
      );
      await loadUsers(isCreate ? 1 : page);
    } catch (requestError) {
      toast.error(requestError.message || "Perubahan akun gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(account) {
    const confirmation = await Swal.fire({
      title: "Hapus akun learner?",
      text: `${account.name} (${account.email}), progres, dan rekaman tersimpan akan dihapus permanen.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Hapus akun",
      cancelButtonText: "Batal",
      confirmButtonColor: "#c84343",
    });
    if (!confirmation.isConfirmed) return;
    try {
      const response = await apiFetch(`admin/users/${account.id}`, {
        method: "DELETE",
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Akun tidak dapat dihapus.");
      toast.success("Akun dan data terkait telah dihapus.");
      await loadUsers(page);
    } catch (requestError) {
      toast.error(requestError.message || "Akun tidak dapat dihapus.");
    }
  }

  async function changeWallet(account, mode) {
    const isSet = mode === "set";
    const result = await Swal.fire({
      title: isSet ? "Tetapkan saldo diamond" : "Tambah / kurangi diamond",
      text: isSet
        ? `Saldo baru untuk ${account.name}. Nilai 0 diperbolehkan.`
        : `Masukkan nilai positif untuk menambah atau negatif untuk mengurangi saldo ${account.name}.`,
      input: "number",
      inputValue: isSet ? String(account.diamonds || 0) : "",
      inputAttributes: {
        min: isSet ? "0" : "-1000000000",
        max: "1000000000",
        step: "1",
        inputmode: "numeric",
      },
      showCancelButton: true,
      confirmButtonText: isSet ? "Atur saldo" : "Terapkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#315c45",
      inputValidator: (value) => {
        if (value === "" || !Number.isInteger(Number(value)))
          return "Masukkan bilangan bulat.";
        if (Math.abs(Number(value)) > 1_000_000_000)
          return "Nilai maksimum 1.000.000.000.";
        if (isSet && Number(value) < 0) return "Saldo tidak boleh negatif.";
        if (!isSet && Number(value) === 0)
          return "Perubahan harus lebih besar atau kurang dari nol.";
        return undefined;
      },
    });
    if (!result.isConfirmed) return;
    try {
      const value = Number(result.value);
      const response = await apiFetch("admin/wallet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSet
            ? { id: account.id, mode, balance: value }
            : { id: account.id, mode, amount: value },
        ),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Saldo diamond gagal diperbarui.");
      setUsers((rows) =>
        rows.map((row) =>
          row.id === account.id ? { ...row, diamonds: body.diamonds } : row,
        ),
      );
      toast.success(`Saldo diperbarui menjadi ${body.diamonds} diamond.`);
    } catch (requestError) {
      toast.error(requestError.message || "Saldo diamond gagal diperbarui.");
    }
  }

  return (
    <section className="admin-users-panel settings-card">
      <div className="setting-title">
        <div className="setting-icon blue">
          <Users size={18} />
        </div>
        <div>
          <b>Pengguna & saldo diamond</b>
          <small>
            Cari akun, atur saldo langsung atau sesuaikan dengan nilai
            positif/negatif.
          </small>
        </div>
      </div>
      <div className="admin-users-toolbar">
        <label className="admin-search-box">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Cari nama, email, atau ID…"
            aria-label="Cari pengguna"
          />
        </label>
        <div className="admin-users-toolbar-actions">
          <span className="admin-user-total">{total} akun</span>
          <button className="btn-primary" type="button" onClick={startCreate}>
            <Plus size={16} /> Tambah user
          </button>
        </div>
      </div>

      {formMode && (
        <form className="admin-user-form" onSubmit={submitUser}>
          <div className="admin-user-form-title">
            <b>
              {formMode === "create"
                ? "Buat akun baru"
                : formMode === "password"
                  ? `Reset password · ${selectedUser?.name}`
                  : `Edit akun · ${selectedUser?.name}`}
            </b>
            <button
              type="button"
              className="icon-action"
              aria-label="Tutup form"
              onClick={() => setFormMode("")}
            >
              <X size={16} />
            </button>
          </div>
          {formMode !== "password" && (
            <>
              <label>
                Nama
                <input
                  className="text-field"
                  value={form.name}
                  maxLength={100}
                  required
                  onChange={(event) =>
                    setForm((v) => ({ ...v, name: event.target.value }))
                  }
                />
              </label>
              <label>
                Email
                <input
                  className="text-field"
                  type="email"
                  autoComplete="off"
                  value={form.email}
                  required
                  onChange={(event) =>
                    setForm((v) => ({ ...v, email: event.target.value }))
                  }
                />
              </label>
            </>
          )}
          <label>
            {formMode === "password"
              ? "Password sementara"
              : formMode === "create"
                ? "Password awal"
                : "Password baru (opsional)"}
            <input
              className="text-field"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required={formMode === "create" || formMode === "password"}
              value={form.password}
              onChange={(event) =>
                setForm((v) => ({ ...v, password: event.target.value }))
              }
            />
            <small>
              Minimal 10 karakter. Password awal/reset wajib diganti pengguna
              saat login.
            </small>
          </label>
          <div className="admin-user-form-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan"}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setFormMode("")}
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="studio-error" role="alert">
          {error}{" "}
          <button onClick={() => void loadUsers(page)}>Coba lagi</button>
        </div>
      )}
      <div className="admin-users-table-wrap">
        <table className="admin-users-table admin-wallet-table">
          <thead>
            <tr>
              <th>USER</th>
              <th>ROLE</th>
              <th>DIAMOND</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {users.map((account) => (
              <tr key={account.id}>
                <td>
                  <b>{account.name}</b>
                  <small>
                    {account.email} · ID {account.id}
                  </small>
                </td>
                <td>
                  {account.role === "admin" ? (
                    <span className="secure-chip">ADMIN</span>
                  ) : (
                    <span className="account-type-chip">LEARNER</span>
                  )}
                </td>
                <td>
                  <span className="diamond-balance">
                    <span>◆</span>
                    {Number(account.diamonds) || 0}
                  </span>
                </td>
                <td>
                  {account.role === "admin" ? (
                    <span className="admin-action-disabled">
                      Admin dilindungi
                    </span>
                  ) : (
                    <div className="admin-user-actions">
                      <button
                        className="icon-action wallet-action"
                        title="Atur saldo diamond"
                        aria-label={`Atur saldo ${account.email}`}
                        onClick={() => void changeWallet(account, "set")}
                      >
                        <Wallet size={15} />
                      </button>
                      <button
                        className="icon-action wallet-action"
                        title="Tambah/kurangi diamond"
                        aria-label={`Sesuaikan saldo ${account.email}`}
                        onClick={() => void changeWallet(account, "adjust")}
                      >
                        <Settings2 size={15} />
                      </button>
                      <button
                        className="icon-action"
                        title="Edit user"
                        aria-label={`Edit ${account.email}`}
                        onClick={() => startEdit(account)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-action"
                        title="Reset password"
                        aria-label={`Reset password ${account.email}`}
                        onClick={() => startEdit(account, "password")}
                      >
                        <KeyRound size={15} />
                      </button>
                      <button
                        className="icon-action danger"
                        title="Hapus user"
                        aria-label={`Hapus ${account.email}`}
                        onClick={() => void deleteUser(account)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={4} className="admin-empty-users">
                  Tidak ada akun yang cocok.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={4} className="admin-empty-users">
                  Memuat pengguna…
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
