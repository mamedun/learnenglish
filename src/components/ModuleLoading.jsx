import { AudioLines } from "lucide-react";

export default function ModuleLoading({ label = "materi" }) {
  return (
    <div className="module-loading" role="status" aria-live="polite">
      <div className="module-loading-label">
        <span className="module-loading-icon">
          <AudioLines size={19} />
        </span>
        <div>
          <strong>Memuat modul {label}...</strong>
          <small>Sedang menyiapkan materi untukmu.</small>
        </div>
        <span className="spinner" aria-hidden="true" />
      </div>
      <div className="module-loading-cards" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}
