import { Plus, Trash2 } from "lucide-react";
import { KOKORO_VOICES } from "../../lib/ttsRocks";
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
  const knownVoice = KOKORO_VOICES.some((voice) => voice.id === value);
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
        {KOKORO_VOICES.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name} · {voice.accent}
          </option>
        ))}
      </select>
      <small>
        Prioritas untuk memilih file cache single-speaker. Jika tidak tersedia,
        lesson memakai Browser Native.
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
                label="Pertanyaan"
                value={question.prompt}
                disabled={disabled}
                onChange={(prompt) => updateQuestion(index, { prompt })}
              />
              <div className="course-question-options">
                {options.map((option, optionIndex) => (
                  <div className="course-question-option" key={optionIndex}>
                    <Field
                      label={`Pilihan ${String.fromCharCode(65 + optionIndex)}`}
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
                        const nextAnswer =
                          answer === optionIndex
                            ? 0
                            : answer > optionIndex
                              ? answer - 1
                              : answer;
                        updateQuestion(index, {
                          options: nextOptions,
                          answer: Math.min(nextAnswer, nextOptions.length - 1),
                        });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="course-schema-text-button"
                disabled={disabled || options.length >= 6}
                onClick={() =>
                  updateQuestion(index, { options: [...options, ""] })
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
                  label="Penjelasan jawaban"
                  value={question.explain}
                  disabled={disabled}
                  onChange={(explain) => updateQuestion(index, { explain })}
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
        description="Teks yang didengar learner dan tujuan pemahaman materi."
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
          label="Naskah audio"
          value={content.script}
          multiline
          rows={8}
          maxLength={30000}
          disabled={disabled}
          onChange={(script) => onChange({ script })}
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

function AiLessonEditor({ content, onChange, disabled }) {
  return (
    <div className="course-schema-stack">
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
          label="Cue card / prompt learner"
          value={content.prompt}
          multiline
          rows={6}
          maxLength={6000}
          disabled={disabled}
          onChange={(prompt) => onChange({ prompt })}
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
        </div>
      </SchemaCard>
      <AudioVoices content={content} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function LiveLessonEditor({ content, onChange, disabled }) {
  return (
    <div className="course-schema-stack">
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
