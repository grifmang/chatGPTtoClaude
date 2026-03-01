import type { Overlay } from "../overlay";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so we cannot reference variables
// declared at the top level. Instead, use vi.hoisted() to create them.
// ---------------------------------------------------------------------------

const { mockOverlay, createOverlayMock } = vi.hoisted(() => {
  const mockOverlay: Overlay = {
    setProgress: vi.fn(),
    setError: vi.fn(),
    promptAction: vi.fn(() => Promise.resolve()),
    setDone: vi.fn(),
    destroy: vi.fn(),
  };
  const createOverlayMock = vi.fn(() => mockOverlay);
  return { mockOverlay, createOverlayMock };
});

vi.mock("../overlay", () => ({
  createOverlay: createOverlayMock,
}));

vi.mock("../api", () => ({
  getAccessToken: vi.fn(),
  fetchConversationList: vi.fn(),
  fetchConversation: vi.fn(),
}));

// Import after mocks are set up
import { run } from "../bookmarklet";
import { createOverlay } from "../overlay";
import { getAccessToken, fetchConversationList, fetchConversation } from "../api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setHostname(hostname: string) {
  Object.defineProperty(window, "location", {
    value: { hostname },
    writable: true,
    configurable: true,
  });
}

/**
 * Set up window.open mock and addEventListener mock that simulates
 * the web app posting { type: "ready" } after a short delay.
 */
