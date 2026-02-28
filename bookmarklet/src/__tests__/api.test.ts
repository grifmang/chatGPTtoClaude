import { getAccessToken, fetchConversationList, fetchConversation } from "../api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

// ---------------------------------------------------------------------------
// getAccessToken
// ---------------------------------------------------------------------------

describe("getAccessToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the access token on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({ accessToken: "tok_abc123" }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const token = await getAccessToken();

    expect(token).toBe("tok_abc123");
    expect(mockFetch).toHaveBeenCalledWith("https://chatgpt.com/api/auth/session");
  });

  it("throws with a log-in message on 401", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    vi.stubGlobal("fetch", mockFetch);

    await expect(getAccessToken()).rejects.toThrow(/log in/i);
  });

  it("throws on other non-ok responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    vi.stubGlobal("fetch", mockFetch);

    await expect(getAccessToken()).rejects.toThrow();
  });

  it("throws when accessToken is missing from response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", mockFetch);

    await expect(getAccessToken()).rejects.toThrow(/session expired or invalid/i);
  });

  it("throws when accessToken is an empty string", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({ accessToken: "" }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(getAccessToken()).rejects.toThrow(/session expired or invalid/i);
  });

  it("throws when accessToken is a non-string value", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({ accessToken: 123 }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(getAccessToken()).rejects.toThrow(/session expired or invalid/i);
  });
});

// ---------------------------------------------------------------------------
// fetchConversationList
// ---------------------------------------------------------------------------

describe("fetchConversationList", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("paginates through multiple pages and collects all items", async () => {
    const page1 = {
      items: [
        { id: "conv-1", title: "First", create_time: 1000 },
        { id: "conv-2", title: "Second", create_time: 2000 },
      ],
      total: 4,
      offset: 0,
      limit: 2,
    };
    const page2 = {
      items: [
        { id: "conv-3", title: "Third", create_time: 3000 },
        { id: "conv-4", title: "Fourth", create_time: 4000 },
      ],
      total: 4,
      offset: 2,
      limit: 2,
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal("fetch", mockFetch);

    const items = await fetchConversationList("tok_abc", 2);

    expect(items).toHaveLength(4);
    expect(items[0]).toEqual({ id: "conv-1", title: "First", create_time: 1000 });
    expect(items[3]).toEqual({ id: "conv-4", title: "Fourth", create_time: 4000 });

    // Should have been called twice (two pages)
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify auth header on both calls
    for (const call of mockFetch.mock.calls) {
      expect(call[1]).toMatchObject({
        headers: { Authorization: "Bearer tok_abc" },
      });
    }

    // Verify correct offsets
    expect(mockFetch.mock.calls[0][0]).toContain("offset=0");
    expect(mockFetch.mock.calls[0][0]).toContain("limit=2");
    expect(mockFetch.mock.calls[1][0]).toContain("offset=2");
    expect(mockFetch.mock.calls[1][0]).toContain("limit=2");
  });

  it("calls onProgress callback for each page", async () => {
    const page1 = {
      items: [{ id: "conv-1", title: "A", create_time: 1 }],
      total: 2,
      offset: 0,
      limit: 1,
    };
    const page2 = {
      items: [{ id: "conv-2", title: "B", create_time: 2 }],
      total: 2,
      offset: 1,
      limit: 1,
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal("fetch", mockFetch);

    const onProgress = vi.fn();
    await fetchConversationList("tok_abc", 1, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(2);
    // First call: fetched 1 of 2
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    // Second call: fetched 2 of 2
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it("handles a single page (items fewer than total)", async () => {
    const page = {
      items: [{ id: "conv-1", title: "Only", create_time: 1 }],
      total: 1,
      offset: 0,
      limit: 20,
    };

    const mockFetch = vi.fn().mockResolvedValueOnce(jsonResponse(page));
    vi.stubGlobal("fetch", mockFetch);

    const items = await fetchConversationList("tok_abc");

    expect(items).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns empty array immediately when total is 0", async () => {
    const page = {
      items: [],
      total: 0,
      offset: 0,
      limit: 20,
    };

    const mockFetch = vi.fn().mockResolvedValueOnce(jsonResponse(page));
    vi.stubGlobal("fetch", mockFetch);

    const onProgress = vi.fn();
    const items = await fetchConversationList("tok_abc", 20, onProgress);

    expect(items).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // onProgress should still be called with (0, 0)
    expect(onProgress).toHaveBeenCalledWith(0, 0);
  });

  it("stops when server returns empty items array", async () => {
    const page1 = {
      items: [{ id: "conv-1", title: "A", create_time: 1 }],
      total: 10,
      offset: 0,
      limit: 1,
    };
    const page2 = {
      items: [],
      total: 10,
      offset: 1,
      limit: 1,
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal("fetch", mockFetch);

    const items = await fetchConversationList("tok_abc", 1);
    expect(items).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// fetchConversation
// ---------------------------------------------------------------------------

describe("fetchConversation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the conversation object on success", async () => {
    const conversation = {
      id: "conv-1",
      title: "My Chat",
      mapping: { node1: {} },
    };

    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(conversation));
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchConversation("conv-1", "tok_abc");

    expect(result).toEqual(conversation);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://chatgpt.com/backend-api/conversation/conv-1",
      { headers: { Authorization: "Bearer tok_abc" } },
    );
  });

  it("throws a specific error on 429 rate limit", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchConversation("conv-1", "tok_abc")).rejects.toThrow(
      /rate limit/i,
    );
  });

  it("throws on other non-ok responses", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchConversation("conv-1", "tok_abc")).rejects.toThrow();
  });

  it("throws when server returns non-JSON response (e.g. HTML error page)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token '<'")),
    } as unknown as Response);
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchConversation("conv-1", "tok_abc")).rejects.toThrow(SyntaxError);
  });

  it("propagates network errors when fetch rejects", async () => {
    const networkError = new TypeError("Failed to fetch");
    const mockFetch = vi.fn().mockRejectedValue(networkError);
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchConversation("conv-1", "tok_abc")).rejects.toThrow(TypeError);
    await expect(fetchConversation("conv-1", "tok_abc")).rejects.toThrow("Failed to fetch");
  });
});
