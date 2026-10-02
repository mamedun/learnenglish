import { useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  CheckCircle2,
  Headphones,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import "./coursePages.css";
import { hasCourseAccess, partitionCourses } from "./courseAccess";
import { appAsset } from "../../lib/appPaths";

const rupiah = (amount) =>
  Number(amount || 0) === 0
    ? "Gratis"
    : `Rp${Number(amount).toLocaleString("id-ID")}`;

function ModeIcon({ mode, size = 20 }) {
  if (mode === "listening") return <Headphones size={size} />;
  if (mode === "ai_lesson") return <Sparkles size={size} />;
  return <AudioLines size={size} />;
}

function modeTitle(mode) {
  return mode === "listening"
    ? "Listening Lab"
    : mode === "ai_lesson"
      ? "AI Lesson"
      : "Live Lesson";
}

function CourseCard({ course, onOpen, onContinue }) {
  const hasAccess = hasCourseAccess(course);
  const progress = course.progress || {};
  const last = course.lastModality;
  return (
    <article
      className="course-card"
      style={{ "--course-accent": course.color }}
    >
      <button className="course-card-main" onClick={() => onOpen(course)}>
        <div className="course-card-image-wrap">
          <img
            className="course-card-image"
            src={
              course.posterUrl ||
              course.bannerUrl ||
              appAsset("images/speakup-adventure.png")
            }
            alt=""
            loading="lazy"
          />
          <span className="course-card-label">
            {course.label || course.level || "Course"}
          </span>
          <span className="course-card-price">{rupiah(course.price)}</span>
        </div>
        <div className="course-card-copy">
          <div className="course-card-level">
            {course.level || "English course"}
          </div>
          <h3>{course.name}</h3>
          <p>{course.description}</p>
        </div>
      </button>
      {hasAccess ? (
        <div className="course-card-progress-row">
          <div className="course-card-progress-copy">
            <span>
              {progress.completed || 0} dari {progress.total || 0} aktivitas
            </span>
            <b>{progress.percent || 0}%</b>
          </div>
          <div className="course-progress-track">
            <i style={{ width: `${progress.percent || 0}%` }} />
          </div>
          <button
            className="course-card-continue"
            onClick={() => onContinue(course)}
          >
            <span>
              {last ? `Lanjutkan ${modeTitle(last)}` : "Mulai course"}
            </span>
            <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <button
          className="course-card-continue course-card-discover"
          onClick={() => onOpen(course)}
        >
          <span>{Number(course.price) ? "Lihat course" : "Enroll gratis"}</span>
          <ArrowRight size={17} />
        </button>
      )}
    </article>
  );
}

export function CoursesPage({
  courses = [],
  ads = [],
  onOpenCourse,
  onContinueCourse,
}) {
  const { enrolled, available } = useMemo(
    () => partitionCourses(courses),
    [courses],
  );
  return (
    <div className="course-pages">
      <section className="course-list-hero">
        <div>
          <div className="eyebrow">
            <BookOpen size={16} /> KATALOG BELAJAR
          </div>
          <h1>
            Belajar lewat course yang <span>sesuai tujuanmu.</span>
          </h1>
          <p>
            Pilih satu jalur, lihat progresmu, dan lanjutkan dari kegiatan
            terakhir.
          </p>
        </div>
        <div className="course-hero-art">
          <img src={appAsset("images/speakup-adventure.png")} alt="" />
        </div>
      </section>

      {ads.length > 0 && (
        <section className="course-ad-section">
          <div className="course-section-heading">
            <div>
              <div className="eyebrow">PILIHAN UNTUKMU</div>
              <h2>Aktivitas & penawaran</h2>
            </div>
            <span>{ads.length} pilihan</span>
          </div>
          <div className="course-ad-grid">
            {ads.map((ad) => (
              <a
                className="course-ad-card"
                href={ad.link}
                target="_blank"
                rel="noreferrer"
                key={ad.id}
              >
                <div className="course-ad-image">
                  <img src={ad.posterUrl} alt="" loading="lazy" />
                  <span>ADVERTISEMENT</span>
                </div>
                <div className="course-ad-copy">
                  <h3>{ad.title}</h3>
                  <p>{ad.description}</p>
                  <span>
                    Buka informasi <ArrowRight size={15} />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="course-section">
        <div className="course-section-heading">
          <div>
            <div className="eyebrow">RUANG BELAJARMU</div>
            <h2>Course yang sudah diikuti</h2>
          </div>
          <span>{enrolled.length} course</span>
        </div>
        {enrolled.length ? (
          <div className="course-card-grid">
            {enrolled.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onOpen={onOpenCourse}
                onContinue={onContinueCourse}
              />
            ))}
          </div>
        ) : (
          <div className="course-empty">
            Pilih course gratis atau temukan course baru di bawah.
          </div>
        )}
      </section>

      <section className="course-section">
        <div className="course-section-heading">
          <div>
            <div className="eyebrow">TEMUKAN JALUR BARU</div>
            <h2>Course yang tersedia</h2>
          </div>
          <span>{available.length} course</span>
        </div>
        {available.length ? (
          <div className="course-card-grid">
            {available.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onOpen={onOpenCourse}
                onContinue={onContinueCourse}
              />
            ))}
          </div>
        ) : (
          <div className="course-empty">
            Semua course yang tersedia sudah ada di ruang belajarmu.
          </div>
        )}
      </section>
    </div>
  );
}

export function CourseDetailPage({
  payload,
  loading,
  error,
  onBack,
  onEnroll,
  onPurchase,
  onOpenActivity,
  onContinue,
}) {
  const course = payload?.course;
  const modules = payload?.modules || {};
  const progress = course?.progress || {};
  if (loading)
    return (
      <div className="course-detail-state">
        <span className="spinner" /> Memuat informasi course…
      </div>
    );
  if (!course)
    return (
      <div className="course-detail-state">
        <p>{error || "Course tidak ditemukan."}</p>
        <button className="outline-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Kembali ke Course
        </button>
      </div>
    );
  const accessible = Boolean(payload.canAccess || payload.enrolled);
  const activeModes = [
    {
      id: "listening",
      enabled: modules.listening?.enabled ?? course.enableListening,
      title: "Listening Lab",
      body: "Dengarkan materi, jawab soal, dan berlatih membaca nyaring.",
    },
    {
      id: "ai_lesson",
      enabled: modules.ai_lesson?.enabled ?? course.enableAiLesson,
      title: "AI Lesson",
      body: "Latih jawaban dan dapatkan feedback English yang kontekstual.",
    },
    {
      id: "live_lesson",
      enabled: modules.live_lesson?.enabled ?? course.enableLiveLesson,
      title: "Live Lesson",
      body: "Mulai role-play spontan dengan teacher AI sesuai skenario.",
    },
  ].filter((mode) => mode.enabled);
  const firstActivity = () => {
    const listening = modules.listening?.units?.find((unit) => unit.published);
    const ai = modules.ai_lesson?.units?.find((unit) => unit.published);
    const live = modules.live_lesson?.units?.find((unit) => unit.published);
    if (listening) return { mode: "listening", unitId: listening.id };
    if (ai) return { mode: "ai_lesson", unitId: ai.id };
    if (live) return { mode: "live_lesson", unitId: live.id };
    return null;
  };
  const continueLast = () => {
    if (course.lastModality) {
      onContinue(course);
      return;
    }
    const next = firstActivity();
    if (next) onOpenActivity(course.id, next.mode, next.unitId);
  };
  const banner =
    course.bannerUrl ||
    course.posterUrl ||
    appAsset("images/speakup-adventure.png");
  return (
    <div
      className="course-pages course-detail-page"
      style={{ "--course-accent": course.color }}
    >
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> Semua Course
      </button>
      <section className="course-detail-hero">
        <img src={banner} alt="" />
        <div className="course-detail-overlay" />
        <div className="course-detail-hero-copy">
          <div className="course-detail-badges">
            <span>{course.label || "English course"}</span>
            <span>{course.level || "All levels"}</span>
          </div>
          <h1>{course.name}</h1>
          <p>{course.description}</p>
          <div className="course-detail-meta">
            <b>{rupiah(course.price)}</b>
            {course.enrolled ? (
              <span>
                <CheckCircle2 size={16} /> Sudah terdaftar
              </span>
            ) : (
              <span>
                <LockKeyhole size={15} /> Akses course setelah enrollment
              </span>
            )}
          </div>
        </div>
      </section>

      {accessible ? (
        <section className="course-progress-panel">
          <div className="course-progress-top">
            <div>
              <div className="eyebrow">PROGRES COURSE</div>
              <h2>Lanjutkan langkah berikutnya</h2>
            </div>
            <strong>{progress.percent || 0}%</strong>
          </div>
          <div className="course-progress-track course-progress-track-large">
            <i style={{ width: `${progress.percent || 0}%` }} />
          </div>
          <div className="course-progress-bottom">
            <span>
              {progress.completed || 0} dari {progress.total || 0} aktivitas
              selesai
            </span>
            <button className="btn-primary" onClick={continueLast}>
              Lanjutkan aktivitas <ArrowRight size={17} />
            </button>
          </div>
        </section>
      ) : (
        <section className="course-enroll-panel">
          <div>
            <div className="eyebrow">MULAI BELAJAR</div>
            <h2>
              {Number(course.price) ? "Bayar melalui QRIS" : "Course gratis"}
            </h2>
            <p>
              {Number(course.price)
                ? "Pembayaran diverifikasi Admin. Enrollment aktif otomatis setelah disetujui."
                : "Enroll sekarang untuk membuka materi Listening, AI Lesson, dan Live Lesson."}
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() =>
              Number(course.price) ? onPurchase(course) : onEnroll(course)
            }
          >
            {Number(course.price)
              ? `Beli · ${rupiah(course.price)}`
              : "Enroll gratis"}{" "}
            <ArrowRight size={17} />
          </button>
        </section>
      )}

      <section className="course-section course-mode-section">
        <div className="course-section-heading">
          <div>
            <div className="eyebrow">ISI COURSE</div>
            <h2>Belajar dalam tiga cara</h2>
          </div>
          <span>{activeModes.length} mode</span>
        </div>
        <div className="course-mode-grid">
          {activeModes.map((mode) => {
            const units = modules[mode.id]?.units || [];
            return (
              <button
                key={mode.id}
                className={`course-mode-card ${accessible ? "" : "locked"}`}
                onClick={() =>
                  accessible && onOpenActivity(course.id, mode.id, null)
                }
                disabled={!accessible}
              >
                <span className="course-mode-icon">
                  <ModeIcon mode={mode.id} size={22} />
                </span>
                <span className="course-mode-count">
                  {accessible
                    ? `${units.length} materi`
                    : "Enroll untuk membuka"}
                </span>
                <h3>{mode.title}</h3>
                <p>{mode.body}</p>
                <span className="course-mode-action">
                  {accessible ? "Buka mode" : "Terkunci"}{" "}
                  {accessible ? (
                    <ArrowRight size={16} />
                  ) : (
                    <LockKeyhole size={15} />
                  )}
                </span>
              </button>
            );
          })}
          {!activeModes.length && (
            <div className="course-empty">
              Admin belum menerbitkan aktivitas untuk course ini.
            </div>
          )}
        </div>
      </section>
      <section className="course-detail-note">
        <CheckCircle2 size={18} />
        <span>
          Yuk, lanjutkan progressmu agar semakin pintar!
        </span>
      </section>
    </div>
  );
}

export function ActivityHeader({ course, mode, onBack }) {
  return (
    <div className="course-activity-header">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> {course?.name || "Course"}
      </button>
      <span>
        <ModeIcon mode={mode} size={15} /> {modeTitle(mode)}
      </span>
    </div>
  );
}
