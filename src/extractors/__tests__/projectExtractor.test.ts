import { describe, it, expect } from "vitest";
import { extractProjects } from "../projectExtractor";
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

describe("extractProjects", () => {
  it("extracts 'I'm building' pattern", () => {
    const conv = makeConversation([
      "I'm building a task management app.",
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("I'm building a task management app.");
    expect(results[0].category).toBe("project");
    expect(results[0].confidence).toBe("high");
    expect(results[0].status).toBe("pending");
  });

  it("extracts 'I'm working on' pattern", () => {
    const conv = makeConversation([
      "I'm working on a new e-commerce platform.",
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("I'm working on");
  });

  it("extracts 'my project' pattern", () => {
    const conv = makeConversation([
      "My project is a social media analytics tool.",
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("My project");
  });

  it("extracts 'the goal is' pattern", () => {
    const conv = makeConversation([
      "The goal is to automate our deployment pipeline.",
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("The goal is");
  });

  it("extracts 'my company' pattern", () => {
    const conv = makeConversation([
      "My company makes developer tools.",
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(1);
  });

  it("extracts 'my team' pattern", () => {
    const conv = makeConversation([
      "My team is responsible for the backend services.",
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(1);
  });

  it("extracts 'we're building' pattern", () => {
    const conv = makeConversation([
      "We're building a real-time chat application.",
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(1);
  });

  it("extracts 'our product' pattern", () => {
    const conv = makeConversation([
      "Our product helps small businesses manage inventory.",
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(1);
  });

  it("ignores assistant messages", () => {
    const conv = makeConversationWithRoles([
      { role: "assistant", text: "I'm building a response for you." },
      { role: "user", text: "Thanks." },
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(0);
  });

  it("returns empty array when no matches found", () => {
    const conv = makeConversation([
      "How do I center a div?",
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(0);
  });

  it("extracts only the matching sentence", () => {
    const conv = makeConversation([
      "Let me give context. I'm building a CLI tool. Can you help?",
    ]);
    const results = extractProjects([conv]);

    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("I'm building a CLI tool.");
  });

  it("generates unique IDs with proj- prefix", () => {
    const conv = makeConversation([
      "I'm building a web app.",
      "My team handles deployments.",
    ]);
    const results = extractProjects([conv]);

    expect(results[0].id).toBe("proj-0");
    expect(results[1].id).toBe("proj-1");
  });

  it("uses conversation createdAt as sourceTimestamp", () => {
    const conv = makeConversation(["I'm building something."], {
      createdAt: 1700000099,
    });
    const results = extractProjects([conv]);

    expect(results[0].sourceTimestamp).toBe(1700000099);
  });
});
