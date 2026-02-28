import type {
  ChatGPTContent,
  ChatGPTConversation,
  ChatGPTMappingNode,
  ParsedConversation,
  ParsedMessage,
} from "../types";

/**
 * Flatten a ChatGPT content object into a plain text string.
 */
function flattenContent(content: ChatGPTContent): string {
  switch (content.content_type) {
    case "text":
      return content.parts
        .filter((p): p is string => typeof p === "string")
        .join("\n");

    case "code":
      return `\`\`\`${content.language}\n${content.text}\n\`\`\``;

    case "multimodal_text":
      return content.parts
        .filter((p): p is string => typeof p === "string")
        .join("\n");

    case "execution_output":
      return content.text;
  }
}

/**
 * Walk the conversation mapping tree from `current_node` back to the root,
 * reverse for chronological order, then filter and flatten into ParsedMessages.
 */
export function parseConversation(
  conv: ChatGPTConversation,
): ParsedConversation {
  // Handle conversations with no messages
  if (conv.current_node === null) {
    return {
      id: conv.id,
      title: conv.title,
      model: conv.default_model_slug,
      createdAt: conv.create_time,
      gizmoId: conv.gizmo_id,
      messages: [],
    };
  }

  // Walk from current_node up through parent links to collect the path
  const path: ChatGPTMappingNode[] = [];
  let nodeId: string | null = conv.current_node;

  while (nodeId !== null) {
    const node: ChatGPTMappingNode | undefined = conv.mapping[nodeId];
    if (!node) break;
    path.push(node);
    nodeId = node.parent;
  }

  // Reverse so we go root -> leaf (chronological order)
  path.reverse();

  // Convert nodes to ParsedMessages, filtering as we go
  const messages: ParsedMessage[] = [];

  for (const node of path) {
    // Skip sentinel nodes with null messages
    if (node.message === null) continue;

    const { author, content, create_time } = node.message;

    // Keep only user and assistant roles
    if (author.role !== "user" && author.role !== "assistant") continue;

    const text = flattenContent(content);

    // Skip messages with empty text after flattening
    if (text.trim() === "") continue;

    messages.push({
      role: author.role,
      text,
      timestamp: create_time,
    });
  }

  return {
    id: conv.id,
    title: conv.title,
    model: conv.default_model_slug,
    createdAt: conv.create_time,
    gizmoId: conv.gizmo_id,
    messages,
  };
}
