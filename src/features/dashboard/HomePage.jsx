import {
  ArrowRight,
  AudioLines,
  Flame,
  Headphones,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { achievements } from "../../gamification";
import { LEVEL_ICONS, BADGE_ICONS } from "../learning/learningIcons";

export default function HomePage({
  greet,
  userName,
  data,
  pct,
  totalDone,
  currentLevel,
  completed,
  startUnit,
  nav,
  allUnits,
  curriculum,
  listeningLessons,
  hasPremiumAccess,
  startListening,
}) {
  const nextSpeaking =
    currentLevel?.units.find((u) => !completed.has(u.id)) || allUnits[0];
  const nextListening =
    listeningLessons.find((l) => !data.listeningCompleted?.includes(l.id)) ||
    listeningLessons[0];
  const next = hasPremiumAccess ? nextSpeaking : nextListening;
  const listenDone = listeningLessons.filter((l) =>
    data.listeningCompleted?.includes(l.id),
  ).length;
  const badges = achievements(data);
  return (
    <div className="home-page">
      <section className="welcome-row">
        <div>
          <div className="eyebrow">
            <Sparkles size={16} /> YOUR LEARNING SPACE
          </div>
          <h1>
            {greet}, {userName?.split(" ")[0]} <span>✳</span>
          </h1>
          <p>Siap untuk satu langkah kecil hari ini? You’ve got this!</p>
        </div>
        <div className="welcome-date">
          <span>✦</span> KEEP GOING, KEEP GROWING
        </div>
      </section>
      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="status-dot" /> YOUR NEXT QUEST ·{" "}
            {hasPremiumAccess ? "SPEAKING" : "LISTENING"}
          </div>
          <h2>{next ? next.title : "More adventures coming soon"}</h2>
          <p>
            {next
              ? next.subtitle || next.objective
              : "Katalog baru sedang disiapkan. Coba materi yang sudah ada sambil menunggu."}
          </p>
          <button
            className="btn-white"
            onClick={() =>
              hasPremiumAccess ? startUnit(next) : startListening(next?.id)
            }
            disabled={!next}
          >
            {hasPremiumAccess ? "Lanjut speaking" : "Mulai mendengar"}{" "}
            <ArrowRight size={18} />
          </button>
          <small>
            {hasPremiumAccess
              ? `${next?.level || "A1"} · IELTS-inspired practice`
              : `${next?.level || "A1"} · original audio script`}
          </small>
        </div>
        <img
          className="hero-art"
          src="/learnenglish/images/speakup-adventure.png"
          alt=""
          aria-hidden="true"
        />
      </section>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon lilac">
            <Zap size={23} />
          </span>
          <div>
            <small>XP TERKUMPUL</small>
            <strong>{data.xp || 0}</strong>
            <span>Poin latihanmu</span>
          </div>
          <div className="stat-decoration">✦</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon orange">
            <Flame size={23} />
          </span>
          <div>
            <small>STREAK SAAT INI</small>
            <strong>
              {data.streak || 0} <em>hari</em>
            </strong>
            <span>Latihan rutin, hasil terasa</span>
          </div>
          <div className="stat-decoration">
            <Flame size={28} />
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon mint">
            <Headphones size={23} />
          </span>
          <div>
            <small>LISTENING SELESAI</small>
            <strong>
              {listenDone}
              <em> / {listeningLessons.length}</em>
            </strong>
            <span>Satu cerita, satu kemajuan</span>
          </div>
          <div className="mini-progress">
            <i
              style={{
                width: listeningLessons.length
                  ? `${(listenDone / listeningLessons.length) * 100}%`
                  : "0%",
              }}
            />
          </div>
        </div>
      </div>
      <section className="section-head">
        <div>
          <div className="eyebrow">PILIH PETUALANGANMU</div>
          <h2>
            Jelajahi level <span>A1 — C2</span>
          </h2>
        </div>
        <button className="text-button" onClick={() => nav("progress")}>
          Lihat progres <ArrowRight size={17} />
        </button>
      </section>
      <div className="level-cards">
        {curriculum.map((l, i) => {
          const units = hasPremiumAccess
            ? l.units
            : listeningLessons.filter((item) => item.level === l.id);
          const count = units.filter((u) =>
            hasPremiumAccess
              ? completed.has(u.id)
              : data.listeningCompleted?.includes(u.id),
          ).length;
          return (
            <button
              key={l.id}
              className={`curriculum-card card-${i}`}
              onClick={() =>
                hasPremiumAccess
                  ? startUnit(
                      l.units.find((u) => !completed.has(u.id)) || l.units[0],
                    )
                  : startListening(
                      units.find(
                        (u) => !data.listeningCompleted?.includes(u.id),
                      )?.id || units[0]?.id,
                    )
              }
            >
              <span className="curr-top">
                <span className="curr-icon" style={{ background: l.color }}>
                  {(() => {
                    const Icon = LEVEL_ICONS[i] || Sparkles;
                    return <Icon size={24} />;
                  })()}
                </span>
                <span className="level-badge">{l.id}</span>
              </span>
              <h3>{l.label}</h3>
              <p>
                {hasPremiumAccess ? "Speaking" : "Listening"} · {l.name}
              </p>
              <span className="curr-foot">
                <span className="tiny-progress">
                  <i
                    style={{
                      width: units.length
                        ? `${(count / units.length) * 100}%`
                        : "0%",
                    }}
                  />
                </span>
                <small>
                  {count}/{units.length}
                </small>
              </span>
              <span className="curr-arrow">
                <ArrowRight size={18} />
              </span>
            </button>
          );
        })}
      </div>
      <section className="home-bottom">
        <div className="daily-card">
          <span className="daily-quote-icon">✳</span>
          <div>
            <small>SMALL STEPS. BIG PROGRESS.</small>
            <p>
              "Berani mencoba hari ini lebih penting daripada menunggu
              sempurna."
            </p>
            <span>Praktik 5 menit juga berarti.</span>
          </div>
        </div>
        <button
          className="mode-card"
          onClick={() => (hasPremiumAccess ? nav("live") : nav("listening"))}
        >
          <span className="mode-icon">
            {hasPremiumAccess ? (
              <AudioLines size={24} />
            ) : (
              <Headphones size={24} />
            )}
          </span>
          <span>
            <b>
              {hasPremiumAccess
                ? "Let’s talk live"
                : "One more listening quest?"}
            </b>
            <small>
              {hasPremiumAccess
                ? "Ngobrol spontan bersama Maya"
                : "Dengarkan, jawab, dapatkan XP"}
            </small>
          </span>
          <ArrowRight size={18} />
        </button>
      </section>
      <section className="achievement-preview">
        <div className="section-head">
          <div>
            <div className="eyebrow">COLLECT THE MOMENTS</div>
            <h2>Badges perjalananmu</h2>
          </div>
          <button className="text-button" onClick={() => nav("progress")}>
            Semua pencapaian <ArrowRight size={17} />
          </button>
        </div>
        <div className="badge-row">
          {badges.map((b) => (
            <div
              key={b.title}
              className={`achievement-badge ${b.unlocked ? "unlocked" : ""}`}
            >
              <span>
                {(() => {
                  const Icon = BADGE_ICONS[b.icon] || Star;
                  return <Icon size={23} />;
                })()}
              </span>
              <div>
                <b>{b.title}</b>
                <small>{b.unlocked ? "Unlocked!" : b.detail}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
      <p className="home-caveat">
        SpeakUp adalah latihan independen terinspirasi IELTS, bukan layanan,
        tes, atau sertifikasi resmi IELTS. XP bukan band IELTS.
      </p>
    </div>
  );
}
