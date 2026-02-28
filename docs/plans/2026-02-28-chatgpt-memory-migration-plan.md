# ChatGPT to Claude Memory Migration - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-only static web app that extracts memories from a ChatGPT data export ZIP and outputs Claude Memory-compatible markdown.

**Architecture:** React + TypeScript + Vite SPA. JSZip for in-browser ZIP extraction. Heuristic extractors scan user messages for preferences, technical patterns, projects, identity, and recurring themes. Review UI lets users approve/edit/reject. Export as markdown.

**Tech Stack:** React 19, TypeScript, Vite, JSZip, Vitest, React Testing Library

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/App.css`
- Create: `vitest.config.ts`, `src/setupTests.ts`

**Step 1: Scaffold Vite + React + TypeScript project**

Run:
```bash
cd "/c/Users/grifm/OneDrive/Desktop/Projects/ChatGPT migration"
npm create vite@latest . -- --template react-ts
```

If prompted about non-empty directory, confirm (only `docs/` exists).

**Step 2: Install dependencies**

Run:
```bash
npm install jszip
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Step 3: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
  },
});
```

Create `src/setupTests.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

**Step 4: Add test script to package.json**

In `package.json`, ensure scripts include:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run"
}
```

**Step 5: Verify scaffolding works**

Run: `npm run test:run`
Expected: No tests found (but vitest runs successfully).

Run: `npm run build`
Expected: Successful build.

**Step 6: Initialize git and commit**

```bash
git init
```

Create `.gitignore`:
```
node_modules
dist
.DS_Store
*.local
```

```bash
git add .
git commit -m "chore: scaffold Vite + React + TypeScript project with Vitest"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/types.ts`
- Test: `src/__tests__/types.test.ts`

**Step 1: Write the type smoke test**

Create `src/__tests__/types.test.ts`:
```ts
import type {
  ChatGPTConversation,
  ChatGPTMessage,
  ParsedConversation,
  ParsedMessage,
  MemoryCandidate,
  MemoryCategory,
  Confidence,
} from "../types";

