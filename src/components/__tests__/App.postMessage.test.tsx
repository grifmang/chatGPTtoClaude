import { act, render, screen, waitFor } from "@testing-library/react";
import App from "../../App";
import { parseConversation } from "../../parser/conversationParser";
import { extractAllMemories } from "../../extractors";

vi.mock("../../parser/zipParser", () => ({
  extractConversations: vi.fn(),
}));

vi.mock("../../parser/conversationParser", () => ({
  parseConversation: vi.fn(() => ({
    id: "conv-1",
    title: "Test",
    model: null,
    createdAt: 0,
    gizmoId: null,
    messages: [],
  })),
}));

vi.mock("../../extractors", () => ({
  extractAllMemories: vi.fn(() => []),
}));

vi.mock("../../extractors/apiExtractor", () => ({
  extractWithApi: vi.fn(),
}));

describe("App postMessage listener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes conversations received via postMessage", async () => {
    render(<App />);

    const conversation = {
      id: "conv-1",
      title: "Test Conversation",
      create_time: 1700000000,
      update_time: 1700000000,
      mapping: {},
      current_node: null,
      default_model_slug: null,
      gizmo_id: null,
    };

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "conversations", data: [conversation] },
        }),
      );
    });

    await waitFor(() => {
      expect(parseConversation).toHaveBeenCalled();
      expect(extractAllMemories).toHaveBeenCalled();
    });
  });

  it("ignores messages without correct type", async () => {
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "other" },
      }),
    );

    await waitFor(() => {
      expect(parseConversation).not.toHaveBeenCalled();
    });
  });

  it("ignores messages where data is not an array", async () => {
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "conversations", data: "not-array" },
      }),
    );

    await waitFor(() => {
      expect(parseConversation).not.toHaveBeenCalled();
    });
  });
});
