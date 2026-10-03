import React from "react";
import { Mic, ChevronDown } from "lucide-react";
import "./CustomMicPicker.css";

export default function CustomMicPicker({
  devices = [],
  deviceId = "",
  onChangeDevice,
  className = "",
}) {
  // If only 1 or 0 mic detected, do not show selection control
  if (!devices || devices.length <= 1) return null;

  return (
    <div className={`custom-mic-picker-container ${className}`}>
      <div className="custom-mic-picker-box">
        <Mic size={14} className="mic-picker-lead-icon" />
        <select
          aria-label="Pilih mikrofon"
          value={deviceId}
          onChange={(e) => onChangeDevice?.(e.target.value)}
          className="custom-mic-select"
        >
          {devices.map((device, i) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Mikrofon ${i + 1}`}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="mic-picker-chevron" />
      </div>
    </div>
  );
}
