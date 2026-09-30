const normalizeWords = (text = "") =>
  String(text)
    .toLocaleLowerCase()
    // Punctuation (including commas, periods and semicolons) is not graded.
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

function wordEditDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

/** Word error rate translated to a 0-100 similarity score. Punctuation is ignored. */
export function compareSpokenText(expected, actual) {
  const expectedWords = normalizeWords(expected);
  const actualWords = normalizeWords(actual);
  if (!expectedWords.length || !actualWords.length) {
    return { percent: 0, passed: false, expectedWords: expectedWords.length };
  }
  const denominator = Math.max(expectedWords.length, actualWords.length);
  const errors = wordEditDistance(expectedWords, actualWords);
  const percent = Math.max(0, Math.round((1 - errors / denominator) * 100));
  return {
    percent,
    passed: percent >= 90,
    expectedWords: expectedWords.length,
    spokenWords: actualWords.length,
    errors,
  };
}

export { normalizeWords, wordEditDistance };
