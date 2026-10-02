import React from "react";
import { Mic, AudioLines } from "lucide-react";
import "./AudioRadarWaveform.css";

// 32 predefined bar heights with natural acoustic distribution
const BASE_HEIGHTS = [
  16, 28, 42, 60, 48, 72, 85, 94, 76, 58, 82, 98, 90, 68, 54, 78,
  88, 95, 84, 62, 75, 92, 80, 50, 66, 82, 70, 48, 38, 26, 18, 12
];

export default function AudioRadarWaveform({
  active = true,
  theme = "emerald", // "emerald" | "coral" | "purple"
  label = "Mendengarkan suara…",
  subLabel = "",
  barsCount = 32,
  compact = false,
  className = "",
}) {
  if (!active) return null;

  const bars = BASE_HEIGHTS.slice(0, barsCount);

  return (
    <div className={`arw-container arw-theme-${theme} ${compact ? "arw-compact" : ""} ${className}`} role="status" aria-live="polite">
      {/* Radar Acoustic Emitter Hub */}
      <div className="arw-radar-hub">
        <span className="arw-ripple arw-r1" />
        <span className="arw-ripple arw-r2" />
        <span className="arw-ripple arw-r3" />
        <div className="arw-radar-center">
          <Mic size={compact ? 15 : 18} />
        </div>
      </div>

      {/* Main Content: Status + Equalizer Soundwave */}
      <div className="arw-body">
        <div className="arw-header">
          <div className="arw-status">
            <span className="arw-live-dot" />
            <span className="arw-label">{label}</span>
          </div>
          {subLabel && <span className="arw-sublabel">{subLabel}</span>}
        </div>

        {/* Dynamic Voice Waveform Equalizer */}
        <div className="arw-waveform" aria-hidden="true">
          {bars.map((h, i) => {
            // Distribute animation duration between 0.5s and 0.9s with varied phase
            const duration = 0.52 + ((i * 7) % 5) * 0.08;
            const delay = -(((i * 3) % 8) * 0.11);
            return (
              <span
                key={i}
                className="arw-bar"
                style={{
                  "--max-h": `${h}%`,
                  height: `${h}%`,
                  animationDuration: `${duration}s`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
