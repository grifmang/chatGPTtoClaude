# ChatGPT Export Bookmarklet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a JavaScript bookmarklet that extracts ChatGPT conversations directly from chatgpt.com and sends them to the web app via postMessage, bypassing the slow ZIP export.

**Architecture:** Separate `bookmarklet/` folder with its own build script. The bookmarklet runs on chatgpt.com, fetches conversations via the internal API, opens the web app in a new tab, and sends data via postMessage handshake. The web app adds a message listener that accepts conversations directly, skipping the ZIP parser.

**Tech Stack:** TypeScript, esbuild (bundle to single IIFE), Vitest (bookmarklet unit tests), React (web app changes)

---

### Task 1: Scaffold bookmarklet folder and build tooling

**Files:**
- Create: `bookmarklet/package.json`
- Create: `bookmarklet/tsconfig.json`
- Create: `bookmarklet/build.ts`
- Create: `bookmarklet/src/bookmarklet.ts` (placeholder)

**Step 1: Create bookmarklet/package.json**

```json
{
  "name": "chatgpt-export-bookmarklet",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "build": "npx tsx build.ts",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "devDependencies": {
    "esbuild": "^0.25.0",
    "tsx": "^4.19.0",
    "typescript": "~5.9.3",
    "vitest": "^4.0.18"
  }
}
```

**Step 2: Create bookmarklet/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

**Step 3: Create bookmarklet/build.ts**

This script uses esbuild to bundle `src/bookmarklet.ts` into a single IIFE string, then wraps it as a `javascript:` URI and writes the result to `dist/bookmarklet.js`.

```typescript
import { build } from "esbuild";
import { mkdirSync, writeFileSync, readFileSync } from "fs";

async function main() {
  await build({
    entryPoints: ["src/bookmarklet.ts"],
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2022",
    outfile: "dist/bundle.js",
  });

  const bundle = readFileSync("dist/bundle.js", "utf-8").trim();
  const bookmarklet = `javascript:void(${encodeURIComponent(bundle)})`;
  writeFileSync("dist/bookmarklet.js", bookmarklet);

  console.log(`Bookmarklet built (${bookmarklet.length} chars)`);
}

main();
```

**Step 4: Create placeholder bookmarklet/src/bookmarklet.ts**

```typescript
// ChatGPT Export Bookmarklet
// Extracts conversations from chatgpt.com and sends to the web app
console.log("bookmarklet loaded");
```

**Step 5: Install dependencies and verify build**

Run: `cd bookmarklet && npm install && npm run build`
Expected: `dist/bookmarklet.js` created with a `javascript:void(...)` URI

**Step 6: Commit**

```bash
git add bookmarklet/
git commit -m "feat: scaffold bookmarklet folder with build tooling"
```

---

### Task 2: Implement bookmarklet auth and conversation fetching

**Files:**
- Create: `bookmarklet/src/api.ts`
- Create: `bookmarklet/src/__tests__/api.test.ts`
- Create: `bookmarklet/vitest.config.ts`

**Step 1: Create bookmarklet/vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 2: Write the failing tests for the API module**

Create `bookmarklet/src/__tests__/api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAccessToken, fetchConversationList, fetchConversation } from "../api";

describe("getAccessToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the access token from the session endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ accessToken: "test-token-123" }),
    }));

    const token = await getAccessToken();
    expect(token).toBe("test-token-123");
    expect(fetch).toHaveBeenCalledWith("https://chatgpt.com/api/auth/session");
  });

  it("throws when not logged in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }));

    await expect(getAccessToken()).rejects.toThrow(/log in/i);
  });
});

describe("fetchConversationList", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("paginates through all conversations", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          items: [{ id: "a" }, { id: "b" }],
          total: 3,
          offset: 0,
          limit: 2,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          items: [{ id: "c" }],
          total: 3,
          offset: 2,
          limit: 2,
        }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const items = await fetchConversationList("token", 2);
    expect(items).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("fetchConversation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches a single conversation by ID", async () => {
    const conv = { id: "abc", title: "Test", mapping: {} };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(conv),
    }));

    const result = await fetchConversation("abc", "token");
    expect(result).toEqual(conv);
    expect(fetch).toHaveBeenCalledWith(
      "https://chatgpt.com/backend-api/conversation/abc",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      })
    );
  });

  it("throws on 429 rate limit", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    }));

    await expect(fetchConversation("abc", "token")).rejects.toThrow(/rate/i);
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd bookmarklet && npx vitest run`
Expected: FAIL — `api` module does not exist

