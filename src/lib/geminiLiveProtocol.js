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
