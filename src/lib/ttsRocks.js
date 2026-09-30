const TTS_ROCKS_ORIGIN = "https://tts.rocks";
const MODEL_ID = "kokoro-82M-v1.0";
const MODEL_URL =
  "https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx";
const MODEL_DB = "kokoroTTS";
const MODEL_KEY = "kokoro-82M-v1.0";

let scriptPromise;
let initPromise;
let configuredDevice = "";
let activeConfig = { compute: "auto", onStatus: () => {} };

export const KOKORO_VOICES = [
  { id: "af_heart", name: "Heart", accent: "American · feminine" },
  { id: "af_bella", name: "Bella", accent: "American · feminine" },
  { id: "af_nicole", name: "Nicole", accent: "American · feminine" },
  { id: "af_sarah", name: "Sarah", accent: "American · feminine" },
  { id: "af_sky", name: "Sky", accent: "American · feminine" },
  { id: "af_aoede", name: "Aoede", accent: "American · feminine" },
  { id: "af_jessica", name: "Jessica", accent: "American · feminine" },
  { id: "af_kore", name: "Kore", accent: "American · feminine" },
  { id: "am_adam", name: "Adam", accent: "American · masculine" },
  { id: "am_michael", name: "Michael", accent: "American · masculine" },
  { id: "am_fenrir", name: "Fenrir", accent: "American · masculine" },
  { id: "am_puck", name: "Puck", accent: "American · masculine" },
  { id: "bf_emma", name: "Emma", accent: "British · feminine" },
  { id: "bf_isabella", name: "Isabella", accent: "British · feminine" },
  { id: "bm_george", name: "George", accent: "British · masculine" },
  { id: "bm_lewis", name: "Lewis", accent: "British · masculine" },
  { id: "jf_alpha", name: "Alpha", accent: "Japanese · feminine" },
  { id: "zf_xiaobei", name: "Xiaobei", accent: "Chinese · feminine" },
  { id: "ef_dora", name: "Dora", accent: "Spanish · feminine" },
  { id: "ff_siwis", name: "Siwis", accent: "French · feminine" },
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
