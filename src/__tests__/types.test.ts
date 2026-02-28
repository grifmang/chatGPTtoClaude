import { describe, it, expect } from "vitest";
import type {
  ChatGPTContentText,
  ChatGPTContentCode,
  ChatGPTContentMultimodal,
  ChatGPTContentExecution,
  ChatGPTContent,
  ChatGPTAuthor,
  ChatGPTMessage,
  ChatGPTMappingNode,
  ChatGPTConversation,
  ParsedMessage,
  ParsedConversation,
  MemoryCategory,
  Confidence,
  CandidateStatus,
  MemoryCandidate,
} from "../types";

describe("Core types", () => {
  it("can construct a MemoryCandidate", () => {
    const candidate: MemoryCandidate = {
      id: "mem-1",
      text: "User prefers dark mode",
      category: "preference",
      confidence: "high",
      sourceTitle: "UI preferences chat",
      sourceTimestamp: 1700000000,
      status: "pending",
    };

    expect(candidate.id).toBe("mem-1");
    expect(candidate.text).toBe("User prefers dark mode");
    expect(candidate.category).toBe("preference");
    expect(candidate.confidence).toBe("high");
    expect(candidate.sourceTitle).toBe("UI preferences chat");
    expect(candidate.sourceTimestamp).toBe(1700000000);
    expect(candidate.status).toBe("pending");
  });

  it("can construct a ParsedConversation with messages", () => {
    const msg: ParsedMessage = {
      role: "user",
      text: "Hello",
      timestamp: 1700000000,
    };

    const conv: ParsedConversation = {
      id: "conv-1",
      title: "Test chat",
      model: "gpt-4",
      createdAt: 1700000000,
      gizmoId: null,
      messages: [msg],
    };

    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].role).toBe("user");
  });

  it("can construct ChatGPT content types", () => {
    const textContent: ChatGPTContentText = {
      content_type: "text",
      parts: ["Hello", null, "World"],
    };
    expect(textContent.content_type).toBe("text");
    expect(textContent.parts).toHaveLength(3);

    const codeContent: ChatGPTContentCode = {
      content_type: "code",
      language: "python",
      text: "print('hi')",
    };
    expect(codeContent.content_type).toBe("code");

    const multimodal: ChatGPTContentMultimodal = {
      content_type: "multimodal_text",
      parts: ["text", { type: "image" }],
    };
    expect(multimodal.content_type).toBe("multimodal_text");

    const execution: ChatGPTContentExecution = {
      content_type: "execution_output",
      text: "output here",
    };
    expect(execution.content_type).toBe("execution_output");

    // Union type works
    const contents: ChatGPTContent[] = [
      textContent,
      codeContent,
      multimodal,
      execution,
    ];
    expect(contents).toHaveLength(4);
  });

  it("can construct a ChatGPTConversation with mapping", () => {
    const author: ChatGPTAuthor = {
      role: "user",
      name: null,
      metadata: {},
    };

    const message: ChatGPTMessage = {
      id: "msg-1",
      author,
      create_time: 1700000000,
      content: { content_type: "text", parts: ["Hello"] },
      status: "finished_successfully",
      metadata: {},
    };

    const node: ChatGPTMappingNode = {
      id: "node-1",
      message,
      parent: null,
      children: [],
    };

    const conv: ChatGPTConversation = {
      title: "Test",
      create_time: 1700000000,
      update_time: 1700000001,
      mapping: { "node-1": node },
      current_node: "node-1",
      default_model_slug: "gpt-4",
      gizmo_id: null,
      id: "conv-1",
    };

    expect(conv.mapping["node-1"].message?.author.role).toBe("user");
  });

  it("supports all MemoryCategory values", () => {
    const categories: MemoryCategory[] = [
      "preference",
      "technical",
      "project",
      "identity",
      "theme",
    ];
    expect(categories).toHaveLength(5);
  });

  it("supports all Confidence values", () => {
    const levels: Confidence[] = ["high", "medium", "low"];
    expect(levels).toHaveLength(3);
  });

  it("supports all CandidateStatus values", () => {
    const statuses: CandidateStatus[] = ["pending", "approved", "rejected"];
    expect(statuses).toHaveLength(3);
  });
});
