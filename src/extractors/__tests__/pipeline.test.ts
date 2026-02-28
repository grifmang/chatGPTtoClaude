import { describe, it, expect } from "vitest";
import { extractAllMemories } from "../index";
import type { ParsedConversation, MemoryCategory } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConversation(
  id: string,
  title: string,
  userMessages: string[],
): ParsedConversation {
  return {
    id,
    title,
    model: "gpt-4",
    createdAt: 1700000000,
    gizmoId: null,
    messages: userMessages.map((text) => ({
      role: "user" as const,
      text,
      timestamp: 1700000010,
    })),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("extractAllMemories", () => {
  it("runs all extractors and returns combined results", () => {
    const convs = [
      // Preference trigger
      makeConversation("c1", "Preferences", [
        "I prefer functional programming.",
      ]),
      // Technical trigger
      makeConversation("c2", "Stack", [
        "I use React and TypeScript.",
      ]),
      // Project trigger
      makeConversation("c3", "Project", [
        "I'm building a task manager.",
      ]),
      // Identity trigger
      makeConversation("c4", "About me", [
        "I'm a senior developer.",
      ]),
      // Theme triggers (need 3+ conversations mentioning same word)
      makeConversation("c5", "Testing 1", [
        "Help me with testing.",
      ]),
      makeConversation("c6", "Testing 2", [
        "More testing questions.",
      ]),
      makeConversation("c7", "Testing 3", [
        "Testing best practices.",
      ]),
    ];

    const results = extractAllMemories(convs);

    // Should have results from all categories
    const categories = new Set(results.map((r) => r.category));
    expect(categories.has("preference")).toBe(true);
    expect(categories.has("technical")).toBe(true);
    expect(categories.has("project")).toBe(true);
    expect(categories.has("identity")).toBe(true);
    expect(categories.has("theme")).toBe(true);
  });

  it("returns results from all 5 categories", () => {
    const convs = [
      makeConversation("c1", "Chat", [
        "I prefer dark mode. I use Python. I'm building an app. I'm a developer.",
      ]),
      // Theme needs 3+ conversations
      makeConversation("c2", "Chat", ["authentication flow"]),
      makeConversation("c3", "Chat", ["authentication setup"]),
      makeConversation("c4", "Chat", ["authentication tokens"]),
    ];

    const results = extractAllMemories(convs);
    const categories = new Set<MemoryCategory>(
      results.map((r) => r.category),
    );

    expect(categories.size).toBe(5);
  });

  it("generates unique IDs across all extractors", () => {
    const convs = [
      makeConversation("c1", "Chat", [
        "I prefer TypeScript. I use React. I'm building something. I'm a developer.",
      ]),
      makeConversation("c2", "Chat", ["deployment pipeline"]),
      makeConversation("c3", "Chat", ["deployment process"]),
      makeConversation("c4", "Chat", ["deployment automation"]),
    ];

    const results = extractAllMemories(convs);
    const ids = results.map((r) => r.id);
    const uniqueIds = new Set(ids);

    // All IDs should be unique
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all candidates have pending status", () => {
    const convs = [
      makeConversation("c1", "Chat", [
        "I prefer dark mode.",
      ]),
    ];

    const results = extractAllMemories(convs);
    for (const r of results) {
      expect(r.status).toBe("pending");
    }
  });

  it("returns empty array for empty conversations", () => {
    const results = extractAllMemories([]);

    expect(results).toEqual([]);
  });

  it("returns empty array for conversations with no extractable content", () => {
    const convs = [
      makeConversation("c1", "", ["Hello, how are you?"]),
    ];
    const results = extractAllMemories(convs);

    expect(results).toHaveLength(0);
  });
});
