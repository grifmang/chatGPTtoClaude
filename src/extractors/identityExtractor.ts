import type { ParsedConversation, MemoryCandidate } from "../types";
import { extractSentence } from "./preferenceExtractor";

// ─── Pattern Definitions ─────────────────────────────────────────────────────

const IDENTITY_PATTERNS: RegExp[] = [
  /\bI'm a\b/i,
  /\bmy role is\b/i,
  /\bI work at\b/i,
  /\bI work as\b/i,
  /\bmy background is\b/i,
  /\bmy experience is\b/i,
  /\bI have \d+ years\b/i,
  /\bI've been a\b/i,
];

// ─── Extractor ───────────────────────────────────────────────────────────────

export function extractIdentity(
  conversations: ParsedConversation[],
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  let counter = 0;

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;

      for (const pattern of IDENTITY_PATTERNS) {
        const match = pattern.exec(msg.text);
        if (match) {
          const sentence = extractSentence(msg.text, match.index);
          candidates.push({
            id: `id-${counter++}`,
            text: sentence,
            category: "identity",
            confidence: "high",
            sourceTitle: conv.title,
            sourceTimestamp: conv.createdAt,
            status: "pending",
          });
          break; // one match per message
        }
      }
    }
  }

  return candidates;
}