**Step 4: Implement the API module**

Create `bookmarklet/src/api.ts`:

```typescript
export async function getAccessToken(): Promise<string> {
  const res = await fetch("https://chatgpt.com/api/auth/session");
  if (!res.ok) {
    throw new Error("Not logged in to ChatGPT. Please log in and try again.");
  }
  const data = await res.json();
  return data.accessToken;
}

interface ConversationListItem {
  id: string;
  title?: string;
  create_time?: string;
}

interface ConversationListResponse {
  items: ConversationListItem[];
  total: number;
  offset: number;
  limit: number;
}

export async function fetchConversationList(
  token: string,
  pageSize = 100,
  onProgress?: (fetched: number, total: number) => void,
): Promise<ConversationListItem[]> {
  const all: ConversationListItem[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const res = await fetch(
      `https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${pageSize}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Failed to fetch conversation list (${res.status})`);

    const data: ConversationListResponse = await res.json();
    total = data.total;
    all.push(...data.items);
    offset += data.items.length;
    onProgress?.(all.length, total);

    if (data.items.length === 0) break;
  }

  return all;
}

export async function fetchConversation(
  id: string,
  token: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `https://chatgpt.com/backend-api/conversation/${id}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (res.status === 429) {
    throw new Error("Rate limited by ChatGPT. Please wait and try again.");
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch conversation ${id} (${res.status})`);
  }

  return res.json();
}
```

**Step 5: Run tests to verify they pass**

Run: `cd bookmarklet && npx vitest run`
Expected: All 5 tests PASS

**Step 6: Commit**

```bash
git add bookmarklet/src/api.ts bookmarklet/src/__tests__/api.test.ts bookmarklet/vitest.config.ts
git commit -m "feat: add bookmarklet API module for auth and conversation fetching"
```

---

### Task 3: Implement progress overlay UI

**Files:**
- Create: `bookmarklet/src/overlay.ts`
- Create: `bookmarklet/src/__tests__/overlay.test.ts`

**Step 1: Write failing tests for the overlay**

Create `bookmarklet/src/__tests__/overlay.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createOverlay } from "../overlay";

describe("createOverlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("injects a floating overlay into the DOM", () => {
    const overlay = createOverlay();
    expect(document.getElementById("cgpt-export-overlay")).toBeTruthy();
    overlay.destroy();
  });

  it("updates progress text", () => {
    const overlay = createOverlay();
    overlay.setProgress("Fetching conversation 3 of 10...");
    expect(document.getElementById("cgpt-export-overlay")!.textContent).toContain(
      "Fetching conversation 3 of 10..."
    );
    overlay.destroy();
  });

  it("shows error state", () => {
    const overlay = createOverlay();
    overlay.setError("Something went wrong");
    expect(document.getElementById("cgpt-export-overlay")!.textContent).toContain(
      "Something went wrong"
    );
    overlay.destroy();
  });

  it("shows done state", () => {
    const overlay = createOverlay();
    overlay.setDone();
    expect(document.getElementById("cgpt-export-overlay")!.textContent).toContain(
      "Done"
    );
    overlay.destroy();
  });

  it("removes the overlay from DOM on destroy", () => {
    const overlay = createOverlay();
    overlay.destroy();
    expect(document.getElementById("cgpt-export-overlay")).toBeNull();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    const overlay = createOverlay(onCancel);
    const cancelBtn = document.querySelector<HTMLButtonElement>("#cgpt-export-overlay button");
    cancelBtn?.click();
    expect(onCancel).toHaveBeenCalled();
    overlay.destroy();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd bookmarklet && npx vitest run`
