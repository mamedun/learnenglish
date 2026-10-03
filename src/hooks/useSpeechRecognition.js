import { useCallback, useEffect, useRef, useState } from "react";

function getRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isBraveBrowser() {
  return false;
}

export function speechRecognitionErrorMessage(code) {
  if (code === "not-allowed" || code === "service-not-allowed")
    return "Izin mikrofon/transkripsi ditolak. Izinkan penggunaan mikrofon di browser.";
  if (code === "audio-capture")
    return "Browser tidak menemukan mikrofon. Periksa perangkat input.";
  if (code === "network")
    return "Layanan transkripsi browser tidak dapat terhubung. Periksa koneksi internet.";
  return `Transkripsi berhenti${code ? ` (${code})` : ""}. Coba ulangi.`;
}

/**
 * Intelligent transcript merger that eliminates Android & mobile Chrome duplicate loops
 * while allowing natural sentence progression and real-time word streaming.
 */
export function mergeTranscripts(existing, next) {
  const a = (existing || "").trim();
  const b = (next || "").trim();
  if (!a) return b;
  if (!b) return a;
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  // If b already contains or starts with a (Android cumulative repeat)
  if (bLower.startsWith(aLower)) return b;

  // If a already contains or ends with b
  if (aLower.endsWith(bLower)) return a;

  // Check word-level overlap at the boundary
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  const maxOverlap = Math.min(aWords.length, bWords.length, 6);

  for (let len = maxOverlap; len > 0; len--) {
    const aTail = aWords.slice(-len).join(" ").toLowerCase();
    const bHead = bWords.slice(0, len).join(" ").toLowerCase();
    if (aTail === bHead) {
      return aWords.concat(bWords.slice(len)).join(" ");
    }
  }

  return a + " " + b;
}

/** Live, read-only speech recognition using the Web Speech API (continuous + interim results).
 * Works across modern Chromium browsers (Chrome, Brave, Edge, etc.) on desktop and mobile. */
export function useSpeechRecognition({ language = "en-US" } = {}) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(() =>
    Boolean(getRecognitionConstructor()),
  );
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const prefixRef = useRef("");
  const finalTranscriptRef = useRef("");
  const lastFinalChunkRef = useRef("");
  const ignoreLateResultsRef = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getRecognitionConstructor()));
    return () => {
      listeningRef.current = false;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onresult = null;
        recognition.onend = null;
        recognition.onerror = null;
        try {
          recognition.abort();
        } catch {
          // The browser may already have closed the microphone session.
        }
      }
    };
  }, []);

  const stop = useCallback((options = {}) => {
    listeningRef.current = false;
    if (options?.discardPendingResults) ignoreLateResultsRef.current = true;
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // stop() can throw if recognition has already ended.
      }
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    listeningRef.current = false;
    ignoreLateResultsRef.current = true;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        // Nothing else to clean up.
      }
    }
    prefixRef.current = "";
    finalTranscriptRef.current = "";
    lastFinalChunkRef.current = "";
    setListening(false);
    setTranscript("");
  }, []);

  const updateTranscript = useCallback((newText) => {
    const val =
      typeof newText === "function"
        ? newText(finalTranscriptRef.current)
        : newText;
    prefixRef.current = val || "";
    finalTranscriptRef.current = val || "";
    lastFinalChunkRef.current = "";
    setTranscript(val || "");
  }, []);

  const start = useCallback(
    ({ append = false } = {}) => {
      const Recognition = getRecognitionConstructor();
      if (!Recognition) {
        setSupported(false);
        return { ok: false, reason: "unsupported" };
      }

      if (recognitionRef.current && listeningRef.current) return { ok: true };
      ignoreLateResultsRef.current = false;
      listeningRef.current = true;

      const prefix = append ? transcript.trim() : "";
      prefixRef.current = prefix;
      finalTranscriptRef.current = prefix;
      lastFinalChunkRef.current = "";
      if (!append) setTranscript("");

      try {
        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;

        recognition.onresult = (event) => {
          if (ignoreLateResultsRef.current) return;

          let interimText = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const item = event.results[i];
            const text = (item?.[0]?.transcript || "").trim();
            if (!text) continue;

            if (item.isFinal) {
              // Mobile repeat bug: resultIndex 1 repeats resultIndex 0 on Android Chrome
              if (
                i === 1 &&
                text.toLowerCase() ===
                  (event.results[0]?.[0]?.transcript || "").trim().toLowerCase()
              ) {
                continue;
              }

              // Prevent exact consecutive duplicate chunks
              if (
                lastFinalChunkRef.current &&
                lastFinalChunkRef.current.toLowerCase() === text.toLowerCase()
              ) {
                continue;
              }
              lastFinalChunkRef.current = text;

              finalTranscriptRef.current = mergeTranscripts(
                finalTranscriptRef.current,
                text,
              );
            } else {
              interimText = mergeTranscripts(interimText, text);
            }
          }

          const combined = mergeTranscripts(
            finalTranscriptRef.current,
            interimText,
          );
          setTranscript(combined);
        };

        recognition.onerror = (event) => {
          if (event.error === "no-speech" || event.error === "aborted") {
            // Non-fatal transient events, do not stop or surface error to user
            return;
          }

          listeningRef.current = false;
          setListening(false);
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }

          window.dispatchEvent(
            new CustomEvent("speakup:speech-error", {
              detail: { error: event.error },
            }),
          );
        };

        recognition.onend = () => {
          if (listeningRef.current && !ignoreLateResultsRef.current) {
            try {
              recognition.start();
              return;
            } catch {
              // Browser may require a new touch gesture on some mobile platforms
            }
          }

          listeningRef.current = false;
          setListening(false);
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
        setSupported(true);
        return { ok: true };
      } catch (error) {
        listeningRef.current = false;
        recognitionRef.current = null;
        setListening(false);
        return { ok: false, reason: error?.name || "recognition-error" };
      }
    },
    [language, transcript],
  );

  return {
    transcript,
    setTranscript: updateTranscript,
    listening,
    supported,
    start,
    stop,
    reset,
  };
}
