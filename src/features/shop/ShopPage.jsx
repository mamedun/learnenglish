import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Copy,
  Gem,
  MessageCircle,
  QrCode,
  RefreshCw,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { apiJson, apiUrl } from "../../api";
import "./ShopPage.css";

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
const dateTime = (value) =>
  value ? new Date(value).toLocaleString("id-ID") : "—";
const statusText = {
  pending: "Menunggu konfirmasi",
  paid: "Lunas",
  expired: "Kedaluwarsa",
  deleted: "Dihapus",
};

export default function ShopPage({ user, onBalanceChange = () => {} }) {
  const [settings, setSettings] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [balance, setBalance] = useState(Number(user?.diamonds) || 0);
  const [baseAmount, setBaseAmount] = useState(5000);
  const [activeId, setActiveId] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [staticVisible, setStaticVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const activePurchase = useMemo(
    () => purchases.find((item) => item.id === activeId) || null,
    [purchases, activeId],
  );
  const dynamicQrAvailable = Boolean(activePurchase?.qris_payload);
  const staticQrUrl = settings?.static_qr_url
    ? apiUrl(settings.static_qr_url)
    : "";

  async function loadShop() {
    setLoading(true);
    try {
      const [shop, history] = await Promise.all([
        apiJson("shop/settings"),
        apiJson("shop/purchases"),
      ]);
      setSettings(shop.settings || {});
      setPurchases(history.purchases || []);
      const nextBalance = Number(history.diamonds ?? shop.diamonds ?? 0);
      setBalance(nextBalance);
      onBalanceChange(nextBalance);
      setActiveId((current) => {
        if (
          current &&
          (history.purchases || []).some((item) => item.id === current)
        )
          return current;
        return (
          history.purchases?.find((item) => item.status === "pending")?.id ||
          null
        );
      });
    } catch (error) {
      toast.error(error.message || "Toko diamond gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShop();
    // Initial account is stable for this routed page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    if (!activePurchase?.qris_payload) {
      setQrDataUrl("");
      return () => {
        active = false;
      };
    }
    QRCode.toDataURL(activePurchase.qris_payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: { dark: "#17251f", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [activePurchase?.id, activePurchase?.qris_payload]);

  async function createPurchase(event) {
    event.preventDefault();
    const amount = Number(baseAmount);
    if (!Number.isInteger(amount) || amount < 5000 || amount % 5000 !== 0) {
      toast.error("Nominal dasar harus kelipatan Rp5.000, minimal Rp5.000.");
      return;
    }
    setCreating(true);
    try {
      const body = await apiJson("shop/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_amount: amount }),
      });
      const purchase = body.purchase;
      setPurchases((rows) => [
        purchase,
        ...rows.filter((row) => row.id !== purchase.id),
      ]);
      setActiveId(purchase.id);
      setStaticVisible(false);
      toast.success("Pesanan diamond dibuat. QR berlaku selama 24 jam.");
    } catch (error) {
      toast.error(error.message || "Pesanan tidak dapat dibuat.");
    } finally {
      setCreating(false);
    }
  }

  async function contactAdmin(purchase) {
    const whatsapp = String(settings?.whatsapp || "").replace(/\D/g, "");
    if (!whatsapp) {
      toast.error("Nomor WhatsApp admin belum dikonfigurasi.");
      return;
    }
    const message = [
      "Halo Admin SpeakUp, saya sudah melakukan pembayaran diamond.",
      `Nama: ${user?.name || ""}`,
      `Email: ${user?.email || ""}`,
      `ID pesanan: ${purchase.id}`,
      `Nominal dasar: ${money(purchase.base_amount)}`,
      `PPN: ${money(purchase.tax_amount)}`,
      `Biaya admin: ${money(purchase.admin_fee)}`,
      `Kode unik: Rp${String(purchase.unique_code).padStart(3, "0")}`,
      `Total dibayar: ${money(purchase.total_amount)}`,
      `Diamond yang dibeli: ${Number(purchase.diamond_amount).toLocaleString("id-ID")}`,
    ].join("\n");
    const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
    try {
      await apiJson(`shop/purchases/${purchase.id}/contacted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setPurchases((rows) =>
        rows.map((row) =>
          row.id === purchase.id
            ? { ...row, contacted_at: new Date().toISOString() }
            : row,
        ),
      );
    } catch (error) {
      popup?.close();
      toast.error(error.message || "Konfirmasi WhatsApp gagal disiapkan.");
      return;
    }
    const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
    if (popup) popup.location.href = url;
    else window.location.href = url;
  }

  async function copyPayload(purchase) {
    try {
      await navigator.clipboard.writeText(purchase.qris_payload || "");
      toast.success("Teks QRIS disalin.");
    } catch {
      toast.error("Browser tidak mengizinkan penyalinan teks QRIS.");
    }
  }

  if (loading && !settings) {
    return (
      <div className="shop-loading">
        <span className="spinner" /> Memuat Toko Diamond…
      </div>
    );
  }

  return (
    <div className="shop-page">
      <section className="shop-hero">
        <div>
          <span className="eyebrow">
            <ShoppingBag size={15} /> SPEAKUP DIAMOND SHOP
          </span>
          <h1>
            Isi saldo <span>diamond.</span>
          </h1>
          <p>
            Gunakan diamond untuk AI Lesson, Listening Lab AI, dan Live Lesson.
            Satu diamond bernilai Rp100.
          </p>
        </div>
        <div className="shop-wallet-card">
          <span>
            <Wallet size={17} /> SALDO SAAT INI
          </span>
          <strong>
            <Gem size={23} />{" "}
            {user?.unlimited_diamonds
              ? "Unlimited"
              : balance.toLocaleString("id-ID")}
          </strong>
          <small>
            {user?.unlimited_diamonds
              ? "Akses Admin · saldo tidak dikurangi untuk fitur AI"
              : "Diamond akun SpeakUp"}
          </small>
        </div>
      </section>

      <div className="shop-layout">
        <section className="shop-card shop-buy-card">
          <div className="shop-card-heading">
            <div>
              <span className="shop-icon">
                <Gem size={19} />
              </span>
              <div>
                <b>Buat pesanan diamond</b>
                <small>
                  1 diamond = Rp100 · nominal dasar harus kelipatan Rp5.000
                </small>
              </div>
            </div>
          </div>
          <form onSubmit={createPurchase}>
            <label className="field-label" htmlFor="diamond-amount">
              NOMINAL DASAR (RUPIAH)
            </label>
            <div className="shop-amount-input">
              <span>Rp</span>
              <input
                id="diamond-amount"
                className="text-field"
                type="number"
                inputMode="numeric"
                min={5000}
                step={5000}
                value={baseAmount}
                onChange={(event) =>
                  setBaseAmount(
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
              />
            </div>
            <div className="shop-presets">
              {[5000, 25000, 50000, 100000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={Number(baseAmount) === amount ? "active" : ""}
                  onClick={() => setBaseAmount(amount)}
                >
                  {money(amount)}
                </button>
              ))}
            </div>
            <div className="shop-estimate">
              <span>Diamond diterima</span>
              <b>
                <Gem size={15} />{" "}
                {Math.floor((Number(baseAmount) || 0) / 100).toLocaleString(
                  "id-ID",
                )}
              </b>
            </div>
            <button
              className="btn-primary shop-create-order"
              type="submit"
              disabled={creating || !baseAmount}
            >
              {creating ? (
                <>
                  <span className="spinner" /> Membuat pesanan…
                </>
              ) : (
                <>
                  <QrCode size={17} /> Buat QR pembayaran
                </>
              )}
            </button>
            <small className="shop-fine-print">
              PPN, biaya admin tetap, dan kode unik Rp001–999 ditambahkan ke
              total pembayaran. Ketiganya tidak menambah diamond.
            </small>
          </form>
        </section>

        <section className="shop-card shop-order-card">
          <div className="shop-card-heading">
            <div>
              <span className="shop-icon">
                <QrCode size={19} />
              </span>
              <div>
                <b>Pesanan pembayaran</b>
                <small>QR dinamis nominal tepat · berlaku 24 jam</small>
              </div>
            </div>
            <button
              className="icon-action"
              type="button"
              onClick={() => void loadShop()}
              title="Muat ulang"
            >
              <RefreshCw size={15} />
            </button>
          </div>
          {activePurchase ? (
            <>
              <div className="shop-order-summary">
                <div>
                  <span>Dasar</span>
                  <b>{money(activePurchase.base_amount)}</b>
                </div>
                <div>
                  <span>PPN</span>
                  <b>{money(activePurchase.tax_amount)}</b>
                </div>
                <div>
                  <span>Biaya admin</span>
                  <b>{money(activePurchase.admin_fee)}</b>
                </div>
                <div>
                  <span>Kode unik</span>
                  <b>Rp{String(activePurchase.unique_code).padStart(3, "0")}</b>
                </div>
                <div className="shop-order-total">
                  <span>Total bayar</span>
                  <b>{money(activePurchase.total_amount)}</b>
                </div>
                <div>
                  <span>Diamond</span>
                  <b className="diamond-balance">
                    <Gem size={14} />{" "}
                    {Number(activePurchase.diamond_amount).toLocaleString(
                      "id-ID",
                    )}
                  </b>
                </div>
              </div>
              <div className="shop-expiry">
                <Clock3 size={14} /> Berlaku sampai{" "}
                {dateTime(activePurchase.expires_at)}
              </div>
              {activePurchase.status === "pending" ? (
                <>
                  {dynamicQrAvailable && qrDataUrl ? (
                    <div className="shop-qr-wrap">
                      <img
                        src={qrDataUrl}
                        alt={`QRIS pembayaran ${money(activePurchase.total_amount)}`}
                      />
                      <span>QRIS dinamis · nominal sudah terisi</span>
                    </div>
                  ) : !dynamicQrAvailable && settings?.static_qr_url ? (
                    <div className="shop-qr-wrap shop-static-qr-main">
                      <img
                        src={staticQrUrl}
                        alt="QRIS statis merchant SpeakUp"
                      />
                      <span>QRIS statis · masukkan nominal total di atas</span>
                    </div>
                  ) : (
                    <div className="shop-qr-error">
                      QR pembayaran belum tersedia. Hubungi admin.
                    </div>
                  )}
                  {dynamicQrAvailable && settings?.static_qr_url && (
                    <div className="shop-static-alternative">
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => setStaticVisible((visible) => !visible)}
                      >
                        {staticVisible
                          ? "Sembunyikan QR statis alternatif"
                          : "Tampilkan QR statis alternatif"}
                      </button>
                      {staticVisible && (
                        <div className="shop-qr-wrap">
                          <img src={staticQrUrl} alt="QRIS statis alternatif" />
                          <span>
                            QR statis · transfer sejumlah{" "}
                            {money(activePurchase.total_amount)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    className="shop-whatsapp-button"
                    type="button"
                    onClick={() => void contactAdmin(activePurchase)}
                    disabled={!settings?.whatsapp}
                  >
                    <MessageCircle size={17} /> Saya sudah bayar · konfirmasi
                    WhatsApp
                  </button>
                  {activePurchase.contacted_at && (
                    <small className="shop-contacted-note">
                      <CheckCircle2 size={14} /> Konfirmasi WhatsApp dikirim{" "}
                      {dateTime(activePurchase.contacted_at)}. Admin akan
                      memverifikasi pembayaran.
                    </small>
                  )}
                  {dynamicQrAvailable && (
                    <button
                      className="shop-copy-payload"
                      type="button"
                      onClick={() => void copyPayload(activePurchase)}
                    >
                      <Copy size={14} /> Salin teks QRIS
                    </button>
                  )}
                </>
              ) : (
                <div
                  className={`shop-purchase-status ${activePurchase.status}`}
                >
                  <CheckCircle2 size={18} />
                  <span>
                    <b>
                      {statusText[activePurchase.status] ||
                        activePurchase.status}
                    </b>
                    <small>
                      {activePurchase.status === "paid"
                        ? `Diamond sudah masuk pada ${dateTime(activePurchase.approved_at)}.`
                        : "Pesanan ini tidak lagi dapat dibayar."}
                    </small>
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="shop-empty-order">
              <QrCode size={30} />
              <b>Belum ada pesanan aktif</b>
              <span>
                Pilih nominal lalu buat pesanan untuk menampilkan QR pembayaran.
              </span>
            </div>
          )}
        </section>
      </div>

      <section className="shop-card shop-history-card">
        <div className="shop-card-heading">
          <div>
            <span className="shop-icon">
              <Clock3 size={19} />
            </span>
            <div>
              <b>Riwayat pembelian</b>
              <small>Pesanan terbaru akun ini</small>
            </div>
          </div>
          <span className="shop-history-count">{purchases.length} pesanan</span>
        </div>
        {purchases.length ? (
          <div className="shop-history-list">
            {purchases.map((purchase) => (
              <button
                key={purchase.id}
                type="button"
                className={`shop-history-row ${purchase.id === activeId ? "selected" : ""}`}
                onClick={() => {
                  setActiveId(purchase.id);
                  setStaticVisible(false);
                }}
              >
                <span className={`purchase-status ${purchase.status}`}>
                  {statusText[purchase.status] || purchase.status}
                </span>
                <span>
                  <b>{money(purchase.total_amount)}</b>
                  <small>
                    {dateTime(purchase.created_at)} · kode Rp
                    {String(purchase.unique_code).padStart(3, "0")}
                  </small>
                </span>
                <strong>
                  <Gem size={14} />{" "}
                  {Number(purchase.diamond_amount).toLocaleString("id-ID")}
                </strong>
              </button>
            ))}
          </div>
        ) : (
          <p className="shop-history-empty">
            Riwayat pembelian akan muncul di sini.
          </p>
        )}
      </section>
    </div>
  );
}
