// ChatGPT Export Bookmarklet
// Extracts conversations from chatgpt.com and sends to the web app

import { getAccessToken, fetchConversationList, fetchConversation } from "./api";
import { createOverlay } from "./overlay";

const APP_URL = "https://chatgpt-to-claude.vercel.app";
const DELAY_MS = 100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a "ready" message from the app window.
 * Resolves when the app posts `{ type: "ready" }`, rejects after 30s.
 */
function waitForReady(appWindow: Window): Promise<void> {
  const expectedOrigin = new URL(APP_URL).origin;
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("Timed out waiting for the app to respond."));
    }, 30_000);

    function handler(event: MessageEvent) {
      if (
        event.source === appWindow &&
        event.origin === expectedOrigin &&
        event.data?.type === "ready"
      ) {
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve();
      }
    }

    window.addEventListener("message", handler);
  });
}

/**
 * Main bookmarklet flow. Exported for testing.
 */
export async function run(): Promise<void> {
  let cancelled = false;
  const overlay = createOverlay(() => {
    cancelled = true;
    overlay.destroy();
  });

  try {
    // 1. Check hostname
    const hostname = window.location.hostname;
    if (hostname !== "chatgpt.com" && hostname !== "chat.openai.com") {
      overlay.setError("Please run this bookmarklet on chatgpt.com");
      return;
    }

    // 2. Authenticate
    overlay.setProgress("Authenticating...");
    const token = await getAccessToken();

    // 3. Fetch conversation list
    overlay.setProgress("Fetching conversation list...");
    const convList = await fetchConversationList(token, 100, (fetched, total) => {
      overlay.setProgress(`Fetching conversation list... (${fetched}/${total})`);
    });

    // 4. Fetch each conversation with delay
    const conversations: unknown[] = [];
    for (let i = 0; i < convList.length; i++) {
      if (cancelled) break;
      overlay.setProgress(`Fetching conversation ${i + 1} of ${convList.length}...`);
      try {
        const conv = await fetchConversation(convList[i].id, token);
        conversations.push(conv);
      } catch {
        // Skip individual failures
        continue;
      }
      if (i < convList.length - 1) {
        await delay(DELAY_MS);
      }
    }

    // 5. Open the web app
    const appWindow = window.open(APP_URL, "_blank");
    if (!appWindow) {
      overlay.setError(
        "Could not open popup. Please allow popups for this site and try again.",
      );
      return;
    }

    // 6. Wait for "ready" handshake
    overlay.setProgress("Waiting for app to load...");
    await waitForReady(appWindow);

    // 7. Send conversations to the app
    appWindow.postMessage({ type: "conversations", data: conversations }, APP_URL);

    // 8. Done!
    overlay.setDone();
    setTimeout(() => overlay.destroy(), 3000);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    overlay.setError(message);
  }
}

// Auto-run when loaded as bookmarklet
run();
