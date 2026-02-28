import type { MemoryCandidate, MemoryCategory } from "../types";

// ─── Section Config ──────────────────────────────────────────────────────────

const SECTION_ORDER: { category: MemoryCategory; header: string }[] = [
  { category: "preference", header: "# My Preferences" },
  { category: "technical", header: "# Technical Profile" },
  { category: "project", header: "# Projects" },
  { category: "identity", header: "# About Me" },
  { category: "theme", header: "# Recurring Interests" },
];

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Export approved memory candidates as a Markdown document grouped by category.
 *
 * Returns an empty string if there are no approved candidates.
 */
export function exportToMarkdown(candidates: MemoryCandidate[]): string {
  const approved = candidates.filter((c) => c.status === "approved");

  if (approved.length === 0) {
    return "";
  }

  // Group by category
  const grouped = new Map<MemoryCategory, MemoryCandidate[]>();
  for (const candidate of approved) {
    const list = grouped.get(candidate.category) ?? [];
    list.push(candidate);
    grouped.set(candidate.category, list);
  }

  // Build sections in the defined order, omitting empty ones
  const sections: string[] = [];

  for (const { category, header } of SECTION_ORDER) {
    const items = grouped.get(category);
    if (!items || items.length === 0) continue;

    const bullets = items.map((item) => `- ${item.text}`).join("\n");
    sections.push(`${header}\n${bullets}`);
  }

  return sections.join("\n\n") + "\n";
}
