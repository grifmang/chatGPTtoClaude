import { buildExtractionPrompt, parseApiResponse } from "../apiExtractor";
import type { ParsedConversation } from "../../types";

describe("buildExtractionPrompt", () => {
  it("includes conversation text in the prompt", () => {
    const conversations: ParsedConversation[] = [
      {
        id: "1",
        title: "Test Chat",
        model: "gpt-4o",
        createdAt: 1700000000,
        gizmoId: null,
        messages: [
          { role: "user", text: "I prefer TypeScript", timestamp: 1700000000 },
          { role: "assistant", text: "Good choice!", timestamp: 1700000001 },
        ],
      },
    ];
    const prompt = buildExtractionPrompt(conversations);
    expect(prompt).toContain("I prefer TypeScript");
    expect(prompt).toContain("Test Chat");
  });

  it("asks for categorized JSON output", () => {
    const prompt = buildExtractionPrompt([]);
    expect(prompt).toContain("preference");
    expect(prompt).toContain("technical");
    expect(prompt).toContain("project");
    expect(prompt).toContain("identity");
    expect(prompt).toContain("theme");
    expect(prompt).toContain("JSON");
  });
});

describe("parseApiResponse", () => {
  it("parses a valid JSON response into MemoryCandidates", () => {
    const json = JSON.stringify([
      {
        text: "Prefers TypeScript over JavaScript",
        category: "preference",
        confidence: "high",
      },
      {
        text: "Works with React and Node.js",
        category: "technical",
        confidence: "medium",
      },
    ]);
    const results = parseApiResponse(json, "Test Chat", 1700000000);
    expect(results).toHaveLength(2);
    expect(results[0].category).toBe("preference");
    expect(results[0].confidence).toBe("high");
    expect(results[0].status).toBe("pending");
    expect(results[0].sourceTitle).toBe("Test Chat");
    expect(results[1].category).toBe("technical");
  });

  it("handles JSON wrapped in markdown code fences", () => {
    const response =
      '```json\n[{"text":"test","category":"preference","confidence":"high"}]\n```';
    const results = parseApiResponse(response, "Chat", 0);
    expect(results).toHaveLength(1);
  });

  it("returns empty array on invalid JSON", () => {
    const results = parseApiResponse("not json", "Chat", 0);
    expect(results).toEqual([]);
  });

  it("filters out entries with invalid categories", () => {
    const json = JSON.stringify([
      { text: "valid", category: "preference", confidence: "high" },
      { text: "invalid", category: "unknown", confidence: "high" },
    ]);
    const results = parseApiResponse(json, "Chat", 0);
    expect(results).toHaveLength(1);
  });
});
