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

  // Check word-level overlap at the boundary (e.g. [..., "w1", "w2"] and ["w1", "w2", ...])
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
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef(null);
  const prefixRef = useRef("");
  const sessionFinalRef = useRef("");
  const latestTranscriptRef = useRef("");
  const ignoreLateResultsRef = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getRecognitionConstructor()));
    return () => {
      shouldListenRef.current = false;
      clearTimeout(restartTimerRef.current);
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
    shouldListenRef.current = false;
    clearTimeout(restartTimerRef.current);
    if (options?.discardPendingResults) ignoreLateResultsRef.current = true;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
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
    shouldListenRef.current = false;
    clearTimeout(restartTimerRef.current);
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
    sessionFinalRef.current = "";
    latestTranscriptRef.current = "";
    setListening(false);
    setTranscript("");
  }, []);

  const updateTranscript = useCallback((newText) => {
    const val =
      typeof newText === "function"
        ? newText(latestTranscriptRef.current)
        : newText;
    prefixRef.current = val || "";
    sessionFinalRef.current = val || "";
    latestTranscriptRef.current = val || "";
    setTranscript(val || "");
  }, []);

  const startSession = useCallback(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setSupported(false);
      return { ok: false, reason: "unsupported" };
    }

    try {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onresult = (event) => {
        if (ignoreLateResultsRef.current) return;

        let currentSessionFinal = "";
        let currentInterim = "";

        for (let i = 0; i < event.results.length; i += 1) {
          const res = event.results[i];
          const phrase = (res[0]?.transcript || "").trim();
          if (!phrase) continue;

          if (res.isFinal) {
            currentSessionFinal = mergeTranscripts(currentSessionFinal, phrase);
          } else {
            currentInterim = mergeTranscripts(currentInterim, phrase);
          }
        }

        const fullFinal = mergeTranscripts(
          prefixRef.current,
          currentSessionFinal,
        );
        sessionFinalRef.current = fullFinal;

        const liveCombined = mergeTranscripts(fullFinal, currentInterim);
        latestTranscriptRef.current = liveCombined;
        setTranscript(liveCombined);
      };

      recognition.onerror = (event) => {
        if (event.error === "no-speech" || event.error === "aborted") {
          // Transient on mobile; let onend auto-restart if shouldListen is true
          return;
        }

        if (
          ["not-allowed", "service-not-allowed", "audio-capture"].includes(
            event.error,
          )
        ) {
          shouldListenRef.current = false;
          clearTimeout(restartTimerRef.current);
          setListening(false);
          window.dispatchEvent(
            new CustomEvent("speakup:speech-error", {
              detail: { error: event.error },
            }),
          );
        }
      };

      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }

        if (shouldListenRef.current && !ignoreLateResultsRef.current) {
          if (sessionFinalRef.current) {
            prefixRef.current = sessionFinalRef.current;
          }
          clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (shouldListenRef.current && !ignoreLateResultsRef.current) {
              startSession();
            }
          }, 150);
          return;
        }

        setListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setSupported(true);
      return { ok: true };
    } catch (error) {
      recognitionRef.current = null;
      if (!shouldListenRef.current) {
        setListening(false);
      }
      return { ok: false, reason: error?.name || "recognition-error" };
    }
  }, [language]);

  const start = useCallback(
    ({ append = false } = {}) => {
      const Recognition = getRecognitionConstructor();
      if (!Recognition) {
        setSupported(false);
        return { ok: false, reason: "unsupported" };
      }

      shouldListenRef.current = true;
      ignoreLateResultsRef.current = false;

      const prefix = append ? latestTranscriptRef.current.trim() : "";
      prefixRef.current = prefix;
      sessionFinalRef.current = prefix;
      latestTranscriptRef.current = prefix;
      if (!append) setTranscript("");

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Cleanup prior instance
        }
        recognitionRef.current = null;
      }

      return startSession();
    },
    [startSession],
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
