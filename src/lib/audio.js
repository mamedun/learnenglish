export async function convertRecordingToWav(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
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
