// ─── ChatGPT Export Types (input) ────────────────────────────────────────────

export type ChatGPTContentText = {
  content_type: "text";
  parts: (string | null)[];
};

export type ChatGPTContentCode = {
  content_type: "code";
  language: string;
  text: string;
};

export type ChatGPTContentMultimodal = {
  content_type: "multimodal_text";
  parts: unknown[];
};

export type ChatGPTContentExecution = {
  content_type: "execution_output";
  text: string;
};

export type ChatGPTContent =
  | ChatGPTContentText
  | ChatGPTContentCode
  | ChatGPTContentMultimodal
  | ChatGPTContentExecution;

export type ChatGPTAuthor = {
  role: "system" | "user" | "assistant" | "tool";
  name: string | null;
  metadata: Record<string, unknown>;
};

export type ChatGPTMessage = {
  id: string;
  author: ChatGPTAuthor;
  create_time: number | null;
  content: ChatGPTContent;
  status: string;
  metadata: Record<string, unknown>;
};

export type ChatGPTMappingNode = {
  id: string;
  message: ChatGPTMessage | null;
  parent: string | null;
  children: string[];
};

export type ChatGPTConversation = {
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, ChatGPTMappingNode>;
  current_node: string;
  default_model_slug: string | null;
  gizmo_id: string | null;
  id: string;
};

// ─── Parsed Types (internal) ─────────────────────────────────────────────────

export type ParsedMessage = {
  role: "user" | "assistant";
  text: string;
  timestamp: number | null;
};

export type ParsedConversation = {
  id: string;
  title: string;
  model: string | null;
  createdAt: number;
  gizmoId: string | null;
  messages: ParsedMessage[];
};

// ─── Memory Extraction Types (output) ────────────────────────────────────────

export type MemoryCategory =
  | "preference"
  | "technical"
  | "project"
  | "identity"
  | "theme";

export type Confidence = "high" | "medium" | "low";

export type CandidateStatus = "pending" | "approved" | "rejected";

export type MemoryCandidate = {
  id: string;
  text: string;
  category: MemoryCategory;
  confidence: Confidence;
  sourceTitle: string;
  sourceTimestamp: number | null;
  status: CandidateStatus;
};
