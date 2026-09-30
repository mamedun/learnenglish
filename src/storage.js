import JSZip from "jszip";
import { initialData } from "./data";
import { apiFetch } from "./api";
async function api(url, init) {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request gagal (${response.status})`);
  }
  return response;
}
function collectAudioIds(data) {
  const ids = /* @__PURE__ */ new Set();
  for (const session of data.sessions || [])
    for (const turn of session.turns || [])
      if (turn.audioId) ids.add(String(turn.audioId));
  return [...ids];
}
async function exportBackup(data, includeAudio) {
  const zip = new JSZip();
  zip.file(
    "manifest.json",
    JSON.stringify({
      app: "SpeakUp",
      schema_version: 2,
      exported_at: /* @__PURE__ */ new Date().toISOString(),
      includes_audio: includeAudio,
    }),
  );
  zip.file("data.json", JSON.stringify(data, null, 2));
  if (includeAudio) {
    const folder = zip.folder("audio");
    for (const id of collectAudioIds(data)) {
      try {
        const response = await api(`audio/${encodeURIComponent(id)}`);
        folder.file(`${id}.webm`, await response.blob());
      } catch {}
    }
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `speakup-backup-${/* @__PURE__ */ new Date().toISOString().slice(0, 10)}.zip`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1200);
}
async function importBackup(file) {
  if (file.size > 100 * 1024 * 1024)
    throw new Error("Backup melebihi batas 100 MB.");
  const zip = await JSZip.loadAsync(file, { checkCRC32: true });
  const mf = zip.file("manifest.json"),
    df = zip.file("data.json");
  if (!mf || !df) throw new Error("ZIP bukan backup SpeakUp.");
  const manifestSize = mf._data?.uncompressedSize ?? 0;
  const dataSize = df._data?.uncompressedSize ?? 0;
  if (manifestSize > 65536 || dataSize > 5e6)
    throw new Error("Isi backup melebihi batas aman.");
  const manifest = JSON.parse(await mf.async("text"));
  if (manifest.app !== "SpeakUp" || ![1, 2].includes(manifest.schema_version))
    throw new Error("Versi backup tidak didukung.");
  const raw = JSON.parse(await df.async("text"));
  if (!Array.isArray(raw.completed) || !Array.isArray(raw.sessions))
    throw new Error("Struktur backup tidak valid.");
  const data = {
    ...initialData,
    ...raw,
    settings: { ...initialData.settings, ...raw.settings },
  };
  const idMap = {};
  const folder = zip.folder("audio");
  if (folder) {
    const entries = [];
    folder.forEach((path, entry) => {
      const size = Number(entry._data?.uncompressedSize ?? 0);
      if (
        !entry.dir &&
        /^[a-zA-Z0-9_-]+\.webm$/.test(path) &&
        size > 0 &&
        size <= 25 * 1024 * 1024
      )
        entries.push({
          old: path.replace(/\.webm$/, ""),
          entry,
          expectedSize: size,
        });
    });
    if (entries.length > 300)
      throw new Error("Backup berisi terlalu banyak rekaman (maksimal 300).");
    let total = 0;
    for (const item of entries) {
      total += item.expectedSize;
      if (total > 100 * 1024 * 1024)
        throw new Error("Total ukuran audio melebihi batas 100 MB.");
      const blob = await item.entry.async("blob");
      if (blob.size !== item.expectedSize || blob.size > 25 * 1024 * 1024)
        continue;
      const form = new FormData();
      form.append("audio", blob, `${item.old}.webm`);
      form.append("client_ref", item.old);
      try {
        const response = await api("audio", { method: "POST", body: form });
        const result = await response.json();
        idMap[item.old] = result.audio.id;
      } catch {}
    }
  }
  const replace = (value) => {
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object") {
      const out = {};
      for (const [key, child] of Object.entries(value))
        out[key] =
          key === "audioId" && typeof child === "string"
            ? idMap[child] || null
            : replace(child);
      if ("audioSaved" in out && !out.audioId) out.audioSaved = false;
      return out;
    }
    return value;
  };
  const restored = replace(data);
  await api("progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ progress: restored }),
  });
  return restored;
}
async function deleteAllRecordings() {
  await api("progress", { method: "DELETE" });
}
export { deleteAllRecordings, exportBackup, importBackup };
