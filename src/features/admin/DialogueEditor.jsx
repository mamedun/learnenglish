import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { KOKORO_VOICES } from "../../lib/ttsRocks";

export default function DialogueEditor({
  segments = [],
  defaultVoice = "af_heart",
  onChange,
}) {
  const turns = Array.isArray(segments) ? segments : [];
  function update(index, key, value) {
    onChange(
      turns.map((turn, i) => (i === index ? { ...turn, [key]: value } : turn)),
    );
  }
  function move(index, direction) {
    const next = [...turns];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function addTurn() {
    if (turns.length >= 20) return;
    if (turns.length === 0) {
      onChange([
        { speaker: "Speaker 1", voice: defaultVoice, text: "" },
        { speaker: "Speaker 2", voice: "am_puck", text: "" },
      ]);
      return;
    }
    onChange([
      ...turns,
      {
        speaker: `Speaker ${turns.length + 1}`,
        voice: defaultVoice,
        text: "",
      },
    ]);
  }
  function removeTurn(index) {
    if (turns.length <= 2) {
      onChange([]);
      return;
    }
    onChange(turns.filter((_, i) => i !== index));
  }

  return (
    <section className="dialogue-editor">
      <div className="dialogue-editor-head">
        <div>
          <b>Dialog multi-speaker · {turns.length} giliran</b>
          <small>
            Opsional. Urutan baris menjadi urutan audio; dialog digabung menjadi
            satu file dengan jeda singkat.
          </small>
        </div>
        <button
          type="button"
          className="outline-btn"
          onClick={addTurn}
          disabled={turns.length >= 20}
        >
          <Plus size={14} /> Tambah giliran
        </button>
      </div>
      {turns.length > 0 && (
        <p className="dialogue-hint">
          Saat cache aktif, murid mendengar file dialog bersama. Jika belum ada,
          pemutaran beralih ke Browser Native. Dengan cache nonaktif, Kokoro
          memakai satu suara pilihan murid untuk seluruh naskah.
        </p>
      )}
      {turns.map((turn, index) => (
        <div className="dialogue-turn" key={`${index}-${turn.speaker}`}>
          <div className="dialogue-turn-head">
            <strong>Giliran {index + 1}</strong>
            <div>
              <button
                type="button"
                aria-label={`Naikkan giliran ${index + 1}`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label={`Turunkan giliran ${index + 1}`}
                disabled={index === turns.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                aria-label={`Hapus giliran ${index + 1}`}
                onClick={() => removeTurn(index)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <div className="studio-two">
            <label className="studio-field">
              <span>Nama speaker</span>
              <input
                value={turn.speaker || ""}
                maxLength={60}
                onChange={(event) =>
                  update(index, "speaker", event.target.value)
                }
                required
              />
            </label>
            <label className="studio-field">
              <span>Suara Kokoro</span>
              <select
                value={turn.voice || defaultVoice}
                onChange={(event) => update(index, "voice", event.target.value)}
              >
                {KOKORO_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} · {voice.accent}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="studio-field">
            <span>Teks giliran</span>
            <textarea
              value={turn.text || ""}
              maxLength={2000}
              rows={2}
              onChange={(event) => update(index, "text", event.target.value)}
              required
            />
          </label>
        </div>
      ))}
    </section>
  );
}
