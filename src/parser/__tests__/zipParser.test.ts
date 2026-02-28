import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extractConversations } from "../zipParser";
import type { ChatGPTConversation } from "../../types";

/**
 * Helper: create a File object from a JSZip instance.
 */
async function zipToFile(zip: JSZip, filename = "export.zip"): Promise<File> {
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], filename, { type: "application/zip" });
}

describe("extractConversations", () => {
  it("extracts conversations from a valid ZIP containing conversations.json", async () => {
    const conversations: ChatGPTConversation[] = [
      {
        title: "Test Chat",
        create_time: 1700000000,
        update_time: 1700000001,
        mapping: {},
        current_node: "node-1",
        default_model_slug: "gpt-4",
        gizmo_id: null,
        id: "conv-1",
      },
    ];

    const zip = new JSZip();
    zip.file("conversations.json", JSON.stringify(conversations));

    const file = await zipToFile(zip);
    const result = await extractConversations(file);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test Chat");
    expect(result[0].id).toBe("conv-1");
    expect(result[0].default_model_slug).toBe("gpt-4");
  });

  it("throws when conversations.json is missing from the ZIP", async () => {
    const zip = new JSZip();
    zip.file("other-file.txt", "not what we need");

    const file = await zipToFile(zip);

    await expect(extractConversations(file)).rejects.toThrow(
      "conversations.json not found in ZIP archive",
    );
  });

  it("handles an empty conversations array", async () => {
    const zip = new JSZip();
    zip.file("conversations.json", "[]");

    const file = await zipToFile(zip);
    const result = await extractConversations(file);

    expect(result).toEqual([]);
  });

  it("handles conversations.json nested inside a folder", async () => {
    // ChatGPT exports sometimes put files at the root or inside a folder.
    // Our parser should look specifically for "conversations.json" at root.
    const zip = new JSZip();
    zip.file("subfolder/conversations.json", "[]");

    const file = await zipToFile(zip);

    await expect(extractConversations(file)).rejects.toThrow(
      "conversations.json not found in ZIP archive",
    );
  });
});
