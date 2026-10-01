import {
  AudioLines,
  Clock3,
  Headphones,
  Pause,
  ShieldCheck,
} from "lucide-react";
import { formatTime } from "../../lib/formatTime";

export default function LivePage({
  liveOn,
  liveSeconds,
  liveLines,
  liveStatus,
  liveLoading = false,
  liveAssessment,
  beginLive,
  endLive,
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
            {formatTime(liveSeconds)} <small>/ 20:00</small>
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
        <h2>
          {liveOn
            ? "You\u2019re in the conversation"
            : "Your conversation starts here"}
        </h2>
        <p>
          {liveOn
            ? "Speak naturally; audio streams directly from your browser to Gemini."
            : `Session status: ${liveStatus}. Sessions are limited to 20 minutes.`}
        </p>
        <div className="live-topic">
          <span>TOPIK HARI INI</span>
          <b>Meeting someone new</b>
          <span className="live-status-mini">{liveStatus}</span>
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
          <span>20 minute session limit</span>
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
