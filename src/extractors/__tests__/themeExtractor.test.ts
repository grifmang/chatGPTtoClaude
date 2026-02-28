import { describe, it, expect } from "vitest";
import { extractThemes } from "../themeExtractor";
import type { ParsedConversation } from "../../types";

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

function makeConversationWithRoles(
  id: string,
  title: string,
  messages: Array<{ role: "user" | "assistant"; text: string }>,
): ParsedConversation {
  return {
    id,
    title,
    model: "gpt-4",
    createdAt: 1700000000,
    gizmoId: null,
    messages: messages.map((m) => ({
      ...m,
      timestamp: 1700000010,
    })),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("extractThemes", () => {
  it("detects topics appearing in 3+ conversations", () => {
    const convs = [
      makeConversation("c1", "Testing basics", [
        "How do I write tests for my testing framework?",
      ]),
      makeConversation("c2", "Testing advanced", [
        "What are best testing practices?",
      ]),
      makeConversation("c3", "More testing", [
        "Help me with testing my components.",
      ]),
    ];
    const results = extractThemes(convs);

    const testingTheme = results.find((r) =>
      r.text.toLowerCase().includes("testing"),
    );
    expect(testingTheme).toBeDefined();
    expect(testingTheme!.category).toBe("theme");
    expect(testingTheme!.status).toBe("pending");
    expect(testingTheme!.text).toMatch(/Recurring interest/);
    expect(testingTheme!.text).toMatch(/appeared in \d+ conversations/);
  });

  it("ignores topics appearing in fewer than 3 conversations", () => {
    const convs = [
      makeConversation("c1", "Chat 1", ["Help me with authentication."]),
      makeConversation("c2", "Chat 2", ["Help me with authentication."]),
    ];
    const results = extractThemes(convs);

    const authTheme = results.find((r) =>
      r.text.toLowerCase().includes("authentication"),
    );
    expect(authTheme).toBeUndefined();
  });

  it("sets high confidence for themes in 5+ conversations", () => {
    const convs = [
      makeConversation("c1", "Deploy 1", ["How to deploy this?"]),
      makeConversation("c2", "Deploy 2", ["Deploy to production."]),
      makeConversation("c3", "Deploy 3", ["Deploy my service."]),
      makeConversation("c4", "Deploy 4", ["Help deploy this app."]),
      makeConversation("c5", "Deploy 5", ["I need to deploy again."]),
    ];
    const results = extractThemes(convs);

    const deployTheme = results.find((r) =>
      r.text.toLowerCase().includes("deploy"),
    );
    expect(deployTheme).toBeDefined();
    expect(deployTheme!.confidence).toBe("high");
  });

  it("sets medium confidence for themes in 3-4 conversations", () => {
    const convs = [
      makeConversation("c1", "Auth 1", ["Help with authentication."]),
      makeConversation("c2", "Auth 2", ["Fix authentication bug."]),
      makeConversation("c3", "Auth 3", ["Authentication is failing."]),
    ];
    const results = extractThemes(convs);

    const authTheme = results.find((r) =>
      r.text.toLowerCase().includes("authentication"),
    );
    expect(authTheme).toBeDefined();
    expect(authTheme!.confidence).toBe("medium");
  });

  it("sorts by frequency descending", () => {
    const convs = [
      makeConversation("c1", "Chat", ["database optimization performance"]),
      makeConversation("c2", "Chat", ["database optimization performance"]),
      makeConversation("c3", "Chat", ["database optimization performance"]),
      makeConversation("c4", "Chat", ["database performance"]),
      makeConversation("c5", "Chat", ["database performance"]),
    ];
    const results = extractThemes(convs);

    // database (5 convs) should come before optimization (3 convs)
    const dbIndex = results.findIndex((r) =>
      r.text.toLowerCase().includes("database"),
    );
    const optIndex = results.findIndex((r) =>
      r.text.toLowerCase().includes("optimization"),
    );
    if (dbIndex !== -1 && optIndex !== -1) {
      expect(dbIndex).toBeLessThan(optIndex);
    }
  });

  it("counts words per conversation, not per message", () => {
    // "security" appears 3 times in 1 conversation but only in 1 conversation
    const convs = [
      makeConversation("c1", "Chat", [
        "security security security",
        "more about security",
      ]),
      makeConversation("c2", "Chat", ["something else entirely"]),
    ];
    const results = extractThemes(convs);

    const secTheme = results.find((r) =>
      r.text.toLowerCase().includes("security"),
    );
    expect(secTheme).toBeUndefined();
  });

  it("includes conversation titles in word analysis", () => {
    const convs = [
      makeConversation("c1", "Debugging session", ["Fix this bug."]),
      makeConversation("c2", "Debugging help", ["Another issue here."]),
      makeConversation("c3", "Debugging tips", ["Show me how."]),
    ];
    const results = extractThemes(convs);

    const debugTheme = results.find((r) =>
      r.text.toLowerCase().includes("debugging"),
    );
    expect(debugTheme).toBeDefined();
  });

  it("filters out short words (<=2 chars)", () => {
    const convs = [
      makeConversation("c1", "", ["an is it to do"]),
      makeConversation("c2", "", ["an is it to do"]),
      makeConversation("c3", "", ["an is it to do"]),
    ];
    const results = extractThemes(convs);

    // No word <=2 chars should become a theme
    expect(results).toHaveLength(0);
  });

  it("filters out common stop words", () => {
    const convs = [
      makeConversation("c1", "", ["the and that with this from"]),
      makeConversation("c2", "", ["the and that with this from"]),
      makeConversation("c3", "", ["the and that with this from"]),
    ];
    const results = extractThemes(convs);

    expect(results).toHaveLength(0);
  });

  it("ignores assistant messages", () => {
    const convs = [
      makeConversationWithRoles("c1", "Chat", [
        { role: "assistant", text: "Here is your encryption solution." },
        { role: "user", text: "Thanks." },
      ]),
      makeConversationWithRoles("c2", "Chat", [
        { role: "assistant", text: "More about encryption." },
        { role: "user", text: "OK." },
      ]),
      makeConversationWithRoles("c3", "Chat", [
        { role: "assistant", text: "Encryption details." },
        { role: "user", text: "Sure." },
      ]),
    ];
    const results = extractThemes(convs);

    const encTheme = results.find((r) =>
      r.text.toLowerCase().includes("encryption"),
    );
    expect(encTheme).toBeUndefined();
  });

  it("returns empty array for conversations with no recurring themes", () => {
    const convs = [
      makeConversation("c1", "Chat", ["unique topic alpha."]),
      makeConversation("c2", "Chat", ["different topic beta."]),
    ];
    const results = extractThemes(convs);

    expect(results).toHaveLength(0);
  });

  it("generates unique IDs with theme- prefix", () => {
    const convs = [
      makeConversation("c1", "Chat", ["database optimization"]),
      makeConversation("c2", "Chat", ["database optimization"]),
      makeConversation("c3", "Chat", ["database optimization"]),
      makeConversation("c4", "Chat", ["database"]),
      makeConversation("c5", "Chat", ["database"]),
    ];
    const results = extractThemes(convs);

    for (const r of results) {
      expect(r.id).toMatch(/^theme-\d+$/);
    }
    const ids = results.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
