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

/** Live, read-only speech recognition using the Web Speech API (continuous + interim results).
 * Works across modern Chromium browsers (Chrome, Brave, Edge, etc.) on desktop and mobile. */
export function useSpeechRecognition({ language = "en-US" } = {}) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(() =>
    Boolean(getRecognitionConstructor()),
  );
  const [braveDetected] = useState(false);
  const recognitionRef = useRef(null);
  const prefixRef = useRef("");
  const ignoreLateResultsRef = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getRecognitionConstructor()));
    return () => {
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
    setListening(false);
    setTranscript("");
  }, []);

  const start = useCallback(
    ({ append = false } = {}) => {
      const Recognition = getRecognitionConstructor();
      if (!Recognition) {
        setSupported(false);
        return { ok: false, reason: "unsupported" };
      }
      if (recognitionRef.current) return { ok: true };
      ignoreLateResultsRef.current = false;

      const prefix = append ? transcript.trim() : "";
      prefixRef.current = prefix;
      if (!append) setTranscript("");

      try {
        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;
        recognition.onresult = (event) => {
          if (ignoreLateResultsRef.current) return;
          const parts = [];
          for (let i = 0; i < event.results.length; i += 1) {
            const result = event.results[i];
            const text = result?.[0]?.transcript?.trim();
            if (text) parts.push(text);
          }
          const recognized = parts.join(" ").replace(/\s+/g, " ").trim();
          const combined = [prefixRef.current, recognized]
            .filter(Boolean)
            .join(" ");
          setTranscript(combined);
        };
        recognition.onerror = (event) => {
          if (!["no-speech", "aborted"].includes(event.error)) {
            window.dispatchEvent(
              new CustomEvent("speakup:speech-error", {
                detail: { error: event.error },
              }),
            );
          }
          setListening(false);
          if (recognitionRef.current === recognition)
            recognitionRef.current = null;
        };
        recognition.onend = () => {
          setListening(false);
          if (recognitionRef.current === recognition)
            recognitionRef.current = null;
        };
        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
        setSupported(true);
        return { ok: true };
      } catch (error) {
        recognitionRef.current = null;
        setListening(false);
        return { ok: false, reason: error?.name || "recognition-error" };
      }
    },
    [language, transcript],
  );

  return {
    transcript,
    setTranscript,
    listening,
    supported,
    braveDetected,
    start,
    stop,
    reset,
  };
}
