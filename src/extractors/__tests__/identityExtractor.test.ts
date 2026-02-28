import { describe, it, expect } from "vitest";
import { extractIdentity } from "../identityExtractor";
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
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("extractIdentity", () => {
  it("extracts 'I'm a' pattern", () => {
    const conv = makeConversation([
      "I'm a senior frontend developer.",
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("I'm a senior frontend developer.");
    expect(results[0].category).toBe("identity");
    expect(results[0].confidence).toBe("high");
    expect(results[0].status).toBe("pending");
  });

  it("extracts 'my role is' pattern", () => {
    const conv = makeConversation([
      "My role is tech lead at a startup.",
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("My role is");
  });

  it("extracts 'I work at' pattern", () => {
    const conv = makeConversation([
      "I work at a fintech company in London.",
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(1);
  });

  it("extracts 'I work as' pattern", () => {
    const conv = makeConversation([
      "I work as a data scientist.",
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(1);
  });

  it("extracts 'my background is' pattern", () => {
    const conv = makeConversation([
      "My background is in machine learning.",
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(1);
  });

  it("extracts 'my experience is' pattern", () => {
    const conv = makeConversation([
      "My experience is mostly in backend systems.",
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(1);
  });

  it("extracts 'I have N years' pattern", () => {
    const conv = makeConversation([
      "I have 10 years of experience in web development.",
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(1);
  });

  it("extracts 'I've been a' pattern", () => {
    const conv = makeConversation([
      "I've been a developer for 5 years.",
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(1);
  });

  it("ignores assistant messages", () => {
    const conv = makeConversationWithRoles([
      { role: "assistant", text: "I'm a helpful AI assistant." },
      { role: "user", text: "Great, thanks." },
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(0);
  });

  it("returns empty array when no matches found", () => {
    const conv = makeConversation([
      "Can you help me debug this code?",
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(0);
  });

  it("extracts only the matching sentence", () => {
    const conv = makeConversation([
      "Some context. I'm a full-stack developer. Let me explain.",
    ]);
    const results = extractIdentity([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("I'm a full-stack developer.");
  });

  it("generates unique IDs with id- prefix", () => {
    const conv = makeConversation([
      "I'm a developer.",
      "I work at Google.",
    ]);
    const results = extractIdentity([conv]);

    expect(results[0].id).toBe("id-0");
    expect(results[1].id).toBe("id-1");
  });

  it("uses conversation createdAt as sourceTimestamp", () => {
    const conv = makeConversation(["I'm a developer."], {
      createdAt: 1700000099,
    });
    const results = extractIdentity([conv]);

    expect(results[0].sourceTimestamp).toBe(1700000099);
  });
});