Expected: FAIL — `overlay` module does not exist

**Step 3: Implement the overlay**

Create `bookmarklet/src/overlay.ts`:

```typescript
export interface Overlay {
  setProgress: (text: string) => void;
  setError: (text: string) => void;
  setDone: () => void;
  destroy: () => void;
}

export function createOverlay(onCancel?: () => void): Overlay {
  const container = document.createElement("div");
  container.id = "cgpt-export-overlay";
  Object.assign(container.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "99999",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#1e1e2e",
    borderRadius: "12px",
    padding: "2rem",
    maxWidth: "400px",
    width: "90%",
    textAlign: "center",
    color: "#ddd",
  });

  const title = document.createElement("h2");
  title.textContent = "Exporting ChatGPT Data";
  title.style.marginBottom = "1rem";

  const status = document.createElement("p");
  status.textContent = "Starting...";
  status.id = "cgpt-export-status";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  Object.assign(cancelBtn.style, {
    marginTop: "1rem",
    padding: "0.5rem 1rem",
    border: "1px solid #444",
    borderRadius: "8px",
    background: "#2a2a2a",
    color: "#ddd",
    cursor: "pointer",
  });
  cancelBtn.addEventListener("click", () => onCancel?.());

  card.appendChild(title);
  card.appendChild(status);
  card.appendChild(cancelBtn);
  container.appendChild(card);
  document.body.appendChild(container);

  return {
    setProgress(text: string) {
      status.textContent = text;
    },
    setError(text: string) {
      title.textContent = "Export Error";
      status.textContent = text;
      cancelBtn.textContent = "Close";
    },
    setDone() {
      title.textContent = "Done!";
      status.textContent = "Check the new tab to continue.";
      cancelBtn.textContent = "Close";
    },
    destroy() {
      container.remove();
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd bookmarklet && npx vitest run`
Expected: All overlay tests PASS

**Step 5: Commit**

```bash
git add bookmarklet/src/overlay.ts bookmarklet/src/__tests__/overlay.test.ts
git commit -m "feat: add bookmarklet progress overlay UI"
```

---

### Task 4: Implement bookmarklet main entry point

**Files:**
- Modify: `bookmarklet/src/bookmarklet.ts` (replace placeholder)
- Create: `bookmarklet/src/__tests__/bookmarklet.test.ts`

**Step 1: Write failing tests for the main entry point**

Create `bookmarklet/src/__tests__/bookmarklet.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { run } from "../bookmarklet";
import * as api from "../api";
import * as overlay from "../overlay";

vi.mock("../api");
vi.mock("../overlay");

describe("bookmarklet run()", () => {
  const mockOverlay = {
    setProgress: vi.fn(),
    setError: vi.fn(),
    setDone: vi.fn(),
    destroy: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(overlay.createOverlay).mockReturnValue(mockOverlay);
    vi.mocked(api.getAccessToken).mockResolvedValue("test-token");
    vi.mocked(api.fetchConversationList).mockResolvedValue([
      { id: "conv-1" },
      { id: "conv-2" },
    ]);
    vi.mocked(api.fetchConversation).mockResolvedValue({
      id: "conv-1",
      title: "Test",
      mapping: {},
      current_node: null,
    });
    // Mock window.open
    vi.stubGlobal("open", vi.fn().mockReturnValue({
      postMessage: vi.fn(),
    }));
  });

  it("checks hostname is chatgpt.com", async () => {
    // Default jsdom location is localhost
    await run();
    expect(mockOverlay.setError).toHaveBeenCalledWith(
      expect.stringContaining("chatgpt.com")
    );
  });

  it("fetches token and conversations when on chatgpt.com", async () => {
    Object.defineProperty(window, "location", {
      value: { hostname: "chatgpt.com" },
      writable: true,
    });

    await run();

    expect(api.getAccessToken).toHaveBeenCalled();
    expect(api.fetchConversationList).toHaveBeenCalledWith(
      "test-token",
      100,
      expect.any(Function),
    );
    expect(api.fetchConversation).toHaveBeenCalledTimes(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd bookmarklet && npx vitest run`
