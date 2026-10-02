export default function ProcessingStatus({
  message,
  progress = null,
  detail = "",
  compact = false,
  className = "",
}) {
  if (!message) return null;
  const hasProgress = Number.isFinite(progress);
  const percentage = hasProgress
    ? Math.max(0, Math.min(100, Math.round(progress)))
    : null;

  return (
    <div
      className={`processing-status ${compact ? "is-compact" : ""} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="processing-status-spinner" aria-hidden="true" />
      <div className="processing-status-copy">
        <strong>{message}</strong>
        {detail && <small>{detail}</small>}
        {hasProgress && (
          <div
            className="processing-status-progress"
            role="progressbar"
            aria-label={message}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
          >
            <span style={{ width: `${percentage}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