describe("types", () => {
  it("MemoryCandidate can be constructed with all required fields", () => {
    const candidate: MemoryCandidate = {
      id: "1",
      text: "I prefer TypeScript",
      category: "preference",
      confidence: "high",
      sourceTitle: "Chat about coding",
      sourceTimestamp: 1700000000,
      status: "pending",
    };
    expect(candidate.category).toBe("preference");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/types.test.ts`
Expected: FAIL - cannot find module "../types"

**Step 3: Write the types**

Create `src/types.ts`:
```ts
// --- ChatGPT Export Types (input) ---

export interface ChatGPTContentText {
  content_type: "text";
  parts: (string | null)[];
}

export interface ChatGPTContentCode {
  content_type: "code";
  language: string;
  text: string;
}

export interface ChatGPTContentMultimodal {
  content_type: "multimodal_text";
  parts: unknown[];
}

export interface ChatGPTContentExecution {
  content_type: "execution_output";
  text: string;
}

export type ChatGPTContent =
  | ChatGPTContentText
  | ChatGPTContentCode
  | ChatGPTContentMultimodal
  | ChatGPTContentExecution;

export interface ChatGPTAuthor {
  role: "system" | "user" | "assistant" | "tool";
  name: string | null;
  metadata: Record<string, unknown>;
}

export interface ChatGPTMessage {
  id: string;
  author: ChatGPTAuthor;
  create_time: number | null;
  content: ChatGPTContent;
  status: string;
  metadata: Record<string, unknown>;
}

export interface ChatGPTMappingNode {
  id: string;
  message: ChatGPTMessage | null;
  parent: string | null;
  children: string[];
}

export interface ChatGPTConversation {
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, ChatGPTMappingNode>;
  current_node: string;
  default_model_slug: string;
  gizmo_id: string | null;
  id: string;
}

// --- Parsed Types (internal) ---

export interface ParsedMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number | null;
}

export interface ParsedConversation {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  gizmoId: string | null;
  messages: ParsedMessage[];
}

// --- Memory Extraction Types (output) ---

export type MemoryCategory =
  | "preference"
  | "technical"
  | "project"
  | "identity"
  | "theme";

export type Confidence = "high" | "medium" | "low";

export type CandidateStatus = "pending" | "approved" | "rejected";

export interface MemoryCandidate {
  id: string;
  text: string;
  category: MemoryCategory;
  confidence: Confidence;
  sourceTitle: string;
  sourceTimestamp: number;
  status: CandidateStatus;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types.ts src/__tests__/types.test.ts
git commit -m "feat: add core type definitions for ChatGPT export and memory extraction"
```

---

### Task 3: ZIP Parser - Extract conversations.json

**Files:**
- Create: `src/parser/zipParser.ts`
- Test: `src/parser/__tests__/zipParser.test.ts`
- Create: `src/parser/__tests__/fixtures/` (test fixtures)

**Step 1: Write the failing test**

Create `src/parser/__tests__/zipParser.test.ts`:
```ts
import JSZip from "jszip";
import { extractConversations } from "../zipParser";

async function createTestZip(
  conversations: unknown[]
): Promise<File> {
  const zip = new JSZip();
  zip.file("conversations.json", JSON.stringify(conversations));
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "export.zip", { type: "application/zip" });
}

describe("extractConversations", () => {
  it("extracts conversations.json from a ZIP file", async () => {
    const mockConversations = [
      {
        title: "Test Chat",
        create_time: 1700000000,
        update_time: 1700005000,
        mapping: {},
        current_node: "node-1",
        default_model_slug: "gpt-4o",
        gizmo_id: null,
        id: "conv-1",
      },
    ];
    const file = await createTestZip(mockConversations);
    const result = await extractConversations(file);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test Chat");
  });

  it("throws if conversations.json is missing", async () => {
    const zip = new JSZip();
    zip.file("other.json", "{}");
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "export.zip");
    await expect(extractConversations(file)).rejects.toThrow(
      "conversations.json not found"
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/parser/__tests__/zipParser.test.ts`
Expected: FAIL - cannot find module "../zipParser"

**Step 3: Write minimal implementation**

Create `src/parser/zipParser.ts`:
```ts
import JSZip from "jszip";
import type { ChatGPTConversation } from "../types";

export async function extractConversations(
  file: File
): Promise<ChatGPTConversation[]> {
  const zip = await JSZip.loadAsync(file);
  const conversationsFile = zip.file("conversations.json");
  if (!conversationsFile) {
    throw new Error("conversations.json not found in ZIP archive");
  }
  const text = await conversationsFile.async("text");
  return JSON.parse(text) as ChatGPTConversation[];
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/parser/__tests__/zipParser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/parser/
git commit -m "feat: add ZIP parser to extract conversations.json"
```

---

### Task 4: Conversation Tree Walker

**Files:**
- Create: `src/parser/conversationParser.ts`
- Test: `src/parser/__tests__/conversationParser.test.ts`

**Step 1: Write the failing test**

Create `src/parser/__tests__/conversationParser.test.ts`:
```ts
import { parseConversation } from "../conversationParser";
import type { ChatGPTConversation } from "../../types";

function makeConversation(
  overrides: Partial<ChatGPTConversation> = {}
): ChatGPTConversation {
  return {
    title: "Test Chat",
    create_time: 1700000000,
    update_time: 1700005000,
    mapping: {},
    current_node: "",
    default_model_slug: "gpt-4o",
    gizmo_id: null,
    id: "conv-1",
    ...overrides,
  };
}

describe("parseConversation", () => {
  it("walks tree from current_node to root and returns messages in order", () => {
    const conv = makeConversation({
      current_node: "node-3",
      mapping: {
        "node-root": {
          id: "node-root",
          message: null, // sentinel root
          parent: null,
          children: ["node-1"],
        },
        "node-1": {
          id: "node-1",
          message: {
            id: "msg-1",
            author: { role: "user", name: null, metadata: {} },
            create_time: 1700000001,
            content: { content_type: "text", parts: ["Hello"] },
            status: "finished_successfully",
            metadata: {},
          },
          parent: "node-root",
          children: ["node-2"],
        },
        "node-2": {
          id: "node-2",
          message: {
            id: "msg-2",
            author: { role: "assistant", name: null, metadata: {} },
            create_time: 1700000002,
            content: { content_type: "text", parts: ["Hi there!"] },
            status: "finished_successfully",
            metadata: {},
          },
          parent: "node-1",
          children: ["node-3"],
        },
        "node-3": {
          id: "node-3",
          message: {
            id: "msg-3",
            author: { role: "user", name: null, metadata: {} },
            create_time: 1700000003,
            content: {
              content_type: "text",
              parts: ["I prefer TypeScript"],
            },
            status: "finished_successfully",
            metadata: {},
          },
          parent: "node-2",
          children: [],
        },
      },
    });

    const result = parseConversation(conv);
    expect(result.title).toBe("Test Chat");
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].text).toBe("Hello");
    expect(result.messages[0].role).toBe("user");
    expect(result.messages[1].text).toBe("Hi there!");
    expect(result.messages[1].role).toBe("assistant");
    expect(result.messages[2].text).toBe("I prefer TypeScript");
  });

  it("skips system and tool messages", () => {
    const conv = makeConversation({
      current_node: "node-2",
      mapping: {
        "node-root": {
          id: "node-root",
          message: {
            id: "msg-sys",
            author: { role: "system", name: null, metadata: {} },
            create_time: null,
            content: { content_type: "text", parts: ["You are helpful"] },
            status: "finished_successfully",
            metadata: {},
          },
          parent: null,
          children: ["node-1"],
        },
        "node-1": {
          id: "node-1",
          message: {
            id: "msg-tool",
            author: { role: "tool", name: "browser", metadata: {} },
            create_time: 1700000001,
            content: { content_type: "text", parts: ["browsing result"] },
            status: "finished_successfully",
            metadata: {},
          },
          parent: "node-root",
          children: ["node-2"],
        },
        "node-2": {
          id: "node-2",
          message: {
            id: "msg-user",
            author: { role: "user", name: null, metadata: {} },
            create_time: 1700000002,
            content: { content_type: "text", parts: ["Hello"] },
            status: "finished_successfully",
            metadata: {},
          },
          parent: "node-1",
          children: [],
        },
      },
    });

    const result = parseConversation(conv);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
  });

  it("flattens code content type", () => {
    const conv = makeConversation({
      current_node: "node-1",
      mapping: {
        "node-root": {
          id: "node-root",
          message: null,
          parent: null,
          children: ["node-1"],
        },
        "node-1": {
          id: "node-1",
          message: {
            id: "msg-1",
            author: { role: "assistant", name: null, metadata: {} },
            create_time: 1700000001,
            content: {
              content_type: "code",
              language: "python",
              text: "print('hello')",
            },
            status: "finished_successfully",
            metadata: {},
          },
          parent: "node-root",
          children: [],
        },
      },
    });

    const result = parseConversation(conv);
    expect(result.messages[0].text).toContain("print('hello')");
  });

  it("handles multimodal_text by extracting string parts only", () => {
    const conv = makeConversation({
      current_node: "node-1",
      mapping: {
        "node-root": {
          id: "node-root",
          message: null,
          parent: null,
          children: ["node-1"],
        },
        "node-1": {
          id: "node-1",
          message: {
            id: "msg-1",
            author: { role: "user", name: null, metadata: {} },
            create_time: 1700000001,
            content: {
              content_type: "multimodal_text",
              parts: [
                "Describe this image:",
                { content_type: "image_asset_pointer", asset_pointer: "file-service://file-abc" },
              ],
            },
            status: "finished_successfully",
            metadata: {},
          },
          parent: "node-root",
          children: [],
        },
      },
    });

    const result = parseConversation(conv);
    expect(result.messages[0].text).toBe("Describe this image:");
  });

  it("skips nodes with null messages (sentinel nodes)", () => {
    const conv = makeConversation({
      current_node: "node-1",
      mapping: {
        "node-root": {
          id: "node-root",
          message: null,
          parent: null,
          children: ["node-1"],
        },
        "node-1": {
          id: "node-1",
          message: {
            id: "msg-1",
            author: { role: "user", name: null, metadata: {} },
            create_time: 1700000001,
            content: { content_type: "text", parts: ["Hello"] },
            status: "finished_successfully",
            metadata: {},
          },
          parent: "node-root",
          children: [],
        },
      },
    });

    const result = parseConversation(conv);
    expect(result.messages).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/parser/__tests__/conversationParser.test.ts`
Expected: FAIL - cannot find module "../conversationParser"

**Step 3: Write implementation**

Create `src/parser/conversationParser.ts`:
```ts
import type {
  ChatGPTConversation,
  ChatGPTContent,
  ChatGPTMappingNode,
  ParsedConversation,
  ParsedMessage,
} from "../types";

function flattenContent(content: ChatGPTContent): string {
  switch (content.content_type) {
    case "text":
      return content.parts.filter((p): p is string => typeof p === "string").join("");
    case "code":
      return `\`\`\`${content.language}\n${content.text}\n\`\`\``;
    case "multimodal_text":
      return content.parts
        .filter((p): p is string => typeof p === "string")
        .join("");
    case "execution_output":
      return content.text;
    default:
      return "";
  }
}

export function parseConversation(
  conv: ChatGPTConversation
): ParsedConversation {
  const nodes: ChatGPTMappingNode[] = [];
  let currentId: string | null = conv.current_node;

  while (currentId) {
    const node = conv.mapping[currentId];
    if (!node) break;
    nodes.push(node);
    currentId = node.parent;
  }

  nodes.reverse();

  const messages: ParsedMessage[] = [];
  for (const node of nodes) {
    if (!node.message) continue;
    const role = node.message.author.role;
    if (role !== "user" && role !== "assistant") continue;
    const text = flattenContent(node.message.content).trim();
    if (!text) continue;
    messages.push({
      role,
      text,
      timestamp: node.message.create_time,
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/parser/__tests__/conversationParser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/parser/conversationParser.ts src/parser/__tests__/conversationParser.test.ts
git commit -m "feat: add conversation tree walker with content flattening"
```

---

### Task 5: Preference Extractor

**Files:**
- Create: `src/extractors/preferenceExtractor.ts`
- Test: `src/extractors/__tests__/preferenceExtractor.test.ts`

**Step 1: Write the failing test**

Create `src/extractors/__tests__/preferenceExtractor.test.ts`:
```ts
import { extractPreferences } from "../preferenceExtractor";
import type { ParsedConversation } from "../../types";

function makeConv(userMessages: string[]): ParsedConversation {
  return {
    id: "conv-1",
    title: "Test",
    model: "gpt-4o",
    createdAt: 1700000000,
    gizmoId: null,
    messages: userMessages.map((text) => ({
      role: "user" as const,
      text,
      timestamp: 1700000000,
    })),
  };
}

describe("extractPreferences", () => {
  it("extracts 'I prefer' statements", () => {
    const results = extractPreferences([
      makeConv(["I prefer TypeScript over JavaScript for all my projects"]),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("I prefer TypeScript over JavaScript");
    expect(results[0].category).toBe("preference");
    expect(results[0].confidence).toBe("high");
  });

  it("extracts 'I always' statements", () => {
    const results = extractPreferences([
      makeConv(["I always use dark mode in my editors"]),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].text).toContain("I always use dark mode");
  });

  it("extracts 'please always' and 'don't ever' statements", () => {
    const results = extractPreferences([
      makeConv([
        "Please always use semicolons in code examples",
        "Don't ever use var in JavaScript",
      ]),
    ]);
    expect(results).toHaveLength(2);
  });

  it("ignores assistant messages", () => {
    const conv: ParsedConversation = {
      id: "conv-1",
      title: "Test",
      model: "gpt-4o",
      createdAt: 1700000000,
      gizmoId: null,
      messages: [
        { role: "assistant", text: "I prefer to help you", timestamp: 1700000000 },
      ],
    };
    const results = extractPreferences([conv]);
    expect(results).toHaveLength(0);
  });

  it("returns empty array when no preferences found", () => {
    const results = extractPreferences([
      makeConv(["What is the weather today?"]),
    ]);
    expect(results).toHaveLength(0);
  });

  it("assigns medium confidence to weaker signals like 'I like'", () => {
    const results = extractPreferences([
      makeConv(["I like using Tailwind for styling"]),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe("medium");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/extractors/__tests__/preferenceExtractor.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/extractors/preferenceExtractor.ts`:
```ts
import type { ParsedConversation, MemoryCandidate, Confidence } from "../types";

interface PatternDef {
  pattern: RegExp;
  confidence: Confidence;
}

const PATTERNS: PatternDef[] = [
  { pattern: /\b(I prefer)\b/i, confidence: "high" },
  { pattern: /\b(I always)\b/i, confidence: "high" },
  { pattern: /\b(please always)\b/i, confidence: "high" },
  { pattern: /\b(don'?t ever)\b/i, confidence: "high" },
  { pattern: /\b(never use)\b/i, confidence: "high" },
  { pattern: /\b(my style is)\b/i, confidence: "high" },
  { pattern: /\b(I want you to)\b/i, confidence: "high" },
  { pattern: /\b(I like)\b/i, confidence: "medium" },
  { pattern: /\b(I tend to)\b/i, confidence: "medium" },
  { pattern: /\b(I usually)\b/i, confidence: "medium" },
];

function extractSentence(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match || match.index === undefined) return text;

  // Find sentence boundaries around the match
  const before = text.slice(0, match.index);
  const after = text.slice(match.index);

  const sentenceStart = Math.max(
    before.lastIndexOf(". ") + 2,
    before.lastIndexOf("! ") + 2,
    before.lastIndexOf("? ") + 2,
    before.lastIndexOf("\n") + 1,
    0
  );

  const sentenceEndMatch = after.match(/[.!?\n]/);
  const sentenceEnd = sentenceEndMatch
    ? match.index + (sentenceEndMatch.index ?? after.length) + 1
    : text.length;

  return text.slice(sentenceStart, sentenceEnd).trim();
}

let nextId = 0;

export function extractPreferences(
  conversations: ParsedConversation[]
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;

      for (const { pattern, confidence } of PATTERNS) {
        if (pattern.test(msg.text)) {
          candidates.push({
            id: `pref-${nextId++}`,
            text: extractSentence(msg.text, pattern),
            category: "preference",
            confidence,
            sourceTitle: conv.title,
            sourceTimestamp: conv.createdAt,
            status: "pending",
          });
          break; // one match per message to avoid duplicates
        }
      }
    }
  }

  return candidates;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/extractors/__tests__/preferenceExtractor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/extractors/
git commit -m "feat: add preference extractor with pattern matching"
```

---

### Task 6: Technical Profile Extractor

**Files:**
- Create: `src/extractors/technicalExtractor.ts`
- Test: `src/extractors/__tests__/technicalExtractor.test.ts`

**Step 1: Write the failing test**

Create `src/extractors/__tests__/technicalExtractor.test.ts`:
```ts
import { extractTechnical } from "../technicalExtractor";
import type { ParsedConversation } from "../../types";

function makeConv(
  id: string,
  userMessages: string[]
): ParsedConversation {
  return {
    id,
    title: `Chat ${id}`,
    model: "gpt-4o",
    createdAt: 1700000000,
    gizmoId: null,
    messages: userMessages.map((text) => ({
      role: "user" as const,
      text,
      timestamp: 1700000000,
    })),
  };
}

describe("extractTechnical", () => {
  it("extracts explicit stack descriptions", () => {
    const results = extractTechnical([
      makeConv("1", ["My stack is React, TypeScript, and Node.js"]),
    ]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe("technical");
    expect(results[0].text).toContain("React");
  });

  it("detects recurring tech mentions across conversations", () => {
    const results = extractTechnical([
      makeConv("1", ["How do I set up React Router?"]),
      makeConv("2", ["Help me with React testing"]),
      makeConv("3", ["React component performance tips"]),
    ]);
    const recurring = results.filter((r) => r.confidence === "high");
    expect(recurring.length).toBeGreaterThan(0);
    expect(recurring[0].text).toContain("React");
  });

  it("gives low confidence to one-off mentions", () => {
    const results = extractTechnical([
      makeConv("1", ["What is Haskell used for?"]),
    ]);
    const haskell = results.find((r) => r.text.includes("Haskell"));
    if (haskell) {
      expect(haskell.confidence).toBe("low");
    }
  });

  it("ignores assistant messages", () => {
    const conv: ParsedConversation = {
      id: "1",
      title: "Test",
      model: "gpt-4o",
      createdAt: 1700000000,
      gizmoId: null,
      messages: [
        { role: "assistant", text: "You should try React", timestamp: 1700000000 },
      ],
    };
    const results = extractTechnical([conv]);
    expect(results).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/extractors/__tests__/technicalExtractor.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/extractors/technicalExtractor.ts`:
```ts
import type { ParsedConversation, MemoryCandidate, Confidence } from "../types";

const TECH_KEYWORDS: string[] = [
  // Languages
  "JavaScript", "TypeScript", "Python", "Rust", "Go", "Java", "C#", "C\\+\\+",
  "Ruby", "PHP", "Swift", "Kotlin", "Dart", "Elixir", "Haskell", "Lua",
  // Frontend
  "React", "Vue", "Angular", "Svelte", "Next\\.js", "Nuxt", "Astro", "Remix",
  "Tailwind", "Bootstrap", "CSS Modules", "Styled Components",
  // Backend
  "Node\\.js", "Express", "Fastify", "Django", "Flask", "FastAPI", "Rails",
  "Spring Boot", "ASP\\.NET", "Gin", "Actix",
  // Databases
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "DynamoDB",
  "Supabase", "Firebase", "Prisma", "Drizzle",
  // Cloud / Infra
  "AWS", "Azure", "GCP", "Vercel", "Netlify", "Docker", "Kubernetes",
  "Terraform", "Cloudflare",
  // Tools
  "Vite", "Webpack", "esbuild", "Bun", "Deno", "pnpm", "npm", "yarn",
  "Git", "GitHub", "GitLab", "VS Code", "Neovim",
  // Testing
  "Jest", "Vitest", "Playwright", "Cypress", "Pytest",
];

const STACK_PATTERNS = [
  /\b(my stack is|my tech stack|I use|I'm using|we use|our stack)\b/i,
  /\b(I build with|I develop with|I work with)\b/i,
];

let nextId = 0;

export function extractTechnical(
  conversations: ParsedConversation[]
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  const techFrequency = new Map<string, number>();

  // First pass: count tech keyword frequency across conversations
  for (const conv of conversations) {
    const convTechs = new Set<string>();
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;
      for (const keyword of TECH_KEYWORDS) {
        const regex = new RegExp(`\\b${keyword}\\b`, "i");
        if (regex.test(msg.text)) {
          convTechs.add(keyword.replace(/\\\./g, ".").replace(/\\\+/g, "+"));
        }
      }
    }
    for (const tech of convTechs) {
      techFrequency.set(tech, (techFrequency.get(tech) ?? 0) + 1);
    }
  }

  // Second pass: extract explicit stack descriptions
  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;
      for (const pattern of STACK_PATTERNS) {
        if (pattern.test(msg.text)) {
          // Find the sentence containing the pattern
          const match = msg.text.match(pattern);
          if (!match || match.index === undefined) continue;
          const after = msg.text.slice(match.index);
          const endMatch = after.match(/[.!?\n]/);
          const sentence = endMatch
            ? after.slice(0, (endMatch.index ?? after.length) + 1)
            : after;
          candidates.push({
            id: `tech-${nextId++}`,
            text: sentence.trim(),
            category: "technical",
            confidence: "high",
            sourceTitle: conv.title,
            sourceTimestamp: conv.createdAt,
            status: "pending",
          });
          break;
        }
      }
    }
  }

  // Third pass: report recurring technologies (3+ conversations)
  for (const [tech, count] of techFrequency) {
    if (count >= 3) {
      candidates.push({
        id: `tech-${nextId++}`,
        text: `Frequently uses ${tech} (mentioned in ${count} conversations)`,
        category: "technical",
        confidence: "high",
        sourceTitle: "(multiple conversations)",
        sourceTimestamp: 0,
        status: "pending",
      });
    } else if (count === 1) {
      // Only report single mentions if they matched a stack pattern above
      // (already captured). Otherwise skip to reduce noise.
    }
  }

  return candidates;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/extractors/__tests__/technicalExtractor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/extractors/technicalExtractor.ts src/extractors/__tests__/technicalExtractor.test.ts
git commit -m "feat: add technical profile extractor with frequency tracking"
```

---

### Task 7: Project, Identity, and Theme Extractors

**Files:**
- Create: `src/extractors/projectExtractor.ts`
- Create: `src/extractors/identityExtractor.ts`
- Create: `src/extractors/themeExtractor.ts`
- Test: `src/extractors/__tests__/projectExtractor.test.ts`
- Test: `src/extractors/__tests__/identityExtractor.test.ts`
- Test: `src/extractors/__tests__/themeExtractor.test.ts`

**Step 1: Write failing tests**

Create `src/extractors/__tests__/projectExtractor.test.ts`:
```ts
import { extractProjects } from "../projectExtractor";
import type { ParsedConversation } from "../../types";

function makeConv(userMessages: string[]): ParsedConversation {
  return {
    id: "conv-1",
    title: "Test",
    model: "gpt-4o",
    createdAt: 1700000000,
    gizmoId: null,
    messages: userMessages.map((text) => ({
      role: "user" as const,
      text,
      timestamp: 1700000000,
    })),
  };
}

describe("extractProjects", () => {
  it("extracts 'I'm building' statements", () => {
    const results = extractProjects([
      makeConv(["I'm building a SaaS analytics dashboard"]),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("project");
    expect(results[0].text).toContain("SaaS analytics dashboard");
  });

  it("extracts 'my project' statements", () => {
    const results = extractProjects([
      makeConv(["My project is a CLI tool for database migrations"]),
    ]);
    expect(results).toHaveLength(1);
  });

  it("extracts 'I'm working on' statements", () => {
    const results = extractProjects([
      makeConv(["I'm working on an AI chatbot for customer support"]),
    ]);
    expect(results).toHaveLength(1);
  });

  it("returns empty for no matches", () => {
    const results = extractProjects([makeConv(["What time is it?"])]);
    expect(results).toHaveLength(0);
  });
});
```

Create `src/extractors/__tests__/identityExtractor.test.ts`:
```ts
import { extractIdentity } from "../identityExtractor";
import type { ParsedConversation } from "../../types";

function makeConv(userMessages: string[]): ParsedConversation {
  return {
    id: "conv-1",
    title: "Test",
    model: "gpt-4o",
    createdAt: 1700000000,
    gizmoId: null,
    messages: userMessages.map((text) => ({
      role: "user" as const,
      text,
      timestamp: 1700000000,
    })),
  };
}

describe("extractIdentity", () => {
  it("extracts 'I'm a' statements", () => {
    const results = extractIdentity([
      makeConv(["I'm a senior frontend engineer at Acme Corp"]),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].category).toBe("identity");
    expect(results[0].text).toContain("senior frontend engineer");
  });

  it("extracts 'I work at' statements", () => {
    const results = extractIdentity([
      makeConv(["I work at a fintech startup in NYC"]),
    ]);
    expect(results).toHaveLength(1);
  });

  it("extracts 'my role is' statements", () => {
    const results = extractIdentity([
      makeConv(["My role is tech lead for the platform team"]),
    ]);
    expect(results).toHaveLength(1);
  });

  it("returns empty for no matches", () => {
    const results = extractIdentity([
      makeConv(["How do I center a div?"]),
    ]);
    expect(results).toHaveLength(0);
  });
});
```

Create `src/extractors/__tests__/themeExtractor.test.ts`:
```ts
import { extractThemes } from "../themeExtractor";
import type { ParsedConversation } from "../../types";

function makeConv(id: string, title: string): ParsedConversation {
  return {
    id,
    title,
    model: "gpt-4o",
    createdAt: 1700000000,
    gizmoId: null,
    messages: [{ role: "user", text: title, timestamp: 1700000000 }],
  };
}

describe("extractThemes", () => {
  it("detects topics appearing in 3+ conversations", () => {
    const results = extractThemes([
      makeConv("1", "React component design patterns"),
      makeConv("2", "React hooks best practices"),
      makeConv("3", "React performance optimization"),
    ]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].category).toBe("theme");
    expect(results[0].text.toLowerCase()).toContain("react");
  });

  it("ignores topics in fewer than 3 conversations", () => {
    const results = extractThemes([
      makeConv("1", "Python web scraping"),
      makeConv("2", "JavaScript async patterns"),
    ]);
    expect(results).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/extractors/__tests__/projectExtractor.test.ts src/extractors/__tests__/identityExtractor.test.ts src/extractors/__tests__/themeExtractor.test.ts`
Expected: FAIL

**Step 3: Write implementations**

Create `src/extractors/projectExtractor.ts`:
```ts
import type { ParsedConversation, MemoryCandidate } from "../types";

const PATTERNS = [
  /\b(I'?m building)\b/i,
  /\b(I'?m working on)\b/i,
  /\b(my project)\b/i,
  /\b(the goal is)\b/i,
  /\b(my company)\b/i,
  /\b(my team)\b/i,
  /\b(we'?re building)\b/i,
  /\b(our product)\b/i,
];

let nextId = 0;

function extractSentence(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match || match.index === undefined) return text;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index);
  const sentenceStart = Math.max(
    before.lastIndexOf(". ") + 2,
    before.lastIndexOf("\n") + 1,
    0
  );
  const endMatch = after.match(/[.!?\n]/);
  const sentenceEnd = endMatch
    ? match.index + (endMatch.index ?? after.length) + 1
    : text.length;
  return text.slice(sentenceStart, sentenceEnd).trim();
}

export function extractProjects(
  conversations: ParsedConversation[]
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;
      for (const pattern of PATTERNS) {
        if (pattern.test(msg.text)) {
          candidates.push({
            id: `proj-${nextId++}`,
            text: extractSentence(msg.text, pattern),
            category: "project",
            confidence: "high",
            sourceTitle: conv.title,
            sourceTimestamp: conv.createdAt,
            status: "pending",
          });
          break;
        }
      }
    }
  }

  return candidates;
}
```

Create `src/extractors/identityExtractor.ts`:
```ts
import type { ParsedConversation, MemoryCandidate } from "../types";

const PATTERNS = [
  /\b(I'?m a)\b/i,
  /\b(my role is)\b/i,
  /\b(I work at)\b/i,
  /\b(I work as)\b/i,
  /\b(my background is)\b/i,
  /\b(my experience is)\b/i,
  /\b(I have \d+ years?)\b/i,
  /\b(I'?ve been a)\b/i,
];

let nextId = 0;

function extractSentence(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  if (!match || match.index === undefined) return text;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index);
  const sentenceStart = Math.max(
    before.lastIndexOf(". ") + 2,
    before.lastIndexOf("\n") + 1,
    0
  );
  const endMatch = after.match(/[.!?\n]/);
  const sentenceEnd = endMatch
    ? match.index + (endMatch.index ?? after.length) + 1
    : text.length;
  return text.slice(sentenceStart, sentenceEnd).trim();
}

export function extractIdentity(
  conversations: ParsedConversation[]
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];

  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;
      for (const pattern of PATTERNS) {
        if (pattern.test(msg.text)) {
          candidates.push({
            id: `id-${nextId++}`,
            text: extractSentence(msg.text, pattern),
            category: "identity",
            confidence: "high",
            sourceTitle: conv.title,
            sourceTimestamp: conv.createdAt,
            status: "pending",
          });
          break;
        }
      }
    }
  }

  return candidates;
}
```

Create `src/extractors/themeExtractor.ts`:
```ts
import type { ParsedConversation, MemoryCandidate } from "../types";

// Common stop words to exclude from theme detection
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "out", "off", "over",
  "under", "again", "further", "then", "once", "here", "there", "when",
  "where", "why", "how", "all", "each", "every", "both", "few", "more",
  "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "because", "but", "and",
  "or", "if", "while", "about", "up", "it", "its", "this", "that",
  "these", "those", "i", "me", "my", "we", "our", "you", "your", "he",
  "him", "his", "she", "her", "they", "them", "their", "what", "which",
  "who", "whom", "help", "need", "want", "make", "get", "use", "new",
  "like", "know", "think", "see", "look", "find", "give", "tell",
  "work", "try", "ask", "way", "thing", "also", "well", "back",
]);

let nextId = 0;

export function extractThemes(
  conversations: ParsedConversation[]
): MemoryCandidate[] {
  // Count significant words across conversation titles and first user messages
  const wordConvCount = new Map<string, Set<string>>();

  for (const conv of conversations) {
    const text = [
      conv.title,
      ...conv.messages
        .filter((m) => m.role === "user")
        .map((m) => m.text),
    ].join(" ");

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s.-]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    const uniqueWords = new Set(words);
    for (const word of uniqueWords) {
      if (!wordConvCount.has(word)) {
        wordConvCount.set(word, new Set());
      }
      wordConvCount.get(word)!.add(conv.id);
    }
  }

  const candidates: MemoryCandidate[] = [];

  for (const [word, convIds] of wordConvCount) {
    if (convIds.size >= 3) {
      candidates.push({
        id: `theme-${nextId++}`,
        text: `Recurring interest: "${word}" (appeared in ${convIds.size} conversations)`,
        category: "theme",
        confidence: convIds.size >= 5 ? "high" : "medium",
        sourceTitle: "(multiple conversations)",
        sourceTimestamp: 0,
        status: "pending",
      });
    }
  }

  // Sort by frequency descending
  candidates.sort((a, b) => {
    const countA = parseInt(a.text.match(/(\d+) conversations/)?.[1] ?? "0");
    const countB = parseInt(b.text.match(/(\d+) conversations/)?.[1] ?? "0");
    return countB - countA;
  });

  return candidates;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/extractors/__tests__/projectExtractor.test.ts src/extractors/__tests__/identityExtractor.test.ts src/extractors/__tests__/themeExtractor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/extractors/
git commit -m "feat: add project, identity, and theme extractors"
```

---

### Task 8: Extractor Pipeline (combines all extractors)

**Files:**
- Create: `src/extractors/index.ts`
- Test: `src/extractors/__tests__/pipeline.test.ts`

**Step 1: Write the failing test**

Create `src/extractors/__tests__/pipeline.test.ts`:
```ts
import { extractAllMemories } from "../index";
import type { ParsedConversation } from "../../types";

describe("extractAllMemories", () => {
  it("runs all extractors and returns combined candidates", () => {
    const conversations: ParsedConversation[] = [
      {
        id: "1",
        title: "React project help",
        model: "gpt-4o",
        createdAt: 1700000000,
        gizmoId: null,
        messages: [
          {
            role: "user",
            text: "I prefer TypeScript over JavaScript. I'm a senior engineer at Acme Corp. I'm building a SaaS dashboard. My stack is React and Node.js.",
            timestamp: 1700000000,
          },
        ],
      },
      {
        id: "2",
        title: "React hooks question",
        model: "gpt-4o",
        createdAt: 1700000001,
        gizmoId: null,
        messages: [
          { role: "user", text: "Help with React hooks", timestamp: 1700000001 },
        ],
      },
      {
        id: "3",
        title: "React performance tips",
        model: "gpt-4o",
        createdAt: 1700000002,
        gizmoId: null,
        messages: [
          { role: "user", text: "React performance optimization", timestamp: 1700000002 },
        ],
      },
    ];

    const results = extractAllMemories(conversations);

    const categories = new Set(results.map((r) => r.category));
    expect(categories.has("preference")).toBe(true);
    expect(categories.has("identity")).toBe(true);
    expect(categories.has("project")).toBe(true);
    expect(results.length).toBeGreaterThan(3);
    // All should have unique IDs
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/extractors/__tests__/pipeline.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/extractors/index.ts`:
```ts
import type { ParsedConversation, MemoryCandidate } from "../types";
import { extractPreferences } from "./preferenceExtractor";
import { extractTechnical } from "./technicalExtractor";
import { extractProjects } from "./projectExtractor";
import { extractIdentity } from "./identityExtractor";
import { extractThemes } from "./themeExtractor";

export function extractAllMemories(
  conversations: ParsedConversation[]
): MemoryCandidate[] {
  return [
    ...extractPreferences(conversations),
    ...extractTechnical(conversations),
    ...extractProjects(conversations),
    ...extractIdentity(conversations),
    ...extractThemes(conversations),
  ];
}

export {
  extractPreferences,
  extractTechnical,
  extractProjects,
  extractIdentity,
  extractThemes,
};
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/extractors/__tests__/pipeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/extractors/index.ts src/extractors/__tests__/pipeline.test.ts
git commit -m "feat: add extractor pipeline combining all memory extractors"
```

---

### Task 9: Markdown Export

**Files:**
- Create: `src/export/markdownExport.ts`
- Test: `src/export/__tests__/markdownExport.test.ts`

**Step 1: Write the failing test**

Create `src/export/__tests__/markdownExport.test.ts`:
```ts
import { exportToMarkdown } from "../markdownExport";
import type { MemoryCandidate } from "../../types";

describe("exportToMarkdown", () => {
  it("groups approved memories by category with headers", () => {
    const candidates: MemoryCandidate[] = [
      {
        id: "1",
        text: "I prefer TypeScript",
        category: "preference",
        confidence: "high",
        sourceTitle: "Chat",
        sourceTimestamp: 1700000000,
        status: "approved",
      },
      {
        id: "2",
        text: "Uses React and Node.js",
        category: "technical",
        confidence: "high",
        sourceTitle: "Chat",
        sourceTimestamp: 1700000000,
        status: "approved",
      },
      {
        id: "3",
        text: "Building a SaaS dashboard",
        category: "project",
        confidence: "high",
        sourceTitle: "Chat",
        sourceTimestamp: 1700000000,
        status: "approved",
      },
      {
        id: "4",
        text: "Senior engineer",
        category: "identity",
        confidence: "high",
        sourceTitle: "Chat",
        sourceTimestamp: 1700000000,
        status: "approved",
      },
      {
        id: "5",
        text: "Recurring interest: AI",
        category: "theme",
        confidence: "high",
        sourceTitle: "Chat",
        sourceTimestamp: 1700000000,
        status: "approved",
      },
    ];

    const md = exportToMarkdown(candidates);

    expect(md).toContain("# My Preferences");
    expect(md).toContain("- I prefer TypeScript");
    expect(md).toContain("# Technical Profile");
    expect(md).toContain("- Uses React and Node.js");
    expect(md).toContain("# Projects");
    expect(md).toContain("- Building a SaaS dashboard");
    expect(md).toContain("# About Me");
    expect(md).toContain("- Senior engineer");
    expect(md).toContain("# Recurring Interests");
    expect(md).toContain("- Recurring interest: AI");
  });

  it("excludes rejected and pending memories", () => {
    const candidates: MemoryCandidate[] = [
      {
        id: "1",
        text: "Approved memory",
        category: "preference",
        confidence: "high",
        sourceTitle: "Chat",
        sourceTimestamp: 1700000000,
        status: "approved",
      },
      {
        id: "2",
        text: "Rejected memory",
        category: "preference",
        confidence: "high",
        sourceTitle: "Chat",
        sourceTimestamp: 1700000000,
        status: "rejected",
      },
      {
        id: "3",
        text: "Pending memory",
        category: "preference",
        confidence: "high",
        sourceTitle: "Chat",
        sourceTimestamp: 1700000000,
        status: "pending",
      },
    ];

    const md = exportToMarkdown(candidates);
    expect(md).toContain("Approved memory");
    expect(md).not.toContain("Rejected memory");
    expect(md).not.toContain("Pending memory");
  });

  it("omits empty category sections", () => {
    const candidates: MemoryCandidate[] = [
      {
        id: "1",
        text: "A preference",
        category: "preference",
        confidence: "high",
        sourceTitle: "Chat",
        sourceTimestamp: 1700000000,
        status: "approved",
      },
    ];

    const md = exportToMarkdown(candidates);
    expect(md).toContain("# My Preferences");
    expect(md).not.toContain("# Technical Profile");
    expect(md).not.toContain("# Projects");
  });

  it("returns empty string when no approved memories", () => {
    const md = exportToMarkdown([]);
    expect(md).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/export/__tests__/markdownExport.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/export/markdownExport.ts`:
```ts
import type { MemoryCandidate, MemoryCategory } from "../types";

const CATEGORY_HEADERS: Record<MemoryCategory, string> = {
  preference: "My Preferences",
  technical: "Technical Profile",
  project: "Projects",
  identity: "About Me",
  theme: "Recurring Interests",
};

const CATEGORY_ORDER: MemoryCategory[] = [
  "preference",
  "technical",
  "project",
  "identity",
  "theme",
];

export function exportToMarkdown(candidates: MemoryCandidate[]): string {
  const approved = candidates.filter((c) => c.status === "approved");
  if (approved.length === 0) return "";

  const grouped = new Map<MemoryCategory, MemoryCandidate[]>();
  for (const candidate of approved) {
    if (!grouped.has(candidate.category)) {
      grouped.set(candidate.category, []);
    }
    grouped.get(candidate.category)!.push(candidate);
  }

  const sections: string[] = [];

  for (const category of CATEGORY_ORDER) {
    const items = grouped.get(category);
    if (!items || items.length === 0) continue;

    const header = `# ${CATEGORY_HEADERS[category]}`;
    const bullets = items.map((item) => `- ${item.text}`).join("\n");
    sections.push(`${header}\n${bullets}`);
  }

  return sections.join("\n\n") + "\n";
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/export/__tests__/markdownExport.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/export/
git commit -m "feat: add markdown export for Claude Memory import"
```

---

### Task 10: Upload Page Component

**Files:**
- Create: `src/components/UploadPage.tsx`
- Create: `src/components/UploadPage.css`
- Test: `src/components/__tests__/UploadPage.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/UploadPage.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadPage } from "../UploadPage";

describe("UploadPage", () => {
  it("renders upload area with instructions", () => {
    render(<UploadPage onFileSelected={vi.fn()} isProcessing={false} />);
    expect(
      screen.getByText(/upload your chatgpt export/i)
    ).toBeInTheDocument();
  });

  it("calls onFileSelected when a file is dropped", async () => {
    const onFileSelected = vi.fn();
    render(<UploadPage onFileSelected={onFileSelected} isProcessing={false} />);

    const input = screen.getByTestId("file-input");
    const file = new File(["test"], "export.zip", {
      type: "application/zip",
    });
    await userEvent.upload(input, file);

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("shows processing state", () => {
    render(<UploadPage onFileSelected={vi.fn()} isProcessing={true} />);
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });

  it("shows error message when provided", () => {
    render(
      <UploadPage
        onFileSelected={vi.fn()}
        isProcessing={false}
        error="Invalid file format"
      />
    );
    expect(screen.getByText(/invalid file format/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/UploadPage.test.tsx`
Expected: FAIL

**Step 3: Write implementation**

Create `src/components/UploadPage.tsx`:
```tsx
import { useCallback, useRef, useState } from "react";
import "./UploadPage.css";

interface UploadPageProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
  error?: string;
}

export function UploadPage({
  onFileSelected,
  isProcessing,
  error,
}: UploadPageProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  if (isProcessing) {
    return (
      <div className="upload-page">
        <div className="upload-processing">
          <div className="spinner" />
          <p>Processing your ChatGPT export...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-page">
      <h1>ChatGPT to Claude Memory</h1>
      <p className="subtitle">
        Extract your preferences, habits, and knowledge from ChatGPT and import
        them into Claude's memory.
      </p>

      <div
        className={`upload-zone ${isDragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <p className="upload-icon">📁</p>
        <p>Upload your ChatGPT export</p>
        <p className="upload-hint">
          Drop your ZIP file here or click to browse
        </p>
        <input
          ref={inputRef}
          data-testid="file-input"
          type="file"
          accept=".zip"
          onChange={handleChange}
          hidden
        />
      </div>

      {error && <p className="upload-error">{error}</p>}

      <details className="instructions">
        <summary>How to export your ChatGPT data</summary>
        <ol>
          <li>Go to ChatGPT Settings</li>
          <li>Click Data Controls</li>
          <li>Click Export Data</li>
          <li>Wait for the email with the download link</li>
          <li>Upload the ZIP file here</li>
        </ol>
      </details>
    </div>
  );
}
```

Create `src/components/UploadPage.css`:
```css
.upload-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.upload-page h1 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  margin-bottom: 2rem;
}

.upload-zone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 3rem 2rem;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}

.upload-zone:hover,
.upload-zone.dragging {
  border-color: #6366f1;
  background-color: #f5f3ff;
}

.upload-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.upload-hint {
  color: #999;
  font-size: 0.9rem;
}

.upload-error {
  color: #dc2626;
  margin-top: 1rem;
}

.upload-processing {
  padding: 4rem 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.instructions {
  margin-top: 2rem;
  text-align: left;
}

.instructions summary {
  cursor: pointer;
  color: #6366f1;
}

.instructions ol {
  margin-top: 0.5rem;
  padding-left: 1.5rem;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/UploadPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add upload page component with drag-and-drop"
```

---

### Task 11: Review Page Component

**Files:**
- Create: `src/components/ReviewPage.tsx`
- Create: `src/components/ReviewPage.css`
- Create: `src/components/MemoryCard.tsx`
- Test: `src/components/__tests__/ReviewPage.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/ReviewPage.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewPage } from "../ReviewPage";
import type { MemoryCandidate } from "../../types";

const mockCandidates: MemoryCandidate[] = [
  {
    id: "1",
    text: "I prefer TypeScript",
    category: "preference",
    confidence: "high",
    sourceTitle: "Coding Chat",
    sourceTimestamp: 1700000000,
    status: "pending",
  },
  {
    id: "2",
    text: "Uses React",
    category: "technical",
    confidence: "medium",
    sourceTitle: "React Help",
    sourceTimestamp: 1700000001,
    status: "pending",
  },
  {
    id: "3",
    text: "Senior engineer",
    category: "identity",
    confidence: "low",
    sourceTitle: "Intro Chat",
    sourceTimestamp: 1700000002,
    status: "pending",
  },
];

describe("ReviewPage", () => {
  it("renders all memory candidates", () => {
    render(
      <ReviewPage
        candidates={mockCandidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />
    );
    expect(screen.getByText("I prefer TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Uses React")).toBeInTheDocument();
    expect(screen.getByText("Senior engineer")).toBeInTheDocument();
  });

  it("shows approval counter", () => {
    const candidates = [
      { ...mockCandidates[0], status: "approved" as const },
      ...mockCandidates.slice(1),
    ];
    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />
    );
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument();
  });

  it("calls onUpdateCandidate when approve button clicked", async () => {
    const onUpdate = vi.fn();
    render(
      <ReviewPage
        candidates={mockCandidates}
        onUpdateCandidate={onUpdate}
        onExport={vi.fn()}
      />
    );
    const approveButtons = screen.getAllByRole("button", { name: /approve/i });
    await userEvent.click(approveButtons[0]);
    expect(onUpdate).toHaveBeenCalledWith("1", { status: "approved" });
  });

  it("calls onUpdateCandidate when reject button clicked", async () => {
    const onUpdate = vi.fn();
    render(
      <ReviewPage
        candidates={mockCandidates}
        onUpdateCandidate={onUpdate}
        onExport={vi.fn()}
      />
    );
    const rejectButtons = screen.getAllByRole("button", { name: /reject/i });
    await userEvent.click(rejectButtons[0]);
    expect(onUpdate).toHaveBeenCalledWith("1", { status: "rejected" });
  });

  it("calls onExport when export button clicked", async () => {
    const onExport = vi.fn();
    const candidates = mockCandidates.map((c) => ({
      ...c,
      status: "approved" as const,
    }));
    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={onExport}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /export/i }));
    expect(onExport).toHaveBeenCalled();
  });

  it("has bulk approve all high-confidence button", async () => {
    const onUpdate = vi.fn();
    render(
      <ReviewPage
        candidates={mockCandidates}
        onUpdateCandidate={onUpdate}
        onExport={vi.fn()}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /approve all high/i })
    );
    expect(onUpdate).toHaveBeenCalledWith("1", { status: "approved" });
    // Should not approve medium or low confidence
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/ReviewPage.test.tsx`
Expected: FAIL

**Step 3: Write implementations**

Create `src/components/MemoryCard.tsx`:
```tsx
import type { MemoryCandidate } from "../types";

interface MemoryCardProps {
  candidate: MemoryCandidate;
  onUpdate: (
    id: string,
    updates: Partial<Pick<MemoryCandidate, "status" | "text">>
  ) => void;
}

const CONFIDENCE_COLORS = {
  high: "#16a34a",
  medium: "#ca8a04",
  low: "#dc2626",
};

export function MemoryCard({ candidate, onUpdate }: MemoryCardProps) {
  const date = candidate.sourceTimestamp
    ? new Date(candidate.sourceTimestamp * 1000).toLocaleDateString()
    : "";

  return (
    <div className={`memory-card memory-card--${candidate.status}`}>
      <div className="memory-card-header">
        <span
          className="confidence-badge"
          style={{ backgroundColor: CONFIDENCE_COLORS[candidate.confidence] }}
        >
          {candidate.confidence}
        </span>
        <span className="memory-source">
          {candidate.sourceTitle} {date && `· ${date}`}
        </span>
      </div>

      <p className="memory-text">{candidate.text}</p>

      <div className="memory-card-actions">
        {candidate.status === "pending" && (
          <>
            <button
              className="btn btn-approve"
              onClick={() => onUpdate(candidate.id, { status: "approved" })}
            >
              Approve
            </button>
            <button
              className="btn btn-reject"
              onClick={() => onUpdate(candidate.id, { status: "rejected" })}
            >
              Reject
            </button>
          </>
        )}
        {candidate.status === "approved" && (
          <button
            className="btn btn-undo"
            onClick={() => onUpdate(candidate.id, { status: "pending" })}
          >
            Undo
          </button>
        )}
        {candidate.status === "rejected" && (
          <button
            className="btn btn-undo"
            onClick={() => onUpdate(candidate.id, { status: "pending" })}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
```

Create `src/components/ReviewPage.tsx`:
```tsx
import { useState } from "react";
import type { MemoryCandidate, MemoryCategory, Confidence } from "../types";
import { MemoryCard } from "./MemoryCard";
import "./ReviewPage.css";

interface ReviewPageProps {
  candidates: MemoryCandidate[];
  onUpdateCandidate: (
    id: string,
    updates: Partial<Pick<MemoryCandidate, "status" | "text">>
  ) => void;
  onExport: () => void;
}

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  preference: "Preferences",
  technical: "Technical",
  project: "Projects",
  identity: "Identity",
  theme: "Themes",
};

export function ReviewPage({
  candidates,
  onUpdateCandidate,
  onExport,
}: ReviewPageProps) {
  const [filterCategory, setFilterCategory] = useState<
    MemoryCategory | "all"
  >("all");
  const [filterConfidence, setFilterConfidence] = useState<
    Confidence | "all"
  >("all");

  const approvedCount = candidates.filter(
    (c) => c.status === "approved"
  ).length;

  const filtered = candidates.filter((c) => {
    if (filterCategory !== "all" && c.category !== filterCategory) return false;
    if (filterConfidence !== "all" && c.confidence !== filterConfidence)
      return false;
    return true;
  });

  const handleBulkApproveHigh = () => {
    for (const c of candidates) {
      if (c.confidence === "high" && c.status === "pending") {
        onUpdateCandidate(c.id, { status: "approved" });
      }
    }
  };

  const handleBulkRejectLow = () => {
    for (const c of candidates) {
      if (c.confidence === "low" && c.status === "pending") {
        onUpdateCandidate(c.id, { status: "rejected" });
      }
    }
  };

  return (
    <div className="review-page">
      <div className="review-header">
        <h1>Review Extracted Memories</h1>
        <p className="review-counter">
          {approvedCount} of {candidates.length} memories approved
        </p>
      </div>

      <div className="review-toolbar">
        <div className="review-filters">
          <select
            value={filterCategory}
            onChange={(e) =>
              setFilterCategory(e.target.value as MemoryCategory | "all")
            }
          >
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={filterConfidence}
            onChange={(e) =>
              setFilterConfidence(e.target.value as Confidence | "all")
            }
          >
            <option value="all">All confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="review-bulk-actions">
          <button className="btn btn-bulk" onClick={handleBulkApproveHigh}>
            Approve all high-confidence
          </button>
          <button className="btn btn-bulk" onClick={handleBulkRejectLow}>
            Reject all low-confidence
          </button>
        </div>
      </div>

      <div className="memory-list">
        {filtered.map((candidate) => (
          <MemoryCard
            key={candidate.id}
            candidate={candidate}
            onUpdate={onUpdateCandidate}
          />
        ))}
      </div>

      {approvedCount > 0 && (
        <div className="review-export">
          <button className="btn btn-export" onClick={onExport}>
            Export {approvedCount} memories
          </button>
        </div>
      )}
    </div>
  );
}
```

Create `src/components/ReviewPage.css`:
```css
.review-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.review-header {
  margin-bottom: 1.5rem;
}

.review-header h1 {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.review-counter {
  color: #6366f1;
  font-weight: 600;
}

.review-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
}

.review-filters {
  display: flex;
  gap: 0.5rem;
}

.review-filters select {
  padding: 0.4rem 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
}

.review-bulk-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.4rem 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background-color 0.15s;
}

.btn:hover {
  background-color: #f3f4f6;
}

.btn-approve {
  color: #16a34a;
  border-color: #16a34a;
}

.btn-approve:hover {
  background-color: #f0fdf4;
}

.btn-reject {
  color: #dc2626;
  border-color: #dc2626;
}

.btn-reject:hover {
  background-color: #fef2f2;
}

.btn-export {
  background: #6366f1;
  color: white;
  border-color: #6366f1;
  padding: 0.6rem 1.5rem;
  font-size: 1rem;
}

.btn-export:hover {
  background: #4f46e5;
}

.memory-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.memory-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  transition: border-color 0.15s;
}

.memory-card--approved {
  border-color: #16a34a;
  background-color: #f0fdf4;
}

.memory-card--rejected {
  border-color: #dc2626;
  background-color: #fef2f2;
  opacity: 0.6;
}

.memory-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
}

.confidence-badge {
  color: white;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.memory-source {
  color: #9ca3af;
}

.memory-text {
  margin-bottom: 0.75rem;
  line-height: 1.5;
}

.memory-card-actions {
  display: flex;
  gap: 0.5rem;
}

.review-export {
  position: sticky;
  bottom: 1rem;
  text-align: center;
  padding: 1rem;
  margin-top: 2rem;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/ReviewPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add review page with memory cards, filtering, and bulk actions"
```

---

### Task 12: Export Modal Component

**Files:**
- Create: `src/components/ExportModal.tsx`
- Test: `src/components/__tests__/ExportModal.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/ExportModal.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportModal } from "../ExportModal";

describe("ExportModal", () => {
  it("renders markdown content in a textarea", () => {
    render(
      <ExportModal
        markdown="# My Preferences\n- I prefer TypeScript"
        onClose={vi.fn()}
      />
    );
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue(
      "# My Preferences\n- I prefer TypeScript"
    );
  });

  it("has a copy to clipboard button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <ExportModal markdown="test content" onClose={vi.fn()} />
    );
    await userEvent.click(
      screen.getByRole("button", { name: /copy/i })
    );
    expect(writeText).toHaveBeenCalledWith("test content");
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(<ExportModal markdown="test" onClose={onClose} />);
    await userEvent.click(
      screen.getByRole("button", { name: /close/i })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("shows instructions for Claude import", () => {
    render(<ExportModal markdown="test" onClose={vi.fn()} />);
    expect(
      screen.getByText(/paste.*into.*claude/i)
    ).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/ExportModal.test.tsx`
Expected: FAIL

**Step 3: Write implementation**

Create `src/components/ExportModal.tsx`:
```tsx
import { useState } from "react";

interface ExportModalProps {
  markdown: string;
  onClose: () => void;
}

export function ExportModal({ markdown, onClose }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export Complete</h2>
        <p>
          Copy the text below and paste it into Claude with the message:
          "Please save all of these to your memory."
        </p>

        <textarea
          className="export-textarea"
          value={markdown}
          readOnly
          rows={15}
        />

        <div className="modal-actions">
          <button className="btn btn-export" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/ExportModal.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ExportModal.tsx src/components/__tests__/ExportModal.test.tsx
git commit -m "feat: add export modal with copy-to-clipboard"
```

---

### Task 13: Wire Up App Component

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Test: `src/components/__tests__/App.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/App.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import App from "../../App";

describe("App", () => {
  it("renders the upload page initially", () => {
    render(<App />);
    expect(
      screen.getByText(/upload your chatgpt export/i)
    ).toBeInTheDocument();
  });

  it("shows the app title", () => {
    render(<App />);
    expect(
      screen.getByText(/chatgpt to claude memory/i)
    ).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/App.test.tsx`
Expected: FAIL (default App.tsx has different content)

**Step 3: Write implementation**

Replace `src/App.tsx`:
```tsx
import { useState, useCallback } from "react";
import { extractConversations } from "./parser/zipParser";
import { parseConversation } from "./parser/conversationParser";
import { extractAllMemories } from "./extractors";
import { exportToMarkdown } from "./export/markdownExport";
import { UploadPage } from "./components/UploadPage";
import { ReviewPage } from "./components/ReviewPage";
import { ExportModal } from "./components/ExportModal";
import type { MemoryCandidate } from "./types";
import "./App.css";

type AppState = "upload" | "review" | "export";

function App() {
  const [state, setState] = useState<AppState>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>();
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [exportMarkdown, setExportMarkdown] = useState("");

  const handleFileSelected = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(undefined);
    try {
      const rawConversations = await extractConversations(file);
      const parsed = rawConversations.map(parseConversation);
      const memories = extractAllMemories(parsed);
      setCandidates(memories);
      setState("review");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process file"
      );
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleUpdateCandidate = useCallback(
    (id: string, updates: Partial<Pick<MemoryCandidate, "status" | "text">>) => {
      setCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const handleExport = useCallback(() => {
    const md = exportToMarkdown(candidates);
    setExportMarkdown(md);
    setState("export");
  }, [candidates]);

  return (
    <>
      {state === "upload" && (
        <UploadPage
          onFileSelected={handleFileSelected}
          isProcessing={isProcessing}
          error={error}
        />
      )}
      {state === "review" && (
        <ReviewPage
          candidates={candidates}
          onUpdateCandidate={handleUpdateCandidate}
          onExport={handleExport}
        />
      )}
      {state === "export" && (
        <ExportModal
          markdown={exportMarkdown}
          onClose={() => setState("review")}
        />
      )}
    </>
  );
}

export default App;
```

Replace `src/App.css`:
```css
:root {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #1a1a1a;
  background-color: #ffffff;
  line-height: 1.6;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  max-width: 700px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal h2 {
  margin-bottom: 0.5rem;
}

.modal p {
  color: #666;
  margin-bottom: 1rem;
}

.export-textarea {
  width: 100%;
  font-family: monospace;
  font-size: 0.85rem;
  padding: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  resize: vertical;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/App.test.tsx`
Expected: PASS

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/App.tsx src/App.css src/components/__tests__/App.test.tsx
git commit -m "feat: wire up App with upload, review, and export flow"
```

---

### Task 14: Clean Up and Final Verification

**Files:**
- Modify: `index.html` (update title)
- Delete: `src/assets/` (unused Vite boilerplate)

**Step 1: Update index.html title**

In `index.html`, change `<title>Vite + React + TS</title>` to `<title>ChatGPT to Claude Memory</title>`.

**Step 2: Remove unused boilerplate files**

```bash
rm -rf src/assets
```

Remove any unused Vite boilerplate from `src/main.tsx` if needed (keep it minimal - just renders `<App />`).

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

**Step 4: Run production build**

Run: `npm run build`
Expected: Successful build with no errors.

**Step 5: Test the dev server manually**

Run: `npm run dev`
Verify: App loads, shows upload page. (Manual verification step.)

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: clean up boilerplate, update title"
```
