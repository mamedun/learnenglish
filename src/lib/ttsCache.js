import { apiFetch } from "../api";

function cacheQuery(contentType, item, voiceId) {
  const params = new URLSearchParams({
    type: contentType,
    id: String(item?.id || ""),
    revision: String(item?.ttsRevision || ""),
    voice: voiceId,
  });
  if (item?.courseId) params.set("course_id", String(item.courseId));
  return `tts-cache?${params.toString()}`;
}

async function responseError(response) {
  const body = await response.json().catch(() => ({}));
  return new Error(body.error || `Audio bersama gagal (${response.status}).`);
}

export async function getSharedTtsAudio(contentType, item, voiceId) {
  if (!item?.id || !item?.ttsRevision || !voiceId) return null;
  const response = await apiFetch(cacheQuery(contentType, item, voiceId));
  if (response.status === 404) return null;
  if (!response.ok) throw await responseError(response);
  return response.blob();
}

export async function saveSharedTtsAudio({
  contentType,
  item,
  voiceId,
  audio,
}) {
  if (!item?.id || !item?.ttsRevision || !audio)
    throw new Error("Materi atau audio cache belum lengkap.");
  const form = new FormData();
  form.append("type", contentType);
  form.append("id", String(item.id));
  form.append("revision", String(item.ttsRevision));
  form.append("voice", voiceId);
  if (item.courseId) form.append("course_id", String(item.courseId));
  form.append("audio", audio, `${item.id}-${voiceId}.wav`);
  const response = await apiFetch("tts-cache", { method: "POST", body: form });
  if (!response.ok) throw await responseError(response);
  return response.json().catch(() => ({}));
}
