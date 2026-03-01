import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App";
import { extractConversations } from "../../parser/zipParser";
import { parseConversation } from "../../parser/conversationParser";
import { extractAllMemories } from "../../extractors";
import type {
  ChatGPTConversation,
  ParsedConversation,
  MemoryCandidate,
} from "../../types";

// Mock the heavy dependencies to keep App tests fast and focused
vi.mock("../../parser/zipParser", () => ({
  extractConversations: vi.fn(),
}));

vi.mock("../../parser/conversationParser", () => ({
  parseConversation: vi.fn(),
}));

vi.mock("../../extractors", () => ({
  extractAllMemories: vi.fn(),
}));

vi.mock("../../extractors/apiExtractor", () => ({
  extractWithApi: vi.fn(),
}));

describe("App", () => {
  it("renders upload page initially", () => {
    render(<App />);

    expect(
      screen.getByText("Migrate your ChatGPT memories to Claude"),
    ).toBeInTheDocument();
  });

  it("shows the app title on the upload page", () => {
    render(<App />);

    expect(
      screen.getByText("Migrate your ChatGPT memories to Claude"),
    ).toBeInTheDocument();
  });

  it("renders the wizard stepper initially", () => {
    render(<App />);

    expect(screen.getByText("Get your data")).toBeInTheDocument();
    expect(screen.getByText("Download export")).toBeInTheDocument();
    expect(screen.getByText("Upload & extract")).toBeInTheDocument();
  });

  it("starts on step 1 with ChatGPT export instructions", () => {
    render(<App />);

    expect(
      screen.getByRole("link", { name: /open chatgpt data controls/i }),
    ).toBeInTheDocument();
  });
});

// ─── Integration tests: state transitions, error handling, ready signal ──────

const FAKE_CONVERSATION: ChatGPTConversation = {
  id: "conv-1",
  title: "Test Conversation",
  create_time: 1700000000,
  update_time: 1700000000,
  mapping: {},
  current_node: null,
  default_model_slug: null,
  gizmo_id: null,
};

const FAKE_PARSED: ParsedConversation = {
  id: "conv-1",
  title: "Test Conversation",
  model: null,
  createdAt: 1700000000,
  gizmoId: null,
  messages: [
    { role: "user", text: "Hello", timestamp: 1700000000 },
    { role: "assistant", text: "Hi there!", timestamp: 1700000001 },
  ],
};

const FAKE_MEMORY: MemoryCandidate = {
  id: "mem-1",
  text: "User prefers TypeScript",
  category: "technical",
  confidence: "high",
  sourceTitle: "Test Conversation",
  sourceTimestamp: 1700000000,
  status: "pending",
};

