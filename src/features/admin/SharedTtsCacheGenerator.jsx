import { useState } from "react";
import { AudioLines } from "lucide-react";
import { toast } from "sonner";
import {
  generateKokoroAudio,
  generateKokoroCompositeAudio,
} from "../../lib/ttsRocks";
import { saveSharedTtsAudio } from "../../lib/ttsCache";

export default function SharedTtsCacheGenerator({
  contentType,
  item,
  sourceText,
  segments = [],
  sourceChanged = false,
  disabled = false,
  onGeneratingChange = () => {},
  onCacheGenerated = () => {},
}) {
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const validSegments = Array.isArray(segments)
    ? segments.filter((turn) => String(turn?.text || "").trim())
    : [];
  const hasMultiSpeaker = validSegments.length >= 2;
  const canGenerate =
    Boolean(item?.id && item?.ttsRevision && String(sourceText || "").trim()) &&
    !sourceChanged &&
    !disabled &&
    !generating;

  async function generateCache() {
    if (!canGenerate) return;
    const cacheItem = {
      id: item.id,
      ttsRevision: item.ttsRevision,
      ...(item.courseId ? { courseId: item.courseId } : {}),
    };
    const priorityVoice = item.defaultVoice || "af_heart";
    const jobs = hasMultiSpeaker
      ? [
          {
            key: "multi",
            label: "Dialog multi-speaker",
            generate: (onStatus) =>
              generateKokoroCompositeAudio(validSegments, {
                compute: "auto",
                speed: 0.88,
                pauseMs: 280,
                onStatus,
              }),
          },
        ]
      : [
          {
            key: priorityVoice,
            label: `Voice prioritas · ${priorityVoice}`,
            generate: (onStatus) =>
              generateKokoroAudio(String(sourceText).trim(), {
                voice: priorityVoice,
                compute: "auto",
                speed: 0.88,
                onStatus,
              }),
          },
        ];

    setGenerating(true);
    onGeneratingChange(true);
    setStatus(
      `Membuat satu file audio${hasMultiSpeaker ? " gabungan multi-speaker" : ` dengan voice ${priorityVoice}`}…`,
    );
    const onModelStatus = (job) => (modelStatus) => {
      if (modelStatus?.message)
        setStatus(`${job.label}: ${modelStatus.message}`);
    };
    let completed = 0;
    try {
      const results = await Promise.allSettled(
        jobs.map(async (job) => {
          const audio = await job.generate(onModelStatus(job));
          await saveSharedTtsAudio({
            contentType,
            item: cacheItem,
            voiceId: job.key,
            audio,
          });
          onCacheGenerated(job.key);
          completed += 1;
          setStatus(`${completed}/${jobs.length} file selesai · ${job.label}`);
          return job;
        }),
      );
      const failed = results
        .map((result, index) =>
          result.status === "rejected"
            ? { label: jobs[index].label, error: result.reason }
            : null,
        )
        .filter(Boolean);
      const succeeded = jobs.length - failed.length;
      if (failed.length) {
        const failedNames = failed.map((job) => job.label).join(", ");
        const firstError = String(
          failed[0].error?.message ||
            failed[0].error ||
            "Kesalahan tidak diketahui.",
        )
          .replace(/\s+/g, " ")
          .slice(0, 180);
        setStatus(
          `${succeeded}/${jobs.length} file tersimpan; gagal: ${failedNames}. ${firstError}`,
        );
        toast.error(
          `${succeeded}/${jobs.length} cache tersimpan. ${failed[0].label}: ${firstError}`,
        );
      } else {
        setStatus(
          `Selesai: ${jobs.length} file tersedia. Generate ulang akan mengganti file cache lama.`,
        );
        toast.success(
          hasMultiSpeaker
            ? "Satu audio gabungan multi-speaker tersimpan di shared cache."
            : `Satu audio dengan voice ${priorityVoice} tersimpan di shared cache.`,
        );
      }
    } catch (error) {
      setStatus(error?.message || "Pembuatan shared cache gagal.");
      toast.error(error?.message || "Pembuatan shared cache gagal.");
    } finally {
      setGenerating(false);
      onGeneratingChange(false);
    }
  }

  return (
    <section className="studio-cache-generator">
      <div>
        <b>
          <AudioLines size={16} /> Shared audio cache
        </b>
        <small>
          {hasMultiSpeaker
            ? "Dialog dengan beberapa speaker dibuat sebagai satu audio gabungan; prioritas voice tunggal diabaikan."
            : `Materi ini menyimpan satu audio dengan voice prioritas ${item?.defaultVoice || "af_heart"}.`}{" "}
          Generate ulang mengganti audio cache lama.
        </small>
      </div>
      <button
        type="button"
        className="outline-btn"
        disabled={!canGenerate}
        onClick={generateCache}
      >
        {generating ? (
          <>
            <span className="spinner" /> Membuat cache…
          </>
        ) : (
          <>
            <AudioLines size={15} /> Generate satu audio
          </>
        )}
      </button>
      {sourceChanged && item?.id && (
        <p className="studio-cache-hint">
          Simpan perubahan prompt/cue card, naskah, prioritas voice, atau
          giliran dialog terlebih dahulu.
        </p>
      )}
      {!item?.id && (
        <p className="studio-cache-hint">
          Simpan materi baru sebelum membuat audio cache.
        </p>
      )}
      {item?.id && !item?.ttsRevision && !sourceChanged && (
        <p className="studio-cache-hint">
          Muat ulang materi agar versi audio terbaru tersedia.
        </p>
      )}
      {status && (
        <p className="studio-cache-status" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
