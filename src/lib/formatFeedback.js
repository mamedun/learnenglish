// Utilities for formatting criteria feedback notes and separating joined words or slugs

const COMMON_FEEDBACK_WORDS = new Set([
  "a", "about", "above", "accurate", "accurately", "accuracy", "across", "action", "actionable", "adequate", "adequately", "advanced",
  "after", "again", "all", "along", "also", "although", "always", "am", "an", "and", "another", "any", "appropriate", "appropriately",
  "are", "area", "around", "as", "ask", "asked", "at", "audio", "authentic", "avoid", "aware", "away", "back", "band", "be", "because",
  "been", "before", "beginner", "being", "below", "better", "between", "both", "but", "by", "can", "cannot", "cause", "clarity", "clause", "clauses",
  "clear", "clearly", "coherence", "coherent", "collocation", "collocations", "complex", "complexity", "confidence", "confident", "connect",
  "connective", "connectives", "consonant", "consonants", "conversation", "correct", "correctly", "could", "criteria", "criterion",
  "delivery", "descriptive", "detail", "detailed", "details", "development", "did", "different", "difficult", "difficulty", "direct",
  "directly", "distinct", "do", "does", "done", "down", "each", "easy", "easily", "effective", "effectively", "element", "emphasize",
  "enable", "encourage", "end", "english", "enough", "error", "errors", "evaluate", "evaluation", "even", "ever", "every", "evidence",
  "exact", "excellent", "example", "explain", "explanation", "expression", "expressions", "extended", "fast", "feedback", "few", "final",
  "flexible", "flexibility", "flow", "fluent", "fluently", "fluency", "focus", "focused", "follow", "following", "for", "form", "formula",
  "free", "frequent", "frequently", "from", "general", "generally", "genuinely", "get", "give", "given", "gives", "giving", "good",
  "grammar", "grammatical", "great", "group", "had", "has", "have", "having", "he", "help", "helpful", "her", "here", "hesitation",
  "high", "higher", "highly", "his", "hold", "how", "however", "idea", "ideas", "identify", "idiomatic", "if", "improvement", "in",
  "inaccurate", "include", "including", "incorrect", "individual", "informative", "initial", "inside", "instead", "instruction",
  "intonation", "introduce", "is", "it", "its", "just", "keep", "key", "know", "language", "learner", "learning", "least", "less",
  "lesson", "level", "lexical", "like", "limited", "line", "listen", "listening", "little", "long", "look", "looked", "low", "lower",
  "made", "main", "make", "makes", "making", "many", "may", "me", "meaning", "means", "might", "minor", "minute", "mix", "mixed", "model",
  "moderate", "more", "most", "much", "must", "my", "natural", "naturally", "need", "needed", "needs", "never", "new", "next", "no",
  "none", "normal", "not", "note", "notice", "null", "number", "obvious", "occasional", "occur", "of", "off", "often", "on", "once", "one",
  "only", "open", "opening", "or", "order", "original", "other", "our", "out", "over", "pacing", "part", "particular", "pass", "passed",
  "path", "pause", "pauses", "phrasing", "phrase", "phrases", "pitch", "plain", "point", "poor", "practice", "practice_stars", "praise",
  "precise", "precision", "prepare", "pronounce", "pronouncing", "pronunciation", "proper", "properly", "provisional", "question",
  "quick", "quickly", "range", "rate", "rating", "ratio", "read", "reading", "real", "really", "reason", "recommend", "record", "recorded",
  "recording", "regular", "relative", "relevant", "repeat", "repetition", "reply", "require", "required", "resource", "response", "rest",
  "result", "retry", "rhythm", "right", "role", "room", "rule", "rules", "said", "same", "satisfactory", "say", "scale", "score", "scored",
  "second", "see", "sentence", "sentences", "serve", "set", "short", "should", "side", "simple", "simply", "single", "situation", "skill",
  "slight", "slightly", "slow", "slowly", "smooth", "smoothly", "so", "some", "sound", "sounds", "speak", "speaker", "speaking", "specific",
  "speech", "speed", "standard", "start", "started", "state", "statement", "status", "stay", "still", "strength", "stress", "strong",
  "structure", "style", "subject", "subtle", "suggest", "suggestion", "suitable", "supportive", "sure", "syllable", "syntax", "take",
  "talk", "task", "teach", "teacher", "tells", "term", "test", "text", "than", "that", "the", "their", "them", "then", "there", "these",
  "they", "think", "this", "though", "thought", "through", "time", "to", "topic", "transition", "turn", "turns", "type", "typical",
  "unclear", "understand", "understanding", "unique", "unit", "unless", "unsupported", "until", "up", "use", "used", "useful", "user",
  "using", "utterance", "variety", "vary", "verb", "very", "vocabulary", "voice", "volume", "vowel", "vowels", "was", "way", "we", "well",
  "were", "what", "when", "where", "which", "while", "who", "why", "will", "with", "without", "word", "words", "work", "would", "write",
  "writing", "wrong", "yes", "you", "your", "yourself",
]);

function splitCompoundSegment(segment) {
  const n = segment.length;
  const dp = new Array(n + 1).fill(null);
  dp[0] = [];
  for (let i = 0; i < n; i++) {
    if (!dp[i]) continue;
    for (let j = i + 1; j <= Math.min(n, i + 25); j++) {
      const sub = segment.slice(i, j);
      if (COMMON_FEEDBACK_WORDS.has(sub)) {
        const candidate = [...dp[i], sub];
        if (!dp[j] || candidate.length < dp[j].length) {
          dp[j] = candidate;
        }
      }
    }
  }
  return dp[n] && dp[n].length > 1 ? dp[n].join(" ") : segment;
}

export function formatFeedbackText(text) {
  if (!text || typeof text !== "string") return "";
  let clean = text.trim();
  if (!clean) return "";

  // If text is an unspaced slug with underscores or hyphens
  if (!/\s/.test(clean)) {
    clean = clean.replace(/[_\-]+/g, " ");
  } else {
    clean = clean.replace(/_+/g, " ");
  }

  // Split camelCase / PascalCase
  clean = clean.replace(/([a-z])([A-Z])/g, "$1 $2");

  // Segment any unspaced tokens
  const tokens = clean.split(/\s+/).map((token) => {
    const match = token.match(/^([a-zA-Z]{6,})([.,;:!?])?$/);
    if (match) {
      const base = match[1];
      const punctuation = match[2] || "";
      const segmented = splitCompoundSegment(base.toLowerCase());
      return segmented + punctuation;
    }
    return token;
  });

  const joined = tokens.join(" ").replace(/\s+/g, " ").trim();
  return joined ? joined.charAt(0).toUpperCase() + joined.slice(1) : "";
}
