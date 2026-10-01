/** Encode mono Float32 audio as base64 little-endian PCM16 at the Live API rate. */
export function encodePcm16Base64(input, fromRate, toRate = 16_000) {
  if (!input || typeof input.length !== "number")
    throw new TypeError("PCM input must be an array-like audio buffer.");
  const sourceRate = Number(fromRate);
  const targetRate = Number(toRate);
  if (
    !Number.isFinite(sourceRate) ||
    sourceRate <= 0 ||
    !Number.isFinite(targetRate) ||
    targetRate <= 0
  )
    throw new RangeError("PCM sample rates must be positive finite numbers.");
  if (typeof btoa !== "function")
    throw new Error("Base64 encoding is unavailable in this browser.");

  const ratio = sourceRate / targetRate;
  const frameCount = Math.floor(input.length / ratio);
  const bytes = new Uint8Array(frameCount * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < frameCount; i++) {
    const position = i * ratio;
    const leftIndex = Math.min(input.length - 1, Math.floor(position));
    const rightIndex = Math.min(input.length - 1, leftIndex + 1);
    const fraction = position - leftIndex;
    const left = Number(input[leftIndex] ?? 0);
    const right = Number(input[rightIndex] ?? left);
    const sample = Math.max(-1, Math.min(1, left + (right - left) * fraction));
    view.setInt16(
      i * 2,
      Math.round(sample * (sample < 0 ? 32768 : 32767)),
      true,
    );
  }

  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + 32768, bytes.length)),
    );
  return btoa(binary);
}

/**
 * Gemini Live may send WebSocket messages as text or binary frames. In the
 * browser, binary frames are delivered as Blob by default; decode these before
 * parsing the JSON protocol message.
 */
export async function parseGeminiLiveMessage(data) {
  let text;

  if (typeof data === "string") {
    text = data;
  } else if (typeof Blob !== "undefined" && data instanceof Blob) {
    text = await data.text();
  } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    text = new TextDecoder().decode(data);
  } else {
    throw new TypeError("Unsupported Gemini Live WebSocket message frame.");
  }

  const message = JSON.parse(text);
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new TypeError("Gemini Live returned an invalid protocol message.");
  }
  return message;
}

/** Return a useful server-side error without exposing any credentials. */
export function getGeminiLiveMessageError(message) {
  const error = message?.error ?? message?.serverError ?? message?.server_error;
  if (!error) return null;
  if (typeof error === "string") return error;
  if (typeof error.message === "string" && error.message.trim())
    return error.message.trim();
  if (typeof error.status === "string" && error.status.trim())
    return error.status.trim();
  return "Gemini Live menolak konfigurasi sesi.";
}
