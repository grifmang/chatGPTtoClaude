import type { ParsedConversation, MemoryCandidate, Confidence } from "../types";

// ─── Pattern Definitions ─────────────────────────────────────────────────────

type PatternDef = { regex: RegExp; confidence: Confidence };

const HIGH_PATTERNS: PatternDef[] = [
  { regex: /\bI prefer\b/i, confidence: "high" },
  { regex: /\bI always\b/i, confidence: "high" },
  { regex: /\bplease always\b/i, confidence: "high" },
  { regex: /\bdon'?t ever\b/i, confidence: "high" },
  { regex: /\bnever use\b/i, confidence: "high" },
  { regex: /\bmy style is\b/i, confidence: "high" },
  { regex: /\bI want you to\b/i, confidence: "high" },
];

const MEDIUM_PATTERNS: PatternDef[] = [
  { regex: /\bI like\b/i, confidence: "medium" },
  { regex: /\bI tend to\b/i, confidence: "medium" },
  { regex: /\bI usually\b/i, confidence: "medium" },
];

const ALL_PATTERNS: PatternDef[] = [...HIGH_PATTERNS, ...MEDIUM_PATTERNS];

// ─── Sentence Extraction ─────────────────────────────────────────────────────

/**
 * Extract the sentence containing the match from the full text.
 * Sentence boundaries: period, exclamation mark, question mark, or newline.
 */
export function extractSentence(text: string, matchIndex: number): string {
  // Find the start of the sentence (look backwards for a boundary)
  let start = 0;
  for (let i = matchIndex - 1; i >= 0; i--) {
    if (text[i] === "." || text[i] === "!" || text[i] === "?" || text[i] === "\n") {
      start = i + 1;
      break;
    }
  }

  // Find the end of the sentence (look forwards for a boundary)
  let end = text.length;
  for (let i = matchIndex; i < text.length; i++) {
    if (text[i] === "." || text[i] === "!" || text[i] === "?" || text[i] === "\n") {
      end = i + 1;
      break;
    }
  }

  return text.slice(start, end).trim();
}

// ─── Extractor ───────────────────────────────────────────────────────────────

export function extractPreferences(
  conversations: ParsedConversation[],
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  let counter = 0;

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      // Only scan user messages
      if (msg.role !== "user") continue;

      // Try each pattern, break after first match per message
      for (const pattern of ALL_PATTERNS) {
        const match = pattern.regex.exec(msg.text);
        if (match) {
          const sentence = extractSentence(msg.text, match.index);
          candidates.push({
            id: `pref-${counter++}`,
            text: sentence,
            category: "preference",
            confidence: pattern.confidence,
            sourceTitle: conv.title,
            sourceTimestamp: conv.createdAt,
            status: "pending",
          });
          break;
        }
      }
    }
  }

  return candidates;
}
