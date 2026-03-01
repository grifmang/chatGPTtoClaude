import { describe, it, expect } from "vitest";
import { extractPreferences } from "../preferenceExtractor";
import type { ParsedConversation } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConversation(
  userMessages: string[],
  overrides: Partial<ParsedConversation> = {},
): ParsedConversation {
  return {
    id: "conv-1",
    title: "Test Chat",
    model: "gpt-4",
    createdAt: 1700000000,
    gizmoId: null,
    messages: userMessages.map((text) => ({
      role: "user" as const,
      text,
      timestamp: 1700000010,
    })),
    ...overrides,
  };
}

function makeConversationWithRoles(
  messages: Array<{ role: "user" | "assistant"; text: string }>,
  overrides: Partial<ParsedConversation> = {},
): ParsedConversation {
  return {
    id: "conv-1",
    title: "Test Chat",
    model: "gpt-4",
    createdAt: 1700000000,
    gizmoId: null,
    messages: messages.map((m) => ({
      ...m,
      timestamp: 1700000010,
    })),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("extractPreferences", () => {
  it("extracts 'I prefer' as high confidence", () => {
    const conv = makeConversation([
      "I prefer dark mode for all my editors.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("I prefer dark mode for all my editors.");
    expect(results[0].confidence).toBe("high");
    expect(results[0].category).toBe("preference");
    expect(results[0].status).toBe("pending");
    expect(results[0].sourceTitle).toBe("Test Chat");
  });

  it("extracts 'I always' as high confidence", () => {
    const conv = makeConversation([
      "I always use semicolons in JavaScript.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("I always use semicolons in JavaScript.");
    expect(results[0].confidence).toBe("high");
  });

  it("extracts 'please always' and 'don't ever' as high confidence", () => {
    const conv = makeConversation([
      "Please always use TypeScript for new projects.",
      "Don't ever use var in my code.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(2);
    expect(results[0].text).toBe(
      "Please always use TypeScript for new projects.",
    );
    expect(results[0].confidence).toBe("high");
    expect(results[1].text).toBe("Don't ever use var in my code.");
    expect(results[1].confidence).toBe("high");
  });

  it("ignores assistant messages", () => {
    const conv = makeConversationWithRoles([
      { role: "assistant", text: "I prefer to help you with coding." },
      { role: "user", text: "Thanks for the help." },
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(0);
  });

  it("returns empty array when no matches found", () => {
    const conv = makeConversation([
      "Can you help me write a function?",
      "What is the weather today?",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(0);
  });

  it("extracts 'I like' as medium confidence", () => {
    const conv = makeConversation([
      "I like functional programming a lot. It feels cleaner.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("I like functional programming a lot.");
    expect(results[0].confidence).toBe("medium");
  });

  it("extracts 'I tend to' as medium confidence", () => {
    const conv = makeConversation([
      "I tend to use arrow functions everywhere.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe("medium");
  });

  it("extracts 'I usually' as medium confidence", () => {
    const conv = makeConversation([
      "I usually write tests before code.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe("medium");
  });

  it("extracts only the matching sentence, not the whole message", () => {
    const conv = makeConversation([
      "Here is my setup. I prefer tabs over spaces. Let me know what you think.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("I prefer tabs over spaces.");
  });

  it("only extracts one match per message", () => {
    const conv = makeConversation([
      "I prefer dark mode in editors. I always use TypeScript for projects.",
    ]);
    const results = extractPreferences([conv]);

    // Should only get one match (first pattern hit)
    expect(results).toHaveLength(1);
  });

  it("generates unique IDs", () => {
    const conv = makeConversation([
      "I prefer dark mode in my editors.",
      "I always use TypeScript for projects.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("pref-0");
    expect(results[1].id).toBe("pref-1");
  });

  it("uses conversation createdAt as sourceTimestamp", () => {
    const conv = makeConversation(["I prefer dark mode in editors."], {
      createdAt: 1700000099,
    });
    const results = extractPreferences([conv]);

    expect(results[0].sourceTimestamp).toBe(1700000099);
  });

  it("handles 'never use' pattern", () => {
    const conv = makeConversation(["Never use inline styles in React."]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe("high");
  });

  it("handles 'my style is' pattern", () => {
    const conv = makeConversation([
      "My style is to keep functions small and focused.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe("high");
  });

  it("handles 'I want you to' pattern", () => {
    const conv = makeConversation([
      "I want you to always explain your reasoning.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe("high");
  });

  // ─── Noise Filters ───────────────────────────────────────────────────────────

  it("filters out sentences shorter than 5 words", () => {
    const conv = makeConversation(["I prefer it."]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(0);
  });

  it("filters out questions", () => {
    const conv = makeConversation([
      "Do I prefer dark mode or light mode?",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(0);
  });

  it("still extracts valid preference sentences", () => {
    const conv = makeConversation([
      "I prefer using dark mode in all my editors.",
    ]);
    const results = extractPreferences([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe(
      "I prefer using dark mode in all my editors.",
    );
    expect(results[0].confidence).toBe("high");
  });
});
