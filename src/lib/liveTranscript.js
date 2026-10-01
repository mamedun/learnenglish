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
