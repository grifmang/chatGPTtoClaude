import { describe, it, expect } from "vitest";
import { parseConversation } from "../conversationParser";
import type {
  ChatGPTConversation,
  ChatGPTMappingNode,
  ChatGPTMessage,
  ChatGPTAuthor,
  ChatGPTContent,
} from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAuthor(
  role: ChatGPTAuthor["role"],
  name: string | null = null,
): ChatGPTAuthor {
  return { role, name, metadata: {} };
}

function makeMessage(
  id: string,
  author: ChatGPTAuthor,
  content: ChatGPTContent,
  createTime: number | null = null,
): ChatGPTMessage {
  return {
    id,
    author,
    create_time: createTime,
    content,
    status: "finished_successfully",
    metadata: {},
  };
}

function makeNode(
  id: string,
  message: ChatGPTMessage | null,
  parent: string | null,
  children: string[],
): ChatGPTMappingNode {
  return { id, message, parent, children };
}

function makeConversation(
  mapping: Record<string, ChatGPTMappingNode>,
  currentNode: string,
  overrides: Partial<ChatGPTConversation> = {},
): ChatGPTConversation {
  return {
    title: "Test Chat",
    create_time: 1700000000,
    update_time: 1700000001,
    mapping,
    current_node: currentNode,
    default_model_slug: "gpt-4",
    gizmo_id: null,
    id: "conv-1",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("parseConversation", () => {
  it("walks a basic tree and returns messages in chronological order", () => {
    // root (sentinel) -> user -> assistant
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: ["Hello!"] },
          1700000010,
        ),
        "root",
        ["asst-1"],
      ),
      "asst-1": makeNode(
        "asst-1",
        makeMessage(
          "asst-1",
          makeAuthor("assistant"),
          { content_type: "text", parts: ["Hi there!"] },
          1700000020,
        ),
        "user-1",
        [],
      ),
    };

    const conv = makeConversation(mapping, "asst-1");
    const result = parseConversation(conv);

    expect(result.id).toBe("conv-1");
    expect(result.title).toBe("Test Chat");
    expect(result.model).toBe("gpt-4");
    expect(result.createdAt).toBe(1700000000);
    expect(result.gizmoId).toBeNull();
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual({
      role: "user",
      text: "Hello!",
      timestamp: 1700000010,
    });
    expect(result.messages[1]).toEqual({
      role: "assistant",
      text: "Hi there!",
      timestamp: 1700000020,
    });
  });

  it("skips system and tool messages", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["sys-1"]),
      "sys-1": makeNode(
        "sys-1",
        makeMessage(
          "sys-1",
          makeAuthor("system"),
          { content_type: "text", parts: ["You are a helpful assistant."] },
        ),
        "root",
        ["user-1"],
      ),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: ["Run a tool for me"] },
          1700000010,
        ),
        "sys-1",
        ["tool-1"],
      ),
      "tool-1": makeNode(
        "tool-1",
        makeMessage(
          "tool-1",
          makeAuthor("tool"),
          { content_type: "text", parts: ["tool result"] },
        ),
        "user-1",
        ["asst-1"],
      ),
      "asst-1": makeNode(
        "asst-1",
        makeMessage(
          "asst-1",
          makeAuthor("assistant"),
          { content_type: "text", parts: ["Done!"] },
          1700000030,
        ),
        "tool-1",
        [],
      ),
    };

    const conv = makeConversation(mapping, "asst-1");
    const result = parseConversation(conv);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[1].role).toBe("assistant");
  });

  it("flattens code content into markdown fenced blocks", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["asst-1"]),
      "asst-1": makeNode(
        "asst-1",
        makeMessage(
          "asst-1",
          makeAuthor("assistant"),
          {
            content_type: "code",
            language: "python",
            text: "print('hello')",
          },
          1700000010,
        ),
        "root",
        [],
      ),
    };

    const conv = makeConversation(mapping, "asst-1");
    const result = parseConversation(conv);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].text).toBe(
      "```python\nprint('hello')\n```",
    );
  });

  it("extracts only string parts from multimodal_text content", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          {
            content_type: "multimodal_text",
            parts: [
              "Look at this image:",
              { content_type: "image_asset_pointer", asset_pointer: "file://..." },
              "What do you see?",
            ],
          },
          1700000010,
        ),
        "root",
        [],
      ),
    };

    const conv = makeConversation(mapping, "user-1");
    const result = parseConversation(conv);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].text).toBe(
      "Look at this image:\nWhat do you see?",
    );
  });

  it("uses text field from execution_output content", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["asst-1"]),
      "asst-1": makeNode(
        "asst-1",
        makeMessage(
          "asst-1",
          makeAuthor("assistant"),
          {
            content_type: "execution_output",
            text: "42\n",
          },
          1700000010,
        ),
        "root",
        [],
      ),
    };

    const conv = makeConversation(mapping, "asst-1");
    const result = parseConversation(conv);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].text).toBe("42\n");
  });

  it("handles sentinel root nodes with null messages", () => {
    // The root sentinel has message: null and should be skipped
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: ["Hi"] },
          1700000010,
        ),
        "root",
        [],
      ),
    };

    const conv = makeConversation(mapping, "user-1");
    const result = parseConversation(conv);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].text).toBe("Hi");
  });

  it("skips messages with empty text after flattening", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: [null, null] },
          1700000010,
        ),
        "root",
        ["asst-1"],
      ),
      "asst-1": makeNode(
        "asst-1",
        makeMessage(
          "asst-1",
          makeAuthor("assistant"),
          { content_type: "text", parts: ["Response"] },
          1700000020,
        ),
        "user-1",
        [],
      ),
    };

    const conv = makeConversation(mapping, "asst-1");
    const result = parseConversation(conv);

    // user message should be skipped (all null parts => empty text)
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("assistant");
  });

  it("joins multiple text parts with newline", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: ["Line 1", "Line 2", "Line 3"] },
          1700000010,
        ),
        "root",
        [],
      ),
    };

    const conv = makeConversation(mapping, "user-1");
    const result = parseConversation(conv);

    expect(result.messages[0].text).toBe("Line 1\nLine 2\nLine 3");
  });

  it("preserves gizmo_id from the conversation", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: ["Hi"] },
          1700000010,
        ),
        "root",
        [],
      ),
    };

    const conv = makeConversation(mapping, "user-1", {
      gizmo_id: "g-abc123",
    });
    const result = parseConversation(conv);

    expect(result.gizmoId).toBe("g-abc123");
  });

  it("handles null default_model_slug", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: ["Hi"] },
          1700000010,
        ),
        "root",
        [],
      ),
    };

    const conv = makeConversation(mapping, "user-1", {
      default_model_slug: null,
    });
    const result = parseConversation(conv);

    expect(result.model).toBeNull();
  });

  it("returns empty messages when current_node points to non-existent key", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: ["Hello"] },
          1700000010,
        ),
        "root",
        [],
      ),
    };

    const conv = makeConversation(mapping, "does-not-exist");
    const result = parseConversation(conv);

    expect(result.messages).toEqual([]);
  });

  it("returns partial messages when parent points to non-existent node", () => {
    // asst-1 -> user-1 -> missing-parent (chain breaks)
    const mapping: Record<string, ChatGPTMappingNode> = {
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: ["Hello"] },
          1700000010,
        ),
        "missing-parent",
        ["asst-1"],
      ),
      "asst-1": makeNode(
        "asst-1",
        makeMessage(
          "asst-1",
          makeAuthor("assistant"),
          { content_type: "text", parts: ["Hi there!"] },
          1700000020,
        ),
        "user-1",
        [],
      ),
    };

    const conv = makeConversation(mapping, "asst-1");
    const result = parseConversation(conv);

    // Walk goes: asst-1 -> user-1 -> missing-parent (break)
    // Reversed: user-1, asst-1
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[1].role).toBe("assistant");
  });

  it("skips message when all parts are null producing empty string", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: [null, null] },
          1700000010,
        ),
        "root",
        [],
      ),
    };

    const conv = makeConversation(mapping, "user-1");
    const result = parseConversation(conv);

    // All null parts produce empty string after filtering, so message is skipped
    expect(result.messages).toHaveLength(0);
  });

  it("skips messages with whitespace-only text", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: ["   \n  "] },
          1700000010,
        ),
        "root",
        ["asst-1"],
      ),
      "asst-1": makeNode(
        "asst-1",
        makeMessage(
          "asst-1",
          makeAuthor("assistant"),
          { content_type: "text", parts: ["Real response"] },
          1700000020,
        ),
        "user-1",
        [],
      ),
    };

    const conv = makeConversation(mapping, "asst-1");
    const result = parseConversation(conv);

    // Whitespace-only text trims to "", so the user message is skipped
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("assistant");
    expect(result.messages[0].text).toBe("Real response");
  });

  it("preserves create_time of 0 (not treated as null)", () => {
    const mapping: Record<string, ChatGPTMappingNode> = {
      root: makeNode("root", null, null, ["user-1"]),
      "user-1": makeNode(
        "user-1",
        makeMessage(
          "user-1",
          makeAuthor("user"),
          { content_type: "text", parts: ["Epoch message"] },
          0,
        ),
        "root",
        [],
      ),
    };

    const conv = makeConversation(mapping, "user-1");
    const result = parseConversation(conv);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].timestamp).toBe(0);
    // Ensure it's exactly 0 and not null or undefined
    expect(result.messages[0].timestamp).not.toBeNull();
    expect(result.messages[0].timestamp).not.toBeUndefined();
  });
});
