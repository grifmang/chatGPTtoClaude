import JSZip from "jszip";
import type { ChatGPTConversation } from "../types";

/**
 * Extract conversations from a ChatGPT export ZIP file.
 *
 * Expects `conversations.json` at the root of the archive.
 * Throws if the file is not found.
 */
export async function extractConversations(
  file: File,
): Promise<ChatGPTConversation[]> {
  const zip = await JSZip.loadAsync(file);

  const entry = zip.file("conversations.json");
  if (!entry) {
    throw new Error("conversations.json not found in ZIP archive");
  }

  const text = await entry.async("text");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("conversations.json contains invalid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("conversations.json must contain a JSON array");
  }
  return parsed as ChatGPTConversation[];
}
