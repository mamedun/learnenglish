import { useState } from "react";
import { AudioLines } from "lucide-react";
import { toast } from "sonner";
import {
  generateKokoroAudio,
  generateKokoroCompositeAudio,
  KOKORO_VOICES,
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
    const jobs = KOKORO_VOICES.map((voice) => ({
      key: voice.id,
      label: voice.name,
      generate: (onStatus) =>
        generateKokoroAudio(String(sourceText).trim(), {
          voice: voice.id,
          compute: "auto",
          speed: 0.88,
          onStatus,
        }),
    }));
    if (hasMultiSpeaker) {
      jobs.push({
        key: "multi",
        label: "Dialog multi-speaker",
        generate: (onStatus) =>
          generateKokoroCompositeAudio(validSegments, {
            compute: "auto",
            speed: 0.88,
            pauseMs: 280,
            onStatus,
          }),
      });
    }

    setGenerating(true);
    onGeneratingChange(true);
    setStatus(
      `Menjalankan batch ${jobs.length} audio; engine Kokoro memproses bergiliran…`,
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
            ? "Empat voice tunggal dan audio dialog multi-speaker tersimpan."
            : "Empat voice tunggal tersimpan di shared cache.",
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
          Membuat empat voice tunggal dalam satu batch; engine memproses
          bergiliran agar tetap stabil
          {hasMultiSpeaker
            ? " bersama satu audio dialog multi-speaker."
            : "."}{" "}
          Generate ulang mengganti file lama.
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
            <AudioLines size={15} /> Generate batch audio
          </>
        )}
      </button>
      {sourceChanged && item?.id && (
        <p className="studio-cache-hint">
          Simpan perubahan prompt/naskah atau giliran dialog terlebih dahulu.
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
