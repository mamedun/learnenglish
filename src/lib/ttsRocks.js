const TTS_ROCKS_ORIGIN = "https://tts.rocks";
const MODEL_ID = "kokoro-82M-v1.0";
const MODEL_URL =
  "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx";
const MODEL_DB = "kokoroTTS";
const MODEL_KEY = "kokoro-82M-v1.0";

let scriptPromise;
let initPromise;
let configuredDevice = "";
let inferenceQueue = Promise.resolve();
let activeConfig = { compute: "auto", onStatus: () => {} };

const BUSY_TTS_PHASES = new Set([
  "initialize",
  "download",
  "cache",
  "cache-hit",
  "load-model",
  "cache-lookup",
  "generate",
  "cache-upload",
  "speaking",
]);

export function isTtsBusy(status) {
  return BUSY_TTS_PHASES.has(status?.phase);
}

export function selectBestVoice(voices = [], preferredName = "") {
  if (!Array.isArray(voices) || voices.length === 0) return null;

  if (preferredName) {
    const matched = voices.find((v) => v.name === preferredName);
    if (matched) return matched;
  }

  const scoreVoice = (v) => {
    const name = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase().replace("_", "-");
    let score = 0;

    const isEnGb = lang.startsWith("en-gb") || lang.startsWith("en-uk");
    const isEn = lang.startsWith("en");

    // UK Female voices top priority
    if (name.includes("google uk english female")) score += 1000;
    else if (name.includes("libby")) score += 950;
    else if (name.includes("sonia")) score += 940;
    else if (name.includes("mia") && isEnGb) score += 930;
    else if (name.includes("hazel")) score += 920;
    else if (name.includes("serena")) score += 910;
    else if (name.includes("stephanie")) score += 900;
    else if (name.includes("fiona")) score += 890;
    else if (name.includes("martha")) score += 880;

    // Any other UK female voice
    if (isEnGb) {
      score += 500;
      if (name.includes("female") || name.includes("woman")) score += 200;
      if (name.includes("natural") || name.includes("online")) score += 50;
    }

    // Other English female voices (US/AU/etc.)
    if (name.includes("zira")) score += 400;
    else if (name.includes("jenny")) score += 390;
    else if (name.includes("samantha")) score += 380;
    else if (name.includes("victoria")) score += 370;
    else if (name.includes("karen")) score += 360;
    else if (isEn && (name.includes("female") || name.includes("woman"))) score += 300;

    // Any English voice
    if (isEn) {
      score += 100;
      if (name.includes("natural") || name.includes("online")) score += 30;
      if (v.default) score += 10;
    }

    return score;
  };

  const sorted = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return sorted[0] || voices[0] || null;
}

// Learners can choose from this curated set; Admin can author content with
// every English voice shipped by the Kokoro 82M model below.
export const KOKORO_VOICES = [
  { id: "af_heart", name: "Heart", accent: "American · feminine" },
  { id: "am_puck", name: "Puck", accent: "American · masculine" },
  { id: "bf_emma", name: "Emma", accent: "British · feminine" },
  { id: "bm_george", name: "George", accent: "British · masculine" },
];

export const KOKORO_ADMIN_VOICES = [
  { id: "af_heart", name: "Heart", accent: "American · feminine" },
  { id: "af_alloy", name: "Alloy", accent: "American · feminine" },
  { id: "af_aoede", name: "Aoede", accent: "American · feminine" },
  { id: "af_bella", name: "Bella", accent: "American · feminine" },
  { id: "af_jessica", name: "Jessica", accent: "American · feminine" },
  { id: "af_kore", name: "Kore", accent: "American · feminine" },
  { id: "af_nicole", name: "Nicole", accent: "American · feminine" },
  { id: "af_nova", name: "Nova", accent: "American · feminine" },
  { id: "af_river", name: "River", accent: "American · feminine" },
  { id: "af_sarah", name: "Sarah", accent: "American · feminine" },
  { id: "af_sky", name: "Sky", accent: "American · feminine" },
  { id: "am_adam", name: "Adam", accent: "American · masculine" },
  { id: "am_echo", name: "Echo", accent: "American · masculine" },
  { id: "am_eric", name: "Eric", accent: "American · masculine" },
  { id: "am_fenrir", name: "Fenrir", accent: "American · masculine" },
  { id: "am_liam", name: "Liam", accent: "American · masculine" },
  { id: "am_michael", name: "Michael", accent: "American · masculine" },
  { id: "am_onyx", name: "Onyx", accent: "American · masculine" },
  { id: "am_puck", name: "Puck", accent: "American · masculine" },
  { id: "am_santa", name: "Santa", accent: "American · masculine" },
  { id: "bf_alice", name: "Alice", accent: "British · feminine" },
  { id: "bf_emma", name: "Emma", accent: "British · feminine" },
  { id: "bf_isabella", name: "Isabella", accent: "British · feminine" },
  { id: "bf_lily", name: "Lily", accent: "British · feminine" },
  { id: "bm_daniel", name: "Daniel", accent: "British · masculine" },
  { id: "bm_fable", name: "Fable", accent: "British · masculine" },
  { id: "bm_george", name: "George", accent: "British · masculine" },
  { id: "bm_lewis", name: "Lewis", accent: "British · masculine" },
];

