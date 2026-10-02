import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  QrCode,
  RefreshCw,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { apiUrl } from "../../api";
import { toast } from "sonner";
import "./coursePurchase.css";

const money = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

export default function CoursePurchaseDialog({
  purchase,
  settings,
  user,
  onClose,
  onContact,
  onRefresh,
  refreshing = false,
}) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    if (!purchase?.qris_payload) {
      setQr("");
      return () => {
        alive = false;
      };
    }
    QRCode.toDataURL(purchase.qris_payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 300,
      color: { dark: "#17251f", light: "#ffffff" },
    })
      .then((data) => {
        if (alive) setQr(data);
      })
      .catch(() => {
        if (alive) setQr("");
      });
    return () => {
      alive = false;
    };
  }, [purchase?.id, purchase?.qris_payload]);
  if (!purchase) return null;
  const whatsapp = String(settings?.whatsapp || "").replace(/\D/g, "");
  const staticQr = settings?.static_qr_url
    ? apiUrl(settings.static_qr_url)
    : "";
  const paid = purchase.status === "paid";
  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(purchase.qris_payload || "");
      toast.success("Teks QRIS disalin.");
    } catch {
      toast.error("Browser tidak mengizinkan penyalinan QRIS.");
    }
  }
  function contactAdmin() {
    if (!whatsapp) {
      toast.error("Nomor WhatsApp admin belum dikonfigurasi.");
      return;
    }
    const message = [
      "Halo Admin SpeakUp, saya sudah membayar course.",
      `Nama: ${user?.name || ""}`,
      `Email: ${user?.email || ""}`,
      `Course: ${purchase.course_name}`,
      `ID pesanan: ${purchase.id}`,
      `Nominal dasar: ${money(purchase.base_amount)}`,
      `PPN: ${money(purchase.tax_amount)}`,
      `Biaya admin: ${money(purchase.admin_fee)}`,
      `Kode unik: Rp${String(purchase.unique_code).padStart(3, "0")}`,
      `Total dibayar: ${money(purchase.total_amount)}`,
    ].join("\n");
    void onContact?.(purchase);
    const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
    const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
    if (popup) popup.location.href = url;
    else window.location.href = url;
  }
  return (
    <div
      className="course-payment-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="course-payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-payment-title"
      >
        <button
          className="course-payment-close"
          onClick={onClose}
          aria-label="Tutup"
        >
          <X size={20} />
        </button>
        <div className="course-payment-heading">
          <span className="course-payment-icon">
            <QrCode size={23} />
          </span>
          <div>
            <div className="eyebrow">PEMBAYARAN COURSE</div>
            <h2 id="course-payment-title">{purchase.course_name}</h2>
            <p>Scan QRIS lalu kirim konfirmasi untuk approval Admin.</p>
          </div>
        </div>
        <div className="course-payment-content">
          <div className="course-payment-qr">
            {qr ? (
              <img src={qr} alt="QRIS pembayaran course" />
            ) : staticQr ? (
              <img src={staticQr} alt="QRIS pembayaran" />
            ) : (
              <div className="course-payment-noqr">QRIS belum tersedia</div>
            )}
            <b>{money(purchase.total_amount)}</b>
            <small>
              {purchase.qris_payload
                ? "QRIS dengan nominal unik"
                : "QR statis · input total secara manual"}
            </small>
            {purchase.qris_payload && (
              <button className="outline-btn" onClick={copyPayload}>
                <Copy size={15} /> Salin teks QRIS
              </button>
            )}
          </div>
          <div className="course-payment-summary">
            <div>
              <span>Harga course</span>
              <b>{money(purchase.base_amount)}</b>
            </div>
            <div>
              <span>PPN</span>
              <b>{money(purchase.tax_amount)}</b>
            </div>
            <div>
              <span>Biaya admin</span>
              <b>{money(purchase.admin_fee)}</b>
            </div>
            <div>
              <span>Kode unik</span>
              <b>Rp{String(purchase.unique_code).padStart(3, "0")}</b>
            </div>
            <div className="course-payment-total">
              <span>Total transfer</span>
              <b>{money(purchase.total_amount)}</b>
            </div>
            <div className="course-payment-expiry">
              <Clock3 size={14} /> Berlaku hingga{" "}
              {new Date(purchase.expires_at).toLocaleString("id-ID")}
            </div>
          </div>
        </div>
        {paid ? (
          <div className="course-payment-success">
            <CheckCircle2 size={18} /> Pembayaran disetujui. Enrollment course
            sudah aktif.
          </div>
        ) : (
          <div className="course-payment-actions">
            <button className="btn-primary" onClick={contactAdmin}>
              <ExternalLink size={16} /> Saya sudah bayar · hubungi Admin
            </button>
            <button
              className="outline-btn"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <span className="spinner" />
              ) : (
                <RefreshCw size={15} />
              )}{" "}
              Perbarui status
            </button>
          </div>
        )}
        <div className="course-payment-footnote">
          Akses course aktif otomatis setelah pembayaran diverifikasi Admin.
          Pesanan pending akan kedaluwarsa setelah 24 jam.
        </div>
      </section>
    </div>
  );
}
