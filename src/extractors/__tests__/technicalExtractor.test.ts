import { describe, it, expect } from "vitest";
import { extractTechnical } from "../technicalExtractor";
import type { ParsedConversation } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConversation(
  id: string,
  userMessages: string[],
  overrides: Partial<ParsedConversation> = {},
): ParsedConversation {
  return {
    id,
    title: `Chat ${id}`,
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
  id: string,
  messages: Array<{ role: "user" | "assistant"; text: string }>,
  overrides: Partial<ParsedConversation> = {},
): ParsedConversation {
  return {
    id,
    title: `Chat ${id}`,
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

describe("extractTechnical", () => {
  it("extracts explicit stack descriptions with 'I use'", () => {
    const conv = makeConversation("c1", [
      "I use React and TypeScript for my frontend work.",
    ]);
    const results = extractTechnical([conv]);

    const stackResults = results.filter((r) =>
      r.text.includes("I use React and TypeScript"),
    );
    expect(stackResults.length).toBeGreaterThanOrEqual(1);
    expect(stackResults[0].category).toBe("technical");
    expect(stackResults[0].status).toBe("pending");
  });

  it("extracts 'my stack is' descriptions", () => {
    const conv = makeConversation("c1", [
      "My stack is Python, Flask, and PostgreSQL.",
    ]);
    const results = extractTechnical([conv]);

    const stackResults = results.filter((r) =>
      r.text.includes("My stack is Python"),
    );
    expect(stackResults.length).toBeGreaterThanOrEqual(1);
    expect(stackResults[0].confidence).toBe("high");
  });

  it("extracts 'I build with' descriptions", () => {
    const conv = makeConversation("c1", [
      "I build with Next.js and Tailwind CSS.",
    ]);
    const results = extractTechnical([conv]);

    const stackResults = results.filter((r) =>
      r.text.includes("I build with"),
    );
    expect(stackResults.length).toBeGreaterThanOrEqual(1);
  });

  it("reports technologies in 3+ conversations as high confidence", () => {
    const convs = [
      makeConversation("c1", ["Help me with my React component."]),
      makeConversation("c2", ["How do I test React hooks?"]),
      makeConversation("c3", ["Build a React form for me."]),
    ];
    const results = extractTechnical(convs);

    const reactFrequent = results.find(
      (r) => r.text.includes("React") && r.text.includes("Frequently uses"),
    );
    expect(reactFrequent).toBeDefined();
    expect(reactFrequent!.confidence).toBe("high");
    expect(reactFrequent!.text).toMatch(/mentioned in 3 conversations/);
  });

  it("does not report one-off tech mentions as frequent", () => {
    const convs = [
      makeConversation("c1", ["Help me with React."]),
      makeConversation("c2", ["Write a Python script."]),
    ];
    const results = extractTechnical(convs);

    const frequentResults = results.filter((r) =>
      r.text.includes("Frequently uses"),
    );
    expect(frequentResults).toHaveLength(0);
  });

  it("ignores assistant messages", () => {
    const conv = makeConversationWithRoles("c1", [
      { role: "assistant", text: "I use React for building UIs." },
      { role: "user", text: "Thanks for the info." },
    ]);
    const results = extractTechnical([conv]);

    const stackResults = results.filter((r) => r.text.includes("I use React"));
    expect(stackResults).toHaveLength(0);
  });

  it("counts tech keywords once per conversation, not per message", () => {
    // React mentioned twice in conv c1 but should only count as 1 conversation
    const convs = [
      makeConversation("c1", [
        "Help me with React.",
        "More React questions here.",
      ]),
      makeConversation("c2", ["React is great."]),
    ];
    const results = extractTechnical(convs);

    // Only 2 conversations mention React, so should NOT appear as frequent (needs 3+)
    const frequentReact = results.find(
      (r) => r.text.includes("React") && r.text.includes("Frequently uses"),
    );
    expect(frequentReact).toBeUndefined();
  });

  it("generates unique IDs", () => {
    const conv = makeConversation("c1", [
      "I use React for frontend. I build with Docker for deployment.",
    ]);
    const results = extractTechnical([conv]);

    const ids = results.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("uses conversation createdAt as sourceTimestamp", () => {
    const conv = makeConversation("c1", ["I use TypeScript."], {
      createdAt: 1700000099,
    });
    const results = extractTechnical([conv]);

    for (const r of results) {
      expect(r.sourceTimestamp).toBe(1700000099);
    }
  });

  it("handles 'I develop with' pattern", () => {
    const conv = makeConversation("c1", [
      "I develop with Go and gRPC.",
    ]);
    const results = extractTechnical([conv]);

    const stackResults = results.filter((r) =>
      r.text.includes("I develop with"),
    );
    expect(stackResults.length).toBeGreaterThanOrEqual(1);
  });

  it("handles 'we use' pattern", () => {
    const conv = makeConversation("c1", [
      "We use Kubernetes for orchestration.",
    ]);
    const results = extractTechnical([conv]);

    const stackResults = results.filter((r) =>
      r.text.includes("We use Kubernetes"),
    );
    expect(stackResults.length).toBeGreaterThanOrEqual(1);
  });

  it("handles 'I work with' pattern", () => {
    const conv = makeConversation("c1", [
      "I work with AWS and Terraform.",
    ]);
    const results = extractTechnical([conv]);

    const stackResults = results.filter((r) =>
      r.text.includes("I work with"),
    );
    expect(stackResults.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array for conversations with no tech content", () => {
    const conv = makeConversation("c1", [
      "What is the meaning of life?",
      "Tell me a joke.",
    ]);
    const results = extractTechnical([conv]);

    expect(results).toHaveLength(0);
  });
});
