import { useMemo } from "react";
import { ArrowRight, Mic, Sparkles, Star } from "lucide-react";
import { achievements } from "../../gamification";
import { LEVEL_ICONS, BADGE_ICONS } from "../learning/learningIcons";
import { buildCourseProgressSummary } from "./progressSummary";

export default function ProgressPage({
  data,
  courses = [],
  courseCatalogs = {},
  fallbackCatalog = null,
  progressCatalogLoading = false,
  nav,
  hasLearningAccess,
  startUnit,
  startListening,
}) {
  const summary = useMemo(
    () =>
      buildCourseProgressSummary({
        courses,
        courseCatalogs,
        data,
        fallbackCatalog,
      }),
    [courses, courseCatalogs, data, fallbackCatalog],
  );
  const recent = (data.sessions || []).slice(-5).reverse();
  const badges = achievements(summary.achievementProgress);
  const modalityLabel = (modality) =>
    modality === "ai_lesson" ? "AI Lesson" : "Listening";

  function openLevel(level) {
    const unit = level.units.find((item) => !item.completed) || level.units[0];
    if (!unit) return;
    if (level.modality === "listening")
      startListening?.(unit.id, unit.courseId);
    else startUnit?.(unit, unit.courseId);
  }

  const firstLevel = summary.levels[0];
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
            {summary.completed}/{summary.total} aktivitas selesai ·{" "}
            {summary.courseCount} course
            {progressCatalogLoading ? " · menghitung course lain…" : ""}
          </p>
          <div className="large-progress">
            <i style={{ width: `${summary.percent}%` }} />
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
      {summary.levels.length ? (
        <div className="progress-levels">
          {summary.levels.map((level, index) => {
            const Icon = LEVEL_ICONS[index % LEVEL_ICONS.length] || Sparkles;
            return (
              <div className="progress-level" key={level.key}>
                <div
                  className="progress-level-icon"
                  style={{ background: level.color }}
                >
                  <Icon size={21} />
                </div>
                <div className="progress-level-copy">
                  <b>{level.name}</b>
                  <small>
                    {level.label && level.label !== level.name
                      ? `${level.label} · `
                      : ""}
                    {modalityLabel(level.modality)} · {level.courseCount} course
                    {level.courseCount === 1 ? "" : "s"}
                  </small>
                  <div className="tiny-progress">
                    <i
                      style={{
                        width: level.total
                          ? `${(level.completed / level.total) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
                <span className="progress-fraction">
                  {level.completed}/{level.total}
                </span>
                <button
                  aria-label={`Buka level ${level.name} · ${modalityLabel(level.modality)}`}
                  onClick={() => openLevel(level)}
                >
                  <ArrowRight size={17} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-activity">
          <span>📚</span>
          <b>
            {progressCatalogLoading
              ? "Memuat progres course…"
              : "Belum ada level tersedia"}
          </b>
          <p>Progres setiap course yang kamu ikuti akan muncul di sini.</p>
          {!progressCatalogLoading && (
            <button className="btn-primary" onClick={() => nav("courses")}>
              Jelajahi course <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
      <div className="section-head">
        <div>
          <div className="eyebrow">TROPHY CASE</div>
          <h2>Badge yang menantimu</h2>
        </div>
      </div>
      <div className="badge-row progress-badges">
        {badges.map((badge) => (
          <div
            className={`achievement-badge ${badge.unlocked ? "unlocked" : ""}`}
            key={badge.title}
          >
            <span>
              {(() => {
                const Icon = BADGE_ICONS[badge.icon] || Star;
                return <Icon size={23} />;
              })()}
            </span>
            <div>
              <b>{badge.title}</b>
              <small>{badge.unlocked ? "Terbuka!" : badge.detail}</small>
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
            recent.map((session) => {
              const courseId = session.courseId || "ielts";
              return (
                <div className="recent-session" key={session.id}>
                  <span className="recent-icon">
                    <Mic size={18} />
                  </span>
                  <div>
                    <b>
                      {summary.unitTitles[`${courseId}:${session.unitId}`] ||
                        "Latihan percakapan (diarsipkan)"}
                    </b>
                    <small>
                      {new Date(
                        session.turns?.at(-1)?.createdAt || Date.now(),
                      ).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </small>
                  </div>
                  <span className="recent-stars">
                    {session.turns?.at(-1)?.stars || 0} ★
                  </span>
                </div>
              );
            })
          ) : (
            <div className="empty-activity">
              <span>🗣️</span>
              <b>Belum ada aktivitas speaking</b>
              <p>Mulai latihan pertamamu dan riwayat akan tampil di sini.</p>
              {firstLevel && (
                <button
                  className="btn-primary"
                  onClick={() => openLevel(firstLevel)}
                >
                  Mulai latihan <ArrowRight size={16} />
                </button>
              )}
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
