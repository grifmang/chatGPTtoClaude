import type { ParsedConversation, MemoryCandidate } from "../types";
import { extractPreferences } from "./preferenceExtractor";
import { extractTechnical } from "./technicalExtractor";
import { extractProjects } from "./projectExtractor";
import { extractIdentity } from "./identityExtractor";
import { extractThemes } from "./themeExtractor";

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { extractPreferences } from "./preferenceExtractor";
export { extractTechnical } from "./technicalExtractor";
export { extractProjects } from "./projectExtractor";
export { extractIdentity } from "./identityExtractor";
export { extractThemes } from "./themeExtractor";

// ─── Pipeline ────────────────────────────────────────────────────────────────

/**
 * Run all five extractors against the given conversations and return
 * the combined list of memory candidates.
 */
export function extractAllMemories(
  conversations: ParsedConversation[],
): MemoryCandidate[] {
  return [
    ...extractPreferences(conversations),
    ...extractTechnical(conversations),
    ...extractProjects(conversations),
    ...extractIdentity(conversations),
    ...extractThemes(conversations),
  ];
}
