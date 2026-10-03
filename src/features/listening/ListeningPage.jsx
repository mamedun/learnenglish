import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Headphones,
  List,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Swal from "sweetalert2";
import { apiJson } from "../../api";
import { awardXP } from "../../gamification";
import { normalizeSpeechThreshold } from "../../lib/speechSimilarity";
import { isTtsBusy } from "../../lib/ttsRocks";
import ListeningSpeakingTask from "./ListeningSpeakingTask";
import CourseMedia from "../courses/CourseMedia";

export default function ListeningPage({
  lessons: allLessons,
  levels: curriculum,
  courseId = "ielts",
  initialLessonId,
  onSelectLesson,
  data,
  setData,
  speak,
  ttsStatus,
  speechSimilarityThreshold = 90,
  aiAudioCost = 3,
  aiProvider = "clario",
  maxRecordSeconds = 180,
  maxAiAudioBytes = 12 * 1024 * 1024,
  unlimitedDiamonds = false,
  learningProgressionMode = "parallel",
  devices = [],
  deviceId = "",
  changeDevice = null,
  onDiamondsChanged = () => {},
  onCourseProgress = () => {},
}) {
  const isLinear = learningProgressionMode === "linear";
  const speechThreshold = normalizeSpeechThreshold(speechSimilarityThreshold);
  const scopedData =
    courseId === "ielts" ? data : (data.courseProgress || {})[courseId] || {};
  const [level, setLevel] = useState("All");
  const [activeId, setActiveId] = useState(null);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  useEffect(() => {
    setLevel("All");
    setActiveId(initialLessonId || null);
  }, [initialLessonId, courseId]);
  const [answers, setAnswers] = useState(
    () => scopedData.listeningAnswers || {},
  );
  const [results, setResults] = useState(
    () => scopedData.listeningResults || {},
  );
  const [checking, setChecking] = useState(null);
  const [showScript, setShowScript] = useState(false);
  const lessons = useMemo(
    () => allLessons.filter((x) => level === "All" || x.level === level),
    [allLessons, level],
  );
  const active = lessons.find((x) => x.id === activeId) || lessons[0] || allLessons[0];
  const done = scopedData.listeningCompleted || [];
  const firstIncompleteIdx = isLinear
    ? allLessons.findIndex((item) => !done.includes(item.id))
    : -1;
  const speechPassed = (scopedData.speakingCompleted || []).includes(
    active?.id,
  );
  const speechScore = Number(scopedData.speakingScores?.[active?.id] || 0);
  const ttsBusy = isTtsBusy(ttsStatus);
  const doneCount = allLessons.filter((x) => done.includes(x.id)).length;
  const next = allLessons.find((l) => !done.includes(l.id)) || allLessons[0];
  const keyFor = (question) => `${active.id}:${question.id}`;
  function patchProgress(previous, updates) {
    if (courseId === "ielts") return { ...previous, ...updates };
    return {
      ...previous,
      courseProgress: {
        ...(previous.courseProgress || {}),
        [courseId]: {
          ...((previous.courseProgress || {})[courseId] || {}),
          ...updates,
        },
      },
    };
  }
  function saveAnswer(key, value) {
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    setData((previous) =>
      patchProgress(previous, { listeningAnswers: updated }),
    );
  }
  function saveResult(key, value) {
    const updated = { ...results, [key]: value };
    setResults(updated);
    setData((previous) =>
      patchProgress(previous, { listeningResults: updated }),
    );
  }
  function clearQuestion(key) {
    const updatedAnswers = { ...answers };
    const updatedResults = { ...results };
    delete updatedAnswers[key];
    delete updatedResults[key];
    setAnswers(updatedAnswers);
    setResults(updatedResults);
    setData((previous) =>
      patchProgress(previous, {
        listeningAnswers: updatedAnswers,
        listeningResults: updatedResults,
      }),
    );
  }
  const score =
    active?.questions.filter((q) => results[keyFor(q)]?.correct).length || 0;
  const finished = !!active && done.includes(active.id);
  useEffect(() => {
    setAnswers(scopedData.listeningAnswers || {});
    setResults(scopedData.listeningResults || {});
  }, [scopedData.listeningAnswers, scopedData.listeningResults]);
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setShowScript(false);
  }, [active?.id]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function play() {
    if (typeof speak !== "function") {
      toast.error("Text-to-speech belum tersedia. Gunakan naskah tertulis.");
      setShowScript(true);
      return;
    }
    speak(active.script, {
      type: "listening",
      item: active,
      voice:
        active?.voice ||
        active?.defaultVoice ||
        active?.content?.defaultVoice ||
        "af_heart",
    });
  }
  async function check(question) {
    const key = keyFor(question);
    if (answers[key] === undefined)
      return toast.info("Pilih jawaban lebih dahulu.");
    setChecking(key);
    try {
      const result = await apiJson("listening/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          unit_id: active.id,
          question_id: question.id,
          answer: answers[key],
        }),
      });
      saveResult(key, result);
      if (result.correct)
        toast.success("Betul! +1 langkah menuju lesson selesai.");
      else toast.info("Belum tepat. Baca petunjuknya dan coba lagi!");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setChecking(null);
    }
  }

  async function submitAllAnswers() {
    if (!active?.questions?.length) return;
    const unanswered = active.questions.filter((q) => answers[keyFor(q)] === undefined);
    if (unanswered.length > 0) {
      toast.info(`Ada ${unanswered.length} soal yang belum dijawab. Pilih jawaban untuk semua soal dulu ya!`);
      return;
    }
    const toCheck = active.questions.filter((q) => !results[keyFor(q)]?.correct);
    if (toCheck.length === 0) {
      toast.success("Semua soal sudah benar! Silakan lanjutkan ke latihan speaking.");
      return;
    }
    setCheckingAll(true);
    try {
      const updatedResults = { ...results };
      await Promise.all(
        toCheck.map(async (q) => {
          const key = keyFor(q);
          try {
            const result = await apiJson("listening/check", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                course_id: courseId,
                unit_id: active.id,
                question_id: q.id,
                answer: answers[key],
              }),
            });
            updatedResults[key] = result;
          } catch (err) {
            console.error(err);
          }
        }),
      );
      setResults(updatedResults);
      setData((previous) =>
        patchProgress(previous, {
          listeningAnswers: answers,
          listeningResults: updatedResults,
        }),
      );
      const totalCorrect = active.questions.filter((q) => updatedResults[keyFor(q)]?.correct).length;
      if (totalCorrect === active.questions.length) {
        toast.success("Hebat! Semua jawaban benar. Sekarang selesaikan Latihan Speaking!");
      } else {
        toast.info(`${totalCorrect} dari ${active.questions.length} benar. Periksa penjelasan di bawah dan perbaiki jawaban yang salah.`);
      }
    } catch (e) {
      toast.error(e.message || "Gagal memeriksa jawaban.");
    } finally {
      setCheckingAll(false);
    }
  }

  async function restartLesson() {
    if (!active) return;
    const res = await Swal.fire({
      title: "Ulangi Latihan dari Awal?",
      text: "Jawaban soal dan rekaman speaking pada misi ini akan direset agar kamu bisa berlatih kembali.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Ulangi",
      cancelButtonText: "Batal",
      confirmButtonColor: "#1b7a48",
      cancelButtonColor: "#6c757d",
    });
    if (!res.isConfirmed) return;

    const newAnswers = { ...answers };
    const newResults = { ...results };
    active.questions.forEach((q) => {
      const k = keyFor(q);
      delete newAnswers[k];
      delete newResults[k];
    });
    setAnswers(newAnswers);
    setResults(newResults);

    setData((previous) => {
      const scope =
        courseId === "ielts"
          ? previous
          : (previous.courseProgress || {})[courseId] || {};
      const updatedTranscripts = { ...(scope.speakingTranscripts || {}) };
      delete updatedTranscripts[active.id];
      const updatedScores = { ...(scope.speakingScores || {}) };
      delete updatedScores[active.id];

      return patchProgress(previous, {
        listeningAnswers: newAnswers,
        listeningResults: newResults,
        speakingTranscripts: updatedTranscripts,
        speakingScores: updatedScores,
      });
    });

    toast.info("Latihan direset. Silakan coba kerjakan kembali!");
  }

  function complete() {
    if (score !== active.questions.length || !active.questions.length) {
      toast.info(
        "Jawab semua soal dengan benar dulu ya. Kamu bisa mencoba lagi!",
      );
      return;
    }
    if (!speechPassed && !finished) {
      toast.info(
        `Selesaikan latihan membaca nyaring hingga minimal ${speechThreshold}% sesuai.`,
      );
      return;
    }
    if (!finished) {
      setData((previous) =>
        patchProgress(awardXP(previous, 10), {
          listeningCompleted: Array.from(
            new Set([...(scopedData.listeningCompleted || []), active.id]),
          ),
        }),
      );
      onCourseProgress(courseId);
      toast.success(
        "Lesson selesai! +10 XP dan progres tersimpan di akunmu ✨",
      );
    }
  }
  if (!active)
    return (
      <div className="listening-page">
        <h1>
          Listening practice <Headphones size={30} />
        </h1>
        <p>Belum ada lesson listening yang diterbitkan. Cek lagi nanti!</p>
      </div>
    );
  return (
    <div className="listening-page">
      <div className="page-heading-with-sticker">
        <div>
          <div className="eyebrow">
            <Headphones size={16} /> THE LISTENING LAB
          </div>
          <h1>
            Listen, learn, <span>level up!</span>{" "}
            <Headphones className="title-icon" size={30} />
          </h1>
        </div>
        <div className="page-sticker">
          <span>✦</span>
          <b>
            {doneCount}/{allLessons.length}
          </b>
          <small>lesson done</small>
        </div>
      </div>

      {/* Floating button on mobile to toggle missions drawer */}
      <button
        type="button"
        className="listening-catalog-fab"
        onClick={() => setMobileCatalogOpen(true)}
        title="Daftar Misi Listening"
      >
        <List size={18} />
        <span>Pilih Misi</span>
      </button>

      {mobileCatalogOpen && (
        <div
          className="listening-catalog-backdrop"
          onClick={() => setMobileCatalogOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="listening-layout">
        <aside className={`listening-catalog ${mobileCatalogOpen ? "mobile-drawer-open" : ""}`}>
          <div className="catalog-head">
            <div>
              <div className="eyebrow">PILIH MISI</div>
              <h2>Daftar listening</h2>
            </div>
            <button
              type="button"
              className="catalog-drawer-close-btn"
              onClick={() => setMobileCatalogOpen(false)}
              aria-label="Tutup daftar listening"
            >
              <X size={18} />
            </button>
          </div>
          <div className="level-filters">
            <button
              className={level === "All" ? "selected" : ""}
              onClick={() => {
                setLevel("All");
                setActiveId(null);
                onSelectLesson?.(null);
              }}
            >
              Semua
            </button>
            {curriculum.map((x) => (
              <button
                key={x.id}
                className={level === x.id ? "selected" : ""}
                onClick={() => {
                  setLevel(x.id);
                  setActiveId(null);
                  onSelectLesson?.(null);
                }}
              >
                {x.id}
              </button>
            ))}
          </div>
          <div className="listening-count">
            {doneCount} dari {allLessons.length} misi selesai
          </div>
          <div className="listening-list">
            {lessons.map((l) => {
              const lessonGlobalIdx = allLessons.findIndex(
                (item) => item.id === l.id,
              );
              const isLocked =
                isLinear &&
                firstIncompleteIdx >= 0 &&
                lessonGlobalIdx > firstIncompleteIdx;
              return (
                <button
                  key={l.id}
                  className={`listening-item ${l.id === active.id ? "active" : ""} ${isLocked ? "locked" : ""}`}
                  onClick={() => {
                    if (isLocked) {
                      toast.info(
                        "Mode Linear: Selesaikan lesson sebelumnya untuk membuka materi ini.",
                      );
                      return;
                    }
                    setActiveId(l.id);
                    setShowScript(false);
                    onSelectLesson?.(l.id);
                  }}
                  title={isLocked ? "Terkunci: selesaikan lesson sebelumnya" : l.title}
                >
                  <span className="listen-level">{l.level}</span>
                  <span>
                    <b>{l.title}</b>
                    <small>{isLocked ? "Terkunci · Selesaikan sebelumnya" : l.objective}</small>
                  </span>
                  {done.includes(l.id) ? (
                    <CheckCircle2 size={19} />
                  ) : isLocked ? (
                    <Lock size={16} />
                  ) : (
                    <ArrowRight size={16} />
                  )}
                </button>
              );
            })}
            {!lessons.length && (
              <p className="studio-empty">Belum ada lesson untuk level ini.</p>
            )}
          </div>
        </aside>
        <article className="listening-lesson">
          <div className="lesson-heading">
            <span className="level-pill">MISI {active.level} · LISTENING</span>
            <h2>{active.title}</h2>
            <p>{active.objective}</p>
          </div>
          <div className="audio-player-card">
            <span className="audio-disc">
              <Headphones size={26} />
            </span>
            <div>
              <b>Ready to listen?</b>
              <small>
                Original script · {active.level} · shared audio / TTS
              </small>
            </div>
            <button className="btn-primary" onClick={play} disabled={ttsBusy}>
              {ttsBusy ? (
                <>
                  <span className="spinner" />
                  {ttsStatus?.phase === "speaking"
                    ? "Sedang membaca…"
                    : "Menyiapkan audio…"}
                </>
              ) : (
                <>
                  <Play size={17} fill="currentColor" /> Putar audio
                </>
              )}
            </button>
          </div>
          <button
            className="text-button script-toggle"
            onClick={() => setShowScript((s) => !s)}
          >
            {showScript
              ? "Sembunyikan naskah"
              : "Buka naskah sebagai alternatif"}{" "}
            <ArrowRight size={15} />
          </button>
          {showScript && (
            <div className="listening-script">{active.script}</div>
          )}
          {(active.image || active.mediaUrl) && (
            <CourseMedia
              src={active.image || active.mediaUrl}
              alt={`Ilustrasi materi ${active.title}`}
              className="listening-visual"
              caption="Ilustrasi pelengkap · jawaban ada dalam naskah audio, bukan gambar."
            />
          )}
          <div className="listening-questions">
            <div className="question-section-heading">
              <span className="eyebrow">CHECK YOUR UNDERSTANDING</span>
              <b>
                {score}/{active.questions.length} benar
              </b>
            </div>
            {active.questions.map((q, i) => {
              const key = keyFor(q);
              const result = results[key];
              return (
                <section className="listening-question" key={q.id}>
                  <div className="question-number">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3>{q.prompt}</h3>
                  {(q.image || q.mediaUrl) && (
                    <CourseMedia
                      src={q.image || q.mediaUrl}
                      alt={`Ilustrasi soal ${i + 1}`}
                      className="question-visual"
                    />
                  )}
                  <div className="answer-options">
                    {q.options.map((option, j) => (
                      <button
                        key={j}
                        type="button"
                        disabled={!!result?.correct}
                        className={`${answers[key] === j ? "chosen" : ""} ${result && j === result.correct_index ? "right" : ""} ${result && answers[key] === j && !result.correct ? "wrong" : ""}`}
                        onClick={() => {
                          saveAnswer(key, j);
                          const updatedResults = { ...results };
                          delete updatedResults[key];
                          setResults(updatedResults);
                          setData((previous) =>
                            patchProgress(previous, {
                              listeningAnswers: { ...answers, [key]: j },
                              listeningResults: updatedResults,
                            }),
                          );
                        }}
                      >
                        <span>{String.fromCharCode(65 + j)}</span>
                        {option}
                      </button>
                    ))}
                  </div>
                  {result && (
                    <div
                      className={`answer-feedback ${result.correct ? "correct" : "incorrect"}`}
                    >
                      <b>
                        {result.correct
                          ? "Yes, nice work! ✨"
                          : "Hampir! Coba lagi."}
                      </b>
                      <span>{result.explain}</span>
                      {!result.correct && (
                        <button
                          className="text-button"
                          onClick={() => clearQuestion(key)}
                        >
                          <RotateCcw size={14} /> Pilih jawaban lain
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}

            {/* Tombol Kirim Jawaban (pemeriksaan serentak di bagian bawah) */}
            <div className="listening-submit-all-wrap">
              <button
                type="button"
                className="btn-primary listening-submit-all-btn"
                disabled={checkingAll || !active.questions.length}
                onClick={submitAllAnswers}
              >
                {checkingAll ? (
                  <>
                    <span className="spinner" /> Memeriksa Semua Jawaban…
                  </>
                ) : (
                  <>
                    <Check size={18} /> Kirim Jawaban (
                    {
                      active.questions.filter(
                        (q) => answers[keyFor(q)] !== undefined,
                      ).length
                    }
                    /{active.questions.length})
                  </>
                )}
              </button>
            </div>
          </div>
          <ListeningSpeakingTask
            lesson={active}
            speak={(text) =>
              speak(text, {
                type: "listening",
                item: active,
                voice:
                  active?.voice ||
                  active?.defaultVoice ||
                  active?.content?.defaultVoice ||
                  "af_heart",
              })
            }
            ttsStatus={ttsStatus}
            speechSimilarityThreshold={speechThreshold}
            aiAudioCost={aiAudioCost}
            aiProvider={aiProvider}
            courseId={courseId}
            maxRecordSeconds={maxRecordSeconds}
            maxAiAudioBytes={maxAiAudioBytes}
            unlimitedDiamonds={unlimitedDiamonds}
            devices={devices}
            deviceId={deviceId}
            changeDevice={changeDevice}
            passed={speechPassed}
            passedScore={speechScore}
            savedTranscript={scopedData.speakingTranscripts?.[active.id] || ""}
            onDiamondsChanged={onDiamondsChanged}
            onAttempt={(percent, transcript, method) =>
              setData((previous) => {
                const scope =
                  courseId === "ielts"
                    ? previous
                    : (previous.courseProgress || {})[courseId] || {};
                const previousScore = Number(
                  scope.speakingScores?.[active.id] || 0,
                );
                const hasScore =
                  percent !== null &&
                  percent !== undefined &&
                  Number.isFinite(Number(percent));
                return patchProgress(previous, {
                  speakingScores: hasScore
                    ? {
                        ...(scope.speakingScores || {}),
                        [active.id]: Math.max(previousScore, Number(percent)),
                      }
                    : scope.speakingScores || {},
                  speakingTranscripts: {
                    ...(scope.speakingTranscripts || {}),
                    [active.id]: {
                      text: String(transcript || "").trim(),
                      score: hasScore ? Number(percent) : null,
                      method,
                      updatedAt: new Date().toISOString(),
                    },
                  },
                });
              })
            }
            onPass={(percent) =>
              setData((previous) => {
                const scope =
                  courseId === "ielts"
                    ? previous
                    : (previous.courseProgress || {})[courseId] || {};
                return patchProgress(previous, {
                  speakingCompleted: Array.from(
                    new Set([...(scope.speakingCompleted || []), active.id]),
                  ),
                  speakingScores: {
                    ...(scope.speakingScores || {}),
                    [active.id]: Math.max(
                      Number(scope.speakingScores?.[active.id] || 0),
                      Number(percent) || 0,
                    ),
                  },
                });
              })
            }
          />
          <div className="lesson-end">
            <div>
              <b>
                {finished
                  ? "Misi selesai, hebat!"
                  : `${score} dari ${active.questions.length} jawaban benar`}
              </b>
              <small>
                {finished
                  ? "Lanjutkan ke cerita berikutnya untuk terus berkembang."
                  : speechPassed
                    ? `Soal benar dan speaking minimal ${speechThreshold}% — siap mendapat +10 XP.`
                    : `Jawab soal dengan benar dan selesaikan latihan speaking minimal ${speechThreshold}%.`}
              </small>
            </div>
            <div className="lesson-end-actions">
              <button
                type="button"
                className="outline-btn listening-restart-btn"
                onClick={restartLesson}
                title="Ulangi latihan soal dan speaking dari awal"
              >
                <RotateCcw size={15} /> Ulang Dari Awal
              </button>
              {finished ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setLevel("All");
                    setActiveId(next.id);
                    onSelectLesson?.(next.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Misi berikutnya <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={complete}
                  disabled={score !== active.questions.length || !speechPassed}
                >
                  Selesaikan misi <Check size={16} />
                </button>
              )}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
