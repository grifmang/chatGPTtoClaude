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

// ─── Extractor ───────────────────────────────────────────────────────────────

export function extractThemes(
  conversations: ParsedConversation[],
): MemoryCandidate[] {
  // Count unique words per conversation
  const wordConvCount = new Map<string, number>();

  for (const conv of conversations) {
    const wordsInConv = new Set<string>();

    // Tokenize title
    for (const word of tokenize(conv.title)) {
      wordsInConv.add(word);
    }

    // Tokenize user messages only
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;
      for (const word of tokenize(msg.text)) {
        wordsInConv.add(word);
      }
    }

    // Increment counts
    for (const word of wordsInConv) {
      wordConvCount.set(word, (wordConvCount.get(word) ?? 0) + 1);
    }
  }

  // Filter to words appearing in 3+ conversations, sort by frequency desc
  const themes: Array<{ word: string; count: number }> = [];
  for (const [word, count] of wordConvCount.entries()) {
    if (count >= 3) {
      themes.push({ word, count });
    }
  }
  themes.sort((a, b) => b.count - a.count);

  // Build candidates
  const candidates: MemoryCandidate[] = [];
  let counter = 0;

  for (const { word, count } of themes) {
    const confidence: Confidence = count >= 5 ? "high" : "medium";
    candidates.push({
      id: `theme-${counter++}`,
      text: `Recurring interest: "${word}" (appeared in ${count} conversations)`,
      category: "theme",
      confidence,
      sourceTitle: "multiple",
      sourceTimestamp: null,
      status: "pending",
    });
  }

  return candidates;
}
