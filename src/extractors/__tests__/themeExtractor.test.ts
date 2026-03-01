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
  it("detects bigrams appearing in 3+ conversations", () => {
    const convs = [
      makeConversation("c1", "Chat", [
        "Tell me about machine learning algorithms.",
      ]),
      makeConversation("c2", "Chat", [
        "How does machine learning work?",
      ]),
      makeConversation("c3", "Chat", [
        "I want to study machine learning models.",
      ]),
    ];
    const results = extractThemes(convs);

    const mlTheme = results.find((r) =>
      r.text.toLowerCase().includes("machine learning"),
    );
    expect(mlTheme).toBeDefined();
    expect(mlTheme!.category).toBe("theme");
    expect(mlTheme!.status).toBe("pending");
    expect(mlTheme!.text).toMatch(/Recurring interest/);
    expect(mlTheme!.text).toMatch(/appeared in \d+ conversations/);
  });

  it("does NOT extract single common words as themes", () => {
    // "testing" appears in 3 conversations but as the only content word
    // in each message, so no bigram or trigram can form
    const convs = [
      makeConversation("c1", "", ["Help me with testing."]),
      makeConversation("c2", "", ["I need testing."]),
      makeConversation("c3", "", ["More testing please."]),
    ];
    const results = extractThemes(convs);

    // No bigram/trigram should form from single isolated content words
    expect(results).toHaveLength(0);
  });

  it("extracts trigrams when they appear frequently", () => {
    const convs = [
      makeConversation("c1", "Chat", [
        "natural language processing techniques are interesting",
      ]),
      makeConversation("c2", "Chat", [
        "tell me about natural language processing models",
      ]),
      makeConversation("c3", "Chat", [
        "natural language processing applications are growing",
      ]),
    ];
    const results = extractThemes(convs);

    const nlpTheme = results.find((r) =>
      r.text.toLowerCase().includes("natural language processing"),
    );
    expect(nlpTheme).toBeDefined();
  });

  it("filters out ngrams where ALL words are stop words", () => {
    // All of these words are stop words: "the", "and", "that", "with", "this", "from"
    // After tokenization, stop words and short words are removed, so no tokens remain
    const convs = [
      makeConversation("c1", "", ["the and that with this from"]),
      makeConversation("c2", "", ["the and that with this from"]),
      makeConversation("c3", "", ["the and that with this from"]),
    ];
    const results = extractThemes(convs);

    expect(results).toHaveLength(0);
  });

  it("sets high confidence for themes in 5+ conversations", () => {
    const convs = [
      makeConversation("c1", "Chat", ["machine learning models"]),
      makeConversation("c2", "Chat", ["machine learning algorithms"]),
      makeConversation("c3", "Chat", ["machine learning techniques"]),
      makeConversation("c4", "Chat", ["machine learning frameworks"]),
      makeConversation("c5", "Chat", ["machine learning deployment"]),
    ];
    const results = extractThemes(convs);

    const mlTheme = results.find((r) =>
      r.text.toLowerCase().includes("machine learning"),
    );
    expect(mlTheme).toBeDefined();
    expect(mlTheme!.confidence).toBe("high");
  });

  it("sets medium confidence for themes in 3-4 conversations", () => {
    const convs = [
      makeConversation("c1", "Chat", ["database optimization strategies"]),
      makeConversation("c2", "Chat", ["database optimization tips"]),
      makeConversation("c3", "Chat", ["database optimization queries"]),
    ];
    const results = extractThemes(convs);

    const dbTheme = results.find((r) =>
      r.text.toLowerCase().includes("database optimization"),
    );
    expect(dbTheme).toBeDefined();
    expect(dbTheme!.confidence).toBe("medium");
  });

  it("ignores ngrams appearing in fewer than 3 conversations", () => {
    const convs = [
      makeConversation("c1", "Chat", ["machine learning models"]),
      makeConversation("c2", "Chat", ["machine learning algorithms"]),
    ];
    const results = extractThemes(convs);

    const mlTheme = results.find((r) =>
      r.text.toLowerCase().includes("machine learning"),
    );
    expect(mlTheme).toBeUndefined();
  });

  it("sorts by frequency descending", () => {
    const convs = [
      makeConversation("c1", "Chat", [
        "database optimization and neural network design",
      ]),
      makeConversation("c2", "Chat", [
        "database optimization and neural network training",
      ]),
      makeConversation("c3", "Chat", [
        "database optimization plus neural network tuning",
      ]),
      makeConversation("c4", "Chat", ["database optimization tips"]),
      makeConversation("c5", "Chat", ["database optimization strategies"]),
    ];
    const results = extractThemes(convs);

    // "database optimization" (5 convs) should come before "neural network" (3 convs)
    const dbIndex = results.findIndex((r) =>
      r.text.toLowerCase().includes("database optimization"),
    );
    const nnIndex = results.findIndex((r) =>
      r.text.toLowerCase().includes("neural network"),
    );
    if (dbIndex !== -1 && nnIndex !== -1) {
      expect(dbIndex).toBeLessThan(nnIndex);
    }
  });

  it("counts ngrams per conversation, not per message", () => {
    // "machine learning" appears 3 times but all within 1 conversation
    const convs = [
      makeConversation("c1", "Chat", [
        "machine learning rocks, machine learning rules, machine learning wins",
      ]),
      makeConversation("c2", "Chat", ["something else entirely different"]),
    ];
    const results = extractThemes(convs);

    const mlTheme = results.find((r) =>
      r.text.toLowerCase().includes("machine learning"),
    );
    expect(mlTheme).toBeUndefined();
  });

  it("includes conversation titles in ngram analysis", () => {
    // "database optimization" appears via the title contributing words
    const convs = [
      makeConversation("c1", "Database optimization", ["speed up queries"]),
      makeConversation("c2", "Database optimization", ["improve performance"]),
      makeConversation("c3", "Database optimization", ["fix slow lookups"]),
    ];
    const results = extractThemes(convs);

    const dbTheme = results.find((r) =>
      r.text.toLowerCase().includes("database optimization"),
    );
    expect(dbTheme).toBeDefined();
  });

  it("filters out short words (<=2 chars) before building ngrams", () => {
    const convs = [
      makeConversation("c1", "", ["an is it to do"]),
      makeConversation("c2", "", ["an is it to do"]),
      makeConversation("c3", "", ["an is it to do"]),
    ];
    const results = extractThemes(convs);

    // No tokens remain after filtering short words, so no ngrams
    expect(results).toHaveLength(0);
  });

  it("ignores assistant messages", () => {
    const convs = [
      makeConversationWithRoles("c1", "Chat", [
        {
          role: "assistant",
          text: "Here is your machine learning solution.",
        },
        { role: "user", text: "Thanks." },
      ]),
      makeConversationWithRoles("c2", "Chat", [
        { role: "assistant", text: "More about machine learning." },
        { role: "user", text: "OK." },
      ]),
      makeConversationWithRoles("c3", "Chat", [
        { role: "assistant", text: "Machine learning details." },
        { role: "user", text: "Sure." },
      ]),
    ];
    const results = extractThemes(convs);

    const mlTheme = results.find((r) =>
      r.text.toLowerCase().includes("machine learning"),
    );
    expect(mlTheme).toBeUndefined();
  });

  it("returns empty array for conversations with no recurring themes", () => {
    const convs = [
      makeConversation("c1", "Chat", ["unique topic alpha beta"]),
      makeConversation("c2", "Chat", ["different subject gamma delta"]),
    ];
    const results = extractThemes(convs);

    expect(results).toHaveLength(0);
  });

  it("generates unique IDs with theme- prefix", () => {
    const convs = [
      makeConversation("c1", "Chat", [
        "database optimization and neural network design",
      ]),
      makeConversation("c2", "Chat", [
        "database optimization and neural network training",
      ]),
      makeConversation("c3", "Chat", [
        "database optimization and neural network tuning",
      ]),
      makeConversation("c4", "Chat", ["database optimization tips"]),
      makeConversation("c5", "Chat", ["database optimization strategies"]),
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
