// ChatGPT Export Bookmarklet
// Extracts conversations from chatgpt.com and sends to the web app

import { getAccessToken, fetchConversationList, fetchConversation } from "./api";
import { createOverlay } from "./overlay";

const APP_URL = "https://migrategpt.org";
const CONCURRENCY = 5;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single conversation with retry and exponential backoff on 429.
 * Returns null if all retries are exhausted or a non-retryable error occurs.
 */
async function fetchWithRetry(
  id: string,
  token: string,
): Promise<unknown | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchConversation(id, token);
    } catch (err) {
      const is429 =
        err instanceof Error && err.message.includes("Rate limited");
      if (is429 && attempt < MAX_RETRIES) {
        await delay(BASE_BACKOFF_MS * 2 ** attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Fetch all conversations using a worker pool with bounded concurrency.
 */
async function fetchAllConcurrent(
  ids: string[],
  token: string,
  onProgress: (completed: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<unknown[]> {
  const results: unknown[] = [];
  let completed = 0;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < ids.length && !isCancelled()) {
      const i = nextIndex++;
      const result = await fetchWithRetry(ids[i], token);
      if (result !== null) {
        results.push(result);
      }
      completed++;
      onProgress(completed, ids.length);
    }
  }

  const workerCount = Math.min(CONCURRENCY, ids.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
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

    // 4. Date range selection
    const rangeValue = await overlay.promptChoice(
      `Found ${convList.length} conversations.`,
      [
        { label: "All time", value: "all" },
        { label: "Last 30 days", value: "30d" },
        { label: "Last 6 months", value: "6m" },
        { label: "Last year", value: "1y" },
      ],
    );

    // Filter by date range
    const now = Date.now() / 1000;
    const cutoffs: Record<string, number> = {
      all: 0,
      "30d": now - 30 * 86400,
      "6m": now - 182 * 86400,
      "1y": now - 365 * 86400,
    };
    const cutoff = cutoffs[rangeValue] ?? 0;
    const filteredList = cutoff > 0
      ? convList.filter((c) => (c.create_time ?? 0) >= cutoff)
      : convList;

    // 5. Count preview
    await overlay.promptAction(
      `Exporting ${filteredList.length} conversations.`,
      "Start export",
    );

    // 6. Fetch all conversations
    const ids = filteredList.map((c) => c.id);
    const conversations = await fetchAllConcurrent(ids, token, (done, total) => {
      overlay.setProgress(`Fetching conversations (${done}/${total})...`);
    }, () => cancelled);

    if (cancelled) return;

    // 7. Prompt user to open the app — their click is a fresh user gesture
    //    so popup blockers won't interfere and focus stays on chatgpt.com
    //    until the user is ready.
    await overlay.promptAction(
      `Exported ${conversations.length} conversations. Ready to continue.`,
      "Open MigrateGPT \u2192",
    );

    const appWindow = window.open(APP_URL, "_blank");
    if (!appWindow) {
      overlay.setError(
        "Could not open popup. Please allow popups for this site and try again.",
      );
      return;
    }

    // 8. Wait for the app to signal it's ready, then send data
    overlay.setProgress("Sending data to MigrateGPT...");
    await waitForReady(appWindow);
    appWindow.postMessage({ type: "conversations", data: conversations }, APP_URL);

    // 9. Done!
    overlay.setDone();
    setTimeout(() => overlay.destroy(), 3000);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    overlay.setError(message);
  }
}

// Auto-run when loaded as bookmarklet
run();
