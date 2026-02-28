import type { Overlay } from "../overlay";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so we cannot reference variables
// declared at the top level. Instead, use vi.hoisted() to create them.
// ---------------------------------------------------------------------------

const { mockOverlay, createOverlayMock } = vi.hoisted(() => {
  const mockOverlay: Overlay = {
    setProgress: vi.fn(),
    setError: vi.fn(),
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

  it("fetches token and conversations when on chatgpt.com", async () => {
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

    // Mock window.open to return a mock window
    const mockAppWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;
    vi.stubGlobal("open", vi.fn(() => mockAppWindow));

    // Mock addEventListener so we can simulate the "ready" handshake
    const originalAddEventListener = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation(
      (type: string, handler: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        if (type === "message") {
          // Simulate the app sending "ready" shortly after listening starts
          setTimeout(() => {
            const fn = typeof handler === "function" ? handler : handler.handleEvent.bind(handler);
            fn(new MessageEvent("message", {
              data: { type: "ready" },
              source: mockAppWindow,
            }));
          }, 10);
        }
        return originalAddEventListener(type, handler, options);
      },
    );

    const promise = run();
    // Advance timers to allow delays and the simulated "ready" message
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

    // Verify postMessage was called with conversations data
    expect(mockAppWindow.postMessage).toHaveBeenCalledWith(
      { type: "conversations", data: expect.any(Array) },
      "*",
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

    const mockAppWindow = { postMessage: vi.fn() } as unknown as Window;
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
            }));
          }, 10);
        }
        return originalAddEventListener(type, handler, options);
      },
    );

    const promise = run();
    await vi.advanceTimersByTimeAsync(15000);
    await promise;

    // Should not show error - should proceed with fetching
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
    vi.mocked(fetchConversation).mockResolvedValue({ id: "conv-1" });

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
      .mockRejectedValueOnce(new Error("Rate limited"))
      .mockResolvedValueOnce({ id: "conv-3", mapping: {} });

    const mockAppWindow = { postMessage: vi.fn() } as unknown as Window;
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
            }));
          }, 10);
        }
        return originalAddEventListener(type, handler, options);
      },
    );

    const promise = run();
    await vi.advanceTimersByTimeAsync(15000);
    await promise;

    // All three should have been attempted
    expect(fetchConversation).toHaveBeenCalledTimes(3);

    // Should still complete successfully (2 out of 3 succeeded)
    expect(mockOverlay.setDone).toHaveBeenCalled();

    // postMessage should have been called with the 2 successful conversations
    expect(mockAppWindow.postMessage).toHaveBeenCalledWith(
      {
        type: "conversations",
        data: expect.arrayContaining([
          expect.objectContaining({ id: "conv-1" }),
          expect.objectContaining({ id: "conv-3" }),
        ]),
      },
      "*",
    );
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
});
