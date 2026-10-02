export function buildLearnerAssessmentTranscript(lines, maxLength = 12000) {
  const limit =
    Number.isSafeInteger(maxLength) && maxLength > 0 ? maxLength : 12000;
  return (Array.isArray(lines) ? lines : [])
    .filter(
      (line) =>
        line?.who === "learner" &&
        typeof line.text === "string" &&
        line.text.trim(),
    )
    .map((line) => line.text.trim())
    .join("\n")
    .slice(0, limit)
    .trim();
}

export function mergeLiveTranscriptText(currentValue, incomingValue) {
  const current = String(currentValue ?? "");
  const incoming = String(incomingValue ?? "");
  if (!incoming) return current;
  if (!current) return incoming.trimStart();

  // Live transcription can deliver either a fresh fragment or a cumulative
  // update for the current utterance. Avoid duplicating cumulative text.
  if (incoming.startsWith(current)) return incoming;
  if (current.endsWith(incoming) || current.startsWith(incoming))
    return current;

  const needsSpace =
    !/\s$/u.test(current) && !/^[\s,.;:!?%)\]}]/u.test(incoming);
  return `${current}${needsSpace ? " " : ""}${incoming}`;
}