function emitStatus(onStatus, status) {
  try {
    onStatus?.(status);
  } catch {
    // A UI callback must never interrupt model initialization.
  }
}

function openModelDb() {
  if (!("indexedDB" in window))
    return Promise.reject(
      new Error("IndexedDB tidak tersedia di browser ini."),
    );
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MODEL_DB, 1);
    request.onerror = () =>
      reject(request.error || new Error("IndexedDB gagal dibuka."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("models"))
        db.createObjectStore("models");
    };
  });
}

async function readCachedModel() {
  const db = await openModelDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("models", "readonly")
        .objectStore("models")
        .get(MODEL_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function storeModel(modelData) {
  const db = await openModelDb();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("models", "readwrite");
      transaction.objectStore("models").put(modelData, MODEL_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error || new Error("Cache model gagal disimpan."));
    });
  } finally {
    db.close();
  }
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Persistence is best effort; the browser may still evict site data.
  }
}

async function downloadModel(onStatus) {
  emitStatus(onStatus, {
    phase: "download",
    progress: 0,
    message: "Mengunduh model Kokoro pertama kali…",
  });
  const response = await fetch(MODEL_URL, {
    mode: "cors",
    cache: "force-cache",
  });
  if (!response.ok)
    throw new Error(`Model Kokoro gagal diunduh (HTTP ${response.status}).`);

  const total = Number(response.headers.get("content-length")) || 0;
  let modelData;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      emitStatus(onStatus, {
        phase: "download",
        progress: total
          ? Math.min(99, Math.round((loaded / total) * 100))
          : null,
        loaded,
        total,
        message: total
          ? `Mengunduh model Kokoro… ${Math.min(99, Math.round((loaded / total) * 100))}%`
          : "Mengunduh model Kokoro…",
      });
    }
    modelData = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      modelData.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    modelData = new Uint8Array(await response.arrayBuffer());
  }
  if (!modelData.byteLength)
    throw new Error("File model Kokoro yang diunduh kosong.");

  emitStatus(onStatus, {
    phase: "cache",
    progress: 100,
    loaded: modelData.byteLength,
    total: modelData.byteLength,
    message: "Menyimpan model ke IndexedDB perangkat…",
  });
  await storeModel(modelData);
  return modelData;
}

