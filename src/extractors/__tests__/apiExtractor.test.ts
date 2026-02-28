import {
  buildExtractionPrompt,
  parseApiResponse,
  extractWithApi,
} from "../apiExtractor";
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

// ─── extractWithApi ──────────────────────────────────────────────────────────

function makeConversation(
  id: string,
  title: string,
  createdAt = 1700000000,
): ParsedConversation {
  return {
    id,
    title,
    model: "gpt-4o",
    createdAt,
    gizmoId: null,
    messages: [
      { role: "user", text: `Message in ${title}`, timestamp: createdAt },
      {
        role: "assistant",
        text: `Reply in ${title}`,
        timestamp: createdAt + 1,
      },
    ],
  };
}

function makeApiJsonResponse(
  facts: { text: string; category: string; confidence: string }[],
) {
  return {
    ok: true,
    status: 200,
    text: async () => "",
    json: async () => ({
      content: [{ type: "text", text: JSON.stringify(facts) }],
    }),
  };
}

describe("extractWithApi", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("makes API call with correct URL, headers, and body", async () => {
    const conversations = [makeConversation("1", "Chat 1")];
    fetchMock.mockResolvedValueOnce(makeApiJsonResponse([]));

    await extractWithApi(conversations, "sk-test-key-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers["x-api-key"]).toBe("sk-test-key-123");
    expect(options.headers["anthropic-version"]).toBe("2023-06-01");
    expect(options.headers["anthropic-dangerous-direct-browser-access"]).toBe(
      "true",
    );

    const body = JSON.parse(options.body);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
    expect(body.max_tokens).toBe(4096);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toContain("Chat 1");
  });

  it("batches conversations correctly (5 per batch)", async () => {
    const conversations = Array.from({ length: 7 }, (_, i) =>
      makeConversation(String(i), `Chat ${i}`),
    );

    fetchMock.mockResolvedValue(makeApiJsonResponse([]));

    await extractWithApi(conversations, "sk-key");

    // 7 conversations => 2 batches (5 + 2)
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // First batch should contain conversations 0-4
    const body1 = JSON.parse(fetchMock.mock.calls[0][1].body);
    for (let i = 0; i < 5; i++) {
      expect(body1.messages[0].content).toContain(`Chat ${i}`);
    }
    expect(body1.messages[0].content).not.toContain("Chat 5");

    // Second batch should contain conversations 5-6
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body2.messages[0].content).toContain("Chat 5");
    expect(body2.messages[0].content).toContain("Chat 6");
  });

  it("calls onProgress callback with (current, total) for each batch", async () => {
    const conversations = Array.from({ length: 12 }, (_, i) =>
      makeConversation(String(i), `Chat ${i}`),
    );
    fetchMock.mockResolvedValue(makeApiJsonResponse([]));

    const onProgress = vi.fn();
    await extractWithApi(conversations, "sk-key", onProgress);

    // 12 conversations => 3 batches (5 + 5 + 2)
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it("returns MemoryCandidate[] from all batches combined", async () => {
    const conversations = Array.from({ length: 7 }, (_, i) =>
      makeConversation(String(i), `Chat ${i}`),
    );

    const batch1Facts = [
      { text: "Likes TypeScript", category: "preference", confidence: "high" },
      { text: "Uses React", category: "technical", confidence: "medium" },
    ];
    const batch2Facts = [
      {
        text: "Working on a CLI tool",
        category: "project",
        confidence: "high",
      },
    ];

    fetchMock
      .mockResolvedValueOnce(makeApiJsonResponse(batch1Facts))
      .mockResolvedValueOnce(makeApiJsonResponse(batch2Facts));

    const results = await extractWithApi(conversations, "sk-key");

    expect(results).toHaveLength(3);
    expect(results[0].text).toBe("Likes TypeScript");
    expect(results[0].category).toBe("preference");
    expect(results[0].status).toBe("pending");
    expect(results[1].text).toBe("Uses React");
    expect(results[2].text).toBe("Working on a CLI tool");
    expect(results[2].category).toBe("project");
  });

  it("handles single conversation (1 batch)", async () => {
    const conversations = [makeConversation("1", "Solo Chat", 1700000000)];
    const facts = [
      { text: "Prefers dark mode", category: "preference", confidence: "high" },
    ];
    fetchMock.mockResolvedValueOnce(makeApiJsonResponse(facts));

    const results = await extractWithApi(conversations, "sk-key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe("Prefers dark mode");
    // For single-conversation batches, sourceTitle should be the conversation title
    expect(results[0].sourceTitle).toBe("Solo Chat");
    expect(results[0].sourceTimestamp).toBe(1700000000);
  });

  it("handles exact multiple of BATCH_SIZE (10 conversations = 2 batches)", async () => {
    const conversations = Array.from({ length: 10 }, (_, i) =>
      makeConversation(String(i), `Chat ${i}`),
    );

    fetchMock.mockResolvedValue(makeApiJsonResponse([]));

    const onProgress = vi.fn();
    await extractWithApi(conversations, "sk-key", onProgress);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it("throws on API error (non-ok response)", async () => {
    const conversations = [makeConversation("1", "Chat")];
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
      json: async () => ({}),
    });

    await expect(
      extractWithApi(conversations, "sk-key"),
    ).rejects.toThrowError("Claude API error (429): Rate limit exceeded");
  });

  it("handles network error (fetch rejects)", async () => {
    const conversations = [makeConversation("1", "Chat")];
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      extractWithApi(conversations, "sk-key"),
    ).rejects.toThrowError("Failed to fetch");
  });

  it("handles malformed API response (invalid JSON in content)", async () => {
    const conversations = [makeConversation("1", "Chat")];
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        content: [{ type: "text", text: "this is not valid json at all" }],
      }),
    });

    // parseApiResponse returns [] for invalid JSON, so result should be empty
    const results = await extractWithApi(conversations, "sk-key");
    expect(results).toEqual([]);
  });

  it("returns empty candidates for empty conversations array", async () => {
    const results = await extractWithApi([], "sk-key");

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses batch title format for multi-conversation batches", async () => {
    const conversations = Array.from({ length: 3 }, (_, i) =>
      makeConversation(String(i), `Chat ${i}`, 1700000000 + i),
    );
    const facts = [
      { text: "Uses Vim", category: "technical", confidence: "medium" },
    ];
    fetchMock.mockResolvedValueOnce(makeApiJsonResponse(facts));

    const results = await extractWithApi(conversations, "sk-key");

    expect(results).toHaveLength(1);
    // Multi-conversation batch uses "batch N (M conversations)" format
    expect(results[0].sourceTitle).toBe("batch 1 (3 conversations)");
    // Timestamp comes from the first conversation in the batch
    expect(results[0].sourceTimestamp).toBe(1700000000);
  });

  it("does not call onProgress when callback is not provided", async () => {
    const conversations = [makeConversation("1", "Chat")];
    fetchMock.mockResolvedValueOnce(makeApiJsonResponse([]));

    // Should not throw even without onProgress
    await expect(
      extractWithApi(conversations, "sk-key"),
    ).resolves.toEqual([]);
  });

  it("stops processing batches when an API error occurs mid-way", async () => {
    const conversations = Array.from({ length: 7 }, (_, i) =>
      makeConversation(String(i), `Chat ${i}`),
    );

    fetchMock
      .mockResolvedValueOnce(
        makeApiJsonResponse([
          {
            text: "First batch fact",
            category: "preference",
            confidence: "high",
          },
        ]),
      )
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
        json: async () => ({}),
      });

    await expect(
      extractWithApi(conversations, "sk-key"),
    ).rejects.toThrowError("Claude API error (500)");

    // Only 2 calls made — the second failed so no third call
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
