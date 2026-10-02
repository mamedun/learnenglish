import { ExternalLink, Play } from "lucide-react";
import "./coursePages.css";

function parseYoutube(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be")
      return url.pathname.split("/").filter(Boolean)[0] || "";
    if (
      !["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)
    )
      return "";
    const segments = url.pathname.split("/").filter(Boolean);
    return (
      url.searchParams.get("v") ||
      (segments[0] === "embed" ||
      segments[0] === "shorts" ||
      segments[0] === "live"
        ? segments[1]
        : "") ||
      ""
    );
  } catch {
    return "";
  }
}

export default function CourseMedia({
  src,
  alt = "Ilustrasi materi",
  className = "",
  caption = "",
}) {
  const value = String(src || "").trim();
  if (!value) return null;
  const video = /\.(mp4|webm|mov)(?:[?#].*)?$/i.test(value);
  const image =
    /\.(png|jpe?g|webp|gif|avif|svg)(?:[?#].*)?$/i.test(value) ||
    value.startsWith("data:image/");
  const youtubeId = /^https:\/\//i.test(value) ? parseYoutube(value) : "";
  let content;
  if (youtubeId)
    content = (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`}
        title={alt}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  else if (video && /^https:\/\//i.test(value))
    content = (
      <video
        src={value}
        controls
        playsInline
        preload="metadata"
        aria-label={alt}
      />
    );
  else if (image) content = <img src={value} alt={alt} loading="lazy" />;
  else
    content = (
      <a href={value} target="_blank" rel="noreferrer">
        <span className="course-media-link-icon">
          <Play size={18} />
        </span>
        <span>
          <b>Buka media eksternal</b>
          <small>{value}</small>
        </span>
        <ExternalLink size={16} />
      </a>
    );
  return (
    <figure className={`course-media-frame ${className}`}>
      {content}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
