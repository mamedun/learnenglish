import { Mp3Encoder } from "@breezystack/lamejs";

export function float32ToInt16(samples) {
  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, Number(samples[i]) || 0));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

export function encodeMonoSamplesToMp3(
  samples,
  sampleRate = 24_000,
  kbps = 128,
) {
  const int16 =
    samples instanceof Int16Array ? samples : float32ToInt16(samples);
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const chunks = [];
  const chunkSize = 1152;
  for (let i = 0; i < int16.length; i += chunkSize) {
    const chunk = int16.subarray(i, Math.min(int16.length, i + chunkSize));
    const buf = encoder.encodeBuffer(chunk);
    if (buf && buf.length > 0) chunks.push(buf);
  }
  const end = encoder.flush();
  if (end && end.length > 0) chunks.push(end);
  return new Blob(chunks, { type: "audio/mpeg" });
}

export async function convertRecordingToMp3(blob, kbps = 128) {
  if (!blob) throw new Error("File audio rekaman kosong.");
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext || window.webkitAudioContext
      : null;
  if (!AudioCtx) {
    // If Web Audio API is not available (e.g. node or restricted context), return original blob
    return blob;
  }
  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const rate = decoded.sampleRate || 24_000;
    const length = decoded.length;
    const channels = decoded.numberOfChannels;
    const monoF32 = new Float32Array(length);
    for (let c = 0; c < channels; c += 1) {
      const channelData = decoded.getChannelData(c);
      for (let i = 0; i < length; i += 1) {
        monoF32[i] += channelData[i] / channels;
      }
    }
    return encodeMonoSamplesToMp3(monoF32, rate, kbps);
  } finally {
    await ctx.close().catch(() => {});
  }
}

export async function convertRecordingToWav(blob) {
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext || window.webkitAudioContext
      : null;
  if (!AudioCtx) throw new Error("Browser tidak mendukung pemrosesan audio.");
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const rate = 16_000;
    const length = Math.ceil(decoded.duration * rate);
    const mono = new Float32Array(length);
    const channels = decoded.numberOfChannels;
    for (let channel = 0; channel < channels; channel += 1) {
      const source = decoded.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        const position = (i * decoded.sampleRate) / rate;
        const left = Math.floor(position);
        const fraction = position - left;
        const a = source[Math.min(left, source.length - 1)] || 0;
        const b = source[Math.min(left + 1, source.length - 1)] || a;
        mono[i] += (a + (b - a) * fraction) / channels;
      }
    }

    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    const write = (offset, text) => {
      for (let i = 0; i < text.length; i += 1)
        view.setUint8(offset + i, text.charCodeAt(i));
    };
    write(0, "RIFF");
    view.setUint32(4, 36 + length * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, length * 2, true);
    for (let i = 0; i < length; i += 1) {
      const sample = Math.max(-1, Math.min(1, mono[i]));
      view.setInt16(
        44 + i * 2,
        sample < 0 ? sample * 32768 : sample * 32767,
        true,
      );
    }
    return new Blob([buffer], { type: "audio/wav" });
  } finally {
    await ctx.close().catch(() => {});
  }
}
