import React, { useEffect, useRef, useState } from "react";
import { Mic, Volume2 } from "lucide-react";
import "./AudioRadarWaveform.css";

const BAR_COUNT = 32;

function drawRoundedBar(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y, x + height, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }
}

export default function AudioRadarWaveform({
  active = true,
  stream = null, // External MediaStream if available
  theme = "emerald", // "emerald" | "coral" | "purple"
  label = "Mendengarkan suara…",
  subLabel = "",
  compact = false,
  className = "",
}) {
  const canvasRef = useRef(null);
  const internalStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animFrameRef = useRef(null);
  const currentHeightsRef = useRef(new Float32Array(BAR_COUNT).fill(4));

  const [voiceDetected, setVoiceDetected] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(0); // 0 - 100 scale

  useEffect(() => {
    if (!active) {
      cleanupAudio();
      return undefined;
    }

    let isMounted = true;

    async function initAudio() {
      // If no external media stream is passed, run visualizer simulation.
      // Do NOT request getUserMedia on mobile when Web Speech API is running,
      // because acquiring hardware microphone track starves Web Speech API of audio.
      if (
        !stream ||
        stream.getAudioTracks().length === 0 ||
        stream.getAudioTracks()[0].readyState === "ended"
      ) {
        startSimulatedDrawing();
        return;
      }

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          startSimulatedDrawing();
          return;
        }

        const audioCtx = new AudioContextClass();
        if (audioCtx.state === "suspended") {
          await audioCtx.resume().catch(() => {});
        }

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64; // 32 frequency bins
        analyser.smoothingTimeConstant = 0.65;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
        sourceRef.current = source;

        startDrawing();
      } catch (err) {
        console.warn("AudioRadarWaveform: microphone analysis fallback to simulation", err);
        startSimulatedDrawing();
      }
    }

    initAudio();

    return () => {
      isMounted = false;
      cleanupAudio();
    };
  }, [active, stream]);

  function cleanupAudio() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (_) {}
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch (_) {}
      analyserRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (_) {}
      audioCtxRef.current = null;
    }
    if (internalStreamRef.current) {
      internalStreamRef.current.getTracks().forEach((t) => t.stop());
      internalStreamRef.current = null;
    }
    setVoiceDetected(false);
    setVoiceVolume(0);
  }

  function startDrawing() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount; // 32
    const dataArray = new Uint8Array(bufferLength);
    const timeArray = new Uint8Array(bufferLength);

    let lastStateUpdate = 0;
    const currentHeights = currentHeightsRef.current;

    // Symmetric index mapping: center of equalizer has voice speech frequencies
    // 0..15 -> mirror left and right from center
    const symmetricMap = [];
    const half = Math.floor(BAR_COUNT / 2);
    for (let i = 0; i < BAR_COUNT; i++) {
      const distFromCenter = Math.abs(i - half);
      symmetricMap[i] = Math.min(bufferLength - 1, distFromCenter + 1);
    }

    function render(now) {
      animFrameRef.current = requestAnimationFrame(render);

      analyser.getByteFrequencyData(dataArray);
      analyser.getByteTimeDomainData(timeArray);

      // Compute RMS / Volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength; // 0 - 255

      // Voice threshold: avg > 7 is speech sound above ambient noise floor
      const isSpeaking = avg > 7;
      const volumeLevel = Math.min(100, Math.round((avg / 120) * 100));

      // Throttle React state update to ~12fps for UI text & radar ripples
      if (now - lastStateUpdate > 80) {
        lastStateUpdate = now;
        setVoiceDetected(isSpeaking);
        setVoiceVolume(volumeLevel);
      }

      // Prepare Canvas dimensions
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(rect.width);
      const displayHeight = Math.floor(rect.height);

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      const totalBars = BAR_COUNT;
      const gap = Math.max(2, Math.floor(displayWidth / 90));
      const barWidth = Math.max(3, (displayWidth - gap * (totalBars - 1)) / totalBars);
      const maxHeight = displayHeight - 4;
      const minHeight = 4; // Flat resting static pill when silent

      // Create Gradient
      let gradient;
      if (theme === "coral") {
        gradient = ctx.createLinearGradient(0, displayHeight, 0, 0);
        gradient.addColorStop(0, "#ca4e41");
        gradient.addColorStop(0.6, "#f27c70");
        gradient.addColorStop(1, "#ffa298");
      } else if (theme === "purple") {
        gradient = ctx.createLinearGradient(0, displayHeight, 0, 0);
        gradient.addColorStop(0, "#5240c4");
        gradient.addColorStop(0.6, "#7867ea");
        gradient.addColorStop(1, "#a69afc");
      } else {
        // Emerald
        gradient = ctx.createLinearGradient(0, displayHeight, 0, 0);
        gradient.addColorStop(0, "#29573d");
        gradient.addColorStop(0.6, "#449e6b");
        gradient.addColorStop(1, "#66c78f");
      }

      ctx.fillStyle = gradient;

      for (let i = 0; i < totalBars; i++) {
        const binIndex = symmetricMap[i];
        const rawValue = dataArray[binIndex] || 0; // 0 - 255

        let targetHeight = minHeight;
        if (isSpeaking) {
          // Real-time sound wave dynamic height
          const normalized = rawValue / 255;
          // Apply non-linear boost so human voice clearly causes vigorous waveform movement
          const boosted = Math.pow(normalized, 1.25);
          targetHeight = minHeight + boosted * (maxHeight - minHeight);
        } else {
          // Silent: strictly resting static pill
          targetHeight = minHeight;
        }

        // Fluid decay / spring interpolation:
        // When going up, react fast (0.35); when falling down, smooth decay (0.2)
        if (targetHeight > currentHeights[i]) {
          currentHeights[i] += (targetHeight - currentHeights[i]) * 0.45;
        } else {
          currentHeights[i] += (targetHeight - currentHeights[i]) * 0.22;
        }

        const barH = Math.max(minHeight, Math.min(maxHeight, currentHeights[i]));
        const x = i * (barWidth + gap);
        // Center vertically in canvas
        const y = (displayHeight - barH) / 2;

        drawRoundedBar(ctx, x, y, barWidth, barH, barWidth / 2);
      }

      ctx.restore();
    }

    render(performance.now());
  }

  function startSimulatedDrawing() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastStateUpdate = 0;
    const currentHeights = currentHeightsRef.current;

    function renderSimulated(now) {
      animFrameRef.current = requestAnimationFrame(renderSimulated);

      const t = now * 0.003;
      const primaryPulse = Math.sin(t * 1.6);
      const secondaryPulse = Math.sin(t * 3.4 + 1.2);
      const isSpeaking = primaryPulse > -0.4;
      const volumeLevel = isSpeaking
        ? Math.min(100, Math.round(38 + 28 * Math.abs(primaryPulse) + 14 * secondaryPulse))
        : 6;

      if (now - lastStateUpdate > 80) {
        lastStateUpdate = now;
        setVoiceDetected(isSpeaking);
        setVoiceVolume(volumeLevel);
      }

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(rect.width);
      const displayHeight = Math.floor(rect.height);

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      const totalBars = BAR_COUNT;
      const gap = Math.max(2, Math.floor(displayWidth / 90));
      const barWidth = Math.max(3, (displayWidth - gap * (totalBars - 1)) / totalBars);
      const maxHeight = displayHeight - 4;
      const minHeight = 4;

      let gradient;
      if (theme === "coral") {
        gradient = ctx.createLinearGradient(0, displayHeight, 0, 0);
        gradient.addColorStop(0, "#ca4e41");
        gradient.addColorStop(0.6, "#f27c70");
        gradient.addColorStop(1, "#ffa298");
      } else if (theme === "purple") {
        gradient = ctx.createLinearGradient(0, displayHeight, 0, 0);
        gradient.addColorStop(0, "#5240c4");
        gradient.addColorStop(0.6, "#7867ea");
        gradient.addColorStop(1, "#a69afc");
      } else {
        gradient = ctx.createLinearGradient(0, displayHeight, 0, 0);
        gradient.addColorStop(0, "#29573d");
        gradient.addColorStop(0.6, "#449e6b");
        gradient.addColorStop(1, "#66c78f");
      }

      ctx.fillStyle = gradient;

      const half = Math.floor(BAR_COUNT / 2);
      for (let i = 0; i < totalBars; i++) {
        const distFromCenter = Math.abs(i - half) / half;
        const wave =
          Math.sin(t * 3.1 + i * 0.38) * 0.5 +
          Math.cos(t * 1.9 - i * 0.22) * 0.3 +
          Math.sin(t * 5.4 + i * 0.8) * 0.2;
        const normalized = Math.max(0, Math.min(1, (wave + 1) / 2));
        const envelope = 1 - distFromCenter * 0.5;

        let targetHeight = minHeight;
        if (isSpeaking) {
          const boosted = Math.pow(normalized * envelope, 1.25);
          targetHeight = minHeight + boosted * (maxHeight - minHeight);
        }

        if (targetHeight > currentHeights[i]) {
          currentHeights[i] += (targetHeight - currentHeights[i]) * 0.45;
        } else {
          currentHeights[i] += (targetHeight - currentHeights[i]) * 0.22;
        }

        const barH = Math.max(minHeight, Math.min(maxHeight, currentHeights[i]));
        const x = i * (barWidth + gap);
        const y = (displayHeight - barH) / 2;
        drawRoundedBar(ctx, x, y, barWidth, barH, barWidth / 2);
      }

      ctx.restore();
    }

    renderSimulated(performance.now());
  }

  if (!active) return null;

  return (
    <div
      className={`arw-container arw-theme-${theme} ${compact ? "arw-compact" : ""} ${voiceDetected ? "arw-speaking" : "arw-silent"} ${className}`}
      role="status"
      aria-live="polite"
      style={{
        "--voice-vol": `${voiceVolume}%`,
      }}
    >
      {/* Radar Acoustic Emitter Hub */}
      <div className={`arw-radar-hub ${voiceDetected ? "is-emitting" : "is-calm"}`}>
        <span className="arw-ripple arw-r1" />
        <span className="arw-ripple arw-r2" />
        <span className="arw-ripple arw-r3" />
        <div className="arw-radar-center">
          {voiceDetected ? <Volume2 size={compact ? 15 : 18} /> : <Mic size={compact ? 15 : 18} />}
        </div>
      </div>

      {/* Main Content: Status + Equalizer Soundwave Canvas */}
      <div className="arw-body">
        <div className="arw-header">
          <div className="arw-status">
            <span className={`arw-live-dot ${voiceDetected ? "active-voice" : "silent-wait"}`} />
            <span className="arw-label">
              {voiceDetected ? "● Suara terdeteksi — mic merespons" : label}
            </span>
          </div>
          <span className="arw-sublabel">
            {voiceDetected
              ? `Intensitas volume: ${voiceVolume}%`
              : subLabel || "Hening (Menunggu suaramu…)"}
          </span>
        </div>

        {/* Dynamic Voice Waveform Reactive Canvas */}
        <div className="arw-canvas-wrap" aria-hidden="true">
          <canvas ref={canvasRef} className="arw-canvas" />
        </div>
      </div>
    </div>
  );
}
