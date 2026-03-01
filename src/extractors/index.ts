import type { ParsedConversation, MemoryCandidate } from "../types";
import { extractPreferences } from "./preferenceExtractor";
import { extractTechnical } from "./technicalExtractor";
import { extractProjects } from "./projectExtractor";
import { extractIdentity } from "./identityExtractor";
import { extractThemes } from "./themeExtractor";
import { dedup } from "./dedup";

// ─── Re-exports ──────────────────────────────────────────────────────────────

export {
  extractPreferences,
  extractTechnical,
  extractProjects,
  extractIdentity,
  extractThemes,
  dedup,
};

// ─── Pipeline ────────────────────────────────────────────────────────────────

/**
 * Run all five extractors against the given conversations and return
 * the combined list of memory candidates.
 */
export function extractAllMemories(
  conversations: ParsedConversation[],
): MemoryCandidate[] {
  const raw = [
    ...extractPreferences(conversations),
    ...extractTechnical(conversations),
    ...extractProjects(conversations),
    ...extractIdentity(conversations),
    ...extractThemes(conversations),
  ];
  return dedup(raw);
}
