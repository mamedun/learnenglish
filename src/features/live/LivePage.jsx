import { useState } from "react";
import {
  AudioLines,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock3,
  Gem,
  Headphones,
  MessageSquare,
  Pause,
  Sparkles,
  Trash2,
} from "lucide-react";
import { formatTime } from "../../lib/formatTime";
import { LIVE_TOPICS } from "../../data/liveTopics";
import AudioRadarWaveform from "../../components/AudioRadarWaveform";

export default function LivePage({
  liveOn,
  liveSeconds,
  liveLines,
  liveStatus,
  liveLoading = false,
  liveStream = null,
  liveAssessment,
  liveAssessmentFailed = false,
  diamonds = 0,
  unlimitedAccess = false,
  liveTopicId,
  liveTopic,
  topics = [],
  courseId = "ielts",
  liveMaxSeconds = 600,
  liveBlockMinutes = 5,
  liveRate = 2,
  onLiveTopicChange = () => {},
  beginLive,
  endLive,
  retryLiveAssessment = () => {},
  liveHistory = [],
  deleteLiveHistoryItem = () => {},
  clearAllLiveHistory = () => {},
}) {
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);
  const loadingLabel = liveStatus.toLowerCase().includes("feedback")
    ? "Menyiapkan feedback…"
    : liveStatus.toLowerCase().includes("mengakhiri")
      ? "Mengakhiri sesi…"
      : liveStatus.toLowerCase().includes("token")
        ? "Mengamankan sesi…"
        : liveStatus.toLowerCase().includes("mikrofon")
          ? "Meminta mikrofon…"
          : "Menghubungi Tutor…";
  const canRetryAssessment =
    liveAssessmentFailed &&
    !liveOn &&
    !liveLoading &&
    liveLines.some((line) => line.who === "learner");
  const topicOptions = topics?.length ? topics : LIVE_TOPICS;
  const selectedTopicId = liveTopicId || liveTopic?.id || topicOptions[0]?.id;
  const activeTopic =
    topicOptions.find((t) => t.id === selectedTopicId) ||
    liveTopic ||
    topicOptions[0];
  const tutorName = activeTopic?.tutorName || activeTopic?.coach || "Maya";
  const sessionLimit = Math.ceil(Number(liveMaxSeconds || 600) / 60);
  return (
    <div className="live-page" data-course-id={courseId}>
      <div className="live-heading">
        <div className="eyebrow">
          <span className="live-pulse" /> REAL-TIME CONVERSATION
        </div>
        <h1>
          Let’s talk <span>naturally.</span>
        </h1>
        <p>Latih percakapan spontan dalam suasana yang santai dan suportif.</p>
      </div>
      <div className="live-panel">
        <div className="live-panel-top">
          <span className="live-label">
            <span className="live-pulse" /> LIVE TUTOR
          </span>
          <span className="timer-pill">
            <Clock3 size={14} />
            {formatTime(liveSeconds)}{" "}
            <small>/ {formatTime(liveMaxSeconds)}</small>
          </span>
        </div>
        <div className="live-orb-wrap">
          {liveOn && (
            <div className="live-orb-radar-rings" aria-hidden="true">
              <span className="live-radar-wave lrw-1" />
              <span className="live-radar-wave lrw-2" />
              <span className="live-radar-wave lrw-3" />
            </div>
          )}
          <div className={`live-orb ${liveOn ? "speaking" : ""}`}>
            <div className="orb-inner">
              {liveOn ? <AudioLines size={36} /> : <Headphones size={36} />}
            </div>
          </div>
          <div className="orb-rings">
            <i />
            <i />
            <i />
          </div>
        </div>
        <h2 className="live-conversation-title">
          {liveOn
            ? "You\u2019re in the conversation"
            : "Your conversation starts here"}
        </h2>
        <p className="live-conversation-description">
          {liveOn
            ? `Speak naturally; ${tutorName} will guide the role-play and give a quick, helpful correction after each turn.`
            : `Pilih topik. ${tutorName} akan membuka percakapan dengan pertanyaan sesuai peran dan topik pilihanmu.`}
        </p>
        {liveOn && (
          <AudioRadarWaveform
            stream={liveStream}
            theme="emerald"
            label={`Live Tutor Aktif · ${tutorName} Mendengarkan & Merespons`}
            subLabel="Mikrofon aktif dua arah — bicaralah secara alami kapan saja"
            className="live-radar-card"
          />
        )}
        <div className="live-topic">
          <label htmlFor="live-topic-select">TOPIK HARI INI</label>
          <div className="live-topic-content">
            <select
              id="live-topic-select"
              className="live-topic-select"
              value={selectedTopicId}
              onChange={(event) => onLiveTopicChange(event.target.value)}
              disabled={liveOn || liveLoading}
            >
              {topicOptions.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.label}
                </option>
              ))}
            </select>
            <small>
              {liveTopic?.description || LIVE_TOPICS[0].description}
            </small>
          </div>
          <span className="live-status-mini">
            {liveOn ? "SEDANG BERLANGSUNG" : liveStatus}
          </span>
        </div>
        <button
          className={liveOn ? "btn-end" : "btn-live-start"}
          onClick={liveOn ? endLive : beginLive}
          disabled={liveLoading}
        >
          {liveLoading ? (
            <>
              <span className="spinner" /> {loadingLabel}
            </>
          ) : liveOn ? (
            <>
              <Pause size={17} /> Akhiri sesi
            </>
          ) : (
            <>
              <AudioLines size={18} /> Mulai percakapan Live
            </>
          )}
        </button>
        <div className="live-status">
          <span>
            {unlimitedAccess ? (
              `Admin unlimited access · saldo diamond tidak digunakan · maks ${sessionLimit} mnt`
            ) : (
              <>
                {Number(liveRate)} <Gem size={12} style={{ display: "inline", verticalAlign: "middle" }} /> / menit · cadangan per {Number(liveBlockMinutes)} menit · maks {sessionLimit} mnt · saldo {Number(diamonds).toLocaleString("id-ID")}
              </>
            )}
          </span>
        </div>
      </div>
      {liveLines.length > 0 && (
        <div className="live-transcript">
          <div className="eyebrow">SESSION TRANSCRIPT</div>
          {liveLines.map((l, i) => (
            <p key={i}>
              <b>{l.who === "coach" ? tutorName : "You"}:</b> {l.text}
            </p>
          ))}
        </div>
      )}
      {canRetryAssessment && (
        <section className="settings-card live-assessment-card">
          <h2>Feedback temporarily unavailable</h2>
          <p>
            The transcript is still available above. Retry post-session feedback
            without repeating the conversation.
          </p>
          <button className="btn-primary" onClick={retryLiveAssessment}>
            Retry feedback
          </button>
        </section>
      )}
      {liveAssessment && (
        <section className="settings-card live-assessment-card">
          <div className="eyebrow">POST-SESSION FEEDBACK</div>
          <h2>Session review</h2>
          <p>{liveAssessment.overall_feedback}</p>
          <div className="live-feedback-grid">
            <div>
              <b>Strengths</b>
              <ul>
                {(liveAssessment.strengths || []).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
            <div>
              <b>Next steps</b>
              <ul>
                {(liveAssessment.improvements || []).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
          {(liveAssessment.corrected_examples || []).length > 0 && (
            <div>
              <b>Suggested revisions</b>
              {liveAssessment.corrected_examples.map((x, i) => (
                <p key={i}>
                  <s>{x.original}</s> → <b>{x.improved}</b>
                </p>
              ))}
            </div>
          )}
          <small>
            Transcript-only feedback; no pronunciation score or official IELTS
            band is assigned.
          </small>
        </section>
      )}

      {/* RIWAYAT PERCAKAPAN LIVE (SELF-REVIEW) */}
      <section className="settings-card live-history-section">
        <div className="live-history-header">
          <div>
            <div className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#315c45" }}>
              <BookOpen size={14} /> RIWAYAT PERCAKAPAN LIVE · SELF-REVIEW
            </div>
            <h2 style={{ margin: "4px 0 2px", fontSize: 19, color: "#243c2c" }}>
              Arsip Percakapan Mandiri
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "#6a7b70" }}>
              Transkrip sesi tersimpan untuk bahan evaluasi dan review mandirimu. Tidak dapat digunakan untuk melanjutkan percakapan.
            </p>
          </div>
          {liveHistory.length > 0 && (
            <button
              type="button"
              className="outline-btn live-clear-history-btn"
              onClick={clearAllLiveHistory}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "#b3392d",
                borderColor: "#f2c6c0",
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 12px",
                borderRadius: 8,
              }}
            >
              <Trash2 size={13} /> Hapus Semua ({liveHistory.length})
            </button>
          )}
        </div>

        {liveHistory.length === 0 ? (
          <div className="live-history-empty" style={{ textAlign: "center", padding: "28px 16px", color: "#8a9a8f" }}>
            <MessageSquare size={32} style={{ margin: "0 auto 8px", opacity: 0.45 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#4f6356" }}>
              Belum ada riwayat percakapan live
            </p>
            <small style={{ fontSize: 12, color: "#7a8c80" }}>
              Transkrip sesi akan otomatis tersimpan di sini setelah kamu menyelesaikan sesi percakapan dengan Maya.
            </small>
          </div>
        ) : (
          <div className="live-history-list" style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {liveHistory.map((item) => {
              const isExpanded = expandedHistoryId === item.id;
              const formattedDate = item.date
                ? new Date(item.date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Baru saja";
              return (
                <div key={item.id} className="live-history-card">
                  <div className="live-history-card-top">
                    <div className="live-history-card-meta">
                      <b>{item.topicTitle || "Topik Percakapan"}</b>
                      <div className="live-history-pills">
                        <span className="live-meta-pill date">
                          <Calendar size={12} /> {formattedDate}
                        </span>
                        <span className="live-meta-pill duration">
                          <Clock3 size={12} /> {formatTime(item.durationSeconds || 0)}
                        </span>
                        <span className="live-meta-pill turns">
                          <MessageSquare size={12} /> {item.lines?.length || 0} pesan
                        </span>
                      </div>
                    </div>
                    <div className="live-history-card-actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                      >
                        {isExpanded ? "Tutup Transkrip" : "Buka Transkrip"}{" "}
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                      <button
                        type="button"
                        className="icon-btn-danger"
                        title="Hapus riwayat ini"
                        onClick={() => deleteLiveHistoryItem(item.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="live-history-transcript-expanded">
                      <div className="eyebrow" style={{ fontSize: 11, marginBottom: 8, color: "#315c45" }}>
                        TRANSKRIP PERCAKAPAN LENGKAP
                      </div>
                      <div className="live-transcript-lines-box">
                        {(item.lines || []).map((line, idx) => (
                          <div
                            key={idx}
                            className={`live-hist-bubble ${line.who === "coach" ? "coach" : "learner"}`}
                          >
                            <b>{line.who === "coach" ? "Maya" : "You"}:</b>
                            <p>{line.text}</p>
                          </div>
                        ))}
                      </div>

                      {item.assessment && (
                        <div className="live-hist-assessment">
                          <b>
                            <Sparkles size={14} /> Review & Feedback AI:
                          </b>
                          <p>{item.assessment.overall_feedback}</p>
                          {item.assessment.strengths?.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <small style={{ fontWeight: 700, color: "#256338" }}>Kekuatan:</small>
                              <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                                {item.assessment.strengths.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {item.assessment.improvements?.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <small style={{ fontWeight: 700, color: "#8a5814" }}>Saran Peningkatan:</small>
                              <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                                {item.assessment.improvements.map((imp, i) => (
                                  <li key={i}>{imp}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
