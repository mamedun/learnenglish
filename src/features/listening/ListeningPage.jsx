import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Headphones,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "../../api";
import { awardXP } from "../../gamification";
import { normalizeSpeechThreshold } from "../../lib/speechSimilarity";
import { isTtsBusy } from "../../lib/ttsRocks";
import ListeningSpeakingTask from "./ListeningSpeakingTask";

export default function ListeningPage({
  lessons: allLessons,
  levels: curriculum,
  initialLessonId,
  onSelectLesson,
  data,
  setData,
  speak,
  ttsStatus,
  speechInputMode = "live_transcribe",
  speechScoringMode = "local",
  speechSimilarityThreshold = 90,
  aiProvider = "clario",
}) {
  const speechThreshold = normalizeSpeechThreshold(speechSimilarityThreshold);
  const [level, setLevel] = useState("All");
  const [activeId, setActiveId] = useState(null);
  useEffect(() => {
    if (initialLessonId) setLevel("All");
    setActiveId(initialLessonId || null);
  }, [initialLessonId]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});
  const [checking, setChecking] = useState(null);
  const [showScript, setShowScript] = useState(false);
  const lessons = useMemo(
    () => allLessons.filter((x) => level === "All" || x.level === level),
    [allLessons, level],
  );
  const active = lessons.find((x) => x.id === activeId) || lessons[0];
  const done = data.listeningCompleted || [];
  const speechPassed = (data.speakingCompleted || []).includes(active?.id);
  const speechScore = Number(data.speakingScores?.[active?.id] || 0);
  const ttsBusy = isTtsBusy(ttsStatus);
  const doneCount = allLessons.filter((x) => done.includes(x.id)).length;
  const next = allLessons.find((l) => !done.includes(l.id)) || allLessons[0];
  const keyFor = (question) => `${active.id}:${question.id}`;
  const score =
    active?.questions.filter((q) => results[keyFor(q)]?.correct).length || 0;
  const finished = !!active && done.includes(active.id);
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
    speak(active.script, { type: "listening", item: active });
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
          lesson_id: active.id,
          question_id: question.id,
          answer: answers[key],
        }),
      });
      setResults((v) => ({ ...v, [key]: result }));
      if (result.correct)
        toast.success("Betul! +1 langkah menuju lesson selesai.");
      else toast.info("Belum tepat. Baca petunjuknya dan coba lagi!");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setChecking(null);
    }
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
      setData((p) => ({
        ...awardXP(p, 10),
        listeningCompleted: [...(p.listeningCompleted || []), active.id],
      }));
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
          <p className="page-intro">
            Dengarkan cerita asli, pilih jawabanmu, dan kumpulkan XP. Salah?
            Tenang, kamu bisa mencoba lagi.
          </p>
        </div>
        <div className="page-sticker">
          <span>✦</span>
          <b>
            {doneCount}/{allLessons.length}
          </b>
          <small>lesson done</small>
        </div>
      </div>
      <div className="listening-notice">
        <Volume2 size={21} />
        <div>
          <b>Audio lesson & privasi mic</b>
          <span>
            Audio memakai cache bersama sesuai voice default materi atau TTS
            pilihanmu. Cache miss saat mode cached aktif memakai Browser Native.
            Latihan speaking memakai mode global admin: transkripsi browser
            read-only atau rekaman yang dikirim ke AI hanya setelah persetujuan.
            Web Speech dapat menggunakan layanan vendor browser; audio tidak
            diarsipkan oleh SpeakUp.
          </span>
        </div>
      </div>
      <div className="listening-layout">
        <aside className="listening-catalog">
          <div className="catalog-head">
            <div className="eyebrow">PILIH MISI</div>
            <h2>Daftar listening</h2>
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
            {lessons.map((l) => (
              <button
                key={l.id}
                className={`listening-item ${l.id === active.id ? "active" : ""}`}
                onClick={() => {
                  setActiveId(l.id);
                  setShowScript(false);
                  onSelectLesson?.(l.id);
                }}
              >
                <span className="listen-level">{l.level}</span>
                <span>
                  <b>{l.title}</b>
                  <small>{l.objective}</small>
                </span>
                {done.includes(l.id) ? (
                  <CheckCircle2 size={19} />
                ) : (
                  <ArrowRight size={16} />
                )}
              </button>
            ))}
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
          {active.image && (
            <figure className="listening-visual">
              <img
                src={active.image}
                alt={`Ilustrasi pelengkap untuk ${active.title}`}
              />
              <figcaption>
                Ilustrasi pelengkap · jawaban ada dalam naskah audio, bukan
                gambar.
              </figcaption>
            </figure>
          )}
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
                  <div className="answer-options">
                    {q.options.map((option, j) => (
                      <button
                        key={j}
                        type="button"
                        disabled={!!result?.correct}
                        className={`${answers[key] === j ? "chosen" : ""} ${result && j === result.correct_index ? "right" : ""} ${result && answers[key] === j && !result.correct ? "wrong" : ""}`}
                        onClick={() => {
                          setAnswers((v) => ({ ...v, [key]: j }));
                          setResults((v) => {
                            const copy = { ...v };
                            delete copy[key];
                            return copy;
                          });
                        }}
                      >
                        <span>{String.fromCharCode(65 + j)}</span>
                        {option}
                      </button>
                    ))}
                  </div>
                  {!result ? (
                    <button
                      className="outline-btn check-answer"
                      disabled={checking === key}
                      onClick={() => check(q)}
                    >
                      {checking === key ? (
                        <>
                          <span className="spinner" /> Memeriksa...
                        </>
                      ) : (
                        <>
                          Periksa jawaban <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  ) : (
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
                          onClick={() => {
                            setResults((v) => {
                              const copy = { ...v };
                              delete copy[key];
                              return copy;
                            });
                            setAnswers((v) => {
                              const copy = { ...v };
                              delete copy[key];
                              return copy;
                            });
                          }}
                        >
                          <RotateCcw size={14} /> Pilih jawaban lain
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <ListeningSpeakingTask
            lesson={active}
            speak={(text) => speak(text, { type: "listening", item: active })}
            ttsStatus={ttsStatus}
            speechInputMode={speechInputMode}
            speechScoringMode={speechScoringMode}
            speechSimilarityThreshold={speechThreshold}
            aiProvider={aiProvider}
            passed={speechPassed}
            passedScore={speechScore}
            onPass={(percent) =>
              setData((previous) => ({
                ...previous,
                speakingCompleted: Array.from(
                  new Set([...(previous.speakingCompleted || []), active.id]),
                ),
                speakingScores: {
                  ...(previous.speakingScores || {}),
                  [active.id]: Math.max(
                    Number(previous.speakingScores?.[active.id] || 0),
                    Number(percent) || 0,
                  ),
                },
              }))
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
          <div className="listening-caveat">
            <Sparkles size={16} /> Materi latihan orisinal, bukan tes IELTS
            resmi dan tidak menghasilkan band IELTS.
          </div>
        </article>
      </div>
    </div>
  );
}
