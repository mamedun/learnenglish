import { ArrowRight, Mic, Sparkles, Star } from "lucide-react";
import { achievements } from "../../gamification";
import { LEVEL_ICONS, BADGE_ICONS } from "../learning/learningIcons";

export default function ProgressPage({
  data,
  pct,
  totalDone,
  allUnits,
  curriculum,
  nav,
  hasLearningAccess,
  listeningLessons,
  startUnit,
}) {
  const listenDone = listeningLessons.filter((l) =>
    data.listeningCompleted?.includes(l.id),
  ).length;
  const recent = (data.sessions || []).slice(-5).reverse();
  const badges = achievements(data);
  return (
    <div className="progress-page">
      <div className="eyebrow">
        <Sparkles size={16} /> YOUR ADVENTURE SO FAR
      </div>
      <h1>
        Lihat sejauh apa{" "}
        <span>
          kamu melangkah <Sparkles size={24} />
        </span>
      </h1>
      <p className="page-intro">
        Setiap latihan berarti. Progres dan riwayatmu tersimpan di akun server.
      </p>
      <div className="progress-hero">
        <div>
          <small>TOTAL EXPERIENCE</small>
          <strong>
            {data.xp || 0} <em>XP</em>
          </strong>
          <p>
            {hasLearningAccess
              ? `${totalDone}/${allUnits.length} speaking · `
              : ""}
            {listenDone}/${listeningLessons.length} listening lesson selesai
          </p>
          <div className="large-progress">
            <i
              style={{
                width: `${hasLearningAccess ? pct : listeningLessons.length ? (listenDone / listeningLessons.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <div className="progress-hero-side">
          <span className="progress-emoji">
            <Star size={42} />
          </span>
          <b>{data.streak || 0} hari</b>
          <small>streak latihan saat ini</small>
        </div>
      </div>
      <div className="section-head">
        <div>
          <div className="eyebrow">JOURNEY MAP</div>
          <h2>Jelajahi tiap level</h2>
        </div>
      </div>
      <div className="progress-levels">
        {curriculum.map((l, i) => {
          const units = hasLearningAccess
            ? l.units
            : listeningLessons.filter((item) => item.level === l.id);
          const done = units.filter((u) =>
            hasLearningAccess
              ? data.completed?.includes(u.id)
              : data.listeningCompleted?.includes(u.id),
          ).length;
          return (
            <div className="progress-level" key={l.id}>
              <div
                className="progress-level-icon"
                style={{ background: l.color }}
              >
                {(() => {
                  const Icon = LEVEL_ICONS[i] || Sparkles;
                  return <Icon size={21} />;
                })()}
              </div>
              <div className="progress-level-copy">
                <b>
                  {l.id} · {l.label}
                </b>
                <small>
                  {l.name} · {hasLearningAccess ? "Speaking" : "Listening"}
                </small>
                <div className="tiny-progress">
                  <i
                    style={{
                      width: units.length
                        ? `${(done / units.length) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
              <span className="progress-fraction">
                {done}/{units.length}
              </span>
              <button
                aria-label={`Buka level ${l.id}`}
                onClick={() =>
                  hasLearningAccess
                    ? startUnit(
                        l.units.find((u) => !data.completed?.includes(u.id)) ||
                          l.units[0],
                      )
                    : nav("listening")
                }
              >
                <ArrowRight size={17} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="section-head">
        <div>
          <div className="eyebrow">TROPHY CASE</div>
          <h2>Badge yang menantimu</h2>
        </div>
      </div>
      <div className="badge-row progress-badges">
        {badges.map((b) => (
          <div
            className={`achievement-badge ${b.unlocked ? "unlocked" : ""}`}
            key={b.title}
          >
            <span>
              {(() => {
                const Icon = BADGE_ICONS[b.icon] || Star;
                return <Icon size={23} />;
              })()}
            </span>
            <div>
              <b>{b.title}</b>
              <small>{b.unlocked ? "Terbuka!" : b.detail}</small>
            </div>
          </div>
        ))}
      </div>
      {hasLearningAccess && (
        <>
          <div className="section-head recent-head">
            <div>
              <div className="eyebrow">YOUR MOMENTS</div>
              <h2>Latihan speaking terakhir</h2>
            </div>
          </div>
          {recent.length ? (
            recent.map((s) => (
              <div className="recent-session" key={s.id}>
                <span className="recent-icon">
                  <Mic size={18} />
                </span>
                <div>
                  <b>
                    {allUnits.find((u) => u.id === s.unitId)?.title ||
                      "Latihan percakapan (diarsipkan)"}
                  </b>
                  <small>
                    {new Date(
                      s.turns?.at(-1)?.createdAt || Date.now(),
                    ).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </small>
                </div>
                <span className="recent-stars">
                  {s.turns?.at(-1)?.stars || 0} ★
                </span>
              </div>
            ))
          ) : (
            <div className="empty-activity">
              <span>🗣️</span>
              <b>Belum ada aktivitas speaking</b>
              <p>Mulai latihan pertamamu dan riwayat akan tampil di sini.</p>
              <button
                className="btn-primary"
                onClick={() => startUnit(allUnits[0])}
              >
                Mulai latihan <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
      <p className="home-caveat">
        XP dan badge adalah motivasi belajar, bukan band atau sertifikasi IELTS.
      </p>
    </div>
  );
}
