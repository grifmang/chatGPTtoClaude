import type { ParsedConversation, MemoryCandidate, Confidence } from "../types";

// ─── Stop Words ──────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "has", "have", "been", "some", "them",
  "than", "its", "over", "also", "that", "with", "this", "from", "they",
  "will", "would", "there", "their", "what", "about", "which", "when",
  "make", "like", "time", "just", "know", "take", "come", "could", "more",
  "into", "year", "your", "good", "give", "most", "only", "tell", "very",
  "even", "back", "here", "then", "does", "how", "each", "she", "him",
  "his", "get", "may", "said", "who", "use", "way", "many", "these",
  "after", "other", "well", "much", "before", "being", "because", "where",
  "between", "should", "same", "still", "such", "while", "every", "both",
  "need", "want", "help", "please", "thanks", "thank", "sure", "yes",
  "okay", "right", "think", "see", "new", "now", "let", "try", "thing",
  "something", "anything", "nothing", "using", "going", "doing", "don",
  "didn", "doesn", "isn", "wasn", "aren", "won", "wouldn", "couldn",
  "shouldn", "able", "really", "actually", "might", "look", "around",
]);

// ─── Tokenizer ───────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

// ─── Ngram Extraction ───────────────────────────────────────────────────────

function isAllStopWords(ngram: string[]): boolean {
  return ngram.every((w) => STOP_WORDS.has(w));
}

function extractNgrams(words: string[]): string[] {
  const ngrams: string[] = [];

  // Bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = [words[i], words[i + 1]];
    if (!isAllStopWords(bigram)) {
      ngrams.push(bigram.join(" "));
    }
  }

  // Trigrams
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = [words[i], words[i + 1], words[i + 2]];
    if (!isAllStopWords(trigram)) {
      ngrams.push(trigram.join(" "));
    }
  }

  return ngrams;
}

// ─── Extractor ───────────────────────────────────────────────────────────────

export function extractThemes(
  conversations: ParsedConversation[],
): MemoryCandidate[] {
  // Count unique ngrams per conversation
  const ngramConvCount = new Map<string, number>();

  for (const conv of conversations) {
    const ngramsInConv = new Set<string>();

    // Collect all tokenized words for this conversation
    const allWords: string[] = [];

    // Tokenize title
    allWords.push(...tokenize(conv.title));

    // Tokenize user messages only
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;
      allWords.push(...tokenize(msg.text));
    }

    // Extract ngrams and add to set (dedup within conversation)
    for (const ngram of extractNgrams(allWords)) {
      ngramsInConv.add(ngram);
    }

    // Increment counts
    for (const ngram of ngramsInConv) {
      ngramConvCount.set(ngram, (ngramConvCount.get(ngram) ?? 0) + 1);
    }
  }

  // Filter to ngrams appearing in 3+ conversations, sort by frequency desc
  const themes: Array<{ ngram: string; count: number }> = [];
  for (const [ngram, count] of ngramConvCount.entries()) {
    if (count >= 3) {
      themes.push({ ngram, count });
    }
  }
  themes.sort((a, b) => b.count - a.count);

  // Build candidates
  const candidates: MemoryCandidate[] = [];
  let counter = 0;

  for (const { ngram, count } of themes) {
    const confidence: Confidence = count >= 5 ? "high" : "medium";
    candidates.push({
      id: `theme-${counter++}`,
      text: `Recurring interest: "${ngram}" (appeared in ${count} conversations)`,
      category: "theme",
      confidence,
      sourceTitle: "multiple",
      sourceTimestamp: null,
      status: "pending",
    });
  }

  return candidates;
}
