import { Plus, Trash2 } from "lucide-react";
import { KOKORO_ADMIN_VOICES } from "../../lib/ttsRocks";
import DialogueEditor from "./DialogueEditor";

function Field({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  type = "text",
  min,
  max,
  maxLength,
  disabled = false,
  hint,
}) {
  return (
    <label className="course-schema-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value ?? ""}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          min={min}
          max={max}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(event) =>
            onChange(
              type === "number"
                ? Number(event.target.value)
                : event.target.value,
            )
          }
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function VoiceField({ value, onChange, disabled }) {
  const knownVoice = KOKORO_ADMIN_VOICES.some((voice) => voice.id === value);
  return (
    <label className="course-schema-field">
      <span>Prioritas voice tunggal</span>
      <select
        value={value || "af_heart"}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {!knownVoice && value && (
          <option value={value}>{value} · legacy</option>
        )}
        {KOKORO_ADMIN_VOICES.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name} · {voice.accent}
          </option>
        ))}
      </select>
      <small>
        Materi tanpa dialog menyimpan satu file memakai voice ini. Dialog dengan
        beberapa speaker mengabaikan prioritas ini dan menyimpan satu audio
        gabungan; cache belum tersedia berarti memakai Browser Native.
      </small>
    </label>
  );
}

function SchemaCard({ title, description, children, className = "" }) {
  return (
    <section className={`course-schema-card ${className}`.trim()}>
      <div className="course-schema-card-heading">
        <div>
          <h5>{title}</h5>
          {description && <p>{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ListeningQuestions({ questions, onChange, disabled }) {
  const list = Array.isArray(questions) ? questions : [];
  const updateQuestion = (index, patch) =>
    onChange(
      list.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    );

  return (
    <SchemaCard
      title={`Bank soal · ${list.length}`}
      description="Atur pilihan jawaban dan tandai kunci jawaban untuk setiap soal."
      className="course-question-bank"
    >
      <div className="course-question-list">
        {list.map((question, index) => {
          const options = Array.isArray(question.options)
            ? question.options
            : [];
          const answer = Number.isInteger(question.answer)
            ? question.answer
            : 0;
          return (
            <article className="course-question-card" key={index}>
              <div className="course-question-card-heading">
                <strong>Soal {index + 1}</strong>
                <button
                  type="button"
                  className="course-schema-icon-button"
                  aria-label={`Hapus soal ${index + 1}`}
                  title={`Hapus soal ${index + 1}`}
                  disabled={disabled || list.length <= 1}
                  onClick={() =>
                    onChange(list.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <Field
                label="Pertanyaan (Bahasa Inggris)"
                value={question.prompt}
                disabled={disabled}
                onChange={(prompt) => updateQuestion(index, { prompt })}
              />
              <Field
                label="Terjemahan Pertanyaan (Bahasa Indonesia)"
                value={question.promptTranslation || ""}
                disabled={disabled}
                hint="Ditampilkan saat murid mengaktifkan mode terjemahan Indonesia."
                onChange={(promptTranslation) =>
                  updateQuestion(index, { promptTranslation })
                }
              />
              <div className="course-question-options">
                {options.map((option, optionIndex) => {
                  const optionsTranslation = Array.isArray(
                    question.optionsTranslation,
                  )
                    ? question.optionsTranslation
                    : [];
                  return (
                    <div className="course-question-option" key={optionIndex}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
                        <Field
                          label={`Pilihan ${String.fromCharCode(65 + optionIndex)} (EN)`}
                          value={option}
                          disabled={disabled}
                          onChange={(value) =>
                            updateQuestion(index, {
                              options: options.map((item, itemIndex) =>
                                itemIndex === optionIndex ? value : item,
                              ),
                            })
                          }
                        />
                        <Field
                          label={`Terjemahan (${String.fromCharCode(65 + optionIndex)} - ID)`}
                          value={optionsTranslation[optionIndex] || ""}
                          disabled={disabled}
                          onChange={(value) => {
                            const nextTrans = [...optionsTranslation];
                            nextTrans[optionIndex] = value;
                            updateQuestion(index, {
                              optionsTranslation: nextTrans,
                            });
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="course-schema-icon-button"
                        aria-label={`Hapus pilihan ${String.fromCharCode(65 + optionIndex)} dari soal ${index + 1}`}
                        title="Hapus pilihan"
                        disabled={disabled || options.length <= 2}
                        onClick={() => {
                          const nextOptions = options.filter(
                            (_, itemIndex) => itemIndex !== optionIndex,
                          );
                          const nextTrans = optionsTranslation.filter(
                            (_, itemIndex) => itemIndex !== optionIndex,
                          );
                          const nextAnswer =
                            answer === optionIndex
                              ? 0
                              : answer > optionIndex
                                ? answer - 1
                                : answer;
                          updateQuestion(index, {
                            options: nextOptions,
                            optionsTranslation: nextTrans,
                            answer: Math.min(nextAnswer, nextOptions.length - 1),
                          });
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="course-schema-text-button"
                disabled={disabled || options.length >= 6}
                onClick={() =>
                  updateQuestion(index, {
                    options: [...options, ""],
                    optionsTranslation: [
                      ...(Array.isArray(question.optionsTranslation)
                        ? question.optionsTranslation
                        : []),
                      "",
                    ],
                  })
                }
              >
                <Plus size={14} /> Tambah pilihan
              </button>
              <div className="course-schema-grid">
                <label className="course-schema-field">
                  <span>Jawaban benar</span>
                  <select
                    value={String(
                      Math.max(0, Math.min(answer, options.length - 1)),
                    )}
                    disabled={disabled || options.length < 2}
                    onChange={(event) =>
                      updateQuestion(index, {
                        answer: Number(event.target.value),
                      })
                    }
                  >
                    {options.map((_, optionIndex) => (
                      <option key={optionIndex} value={optionIndex}>
                        Pilihan {String.fromCharCode(65 + optionIndex)}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Penjelasan jawaban (EN)"
                  value={question.explain}
                  disabled={disabled}
                  onChange={(explain) => updateQuestion(index, { explain })}
                />
                <Field
                  label="Terjemahan penjelasan (ID)"
                  value={question.explainTranslation || ""}
                  disabled={disabled}
                  hint="Penjelasan jawaban dalam bahasa Indonesia."
                  onChange={(explainTranslation) =>
                    updateQuestion(index, { explainTranslation })
                  }
                />
              </div>
            </article>
          );
        })}
      </div>
      <button
        type="button"
        className="outline-btn course-schema-add-button"
        disabled={disabled || list.length >= 20}
        onClick={() =>
          onChange([
            ...list,
            { prompt: "", options: ["", ""], answer: 0, explain: "" },
          ])
        }
      >
        <Plus size={15} /> Tambah soal
      </button>
      <small className="course-schema-limit">
        Maksimal 20 soal, 2–6 pilihan per soal.
      </small>
    </SchemaCard>
  );
}

function AudioVoices({ content, onChange, disabled }) {
  return (
    <SchemaCard
      title="Audio & voices"
      description="Atur prioritas voice tunggal dan dialog beberapa speaker. Murid selalu menerima shared audio jika tersedia; bila cache belum ada, pemutaran memakai Browser Native."
    >
      <div className="course-schema-grid">
        <VoiceField
          value={content.defaultVoice || "af_heart"}
          disabled={disabled}
          onChange={(defaultVoice) => onChange({ defaultVoice })}
        />
      </div>
      <DialogueEditor
        segments={Array.isArray(content.ttsSegments) ? content.ttsSegments : []}
        defaultVoice={content.defaultVoice || "af_heart"}
        onChange={(ttsSegments) => onChange({ ttsSegments })}
      />
    </SchemaCard>
  );
}

function ListeningEditor({ content, onChange, disabled }) {
  return (
    <div className="course-schema-stack">
      <SchemaCard
        title="Naskah listening"
        description="Teks yang didengar learner, terjemahan bahasa Indonesia, dan tujuan pemahaman materi."
      >
        <Field
          label="Tujuan"
          value={content.objective}
          multiline
          rows={2}
          disabled={disabled}
          onChange={(objective) => onChange({ objective })}
        />
        <Field
          label="Naskah audio (Bahasa Inggris)"
          value={content.script}
          multiline
          rows={8}
          maxLength={30000}
          disabled={disabled}
          onChange={(script) => onChange({ script })}
        />
        <Field
          label="Terjemahan naskah (Bahasa Indonesia)"
          value={content.scriptTranslation || ""}
          multiline
          rows={7}
          maxLength={30000}
          disabled={disabled}
          hint="Terjemahan yang akan tampil saat murid mengaktifkan toggle bahasa Indonesia."
          onChange={(scriptTranslation) => onChange({ scriptTranslation })}
        />
      </SchemaCard>
      <ListeningQuestions
        questions={content.questions}
        disabled={disabled}
        onChange={(questions) => onChange({ questions })}
      />
      <AudioVoices content={content} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function TutorPersonaFields({ content, onChange, disabled }) {
  return (
    <SchemaCard
      title="Persona Tutor AI"
      description="Nama dan gender tutor AI yang memandu percakapan dan mengevaluasi respon siswa."
    >
      <div className="course-schema-grid">
        <Field
          label="Nama Tutor"
          value={content.tutorName ?? "Maya"}
          disabled={disabled}
          hint="Default: Maya. Nama ini akan dipakai dalam instruksi prompt AI dan dialog learner."
          onChange={(tutorName) => onChange({ tutorName })}
        />
        <label className="course-schema-field">
          <span>Gender Tutor</span>
          <select
            value={content.tutorGender || "female"}
            disabled={disabled}
            onChange={(event) => onChange({ tutorGender: event.target.value })}
          >
            <option value="female">Perempuan (Female)</option>
            <option value="male">Laki-laki (Male)</option>
          </select>
          <small>Menentukan pilihan suara default AI dan persona tutor.</small>
        </label>
      </div>
    </SchemaCard>
  );
}

function AiLessonEditor({ content, onChange, disabled }) {
  return (
    <div className="course-schema-stack">
      <TutorPersonaFields
        content={content}
        onChange={onChange}
        disabled={disabled}
      />
      <SchemaCard
        title="Cue card & tujuan"
        description="Instruksi utama yang dibaca learner saat memulai latihan AI Lesson."
      >
        <div className="course-schema-grid">
          <Field
            label="Emoji"
            value={content.emoji}
            disabled={disabled}
            onChange={(emoji) => onChange({ emoji })}
          />
          <Field
            label="Durasi label"
            value={content.duration}
            disabled={disabled}
            onChange={(duration) => onChange({ duration })}
          />
        </div>
        <Field
          label="Tujuan latihan"
          value={content.objective}
          multiline
          rows={2}
          disabled={disabled}
          onChange={(objective) => onChange({ objective })}
        />
        <Field
          label="Cue card / prompt learner (Bahasa Inggris)"
          value={content.prompt}
          multiline
          rows={6}
          maxLength={6000}
          disabled={disabled}
          onChange={(prompt) => onChange({ prompt })}
        />
        <Field
          label="Terjemahan cue card / prompt (Bahasa Indonesia)"
          value={content.promptTranslation || ""}
          multiline
          rows={5}
          maxLength={6000}
          disabled={disabled}
          hint="Terjemahan cue card yang akan tampil saat murid mengaktifkan toggle bahasa Indonesia."
          onChange={(promptTranslation) => onChange({ promptTranslation })}
        />
        <Field
          label="Konteks visual (opsional)"
          value={content.imageContext}
          multiline
          rows={3}
          disabled={disabled}
          hint="Arahan visual untuk skenario gambar; bukan URL ilustrasi."
          onChange={(imageContext) => onChange({ imageContext })}
        />
      </SchemaCard>
      <SchemaCard
        title="Pengaturan latihan"
        description="Label jenis soal dan waktu persiapan/jawaban yang dipakai tampilan latihan."
      >
        <div className="course-schema-grid">
          <Field
            label="Part / bagian"
            value={content.part}
            disabled={disabled}
            onChange={(part) => onChange({ part })}
          />
          <Field
            label="Jenis pertanyaan"
            value={content.questionType}
            disabled={disabled}
            onChange={(questionType) => onChange({ questionType })}
          />
          <Field
            label="Target band / keterangan skor"
            value={content.bandTarget}
            disabled={disabled}
            onChange={(bandTarget) => onChange({ bandTarget })}
          />
          <Field
            label="Waktu persiapan (detik)"
            type="number"
            min={0}
            max={900}
            value={content.prepSeconds}
            disabled={disabled}
            onChange={(prepSeconds) => onChange({ prepSeconds })}
          />
          <Field
            label="Waktu menjawab (detik)"
            type="number"
            min={1}
            max={3600}
            value={content.responseSeconds}
            disabled={disabled}
            onChange={(responseSeconds) => onChange({ responseSeconds })}
          />
          <Field
            label="Target percakapan (turn)"
            type="number"
            min={1}
            max={50}
            value={content.targetTurns ?? 4}
            disabled={disabled}
            hint="Default 4x percakapan. Poin dihitung proporsional dari bintang."
            onChange={(targetTurns) =>
              onChange({ targetTurns: Math.max(1, Number(targetTurns) || 4) })
            }
          />
          <Field
            label="Nilai kelulusan minimum"
            type="number"
            min={10}
            max={100}
            value={content.minScore ?? 80}
            disabled={disabled}
            hint="Default 80. Skor minimal agar siswa eligible lanjut ke materi berikutnya."
            onChange={(minScore) =>
              onChange({
                minScore: Math.max(10, Math.min(100, Number(minScore) || 80)),
              })
            }
          />
        </div>
      </SchemaCard>
      <AudioVoices content={content} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function LiveLessonEditor({ content, onChange, disabled }) {
  return (
    <div className="course-schema-stack">
      <TutorPersonaFields
        content={content}
        onChange={onChange}
        disabled={disabled}
      />
      <SchemaCard
        title="Live role-play"
        description="Live Teacher membuka sesi sebagai teacher berdasarkan topik, peran, dan situasi di bawah."
      >
        <Field
          label="Peran teacher / AI"
          value={content.teacherRole}
          multiline
          rows={2}
          maxLength={2000}
          disabled={disabled}
          onChange={(teacherRole) => onChange({ teacherRole })}
        />
        <Field
          label="Peran learner"
          value={content.learnerRole}
          multiline
          rows={2}
          maxLength={2000}
          disabled={disabled}
          onChange={(learnerRole) => onChange({ learnerRole })}
        />
        <Field
          label="Situasi"
          value={content.situation}
          multiline
          rows={4}
          maxLength={2000}
          disabled={disabled}
          onChange={(situation) => onChange({ situation })}
        />
        <Field
          label="Kalimat pembuka teacher"
          value={content.opening}
          multiline
          rows={3}
          maxLength={2000}
          disabled={disabled}
          hint="Ini giliran pertama Live Teacher saat sesi dimulai."
          onChange={(opening) => onChange({ opening })}
        />
        <Field
          label="Gaya balasan"
          value={content.responseStyle}
          multiline
          rows={3}
          maxLength={2000}
          disabled={disabled}
          onChange={(responseStyle) => onChange({ responseStyle })}
        />
      </SchemaCard>
    </div>
  );
}

export default function CourseContentEditor({
  modality,
  content = {},
  onChange,
  disabled = false,
}) {
  if (modality === "listening")
    return (
      <ListeningEditor
        content={content}
        onChange={onChange}
        disabled={disabled}
      />
    );
  if (modality === "ai_lesson")
    return (
      <AiLessonEditor
        content={content}
        onChange={onChange}
        disabled={disabled}
      />
    );
  return (
    <LiveLessonEditor
      content={content}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
