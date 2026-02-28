import { describe, it, expect } from "vitest";
import { exportToMarkdown } from "../markdownExport";
import type { MemoryCandidate } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCandidate(
  overrides: Partial<MemoryCandidate> = {},
): MemoryCandidate {
  return {
    id: "test-1",
    text: "Test memory",
    category: "preference",
    confidence: "high",
    sourceTitle: "Test Chat",
    sourceTimestamp: 1700000000,
    status: "approved",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("exportToMarkdown", () => {
  it("groups approved candidates by category with correct headers", () => {
    const candidates: MemoryCandidate[] = [
      makeCandidate({ id: "1", text: "I prefer dark mode", category: "preference" }),
      makeCandidate({ id: "2", text: "Uses TypeScript daily", category: "technical" }),
      makeCandidate({ id: "3", text: "Building a todo app", category: "project" }),
      makeCandidate({ id: "4", text: "Software engineer", category: "identity" }),
      makeCandidate({ id: "5", text: "Interested in AI", category: "theme" }),
    ];

    const result = exportToMarkdown(candidates);

    expect(result).toContain("# My Preferences");
    expect(result).toContain("- I prefer dark mode");
    expect(result).toContain("# Technical Profile");
    expect(result).toContain("- Uses TypeScript daily");
    expect(result).toContain("# Projects");
    expect(result).toContain("- Building a todo app");
    expect(result).toContain("# About Me");
    expect(result).toContain("- Software engineer");
    expect(result).toContain("# Recurring Interests");
    expect(result).toContain("- Interested in AI");
  });

  it("outputs sections in the correct order", () => {
    const candidates: MemoryCandidate[] = [
      makeCandidate({ id: "1", text: "Theme item", category: "theme" }),
      makeCandidate({ id: "2", text: "Identity item", category: "identity" }),
      makeCandidate({ id: "3", text: "Project item", category: "project" }),
      makeCandidate({ id: "4", text: "Technical item", category: "technical" }),
      makeCandidate({ id: "5", text: "Preference item", category: "preference" }),
    ];

    const result = exportToMarkdown(candidates);

    const prefIdx = result.indexOf("# My Preferences");
    const techIdx = result.indexOf("# Technical Profile");
    const projIdx = result.indexOf("# Projects");
    const identIdx = result.indexOf("# About Me");
    const themeIdx = result.indexOf("# Recurring Interests");

    expect(prefIdx).toBeLessThan(techIdx);
    expect(techIdx).toBeLessThan(projIdx);
    expect(projIdx).toBeLessThan(identIdx);
    expect(identIdx).toBeLessThan(themeIdx);
  });

  it("excludes rejected and pending candidates", () => {
    const candidates: MemoryCandidate[] = [
      makeCandidate({ id: "1", text: "Approved item", status: "approved" }),
      makeCandidate({ id: "2", text: "Rejected item", status: "rejected" }),
      makeCandidate({ id: "3", text: "Pending item", status: "pending" }),
    ];

    const result = exportToMarkdown(candidates);

    expect(result).toContain("- Approved item");
    expect(result).not.toContain("Rejected item");
    expect(result).not.toContain("Pending item");
  });

  it("omits empty sections", () => {
    const candidates: MemoryCandidate[] = [
      makeCandidate({ id: "1", text: "Pref item", category: "preference" }),
      makeCandidate({ id: "2", text: "Tech item", category: "technical" }),
    ];

    const result = exportToMarkdown(candidates);

    expect(result).toContain("# My Preferences");
    expect(result).toContain("# Technical Profile");
    expect(result).not.toContain("# Projects");
    expect(result).not.toContain("# About Me");
    expect(result).not.toContain("# Recurring Interests");
  });

  it("returns empty string when no approved candidates", () => {
    const candidates: MemoryCandidate[] = [
      makeCandidate({ id: "1", status: "rejected" }),
      makeCandidate({ id: "2", status: "pending" }),
    ];

    const result = exportToMarkdown(candidates);

    expect(result).toBe("");
  });

  it("returns empty string for empty array", () => {
    const result = exportToMarkdown([]);
    expect(result).toBe("");
  });

  it("groups multiple items under the same category", () => {
    const candidates: MemoryCandidate[] = [
      makeCandidate({ id: "1", text: "Likes dark mode", category: "preference" }),
      makeCandidate({ id: "2", text: "Prefers tabs", category: "preference" }),
      makeCandidate({ id: "3", text: "Uses VS Code", category: "preference" }),
    ];

    const result = exportToMarkdown(candidates);

    expect(result).toContain("- Likes dark mode");
    expect(result).toContain("- Prefers tabs");
    expect(result).toContain("- Uses VS Code");
    // Only one header
    const headerCount = (result.match(/# My Preferences/g) || []).length;
    expect(headerCount).toBe(1);
  });

  it("ends with a trailing newline", () => {
    const candidates: MemoryCandidate[] = [
      makeCandidate({ id: "1", text: "Test item" }),
    ];

    const result = exportToMarkdown(candidates);

    expect(result.endsWith("\n")).toBe(true);
  });

  it("separates sections with blank lines", () => {
    const candidates: MemoryCandidate[] = [
      makeCandidate({ id: "1", text: "Pref item", category: "preference" }),
      makeCandidate({ id: "2", text: "Tech item", category: "technical" }),
    ];

    const result = exportToMarkdown(candidates);

    // Sections should be separated by a blank line
    expect(result).toContain("- Pref item\n\n# Technical Profile");
  });
});