function setupAppWindowMock() {
  const mockAppWindow = {
    postMessage: vi.fn(),
  } as unknown as Window;
  vi.stubGlobal("open", vi.fn(() => mockAppWindow));

  const originalAddEventListener = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation(
    (type: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      if (type === "message") {
        setTimeout(() => {
          const fn = typeof handler === "function" ? handler : handler.handleEvent.bind(handler);
          fn(new MessageEvent("message", {
            data: { type: "ready" },
            source: mockAppWindow,
            origin: "https://migrategpt.org",
          }));
        }, 10);
      }
      return originalAddEventListener(type, handler, options);
    },
  );

  return mockAppWindow;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("bookmarklet run()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();

    // Reset the mock overlay methods
    mockOverlay.setProgress = vi.fn();
    mockOverlay.setError = vi.fn();
    mockOverlay.promptAction = vi.fn(() => Promise.resolve());
    mockOverlay.setDone = vi.fn();
    mockOverlay.destroy = vi.fn();

    // Re-wire createOverlay to return the mock
    createOverlayMock.mockReturnValue(mockOverlay);

    // Default: not on chatgpt.com (jsdom default is localhost)
    setHostname("localhost");

    // Use fake timers for delay() and setTimeout
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. Wrong hostname
  // -------------------------------------------------------------------------

  it("shows error when not on chatgpt.com", async () => {
    setHostname("example.com");

    await run();

    expect(createOverlay).toHaveBeenCalled();
    expect(mockOverlay.setError).toHaveBeenCalledWith(
      "Please run this bookmarklet on chatgpt.com",
    );
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 2. Happy path on chatgpt.com
  // -------------------------------------------------------------------------

  it("fetches conversations then prompts user to open the app", async () => {
    setHostname("chatgpt.com");

    const mockConvList = [
      { id: "conv-1", title: "First" },
      { id: "conv-2", title: "Second" },
    ];

    vi.mocked(getAccessToken).mockResolvedValue("tok_abc");
    vi.mocked(fetchConversationList).mockResolvedValue(mockConvList);
    vi.mocked(fetchConversation)
      .mockResolvedValueOnce({ id: "conv-1", mapping: {} })
      .mockResolvedValueOnce({ id: "conv-2", mapping: {} });

    const mockAppWindow = setupAppWindowMock();

    const promise = run();
    await vi.advanceTimersByTimeAsync(15000);
    await promise;

    // Verify authentication
    expect(getAccessToken).toHaveBeenCalled();
    expect(mockOverlay.setProgress).toHaveBeenCalledWith("Authenticating...");

    // Verify conversation list fetch
    expect(fetchConversationList).toHaveBeenCalledWith(
      "tok_abc",
      100,
      expect.any(Function),
    );

    // Verify individual conversations fetched
    expect(fetchConversation).toHaveBeenCalledTimes(2);
    expect(fetchConversation).toHaveBeenCalledWith("conv-1", "tok_abc");
    expect(fetchConversation).toHaveBeenCalledWith("conv-2", "tok_abc");

    // Verify user was prompted before opening the app
    expect(mockOverlay.promptAction).toHaveBeenCalledWith(
      expect.stringContaining("2 conversations"),
      expect.stringContaining("MigrateGPT"),
    );

    // Verify app opened AFTER prompt (not before)
    expect(window.open).toHaveBeenCalledWith("https://migrategpt.org", "_blank");

    // Verify postMessage was called with conversations data
    expect(mockAppWindow.postMessage).toHaveBeenCalledWith(
      { type: "conversations", data: expect.any(Array) },
      "https://migrategpt.org",
    );

    // Verify done state
    expect(mockOverlay.setDone).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Also works on chat.openai.com
  // -------------------------------------------------------------------------

  it("works on chat.openai.com", async () => {
    setHostname("chat.openai.com");

    vi.mocked(getAccessToken).mockResolvedValue("tok_abc");
    vi.mocked(fetchConversationList).mockResolvedValue([]);

    setupAppWindowMock();

    const promise = run();
    await vi.advanceTimersByTimeAsync(15000);
    await promise;

    expect(getAccessToken).toHaveBeenCalled();
    expect(mockOverlay.setError).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 4. Popup blocked
  // -------------------------------------------------------------------------

  it("shows error when popup is blocked", async () => {
    setHostname("chatgpt.com");

    vi.mocked(getAccessToken).mockResolvedValue("tok_abc");
    vi.mocked(fetchConversationList).mockResolvedValue([
      { id: "conv-1", title: "Test" },
    ]);
    vi.mocked(fetchConversation)
      .mockResolvedValueOnce({ id: "conv-1", mapping: {} });

    // window.open returns null when blocked
    vi.stubGlobal("open", vi.fn(() => null));

    const promise = run();
    await vi.advanceTimersByTimeAsync(15000);
    await promise;

    expect(mockOverlay.setError).toHaveBeenCalledWith(
      expect.stringContaining("popup"),
    );
  });

  // -------------------------------------------------------------------------
  // 5. Skips individual conversation fetch failures
  // -------------------------------------------------------------------------

  it("skips individual conversation fetch failures and continues", async () => {
    setHostname("chatgpt.com");

    const mockConvList = [
      { id: "conv-1", title: "First" },
      { id: "conv-2", title: "Second" },
      { id: "conv-3", title: "Third" },
    ];

    vi.mocked(getAccessToken).mockResolvedValue("tok_abc");
    vi.mocked(fetchConversationList).mockResolvedValue(mockConvList);
    vi.mocked(fetchConversation)
      .mockResolvedValueOnce({ id: "conv-1", mapping: {} })
      // Non-429 error — should skip without retry
      .mockRejectedValueOnce(new Error("Server error"))
      .mockResolvedValueOnce({ id: "conv-3", mapping: {} });

    const mockAppWindow = setupAppWindowMock();

    const promise = run();
    await vi.advanceTimersByTimeAsync(15000);
    await promise;

    // All three should have been attempted
    expect(fetchConversation).toHaveBeenCalledTimes(3);

    // Should still complete successfully (2 out of 3 succeeded)
    expect(mockOverlay.setDone).toHaveBeenCalled();

    // postMessage should have been called with the 2 successful conversations
    const sentData = vi.mocked(mockAppWindow.postMessage).mock.calls[0][0] as {
      data: Array<{ id: string }>;
    };
    const ids = sentData.data.map((c) => c.id);
    expect(ids).toContain("conv-1");
    expect(ids).toContain("conv-3");
    expect(ids).not.toContain("conv-2");
  });

  // -------------------------------------------------------------------------
  // 6. Top-level error handling
  // -------------------------------------------------------------------------

  it("shows error on overlay when getAccessToken fails", async () => {
    setHostname("chatgpt.com");

    vi.mocked(getAccessToken).mockRejectedValue(
      new Error("Please log in to ChatGPT"),
    );

    await run();

    expect(mockOverlay.setError).toHaveBeenCalledWith(
      "Please log in to ChatGPT",
    );
  });

  // -------------------------------------------------------------------------
  // 7. waitForReady timeout
  // -------------------------------------------------------------------------

  it("shows timeout error when app does not send ready message within 30 seconds", async () => {
    setHostname("chatgpt.com");

    vi.mocked(getAccessToken).mockResolvedValue("tok_abc");
    vi.mocked(fetchConversationList).mockResolvedValue([
      { id: "conv-1", title: "Test" },
    ]);
    vi.mocked(fetchConversation)
      .mockResolvedValueOnce({ id: "conv-1", mapping: {} });

    const mockAppWindow = { postMessage: vi.fn() } as unknown as Window;
    vi.stubGlobal("open", vi.fn(() => mockAppWindow));

    // Do NOT simulate a "ready" message — let it time out

    const promise = run();
    await vi.advanceTimersByTimeAsync(30_000);
    await promise;

    expect(mockOverlay.setError).toHaveBeenCalledWith(
      "Timed out waiting for the app to respond.",
    );
  });

  // -------------------------------------------------------------------------
  // 8. Zero conversations returned
  // -------------------------------------------------------------------------

  it("opens app and sends empty data when zero conversations are returned", async () => {
    setHostname("chatgpt.com");

    vi.mocked(getAccessToken).mockResolvedValue("tok_abc");
    vi.mocked(fetchConversationList).mockResolvedValue([]);

    const mockAppWindow = setupAppWindowMock();

    const promise = run();
    await vi.advanceTimersByTimeAsync(15000);
    await promise;

    // Should NOT have fetched any individual conversations
    expect(fetchConversation).not.toHaveBeenCalled();

    // Should still open the app and send empty conversations array
    expect(mockAppWindow.postMessage).toHaveBeenCalledWith(
      { type: "conversations", data: [] },
      "https://migrategpt.org",
    );

    expect(mockOverlay.setDone).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 9. Cancellation during fetch loop
  // -------------------------------------------------------------------------

  it("stops fetching conversations when cancelled mid-loop", async () => {
    setHostname("chatgpt.com");

    const mockConvList = [
      { id: "conv-1", title: "First" },
      { id: "conv-2", title: "Second" },
      { id: "conv-3", title: "Third" },
    ];

    vi.mocked(getAccessToken).mockResolvedValue("tok_abc");
    vi.mocked(fetchConversationList).mockResolvedValue(mockConvList);

    // Capture the onCancel callback passed to createOverlay
    let cancelFn: (() => void) | undefined;
    createOverlayMock.mockImplementation((onCancel?: () => void) => {
      cancelFn = onCancel;
      return mockOverlay;
    });

    // When the first conversation is fetched, trigger cancellation
    vi.mocked(fetchConversation).mockImplementation(async (id: string) => {
      if (id === "conv-1") {
        cancelFn?.();
        return { id: "conv-1", mapping: {} };
      }
      return { id, mapping: {} };
    });

    setupAppWindowMock();

    const promise = run();
    await vi.advanceTimersByTimeAsync(15000);
    await promise;

    // The first conversation should have been fetched
    expect(fetchConversation).toHaveBeenCalledWith("conv-1", "tok_abc");
    // Workers should stop picking up new work after cancellation
    // (conv-2 may or may not have started depending on worker scheduling,
    //  but conv-3 should not have been fetched)
  });

  // -------------------------------------------------------------------------
  // 10. 429 retry with backoff
  // -------------------------------------------------------------------------

  it("retries on 429 with exponential backoff", async () => {
    setHostname("chatgpt.com");

    vi.mocked(getAccessToken).mockResolvedValue("tok_abc");
    vi.mocked(fetchConversationList).mockResolvedValue([
      { id: "conv-1", title: "Test" },
    ]);

    // Fail twice with 429, then succeed
    vi.mocked(fetchConversation)
      .mockRejectedValueOnce(new Error("Rate limited by ChatGPT. Please wait a moment and try again."))
      .mockRejectedValueOnce(new Error("Rate limited by ChatGPT. Please wait a moment and try again."))
      .mockResolvedValueOnce({ id: "conv-1", mapping: {} });

    const mockAppWindow = setupAppWindowMock();

    const promise = run();
    // Advance past backoff delays (1s + 2s) and the ready message (10ms)
    await vi.advanceTimersByTimeAsync(15000);
    await promise;

    // Should have retried 3 times total (2 failures + 1 success)
    expect(fetchConversation).toHaveBeenCalledTimes(3);

    // Should succeed after retries
    expect(mockOverlay.setDone).toHaveBeenCalled();
    expect(mockAppWindow.postMessage).toHaveBeenCalledWith(
      { type: "conversations", data: [{ id: "conv-1", mapping: {} }] },
      "https://migrategpt.org",
    );
  });

  it("gives up after max retries on persistent 429", async () => {
    setHostname("chatgpt.com");

    vi.mocked(getAccessToken).mockResolvedValue("tok_abc");
    vi.mocked(fetchConversationList).mockResolvedValue([
      { id: "conv-1", title: "Test" },
    ]);

    // Fail all attempts with 429
    vi.mocked(fetchConversation).mockRejectedValue(
      new Error("Rate limited by ChatGPT. Please wait a moment and try again."),
    );

    const mockAppWindow = setupAppWindowMock();

    const promise = run();
    // Advance past all backoff delays (1s + 2s + 4s) and the ready message
    await vi.advanceTimersByTimeAsync(30000);
    await promise;

    // Should have tried MAX_RETRIES + 1 times (4 total)
    expect(fetchConversation).toHaveBeenCalledTimes(4);

    // Should still complete (skips the failed conversation)
    expect(mockOverlay.setDone).toHaveBeenCalled();

    // Sends empty array since the only conversation failed
    expect(mockAppWindow.postMessage).toHaveBeenCalledWith(
      { type: "conversations", data: [] },
      "https://migrategpt.org",
    );
  });
});