async function loadTtsRocksScript() {
  if (typeof window === "undefined")
    throw new Error("Kokoro TTS hanya dapat dijalankan di browser.");
  if (window.TTS?.initKokoro) return window.TTS;
  if (!scriptPromise) {
    window.TTS_ASSET_BASE = TTS_ROCKS_ORIGIN;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${TTS_ROCKS_ORIGIN}/tts.js`;
      script.async = true;
      script.onload = () => {
        if (window.TTS?.initKokoro) resolve(window.TTS);
        else
          reject(new Error("Library TTS.Rocks tidak menginisialisasi Kokoro."));
      };
      script.onerror = () =>
        reject(new Error("Library tts.rocks tidak dapat dimuat."));
      document.head.appendChild(script);
    }).catch((error) => {
      scriptPromise = null;
      throw error;
    });
  }
  return scriptPromise;
}

async function selectComputeDevice(compute, module) {
  const canUseWebGpu = async () => {
    if (!navigator.gpu) return false;
    try {
      return typeof module.detectWebGPU === "function"
        ? Boolean(await module.detectWebGPU())
        : true;
    } catch {
      return false;
    }
  };
  if (compute === "wasm") return "wasm";
  if (await canUseWebGpu()) return "webgpu";
  // TTS.Rocks/Kokoro supports a WASM fallback, including when WebGPU is
  // explicitly requested on a browser that does not expose a compatible GPU.
  return "wasm";
}

async function initializeKokoro(TTS, compute, onStatus) {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    emitStatus(onStatus, {
      phase: "initialize",
      progress: null,
      message: "Menyiapkan engine Kokoro…",
    });
    window.TTS_ASSET_BASE = TTS_ROCKS_ORIGIN;
    const bundleUrl = `${TTS_ROCKS_ORIGIN}/thirdparty/kokoro-bundle.es.js`;
    const module = await import(/* @vite-ignore */ bundleUrl);
    const device = await selectComputeDevice(compute, module);

    if (TTS.kokoroTtsInstance && configuredDevice !== device)
      TTS.kokoroTtsInstance = null;
    if (TTS.kokoroTtsInstance && configuredDevice === device) return device;

    let modelData = await readCachedModel().catch(() => null);
    if (modelData) {
      emitStatus(onStatus, {
        phase: "cache-hit",
        progress: 100,
        message: "Model Kokoro ditemukan di cache perangkat.",
      });
    } else {
      modelData = await downloadModel(onStatus);
    }

    const dtype = device === "webgpu" ? "fp32" : "q8";
    emitStatus(onStatus, {
      phase: "load-model",
      progress: null,
      device,
      message: `Memuat model Kokoro melalui ${device === "webgpu" ? "WebGPU" : "WASM"}…`,
    });
    TTS.KokoroTTS = module.KokoroTTS;
    TTS.TextSplitterStream = module.TextSplitterStream;
    TTS.kokoroDevice = device;
    TTS.kokoroTtsInstance = await module.KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      {
        dtype,
        device,
        load_fn: async () => modelData,
        progress_callback: (progress) =>
          emitStatus(onStatus, {
            phase: "load-model",
            progress:
              typeof progress === "number" ? Math.round(progress * 100) : null,
            device,
            message: `Memuat model Kokoro melalui ${device === "webgpu" ? "WebGPU" : "WASM"}…`,
          }),
      },
    );
    configuredDevice = device;
    TTS.kokoroLoaded = true;
    emitStatus(onStatus, {
      phase: "ready",
      progress: 100,
      device,
      message: `Kokoro siap (${device === "webgpu" ? "WebGPU" : "WASM"}). Model tersimpan di perangkat.`,
    });
    return device;
  })()
    .catch((error) => {
      emitStatus(onStatus, {
        phase: "error",
        progress: null,
        message: error?.message || "Kokoro TTS gagal disiapkan.",
      });
      throw error;
    })
    .finally(() => {
      initPromise = null;
    });
  return initPromise;
}

async function prepare(compute = "auto", onStatus = () => {}) {
  activeConfig = { compute, onStatus };
  const TTS = await loadTtsRocksScript();
  TTS.TTSProvider = "kokoro";
  // TTS.Rocks' integration API detects WebGPU automatically. Override only the
  // initializer so the user's WASM/WebGPU preference is respected, while still
  // using its Kokoro bundle, voices, and IndexedDB model-cache key.
  TTS.initKokoro = () =>
    initializeKokoro(TTS, activeConfig.compute, activeConfig.onStatus);
  const device = await TTS.initKokoro();
  return { TTS, device };
}

export async function preloadKokoro({ compute = "auto", onStatus } = {}) {
  const { device } = await prepare(compute, onStatus);
  return device;
}

export async function speakKokoro(
  text,
  { voice = "af_heart", compute = "auto", speed = 0.88, onStatus } = {},
) {
  if (!String(text || "").trim()) return null;
  const { TTS, device } = await prepare(compute, onStatus);
  TTS.kokoroSettings = {
    ...(TTS.kokoroSettings || {}),
    voiceName: voice,
    speed,
  };
  TTS.rate = speed;
  emitStatus(onStatus, {
    phase: "speaking",
    progress: null,
    device,
    message: `Membacakan dengan Kokoro (${device === "webgpu" ? "WebGPU" : "WASM"})…`,
  });

  // Follow the TTS.Rocks API flow; their player consumes Kokoro's stream and
  // plays generated chunks locally without uploading the learner's text.
  await TTS.kokoroTTS(String(text));
  emitStatus(onStatus, {
    phase: "ready",
    progress: 100,
    device,
    message: `Kokoro siap (${device === "webgpu" ? "WebGPU" : "WASM"}). Model tersimpan di perangkat.`,
  });
  return device;
}

function wavFromFloat32(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset, value) => {
    for (let i = 0; i < value.length; i += 1)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, Number(samples[i]) || 0));
    view.setInt16(
      44 + i * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    );
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function toFloat32Samples(candidate) {
  if (candidate instanceof Float32Array)
    return candidate.length ? candidate : null;
  if (candidate instanceof ArrayBuffer) {
    if (candidate.byteLength < Float32Array.BYTES_PER_ELEMENT) return null;
    return new Float32Array(candidate, 0, Math.floor(candidate.byteLength / 4));
  }
  if (ArrayBuffer.isView(candidate)) {
    if (!candidate.length) return null;
    return Float32Array.from(candidate);
  }
  if (Array.isArray(candidate)) {
    if (!candidate.length) return null;
    if (candidate.every((sample) => typeof sample === "number"))
      return Float32Array.from(candidate);
    const chunks = candidate.map(toFloat32Samples).filter(Boolean);
    const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
    if (!length) return null;
    const samples = new Float32Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    return samples;
  }
  return null;
}

export function getGeneratedSamples(result) {
  const audio = result?.audio;
  const candidates = [
    audio?.audio,
    audio?.data,
    audio?.waveform,
    result?.waveform,
    result?.data,
    audio,
    result,
  ];
  for (const candidate of candidates) {
    const samples = toFloat32Samples(candidate);
    if (samples?.length) return samples;
  }
  return null;
}

function describeAudioPayload(result) {
  const payload = result?.audio ?? result;
  const constructor = payload?.constructor?.name || typeof payload;
  const keys =
    payload && typeof payload === "object" ? Object.keys(payload) : [];
  return keys.length
    ? `${constructor} (${keys.slice(0, 8).join(", ")})`
    : constructor;
}

function serializeKokoroInference(operation) {
  const result = inferenceQueue.then(operation, operation);
  inferenceQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function collectStreamedSamples(
  TTS,
  text,
  { voice, speed, onChunk } = {},
) {
  if (
    typeof TTS.TextSplitterStream !== "function" ||
    typeof TTS.kokoroTtsInstance?.stream !== "function"
  ) {
    throw new Error("Streaming Kokoro tidak tersedia di browser ini.");
  }

  const splitter = new TTS.TextSplitterStream();
  splitter.push(String(text || "").trim());
  splitter.close();
  const stream = TTS.kokoroTtsInstance.stream(splitter, {
    voice,
    speed,
    streamAudio: false,
  });
  const chunks = [];
  const decoder = { audioContext: null };
  let totalSamples = 0;
  let sampleRate = null;

  try {
    for await (const part of stream) {
      if (!part) continue;
      const audio = part.audio ?? part;
      let samples = getGeneratedSamples(part);
      let partSampleRate = getGeneratedSampleRate(part);

      if (!samples?.length && typeof audio?.toBlob === "function") {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass)
          throw new Error("Browser tidak mendukung pembacaan audio Kokoro.");
        decoder.audioContext ??= new AudioContextClass();
        const blob = await audio.toBlob();
        if (typeof blob?.arrayBuffer !== "function")
          throw new Error("Kokoro mengembalikan blob audio yang tidak valid.");
        const decoded = await decoder.audioContext.decodeAudioData(
          await blob.arrayBuffer(),
        );
        samples = new Float32Array(decoded.getChannelData(0));
        partSampleRate = decoded.sampleRate;
      }

      if (!samples?.length) {
        if (part.audio == null && part.data == null && part.waveform == null)
          continue;
        throw new Error(
          `Waveform Kokoro tidak dikenali (${describeAudioPayload(part)}).`,
        );
      }
      if (sampleRate !== null && sampleRate !== partSampleRate)
        throw new Error(
          "Kokoro menghasilkan sample rate audio yang tidak cocok.",
        );
      sampleRate = partSampleRate;
      chunks.push(samples);
      totalSamples += samples.length;
      onChunk?.(chunks.length);
    }
  } finally {
    if (
      decoder.audioContext &&
      decoder.audioContext.state !== "closed" &&
      typeof decoder.audioContext.close === "function"
    ) {
      await decoder.audioContext.close().catch(() => {});
    }
  }

  if (!totalSamples || !sampleRate)
    throw new Error("Kokoro menyelesaikan stream tanpa mengirim chunk audio.");

  const combined = new Float32Array(totalSamples);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return { samples: combined, sampleRate };
}

function getGeneratedSampleRate(result) {
  const sampleRate =
    result?.sampling_rate ??
    result?.samplingRate ??
    result?.sample_rate ??
    result?.audio?.sampling_rate ??
    result?.audio?.samplingRate ??
    24_000;
  return Number.isFinite(Number(sampleRate)) ? Number(sampleRate) : 24_000;
}

function assertVoice(voice) {
  if (!KOKORO_ADMIN_VOICES.some((item) => item.id === voice))
    throw new Error("Model suara Kokoro tidak didukung.");
}

export async function generateKokoroAudio(
  text,
  { voice = "af_heart", compute = "auto", speed = 0.88, onStatus } = {},
) {
  const source = String(text || "").trim();
  if (!source) throw new Error("Teks audio masih kosong.");
  assertVoice(voice);
  const { TTS, device } = await prepare(compute, onStatus);
  emitStatus(onStatus, {
    phase: "generate",
    progress: null,
    device,
    voice,
    message: `Menunggu giliran engine Kokoro (${voice})…`,
  });

  const generated = await serializeKokoroInference(() =>
    collectStreamedSamples(TTS, source, {
      voice,
      speed,
      onChunk: (chunk) =>
        emitStatus(onStatus, {
          phase: "generate",
          progress: null,
          device,
          voice,
          message: `Membuat audio Kokoro (${voice})… bagian ${chunk}`,
        }),
    }),
  );
  if (
    !generated.samples.length ||
    generated.sampleRate < 8_000 ||
    generated.sampleRate > 96_000
  ) {
    throw new Error("Kokoro tidak menghasilkan waveform audio yang valid.");
  }
  return wavFromFloat32(generated.samples, generated.sampleRate);
}

export async function generateKokoroCompositeAudio(
  segments,
  { compute = "auto", speed = 0.88, pauseMs = 280, onStatus } = {},
) {
  const turns = (Array.isArray(segments) ? segments : []).filter((turn) =>
    String(turn?.text || "").trim(),
  );
  if (turns.length < 2)
    throw new Error("Dialog multi-voice perlu sedikitnya dua giliran.");
  for (const turn of turns) assertVoice(turn.voice || "af_heart");
  const { TTS, device } = await prepare(compute, onStatus);

  return serializeKokoroInference(async () => {
    const parts = [];
    let totalSamples = 0;
    let sampleRate = null;

    for (let i = 0; i < turns.length; i += 1) {
      const turn = turns[i];
      const voice = turn.voice || "af_heart";
      emitStatus(onStatus, {
        phase: "generate",
        progress: Math.round((i / turns.length) * 100),
        device,
        voice,
        message: `Membuat giliran ${i + 1}/${turns.length} (${voice})…`,
      });
      const generated = await collectStreamedSamples(
        TTS,
        String(turn.text).trim(),
        {
          voice,
          speed,
          onChunk: (chunk) =>
            emitStatus(onStatus, {
              phase: "generate",
              progress: null,
              device,
              voice,
              message: `Membuat giliran ${i + 1}/${turns.length} (${voice})… bagian ${chunk}`,
            }),
        },
      );
      if (sampleRate !== null && generated.sampleRate !== sampleRate)
        throw new Error(
          "Kokoro menghasilkan sample rate audio yang tidak cocok.",
        );
      sampleRate = generated.sampleRate;
      parts.push(generated.samples);
      totalSamples += generated.samples.length;

      if (i < turns.length - 1 && pauseMs > 0) {
        const pauseSamples = Math.round((pauseMs / 1000) * sampleRate);
        if (pauseSamples > 0) {
          parts.push(new Float32Array(pauseSamples));
          totalSamples += pauseSamples;
        }
      }
    }

    if (!sampleRate || !totalSamples)
      throw new Error("Kokoro tidak menghasilkan waveform audio yang valid.");
    const combined = new Float32Array(totalSamples);
    let offset = 0;
    for (const part of parts) {
      combined.set(part, offset);
      offset += part.length;
    }
    emitStatus(onStatus, {
      phase: "generate",
      progress: 100,
      device,
      message: "Menggabungkan giliran dialog…",
    });
    return wavFromFloat32(combined, sampleRate);
  });
}

export async function getKokoroCacheInfo() {
  if (typeof window === "undefined" || !("indexedDB" in window))
    return { cached: false, bytes: 0 };
  try {
    const modelData = await readCachedModel();
    return {
      cached: Boolean(modelData),
      bytes: modelData?.byteLength || modelData?.length || 0,
    };
  } catch {
    return { cached: false, bytes: 0 };
  }
}

export { MODEL_ID };
