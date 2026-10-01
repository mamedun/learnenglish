const contractions = {
  "ain't": "is not",
  "aren't": "are not",
  "can't": "cannot",
  "couldn't": "could not",
  "didn't": "did not",
  "doesn't": "does not",
  "don't": "do not",
  "hadn't": "had not",
  "hasn't": "has not",
  "haven't": "have not",
  "he'd": "he would",
  "he'll": "he will",
  "he's": "he is",
  "how's": "how is",
  "i'd": "i would",
  "i'll": "i will",
  "i'm": "i am",
  "i've": "i have",
  "isn't": "is not",
  "it'll": "it will",
  "it's": "it is",
  "let's": "let us",
  "mightn't": "might not",
  "mustn't": "must not",
  "shan't": "shall not",
  "she'd": "she would",
  "she'll": "she will",
  "she's": "she is",
  "shouldn't": "should not",
  "that's": "that is",
  "there's": "there is",
  "they'd": "they would",
  "they'll": "they will",
  "they're": "they are",
  "they've": "they have",
  "we'd": "we would",
  "we'll": "we will",
  "we're": "we are",
  "we've": "we have",
  "weren't": "were not",
  "what's": "what is",
  "who's": "who is",
  "won't": "will not",
  "wouldn't": "would not",
  "you'd": "you would",
  "you'll": "you will",
  "you're": "you are",
  "you've": "you have",
};

const numberWords = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const smallNumberWords = new Set(
  Object.entries(numberWords)
    .filter(([, value]) => value > 0 && value < 10)
    .map(([word]) => word),
);

function normalizeNumberPhrases(words) {
  const normalized = [];
  for (let index = 0; index < words.length; index += 1) {
    const value = numberWords[words[index]];
    if (value === undefined) {
      normalized.push(words[index]);
      continue;
    }
    const nextValue = numberWords[words[index + 1]];
    if (
      value >= 20 &&
      value % 10 === 0 &&
      smallNumberWords.has(words[index + 1])
    ) {
      normalized.push(String(value + nextValue));
      index += 1;
    } else {
      normalized.push(String(value));
    }
  }
  return normalized;
}

const normalizeWords = (text = "") => {
  const normalized = String(text)
    .toLocaleLowerCase()
    .replace(/[’]/g, "'")
    // Treat a clock time ending in :00 like its spoken hour (6:00 -> six).
    .replace(/\b(\d{1,2}):00\b/g, "$1")
    .replace(/\b0+(\d+)\b/g, "$1")
    .replace(/(\d)([\p{L}])/gu, "$1 $2")
    .replace(/([\p{L}])(\d)/gu, "$1 $2")
    .replace(
      /\b[\p{L}]+(?:'[\p{L}]+)?\b/gu,
      (word) => contractions[word] || word.replace(/'/g, ""),
    )
    // Punctuation (including commas, periods and semicolons) is not graded.
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return normalizeNumberPhrases(normalized);
};

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