Expected: FAIL — `run` not exported from bookmarklet

**Step 3: Implement the main bookmarklet**

Replace `bookmarklet/src/bookmarklet.ts`:

```typescript
import { getAccessToken, fetchConversationList, fetchConversation } from "./api";
import { createOverlay } from "./overlay";

const APP_URL = "https://chatgpt-to-claude.vercel.app";
const DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run(): Promise<void> {
  const ui = createOverlay();

  try {
    // Verify we're on chatgpt.com
    if (
      window.location.hostname !== "chatgpt.com" &&
      window.location.hostname !== "chat.openai.com"
    ) {
      ui.setError("Please run this bookmarklet on chatgpt.com");
      return;
    }

    // Step 1: Get auth token
    ui.setProgress("Authenticating...");
    const token = await getAccessToken();

    // Step 2: Get conversation list
    ui.setProgress("Loading conversation list...");
    const list = await fetchConversationList(token, 100, (fetched, total) => {
      ui.setProgress(`Found ${fetched} of ${total} conversations...`);
    });

    // Step 3: Fetch each full conversation
    const conversations: Record<string, unknown>[] = [];
    let cancelled = false;

    const cancelOverlay = createOverlay(() => {
      cancelled = true;
    });
    // Replace the original overlay with one that has a working cancel
    ui.destroy();

    for (let i = 0; i < list.length; i++) {
      if (cancelled) break;

      cancelOverlay.setProgress(
        `Fetching conversation ${i + 1} of ${list.length}...`,
      );

      try {
        const conv = await fetchConversation(list[i].id, token);
        conversations.push(conv);
      } catch {
        // Skip individual failures, continue with remaining
      }

      if (i < list.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    if (cancelled) {
      cancelOverlay.setError("Export cancelled.");
      return;
    }

    // Step 4: Open app and send data via postMessage
    cancelOverlay.setProgress("Opening app...");
    const appWindow = window.open(APP_URL, "_blank");

    if (!appWindow) {
      cancelOverlay.setError(
        "Pop-up blocked. Please allow pop-ups for chatgpt.com and try again.",
      );
      return;
    }

    // Wait for "ready" handshake from the app
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("App did not respond. Please try again."));
      }, 30000);

      window.addEventListener("message", function handler(event) {
        if (event.data?.type === "ready") {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);

          appWindow.postMessage(
            { type: "conversations", data: conversations },
            APP_URL,
          );
          resolve();
        }
      });
    });

    cancelOverlay.setDone();
    setTimeout(() => cancelOverlay.destroy(), 3000);
  } catch (err) {
    ui.setError(err instanceof Error ? err.message : "An unexpected error occurred");
  }
}

// Auto-run when loaded as bookmarklet
run();
```

**Step 4: Run tests to verify they pass**

Run: `cd bookmarklet && npx vitest run`
Expected: All tests PASS

**Step 5: Build the bookmarklet**

Run: `cd bookmarklet && npm run build`
Expected: `dist/bookmarklet.js` created

**Step 6: Commit**

```bash
git add bookmarklet/src/bookmarklet.ts bookmarklet/src/__tests__/bookmarklet.test.ts
git commit -m "feat: implement bookmarklet main entry point with fetch + postMessage"
```

---

### Task 5: Add postMessage listener to the web app

**Files:**
- Modify: `src/App.tsx:1-99`
- Create: `src/components/__tests__/App.postMessage.test.tsx`

This task modifies the existing web app (parent `src/` folder, NOT `bookmarklet/`).

**Step 1: Write the failing test**

