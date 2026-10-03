import React, { useEffect, useState, useRef } from "react";
import { Sparkles, Check, AudioLines } from "lucide-react";
import { appAsset } from "../lib/appPaths";
import "./MascotLoadingToast.css";

export default function MascotLoadingToast({
  active = false,
  type = "ai", // "ai" | "audio" | "tts" | "success"
  title = "",
  message = "",
  progress = null, // number 0-100 or null for infinite
  onClose = null,
}) {
  const [visible, setVisible] = useState(false);
  const [displayType, setDisplayType] = useState(type);
  const [displayTitle, setDisplayTitle] = useState(title);
  const [displayMessage, setDisplayMessage] = useState(message);
  const [displayProgress, setDisplayProgress] = useState(progress);
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (active) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setVisible(true);
      setIsClosing(false);
      setDisplayType(type);
      setDisplayTitle(title);
      setDisplayMessage(message);
      setDisplayProgress(progress);
    } else if (visible && !isClosing) {
      // Smoothly dismiss toast without confusing success text
      setIsClosing(true);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setIsClosing(false);
        onClose?.();
      }, 300);
    }
  }, [active, type, title, message, progress]);

  if (!visible) return null;

  // Determine which mascot image to display
  let mascotSrc = appAsset("images/mascot/pip-thinking.png");
  let mascotAlt = "Pip sedang berpikir";
  let themeClass = "theme-ai";

  if (displayType === "audio" || displayType === "tts") {
    mascotSrc = appAsset("images/mascot/pip-audio.png");
    mascotAlt = "Pip mendengarkan audio";
    themeClass = "theme-audio";
  } else if (displayType === "success") {
    mascotSrc = appAsset("images/mascot/pip-success.png");
    mascotAlt = "Pip merayakan keberhasilan";
    themeClass = "theme-success";
  }

  const hasDeterminateProgress =
    Number.isFinite(displayProgress) && displayProgress !== null;
  const progressPercent = hasDeterminateProgress
    ? Math.max(0, Math.min(100, Math.round(displayProgress)))
    : null;

  return (
    <aside
      className={`mascot-toast-wrapper ${isClosing ? "toast-exit" : "toast-enter"} ${themeClass}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="mascot-toast-card">
        {/* Cute Mascot Avatar with Floating Bobbing Motion */}
        <div className="mascot-avatar-container">
          <img
            src={mascotSrc}
            alt={mascotAlt}
            className="mascot-avatar-img"
            loading="eager"
          />
          <div className="mascot-avatar-glow" aria-hidden="true" />
        </div>

        {/* Content Column */}
        <div className="mascot-content-col">
          <div className="mascot-badge-row">
            <span className="mascot-tag">
              {displayType === "success" ? (
                <>
                  <Check size={11} strokeWidth={3} /> SELESAI
                </>
              ) : displayType === "audio" || displayType === "tts" ? (
                <>
                  <AudioLines size={11} /> AUDIO PIP
                </>
              ) : (
                <>
                  <Sparkles size={11} /> AI TUTOR PIP
                </>
              )}
            </span>
            {hasDeterminateProgress && (
              <span className="mascot-percent-badge">{progressPercent}%</span>
            )}
          </div>

          <h4 className="mascot-title">{displayTitle || "Sedang memproses…"}</h4>

          {displayMessage && (
            <p className="mascot-description">{displayMessage}</p>
          )}

          {/* Gamified Loading Bar */}
          <div className="mascot-progress-track">
            {hasDeterminateProgress ? (
              <div
                className="mascot-progress-fill determinate"
                style={{ width: `${progressPercent}%` }}
              />
            ) : (
              <div className="mascot-progress-fill indeterminate" />
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
