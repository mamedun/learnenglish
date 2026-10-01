import { useMemo } from "react";
import { ArrowRight, BookOpen, Flame, Sparkles, Star, Zap } from "lucide-react";
import { achievements } from "../../gamification";
import { hasCourseAccess } from "../courses/courseAccess";
import { aggregateCourseAchievements } from "../progress/progressSummary";
import { BADGE_ICONS } from "../learning/learningIcons";
import "./homeCourses.css";

const lastAction = (course) =>
  ({
    listening: "Listening Lab",
    ai_lesson: "AI Lesson",
    live_lesson: "Live Lesson",
  })[course.lastModality] || "aktivitas belajar";
const price = (value) =>
  Number(value || 0) === 0
    ? "Gratis"
    : `Rp${Number(value).toLocaleString("id-ID")}`;
function SmallCourseCard({ course, onOpen, onContinue }) {
  const progress = course.progress || {};
  return (
    <article className="home-course-card">
      <button className="home-course-card-main" onClick={() => onOpen(course)}>
        <img
          src={
            course.posterUrl ||
            course.bannerUrl ||
            "/learnenglish/images/speakup-adventure.png"
          }
          alt=""
          loading="lazy"
        />
        <div>
          <span>{course.label || course.level || "Course"}</span>
          <h3>{course.name}</h3>
          <p>{course.description}</p>
        </div>
      </button>
      <div className="home-course-progress">
        <div>
          <span>
            {progress.completed || 0} / {progress.total || 0} aktivitas
          </span>
          <b>{progress.percent || 0}%</b>
        </div>
        <i>
          <span
            style={{
              width: `${progress.percent || 0}%`,
              background: course.color || "#ef754d",
            }}
          />
        </i>
        <button onClick={() => onContinue(course)}>
          {course.lastModality
            ? `Lanjutkan ${lastAction(course)}`
            : "Mulai course"}
          <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

export default function HomePage({
  greet,
  userName,
  data,
  courses = [],
  onOpenCourse = () => {},
  onContinueCourse = () => {},
  nav = () => {},
}) {
  const enrolled = courses
    .filter((course) => hasCourseAccess(course))
    .sort(
      (a, b) =>
        new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0),
    );
  const availableCourses = courses
    .filter(
      (course) => !hasCourseAccess(course) && course.status === "published",
    )
    .slice(0, 2);
  const latest = enrolled[0];
  const badgeList = useMemo(
    () => achievements(aggregateCourseAchievements(data, courses)).slice(0, 4),
    [data, courses],
  );
  return (
    <div className="home-courses-page">
      <section className="home-courses-welcome">
        <div>
          <div className="eyebrow">
            <Sparkles size={15} /> RUANG BELAJARMU
          </div>
          <h1>
            {greet}, {userName?.split(" ")[0]} <span>✳</span>
          </h1>
          <p>Satu langkah kecil hari ini membuat tujuanmu semakin dekat.</p>
        </div>
        <div className="home-courses-mini-stats">
          <span>
            <Zap size={17} />
            <b>{data.xp || 0}</b> XP
          </span>
          <span>
            <Flame size={17} />
            <b>{data.streak || 0}</b> hari streak
          </span>
        </div>
      </section>
      <section className="home-courses-hero">
        <div>
          <div className="home-courses-kicker">
            <span /> {latest ? "LANJUTKAN BELAJAR" : "MULAI PETUALANGAN"}
          </div>
          <h2>{latest ? latest.name : "Temukan course English pertamamu."}</h2>
          <p>
            {latest
              ? `Kegiatan terakhir: ${lastAction(latest)}. Progresmu ${latest.progress?.percent || 0}% — lanjutkan tepat dari langkah terakhir.`
              : "Jelajahi course gratis dan berbayar yang dirancang untuk tujuanmu."}
          </p>
          <button
            className="home-course-primary"
            onClick={() => (latest ? onContinueCourse(latest) : nav("courses"))}
          >
            {latest ? "Lanjutkan aktivitas" : "Jelajahi Course"}
            <ArrowRight size={17} />
          </button>
          <button
            className="home-course-secondary"
            onClick={() => nav("courses")}
          >
            Semua course
          </button>
        </div>
        <div className="home-courses-art">
          <BookOpen size={72} />
          <span>
            LEARN
            <br />A LITTLE
            <br />
            EVERY DAY
          </span>
        </div>
      </section>
      <section className="home-enrolled-section">
        <div className="home-section-heading">
          <div>
            <div className="eyebrow">PERJALANANMU</div>
            <h2>Course yang sedang diikuti</h2>
          </div>
          <button onClick={() => nav("courses")}>
            Lihat semua <ArrowRight size={15} />
          </button>
        </div>
        {enrolled.length ? (
          <div className="home-course-grid">
            {enrolled.slice(0, 4).map((course) => (
              <SmallCourseCard
                key={course.id}
                course={course}
                onOpen={onOpenCourse}
                onContinue={onContinueCourse}
              />
            ))}
          </div>
        ) : (
          <div className="home-no-course">
            <BookOpen size={22} />
            <span>Belum ada course lain di ruang belajarmu.</span>
            <button onClick={() => nav("courses")}>
              Pilih course <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>
      <section className="home-available-strip">
        <div>
          <div className="eyebrow">NEXT UP</div>
          <h2>Temukan jalur belajar berikutnya</h2>
          <p>
            {availableCourses.length
              ? availableCourses
                  .map((course) => `${course.name} ${price(course.price)}`)
                  .join(" · ")
              : "Semua course yang tersedia sudah ada di ruang belajarmu."}
          </p>
        </div>
        <button onClick={() => nav("courses")}>
          Buka katalog <ArrowRight size={16} />
        </button>
      </section>
      <section className="home-badges-section">
        <div className="home-section-heading">
          <div>
            <div className="eyebrow">PENCAPAIAN</div>
            <h2>Badges perjalananmu</h2>
          </div>
          <button onClick={() => nav("progress")}>
            Semua achievement <ArrowRight size={15} />
          </button>
        </div>
        <div className="home-badge-grid">
          {badgeList.map((badge) => {
            const Icon = BADGE_ICONS[badge.icon] || Star;
            return (
              <div
                key={badge.title}
                className={`home-badge ${badge.unlocked ? "unlocked" : ""}`}
              >
                <span>
                  <Icon size={19} />
                </span>
                <div>
                  <b>{badge.title}</b>
                  <small>{badge.unlocked ? "Terbuka" : badge.detail}</small>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