Create `src/components/__tests__/App.postMessage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("App - postMessage bookmarklet integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("processes conversations received via postMessage", async () => {
    render(<App />);

    // Simulate bookmarklet sending conversations
    const conversations = [
      {
        id: "conv-1",
        title: "Test",
        create_time: 0,
        update_time: 0,
        mapping: {},
        current_node: null,
        default_model_slug: null,
        gizmo_id: null,
      },
    ];

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "conversations", data: conversations },
      })
    );

    await waitFor(() => {
      expect(parseConversation).toHaveBeenCalledWith(conversations[0]);
      expect(extractAllMemories).toHaveBeenCalled();
    });
  });

  it("ignores messages without correct type", () => {
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", { data: { type: "other" } })
    );

    expect(parseConversation).not.toHaveBeenCalled();
  });

  it("ignores messages where data is not an array", () => {
    render(<App />);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "conversations", data: "not-array" },
      })
    );

    expect(parseConversation).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/App.postMessage.test.tsx`
Expected: FAIL — App does not handle postMessage

**Step 3: Modify App.tsx to handle postMessage**

Modify `src/App.tsx`. Add a `useEffect` with a message listener, and extract the shared processing logic:

```typescript
import { useState, useEffect, useCallback } from "react";
import type { ChatGPTConversation, MemoryCandidate } from "./types";
import { extractConversations } from "./parser/zipParser";
import { parseConversation } from "./parser/conversationParser";
import { extractAllMemories } from "./extractors";
import { extractWithApi } from "./extractors/apiExtractor";
import { exportToMarkdown } from "./export/markdownExport";
import { UploadPage } from "./components/UploadPage";
import { ReviewPage } from "./components/ReviewPage";
import { ExportModal } from "./components/ExportModal";
import "./App.css";

type AppState = "upload" | "review" | "export";

function App() {
  const [state, setState] = useState<AppState>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [exportMarkdown, setExportMarkdown] = useState("");
  const [progress, setProgress] = useState("");

  const processConversations = useCallback(
    async (rawConversations: ChatGPTConversation[], apiKey?: string) => {
      setIsProcessing(true);
      setError(undefined);
      setProgress("");

      try {
        const parsed = rawConversations.map(parseConversation);

        let memories: MemoryCandidate[];

        if (apiKey) {
          memories = await extractWithApi(parsed, apiKey, (current, total) => {
            setProgress(`Analyzing batch ${current} of ${total}...`);
          });
        } else {
          memories = extractAllMemories(parsed);
        }

        setCandidates(memories);
        setState("review");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred",
        );
      } finally {
        setIsProcessing(false);
        setProgress("");
      }
    },
    [],
  );

  const handleFileSelected = async (file: File, apiKey?: string) => {
    setIsProcessing(true);
    setError(undefined);

    try {
      const rawConversations = await extractConversations(file);
      await processConversations(rawConversations, apiKey);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      setIsProcessing(false);
    }
  };

  // Listen for conversations from bookmarklet via postMessage
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        event.data?.type === "conversations" &&
        Array.isArray(event.data.data)
      ) {
        processConversations(event.data.data);
      }
    }

    window.addEventListener("message", handleMessage);

    // Signal readiness to bookmarklet (if opened by one)
    if (window.opener) {
      window.opener.postMessage({ type: "ready" }, "*");
    }

    return () => window.removeEventListener("message", handleMessage);
  }, [processConversations]);

  const handleUpdateCandidate = (
    id: string,
    updates: Partial<Pick<MemoryCandidate, "status" | "text">>,
  ) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );
  };

  const handleExport = () => {
    const markdown = exportToMarkdown(candidates);
    setExportMarkdown(markdown);
    setState("export");
  };

  const handleCloseModal = () => {
    setState("review");
  };

  return (
    <div className="app">
      {state === "upload" && (
        <UploadPage
          onFileSelected={handleFileSelected}
          isProcessing={isProcessing}
          error={error}
          progress={progress}
        />
      )}

      {(state === "review" || state === "export") && (
        <ReviewPage
          candidates={candidates}
          onUpdateCandidate={handleUpdateCandidate}
          onExport={handleExport}
        />
      )}

      {state === "export" && (
        <ExportModal markdown={exportMarkdown} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default App;
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/App.postMessage.test.tsx`
Expected: All 3 tests PASS

