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

const homophones = {
  buy: "by",
  bye: "by",
  by: "by",
  to: "to",
  too: "to",
  two: "to",
  for: "for",
  four: "for",
  fore: "for",
  their: "there",
  there: "there",
  theyre: "there",
  no: "no",
  know: "no",
  right: "right",
  write: "right",
  rite: "right",
  hear: "here",
  here: "here",
  our: "hour",
  hour: "hour",
  one: "one",
  won: "one",
  meat: "meet",
  meet: "meet",
  sea: "see",
  see: "see",
  sun: "son",
  son: "son",
  weather: "weather",
  whether: "weather",
  peace: "piece",
  piece: "piece",
  ate: "eight",
  eight: "eight",
  whole: "hole",
  hole: "hole",
  which: "witch",
  witch: "witch",
  wait: "weight",
  weight: "weight",
  break: "brake",
  brake: "brake",
  blew: "blue",
  blue: "blue",
  deer: "dear",
  dear: "dear",
  die: "dye",
  dye: "dye",
  fair: "fare",
  fare: "fare",
  grate: "great",
  great: "great",
  hair: "hare",
  hare: "hare",
  heal: "heel",
  heel: "heel",
  mail: "male",
  male: "male",
  plain: "plane",
  plane: "plane",
  road: "rode",
  rode: "rode",
  sail: "sale",
  sale: "sale",
  stair: "stare",
  stare: "stare",
  tail: "tale",
  tale: "tale",
  weak: "week",
  week: "week",
  colour: "color",
  favourite: "favorite",
  favour: "favor",
  honour: "honor",
  centre: "center",
  theatre: "theater",
  metre: "meter",
  realise: "realize",
  organise: "organize",
  analyse: "analyze",
  travelling: "traveling",
  travelled: "traveled",
  grey: "gray",
  defence: "defense",
  licence: "license",
  practise: "practice",
  dialogue: "dialog",
  catalogue: "catalog",
};

function metaphone(word) {
  if (!word) return "";
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return "";
  if (/^(kn|gn|pn|wr|ps)/.test(w)) w = w.slice(1);
  if (w.startsWith("x")) w = "s" + w.slice(1);
  let code = "";
  for (let i = 0; i < w.length; i += 1) {
    const c = w[i];
    const prev = w[i - 1] || "";
    const next = w[i + 1] || "";
    if (c === prev && c !== "c") continue;
    if (i === 0 && /[aeiou]/.test(c)) {
      code += c.toUpperCase();
      continue;
    }
    if (/[aeiou]/.test(c)) continue;
    switch (c) {
      case "b":
        if (prev === "m" && i === w.length - 1) break;
        code += "B";
        break;
      case "c":
        if (next === "h") {
          code += "X";
          i += 1;
        } else if (/[eiy]/.test(next)) {
          code += "S";
        } else {
          code += "K";
        }
        break;
      case "d":
        if (next === "g" && /[eiy]/.test(w[i + 2] || "")) {
          code += "J";
          i += 2;
        } else {
          code += "T";
        }
        break;
      case "f":
      case "v":
        code += "F";
        break;
      case "g":
        if (next === "h" && i === w.length - 2) break;
        if (/[eiy]/.test(next)) {
          code += "J";
        } else {
          code += "K";
        }
        break;
      case "h":
        if (/[aeiou]/.test(next) && !/[csptg]/.test(prev)) code += "H";
        break;
      case "j":
        code += "J";
        break;
      case "k":
        if (prev !== "c") code += "K";
        break;
      case "l":
        code += "L";
        break;
      case "m":
        code += "M";
        break;
      case "n":
        code += "N";
        break;
      case "p":
        if (next === "h") {
          code += "F";
          i += 1;
        } else code += "P";
        break;
      case "q":
        code += "K";
        break;
      case "r":
        code += "R";
        break;
      case "s":
        if (next === "h") {
          code += "X";
          i += 1;
        } else code += "S";
        break;
      case "t":
        if (next === "h") {
          code += "0";
          i += 1;
        } else if (next === "i" && /[ao]/.test(w[i + 2] || "")) {
          code += "X";
          i += 2;
        } else code += "T";
        break;
      case "w":
      case "y":
        if (/[aeiou]/.test(next)) code += c.toUpperCase();
        break;
      case "z":
        code += "S";
        break;
    }
  }
  return code;
}

function charEditDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

const digitToWord = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "10": "ten",
};

function wordMatchCost(w1, w2) {
  if (w1 === w2) return 0;
  const word1 = digitToWord[w1] || w1;
  const word2 = digitToWord[w2] || w2;
  if (word1 === word2) return 0;
  // Direct homophone or dialect dictionary
  if (homophones[word1] && homophones[word1] === (homophones[word2] || word2)) return 0;
  if (homophones[word2] && homophones[word2] === (homophones[word1] || word1)) return 0;
  // English phonetic equivalence
  const m1 = metaphone(word1);
  const m2 = metaphone(word2);
  if (m1 && m2 && m1 === m2) return 0;
  // Character-level fuzzy matching for near-miss typos/minor STT variance
  const maxLen = Math.max(word1.length, word2.length);
  if (maxLen >= 4) {
    const dist = charEditDistance(word1, word2);
    const charSim = 1 - dist / maxLen;
    if (charSim >= 0.8) return (1 - charSim) * 0.5;
  }
  return 1;
}

function wordEditDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = wordMatchCost(left[i - 1], right[j - 1]);
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function normalizeSpeechThreshold(value = 90) {
  const threshold = Number(value);
  if (!Number.isFinite(threshold)) return 90;
  return Math.max(50, Math.min(100, Math.round(threshold)));
}

export function meetsSpeechThreshold(percent, threshold = 90) {
  const score = Number(percent);
  return Number.isFinite(score) && score >= normalizeSpeechThreshold(threshold);
}

/** Word error rate translated to a 0-100 similarity score. Punctuation is ignored. */
export function compareSpokenText(expected, actual, threshold = 90) {
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
    passed: meetsSpeechThreshold(percent, threshold),
    expectedWords: expectedWords.length,
    spokenWords: actualWords.length,
    errors,
  };
}

export { normalizeWords, wordEditDistance };
