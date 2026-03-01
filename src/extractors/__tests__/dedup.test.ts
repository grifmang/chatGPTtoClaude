import { describe, it, expect } from "vitest";
import { dedup } from "../dedup";
import type { MemoryCandidate } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCandidate(
  overrides: Partial<MemoryCandidate> & { text: string },
): MemoryCandidate {
  return {
    id: "test-0",
    category: "preference",
    confidence: "medium",
    sourceTitle: "Test Chat",
    sourceTimestamp: 1700000000,
    status: "pending",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("dedup", () => {
  it("returns empty array for empty input", () => {
    expect(dedup([])).toEqual([]);
  });

  it("returns single item unchanged", () => {
    const candidates = [makeCandidate({ id: "a", text: "I prefer dark mode." })];
    const result = dedup(candidates);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("I prefer dark mode.");
  });

  it("collapses exact duplicates to one", () => {
    const candidates = [
      makeCandidate({ id: "a", text: "I prefer dark mode.", confidence: "medium" }),
      makeCandidate({ id: "b", text: "I prefer dark mode.", confidence: "medium" }),
    ];
    const result = dedup(candidates);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("I prefer dark mode.");
  });

  it("keeps highest confidence when collapsing exact duplicates", () => {
    const candidates = [
      makeCandidate({ id: "a", text: "I prefer dark mode.", confidence: "low" }),
      makeCandidate({ id: "b", text: "I prefer dark mode.", confidence: "high" }),
      makeCandidate({ id: "c", text: "I prefer dark mode.", confidence: "medium" }),
    ];
    const result = dedup(candidates);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe("high");
  });

  it("keeps highest confidence for near-duplicate texts", () => {
    const candidates = [
      makeCandidate({ id: "a", text: "I prefer dark mode", confidence: "low" }),
      makeCandidate({ id: "b", text: "I prefer dark mode.", confidence: "high" }),
    ];
    const result = dedup(candidates);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe("high");
  });

  it("detects near-duplicates differing by trailing punctuation", () => {
    const candidates = [
      makeCandidate({ id: "a", text: "I always use TypeScript", confidence: "medium" }),
      makeCandidate({ id: "b", text: "I always use TypeScript.", confidence: "high" }),
    ];
    const result = dedup(candidates);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe("high");
  });

  it("keeps similar but meaningfully different texts separate", () => {
    const candidates = [
      makeCandidate({ id: "a", text: "I prefer React", confidence: "high" }),
      makeCandidate({ id: "b", text: "I prefer Vue", confidence: "high" }),
    ];
    const result = dedup(candidates);

    expect(result).toHaveLength(2);
  });

  it("keeps texts that differ significantly separate", () => {
    const candidates = [
      makeCandidate({ id: "a", text: "I use Python for data science.", confidence: "high" }),
      makeCandidate({
        id: "b",
        text: "I prefer functional programming.",
        confidence: "high",
      }),
    ];
    const result = dedup(candidates);

    expect(result).toHaveLength(2);
  });

  it("handles multiple groups of duplicates", () => {
    const candidates = [
      makeCandidate({ id: "a", text: "I prefer dark mode.", confidence: "low" }),
      makeCandidate({ id: "b", text: "I use TypeScript.", confidence: "medium" }),
      makeCandidate({ id: "c", text: "I prefer dark mode", confidence: "high" }),
      makeCandidate({ id: "d", text: "I use TypeScript", confidence: "high" }),
    ];
    const result = dedup(candidates);

    expect(result).toHaveLength(2);
    const texts = result.map((r) => r.text);
    // One from each group should survive
    expect(
      texts.some((t) => t.includes("dark mode")),
    ).toBe(true);
    expect(
      texts.some((t) => t.includes("TypeScript")),
    ).toBe(true);
  });

  it("preserves order of first occurrence", () => {
    const candidates = [
      makeCandidate({ id: "a", text: "I prefer dark mode for my editors.", confidence: "medium" }),
      makeCandidate({ id: "b", text: "I use Python for data science projects.", confidence: "medium" }),
      makeCandidate({ id: "c", text: "I am building a task management app.", confidence: "medium" }),
    ];
    const result = dedup(candidates);

    expect(result).toHaveLength(3);
    expect(result[0].text).toBe("I prefer dark mode for my editors.");
    expect(result[1].text).toBe("I use Python for data science projects.");
    expect(result[2].text).toBe("I am building a task management app.");
  });

  it("treats case-insensitive near-matches as duplicates when similarity is high", () => {
    const candidates = [
      makeCandidate({ id: "a", text: "I prefer dark mode.", confidence: "low" }),
      makeCandidate({ id: "b", text: "I prefer Dark Mode.", confidence: "high" }),
    ];
    const result = dedup(candidates);

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe("high");
  });
});