**Step 5: Run all existing tests to verify no regressions**

Run: `npx vitest run`
Expected: All 143+ tests PASS

**Step 6: Commit**

```bash
git add src/App.tsx src/components/__tests__/App.postMessage.test.tsx
git commit -m "feat: add postMessage listener for bookmarklet data in App"
```

---

### Task 6: Add bookmarklet install UI to UploadPage

**Files:**
- Modify: `src/components/UploadPage.tsx:62-88` (step 0 section)
- Modify: `src/components/UploadPage.css`
- Modify: `src/components/__tests__/UploadPage.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/__tests__/UploadPage.test.tsx`:

```typescript
it("shows bookmarklet install link on step 1", () => {
  render(<UploadPage {...defaultProps} />);
  const bookmarkletLink = screen.getByText(/export chatgpt data/i);
  expect(bookmarkletLink).toBeInTheDocument();
  expect(bookmarkletLink.tagName).toBe("A");
  expect(bookmarkletLink.getAttribute("href")).toMatch(/^javascript:/);
});

it("shows bookmarklet instructions text", () => {
  render(<UploadPage {...defaultProps} />);
  expect(screen.getByText(/drag this to your bookmark bar/i)).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/UploadPage.test.tsx`
Expected: FAIL — no bookmarklet link on page

**Step 3: Add the bookmarklet section to UploadPage step 0**

Modify `src/components/UploadPage.tsx` step 0 section (lines 62-88). Add a "fast path" section before the existing content:

In the `step === 0` block, add after the existing `wizard-nav` div:

```tsx
<div className="bookmarklet-section">
  <p className="bookmarklet-divider">or try the fast way</p>
  <p className="bookmarklet-instructions">
    Drag this to your bookmark bar, then click it while on chatgpt.com:
  </p>
  <a
    href="javascript:void(fetch('https://chatgpt-to-claude.vercel.app/bookmarklet.js').then(r=>r.text()).then(eval))"
    className="bookmarklet-link"
    onClick={(e) => {
      e.preventDefault();
      alert('Drag this link to your bookmark bar, then click it while on chatgpt.com.');
    }}
  >
    Export ChatGPT Data
  </a>
</div>
```

Note: The bookmarklet `href` is a loader that fetches the actual bookmarklet code from the hosted app. This allows updates without users re-dragging the bookmark. For local dev, replace the URL.

**Step 4: Add CSS styles**

Add to `src/components/UploadPage.css`:

```css
/* ─── Bookmarklet ──────────────────────────────────────────────────────────── */

.bookmarklet-section {
  margin-top: 2rem;
  width: 100%;
  text-align: center;
}

.bookmarklet-divider {
  color: #666;
  font-size: 0.85rem;
  margin-bottom: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bookmarklet-instructions {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.bookmarklet-link {
  display: inline-block;
  padding: 0.6rem 1.2rem;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
  cursor: grab;
  transition: transform 0.15s, box-shadow 0.15s;
}

.bookmarklet-link:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/UploadPage.test.tsx`
Expected: All tests PASS

**Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/components/UploadPage.tsx src/components/UploadPage.css src/components/__tests__/UploadPage.test.tsx
git commit -m "feat: add bookmarklet install UI to UploadPage wizard"
```

---

### Task 7: Build verification and cleanup

**Files:**
- Modify: `bookmarklet/build.ts` (if adjustments needed)
- Verify: all tests pass in both projects

**Step 1: Run all bookmarklet tests**

Run: `cd bookmarklet && npx vitest run`
Expected: All tests PASS

**Step 2: Build the bookmarklet**

Run: `cd bookmarklet && npm run build`
Expected: `dist/bookmarklet.js` created

**Step 3: Run all web app tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Build the web app**

Run: `npm run build`
Expected: Clean build, no errors

**Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore: final verification and cleanup"
```