describe("App integration – state transitions and error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("transitions from Upload to Review after successful file processing", async () => {
    // Arrange: mock the pipeline to return test data
    vi.mocked(extractConversations).mockResolvedValue([FAKE_CONVERSATION]);
    vi.mocked(parseConversation).mockReturnValue(FAKE_PARSED);
    vi.mocked(extractAllMemories).mockReturnValue([FAKE_MEMORY]);

    const user = userEvent.setup();
    render(<App />);

    // Verify we start on the upload page
    expect(screen.getByText("Migrate your ChatGPT memories to Claude")).toBeInTheDocument();

    // Navigate to the upload step (step 2) to reveal the file input
    await user.click(screen.getByText("I already have my ZIP file"));

    // Create a fake ZIP file and upload it
    const fakeFile = new File(["fake-zip-content"], "export.zip", {
      type: "application/zip",
    });
    const fileInput = screen.getByTestId("file-input");
    await user.upload(fileInput, fakeFile);

    // Wait for the pipeline to complete and the Review page to appear
    await waitFor(() => {
      expect(screen.getByText("Review Extracted Memories")).toBeInTheDocument();
    });

    // Verify the pipeline was called correctly
    expect(extractConversations).toHaveBeenCalledWith(fakeFile);
    // parseConversation is called via .map(), so it receives (element, index, array)
    expect(parseConversation).toHaveBeenCalledTimes(1);
    expect(vi.mocked(parseConversation).mock.calls[0][0]).toEqual(FAKE_CONVERSATION);
    expect(extractAllMemories).toHaveBeenCalledWith([FAKE_PARSED]);

    // Smart defaults auto-approve high-confidence memories, so they are hidden
    // in the pending-only view. Click "Show all" to reveal them.
    await user.click(screen.getByRole("button", { name: /show all/i }));

    // Verify the memory candidate is displayed
    expect(screen.getByText("User prefers TypeScript")).toBeInTheDocument();
  });

  it("applies smart defaults: high=approved, medium=pending, low=rejected", async () => {
    const highMemory: MemoryCandidate = {
      id: "high-1",
      text: "High confidence fact",
      category: "technical",
      confidence: "high",
      sourceTitle: "Test",
      sourceTimestamp: 1700000000,
      status: "pending",
    };
    const mediumMemory: MemoryCandidate = {
      id: "med-1",
      text: "Medium confidence fact",
      category: "technical",
      confidence: "medium",
      sourceTitle: "Test",
      sourceTimestamp: 1700000000,
      status: "pending",
    };
    const lowMemory: MemoryCandidate = {
      id: "low-1",
      text: "Low confidence fact",
      category: "technical",
      confidence: "low",
      sourceTitle: "Test",
      sourceTimestamp: 1700000000,
      status: "pending",
    };

    vi.mocked(extractConversations).mockResolvedValue([FAKE_CONVERSATION]);
    vi.mocked(parseConversation).mockReturnValue(FAKE_PARSED);
    vi.mocked(extractAllMemories).mockReturnValue([
      highMemory,
      mediumMemory,
      lowMemory,
    ]);

    const user = userEvent.setup();
    render(<App />);

    // Navigate to upload step and upload a file
    await user.click(screen.getByText("I already have my ZIP file"));
    const fakeFile = new File(["content"], "export.zip", {
      type: "application/zip",
    });
    await user.upload(screen.getByTestId("file-input"), fakeFile);

    // Wait for review page
    await waitFor(() => {
      expect(screen.getByText("Review Extracted Memories")).toBeInTheDocument();
    });

    // In pending-only view, only medium-confidence (still pending) should be visible
    expect(screen.getByText("Medium confidence fact")).toBeInTheDocument();
    expect(screen.queryByText("High confidence fact")).not.toBeInTheDocument();
    expect(screen.queryByText("Low confidence fact")).not.toBeInTheDocument();

    // Counter should show 2 of 3 reviewed (high=approved, low=rejected), 1 approved
    expect(screen.getByText(/2 of 3 reviewed/)).toBeInTheDocument();
    expect(screen.getByText(/1 approved/)).toBeInTheDocument();

    // Toggle to show all and verify all three are visible
    await user.click(screen.getByRole("button", { name: /show all/i }));
    expect(screen.getByText("High confidence fact")).toBeInTheDocument();
    expect(screen.getByText("Medium confidence fact")).toBeInTheDocument();
    expect(screen.getByText("Low confidence fact")).toBeInTheDocument();
  });

  it("shows error message when extractConversations throws (corrupted ZIP)", async () => {
    // Arrange: extractConversations rejects with an error
    vi.mocked(extractConversations).mockRejectedValue(
      new Error("Invalid ZIP file: unable to read archive"),
    );

    const user = userEvent.setup();
    render(<App />);

    // Navigate to upload step
    await user.click(screen.getByText("I already have my ZIP file"));

    // Upload a file
    const fakeFile = new File(["corrupt"], "bad.zip", {
      type: "application/zip",
    });
    const fileInput = screen.getByTestId("file-input");
    await user.upload(fileInput, fakeFile);

    // Wait for the error to appear on the upload page
    await waitFor(() => {
      expect(
        screen.getByText("Invalid ZIP file: unable to read archive"),
      ).toBeInTheDocument();
    });

    // Verify we are still on the upload page (not transitioned to review)
    expect(screen.getByText("Migrate your ChatGPT memories to Claude")).toBeInTheDocument();
  });

  it("shows error message when processConversations throws", async () => {
    // Arrange: extractConversations succeeds, but parseConversation throws
    vi.mocked(extractConversations).mockResolvedValue([FAKE_CONVERSATION]);
    vi.mocked(parseConversation).mockImplementation(() => {
      throw new Error("Failed to parse conversation data");
    });

    const user = userEvent.setup();
    render(<App />);

    // Navigate to upload step
    await user.click(screen.getByText("I already have my ZIP file"));

    // Upload a file
    const fakeFile = new File(["content"], "export.zip", {
      type: "application/zip",
    });
    const fileInput = screen.getByTestId("file-input");
    await user.upload(fileInput, fakeFile);

    // Wait for the error to appear
    await waitFor(() => {
      expect(
        screen.getByText("Failed to parse conversation data"),
      ).toBeInTheDocument();
    });

    // Verify we stay on the upload page
    expect(screen.getByText("Migrate your ChatGPT memories to Claude")).toBeInTheDocument();
  });
});

describe("App integration – ready signal via postMessage", () => {
  let originalOpener: typeof window.opener;

  beforeEach(() => {
    vi.clearAllMocks();
    originalOpener = window.opener;
  });

  afterEach(() => {
    // Restore original window.opener
    Object.defineProperty(window, "opener", {
      value: originalOpener,
      writable: true,
      configurable: true,
    });
  });

  it("posts { type: 'ready' } to window.opener for each allowed origin on mount", () => {
    const mockPostMessage = vi.fn();
    Object.defineProperty(window, "opener", {
      value: { postMessage: mockPostMessage },
      writable: true,
      configurable: true,
    });

    render(<App />);

    expect(mockPostMessage).toHaveBeenCalledWith(
      { type: "ready" },
      "https://chatgpt.com",
    );
    expect(mockPostMessage).toHaveBeenCalledWith(
      { type: "ready" },
      "https://chat.openai.com",
    );
    expect(mockPostMessage).toHaveBeenCalledTimes(2);
  });

  it("does not throw when window.opener is null", () => {
    Object.defineProperty(window, "opener", {
      value: null,
      writable: true,
      configurable: true,
    });

    // Rendering should not throw
    expect(() => render(<App />)).not.toThrow();
  });
});
