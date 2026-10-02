const sourceLabelPattern =
  /^\s*(?:[*_]{1,2}\s*)?(?:<(?:em|i|span)\b[^>]*>\s*)?TRANSKRIP\s*(?:[·•|]\s*|\s+)(?:LIVE|HASIL\s+AI)(?:\s*<\/(?:em|i|span)>)?(?:\s*[*_]{1,2})?\s*[:：—–-]?\s*/i;

const namedHtmlEntities = {
  amp: "&",
  apos: "'",
  bull: "•",
  copy: "©",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  reg: "®",
  rsquo: "’",
};

function decodeHtmlEntity(entity) {
  if (entity[0] === "#") {
    const hexadecimal = entity[1]?.toLowerCase() === "x";
    const digits = entity.slice(hexadecimal ? 2 : 1);
    const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff)
      return `&${entity};`;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return `&${entity};`;
    }
  }
  return namedHtmlEntities[entity.toLowerCase()] ?? `&${entity};`;
}

/** Remove a UI-only transcript source badge if it was accidentally copied into text. */
export function stripTranscriptSourceLabel(value) {
  return String(value ?? "")
    .replace(sourceLabelPattern, "")
    .trim();
}

/**
 * Turn AI Markdown/HTML into safe plain text for display and TTS. This keeps
 * the words while removing presentation syntax, tags, links' URLs, and entities.
 */
export function toPlainText(value, { forSpeech = false } = {}) {
  let text = stripTranscriptSourceLabel(value)
    .replace(/\u0000/g, "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/```[^\S\r\n]*[^\r\n]*\r?\n([\s\S]*?)```/g, "$1")
    .replace(/```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/<https?:\/\/([^ >]+)>/gi, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote|tr|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#(?:x[\da-f]+|\d+)|[a-z][a-z\d]+);/gi, (_, entity) =>
      decodeHtmlEntity(entity),
    )
    .replace(/<[^>]*>/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/gm, "")
    .replace(/\\([\\`*_{}\[\]()#+.\-!>])/g, "$1")
    .replace(/\*\*|__|~~|[*_]/g, "")
    .replace(/(^|\s)[•▪◦]\s*/gm, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (forSpeech) text = text.replace(/\s+/g, " ").trim();
  return text;
}
