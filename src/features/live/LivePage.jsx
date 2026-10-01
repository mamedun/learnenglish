import {
  AudioLines,
  Clock3,
  Headphones,
  Pause,
  ShieldCheck,
} from "lucide-react";
import { formatTime } from "../../lib/formatTime";
import { LIVE_TOPICS } from "../../data/liveTopics";

export default function LivePage({
  liveOn,
  liveSeconds,
  liveLines,
  liveStatus,
  liveLoading = false,
  liveAssessment,
  liveAssessmentFailed = false,
  diamonds = 0,
  liveTopicId,
  liveTopic,
  onLiveTopicChange = () => {},
  beginLive,
  endLive,
  retryLiveAssessment = () => {},
}) {
  const loadingLabel = liveStatus.toLowerCase().includes("feedback")
    ? "Menyiapkan feedback…"
    : liveStatus.toLowerCase().includes("mengakhiri")
      ? "Mengakhiri sesi…"
      : liveStatus.toLowerCase().includes("token")
        ? "Mengamankan sesi…"
        : liveStatus.toLowerCase().includes("mikrofon")
          ? "Meminta mikrofon…"
          : "Menghubungkan…";
  const canRetryAssessment =
    liveAssessmentFailed &&
    !liveOn &&
    !liveLoading &&
    liveLines.some((line) => line.who === "learner");
  return (
    <div className="live-page">
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
            <span className="live-pulse" /> GEMINI LIVE
          </span>
          <span className="timer-pill">
            <Clock3 size={14} />
            {formatTime(liveSeconds)} <small>/ 10:00</small>
          </span>
        </div>
        <div className="live-orb-wrap">
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
            ? "Speak naturally; Maya will guide the role-play and give a quick, helpful correction after each turn."
            : "Pilih topik. Maya akan membuka percakapan dengan pertanyaan sesuai peran dan topik pilihanmu."}
        </p>
        <div className="live-topic">
          <label htmlFor="live-topic-select">TOPIK HARI INI</label>
          <div className="live-topic-content">
            <select
              id="live-topic-select"
              className="live-topic-select"
              value={liveTopicId || liveTopic?.id || LIVE_TOPICS[0].id}
              onChange={(event) => onLiveTopicChange(event.target.value)}
              disabled={liveOn || liveLoading}
            >
              {LIVE_TOPICS.map((topic) => (
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
            <span className="status-dot" /> Browser → Gemini direct
          </span>
          <span>
            10 diamonds / 5 min · max 10 min · balance{" "}
            {Number(diamonds).toLocaleString("id-ID")}
          </span>
        </div>
      </div>
      <div className="live-disclaimer">
        <ShieldCheck size={16} />
        <span>
          Audio dikirim langsung ke Google Gemini menggunakan ephemeral token
          satu kali. Audio tidak disimpan oleh SpeakUp. Setelah sesi, transkrip
          dapat dikirim untuk feedback AI.
        </span>
      </div>
      {liveLines.length > 0 && (
        <div className="live-transcript">
          <div className="eyebrow">SESSION TRANSCRIPT</div>
          {liveLines.map((l, i) => (
            <p key={i}>
              <b>{l.who === "coach" ? "Maya" : "You"}:</b> {l.text}
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
    </div>
  );
}
