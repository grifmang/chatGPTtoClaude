import type { MemoryCandidate, MemoryCategory } from "../types";

// --- Section Config ---------------------------------------------------------

const SECTION_ORDER: { category: MemoryCategory; header: string }[] = [
  { category: "identity", header: "# About Me" },
  { category: "preference", header: "# Preferences" },
  { category: "technical", header: "# Tech Stack" },
  { category: "project", header: "# Current Projects" },
  { category: "theme", header: "# Interests & Recurring Topics" },
];

// --- Export -----------------------------------------------------------------

/**
 * Export approved memory candidates as a CLAUDE.md file with semantic headings.
 *
 * Returns an empty string if there are no approved candidates.
 */
export function exportToClaudeMd(candidates: MemoryCandidate[]): string {
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
