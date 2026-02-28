import type {
  ParsedConversation,
  MemoryCandidate,
  MemoryCategory,
  Confidence,
} from "../types";

const VALID_CATEGORIES: Set<string> = new Set([
  "preference",
  "technical",
  "project",
  "identity",
  "theme",
]);

const VALID_CONFIDENCES: Set<string> = new Set(["high", "medium", "low"]);

let nextId = 0;

export function buildExtractionPrompt(
  conversations: ParsedConversation[],
): string {
  const conversationTexts = conversations.map((conv) => {
    const msgs = conv.messages
      .map((m) => `[${m.role}]: ${m.text}`)
      .join("\n");
    return `--- Conversation: "${conv.title}" ---\n${msgs}`;
  });

  return `Analyze these ChatGPT conversations and extract facts about the user that should be remembered. Focus on their preferences, technical profile, projects, identity, and recurring interests.

For each fact, output a JSON array of objects with these fields:
- "text": a concise statement about the user (e.g., "Prefers TypeScript over JavaScript")
- "category": one of "preference", "technical", "project", "identity", "theme"
- "confidence": one of "high", "medium", "low"

Only extract facts stated or strongly implied by the USER (not the assistant). Be concise. Deduplicate. Output only the JSON array, nothing else.

${conversationTexts.join("\n\n")}`;
}

export function parseApiResponse(
  response: string,
  sourceTitle: string,
  sourceTimestamp: number | null,
): MemoryCandidate[] {
  // Strip markdown code fences if present
  let cleaned = response.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const candidates: MemoryCandidate[] = [];
  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.text !== "string" ||
      !VALID_CATEGORIES.has(item.category) ||
      !VALID_CONFIDENCES.has(item.confidence)
    ) {
      continue;
    }
    candidates.push({
      id: `api-${nextId++}`,
      text: item.text,
      category: item.category as MemoryCategory,
      confidence: item.confidence as Confidence,
      sourceTitle,
      sourceTimestamp,
      status: "pending",
    });
  }

  return candidates;
}

type ProgressCallback = (current: number, total: number) => void;

export async function extractWithApi(
  conversations: ParsedConversation[],
  apiKey: string,
  onProgress?: ProgressCallback,
): Promise<MemoryCandidate[]> {
  const BATCH_SIZE = 5;
  const batches: ParsedConversation[][] = [];

  for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
    batches.push(conversations.slice(i, i + BATCH_SIZE));
  }

  const allCandidates: MemoryCandidate[] = [];

  for (let i = 0; i < batches.length; i++) {
    onProgress?.(i + 1, batches.length);

    const prompt = buildExtractionPrompt(batches[i]);
    const batchTitle =
      batches[i].length === 1
        ? batches[i][0].title
        : `batch ${i + 1} (${batches[i].length} conversations)`;
    const batchTimestamp = batches[i][0].createdAt;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude API error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();
    const text =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";
    const candidates = parseApiResponse(text, batchTitle, batchTimestamp);
    allCandidates.push(...candidates);
  }

  return allCandidates;
}
