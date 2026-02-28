import type { ParsedConversation, MemoryCandidate } from "../types";
import { extractSentence } from "./preferenceExtractor";

// ─── Pattern Definitions ─────────────────────────────────────────────────────

const PROJECT_PATTERNS: RegExp[] = [
  /\bI'm building\b/i,
  /\bI'm working on\b/i,
  /\bmy project\b/i,
  /\bthe goal is\b/i,
  /\bmy company\b/i,
  /\bmy team\b/i,
  /\bwe're building\b/i,
  /\bour product\b/i,
];

// ─── Extractor ───────────────────────────────────────────────────────────────

export function extractProjects(
  conversations: ParsedConversation[],
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  let counter = 0;

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;

      for (const pattern of PROJECT_PATTERNS) {
        const match = pattern.exec(msg.text);
        if (match) {
          const sentence = extractSentence(msg.text, match.index);
          candidates.push({
            id: `proj-${counter++}`,
            text: sentence,
            category: "project",
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
