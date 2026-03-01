# MigrateGPT v2 Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish MigrateGPT for public Twitter launch with better extraction quality, improved review UX, bookmarklet flow improvements, export formats, and a hero section.

**Architecture:** Six independent workstreams executed sequentially. Each builds on the previous — extraction quality first (fixes data), then UX to display that data, then bookmarklet/export/hero for polish. All changes are client-side only.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, esbuild (bookmarklet)

---

## Task 1: Deduplication Pass

**Files:**
- Create: `src/extractors/dedup.ts`
- Modify: `src/extractors/index.ts`
- Create: `src/extractors/__tests__/dedup.test.ts`

**Step 1: Write the failing test**

```typescript
// src/extractors/__tests__/dedup.test.ts
import { describe, it, expect } from "vitest";
import { deduplicateCandidates } from "../dedup";
import type { MemoryCandidate } from "../../types";

function make(overrides: Partial<MemoryCandidate> & { id: string; text: string }): MemoryCandidate {
  return {
    category: "preference",
    confidence: "high",
    sourceTitle: "Test",
    sourceTimestamp: null,
    status: "pending",
    ...overrides,
  };
}

describe("deduplicateCandidates", () => {
  it("removes near-duplicate texts, keeping highest confidence", () => {
    const input = [
      make({ id: "1", text: "I prefer dark mode for all editors", confidence: "medium" }),
      make({ id: "2", text: "I prefer dark mode for all editors.", confidence: "high" }),
      make({ id: "3", text: "I always use TypeScript", confidence: "high" }),
    ];
    const result = deduplicateCandidates(input);
    expect(result).toHaveLength(2);
    expect(result[0].confidence).toBe("high");
    expect(result[0].text).toContain("dark mode");
    expect(result[1].text).toContain("TypeScript");
  });

  it("keeps exact duplicates as one entry", () => {
    const input = [
      make({ id: "1", text: "I use React" }),
      make({ id: "2", text: "I use React" }),
      make({ id: "3", text: "I use React" }),
    ];
    const result = deduplicateCandidates(input);
    expect(result).toHaveLength(1);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateCandidates([])).toEqual([]);
  });

  it("does not merge texts that are somewhat similar but different", () => {
    const input = [
      make({ id: "1", text: "I prefer using React for frontend development" }),
      make({ id: "2", text: "I prefer using Vue for frontend development" }),
    ];
    const result = deduplicateCandidates(input);
    expect(result).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/extractors/__tests__/dedup.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/extractors/dedup.ts
import type { MemoryCandidate, Confidence } from "../types";

const CONFIDENCE_RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

/**
 * Normalize text for comparison: lowercase, collapse whitespace, strip trailing punctuation.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/, "").trim();
}

/**
 * Compute similarity ratio between two strings using longest common subsequence.
 * Returns a value between 0 and 1.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  // Use character-level LCS for speed
  const m = a.length;
  const n = b.length;
  const prev = new Uint16Array(n + 1);
  const curr = new Uint16Array(n + 1);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    prev.set(curr);
    curr.fill(0);
  }

  const lcsLen = prev[n];
  return (2 * lcsLen) / (m + n);
}

const SIMILARITY_THRESHOLD = 0.8;

/**
 * Remove near-duplicate candidates, keeping the one with highest confidence.
 */
export function deduplicateCandidates(candidates: MemoryCandidate[]): MemoryCandidate[] {
  if (candidates.length === 0) return [];

  const kept: MemoryCandidate[] = [];
  const normalizedKept: string[] = [];

  // Sort by confidence descending so we keep the best version
  const sorted = [...candidates].sort(
    (a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence],
  );

  for (const candidate of sorted) {
    const norm = normalize(candidate.text);
    const isDuplicate = normalizedKept.some(
      (existing) => similarity(norm, existing) >= SIMILARITY_THRESHOLD,
    );
    if (!isDuplicate) {
      kept.push(candidate);
      normalizedKept.push(norm);
    }
  }

  return kept;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/extractors/__tests__/dedup.test.ts`
Expected: PASS

**Step 5: Wire dedup into pipeline**

Modify `src/extractors/index.ts`:

```typescript
import { deduplicateCandidates } from "./dedup";

export function extractAllMemories(
  conversations: ParsedConversation[],
): MemoryCandidate[] {
  const raw = [
    ...extractPreferences(conversations),
    ...extractTechnical(conversations),
    ...extractProjects(conversations),
    ...extractIdentity(conversations),
    ...extractThemes(conversations),
  ];
  return deduplicateCandidates(raw);
}
```

**Step 6: Run all tests**

Run: `npx vitest run`
Expected: All pass

**Step 7: Commit**

```bash
git add src/extractors/dedup.ts src/extractors/__tests__/dedup.test.ts src/extractors/index.ts
git commit -m "feat: add deduplication pass to extraction pipeline"
```

---

## Task 2: Smarter Preference Heuristics

**Files:**
- Modify: `src/extractors/preferenceExtractor.ts`
- Modify: `src/extractors/__tests__/preferenceExtractor.test.ts`

**Step 1: Write failing tests for the new filters**

Add to the existing test file:

```typescript
it("filters out sentences shorter than 5 words", () => {
  const convs = [makeConv("user", "I prefer it.")];
  const result = extractPreferences(convs);
  expect(result).toHaveLength(0);
});

it("filters out questions", () => {
  const convs = [makeConv("user", "Do I prefer dark mode or light mode?")];
  const result = extractPreferences(convs);
  expect(result).toHaveLength(0);
});

it("keeps valid preference sentences", () => {
  const convs = [makeConv("user", "I prefer using dark mode in all my editors.")];
  const result = extractPreferences(convs);
  expect(result).toHaveLength(1);
});
```

**Step 2: Run test to verify failures**

Run: `npx vitest run src/extractors/__tests__/preferenceExtractor.test.ts`

**Step 3: Add filters to extractPreferences**

In `src/extractors/preferenceExtractor.ts`, after extracting the sentence (line 70), add:

```typescript
const sentence = extractSentence(msg.text, match.index);

// Filter out fragments (< 5 words) and questions
const wordCount = sentence.split(/\s+/).length;
if (wordCount < 5) break;
if (sentence.endsWith("?")) break;
```

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add src/extractors/preferenceExtractor.ts src/extractors/__tests__/preferenceExtractor.test.ts
git commit -m "feat: filter noisy preference matches (short sentences, questions)"
```

---

## Task 3: Theme Extractor — Bigrams/Trigrams

**Files:**
- Modify: `src/extractors/themeExtractor.ts`
- Modify: `src/extractors/__tests__/themeExtractor.test.ts`

**Step 1: Write failing tests**

Replace or add tests that expect bigrams:

```typescript
it("extracts bigrams appearing in 3+ conversations", () => {
  const convs = [
    makeConv("user", "I'm working on machine learning"),
    makeConv("user", "My machine learning pipeline is slow"),
    makeConv("user", "How do I improve machine learning performance"),
  ];
  const result = extractThemes(convs);
  const texts = result.map((r) => r.text);
  expect(texts.some((t) => t.includes("machine learning"))).toBe(true);
});

it("does not extract single common words as themes", () => {
  const convs = [
    makeConv("user", "The code is broken"),
    makeConv("user", "Fix the code please"),
    makeConv("user", "Show me the code"),
  ];
  const result = extractThemes(convs);
  const texts = result.map((r) => r.text);
  // "code" alone should NOT appear as a theme
  expect(texts.some((t) => /: "code"/i.test(t))).toBe(false);
});
```

**Step 2: Run test to verify failures**

Run: `npx vitest run src/extractors/__tests__/themeExtractor.test.ts`

**Step 3: Rewrite tokenize to produce ngrams**

Replace the `tokenize` function and counting logic in `themeExtractor.ts`:

```typescript
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function extractNgrams(words: string[]): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    // Skip bigrams where both words are stop words
    if (!STOP_WORDS.has(words[i]) || !STOP_WORDS.has(words[i + 1])) {
      ngrams.push(bigram);
    }
    if (i < words.length - 2) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      const stopCount = [words[i], words[i + 1], words[i + 2]].filter((w) => STOP_WORDS.has(w)).length;
      if (stopCount < 2) {
        ngrams.push(trigram);
      }
    }
  }
  return ngrams;
}
```

Update the counting to use `extractNgrams(tokenize(text))` and count ngram frequency across conversations. Keep threshold at 3+ conversations, high if 5+.

**Step 4: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add src/extractors/themeExtractor.ts src/extractors/__tests__/themeExtractor.test.ts
git commit -m "feat: replace single-word themes with bigram/trigram extraction"
```

---

## Task 4: Smart Defaults in App.tsx

**Files:**
- Modify: `src/App.tsx` (lines 30-61)
- Modify: `src/components/__tests__/App.test.tsx`

**Step 1: Write failing test**

```typescript
it("auto-approves high confidence and auto-rejects low confidence after extraction", async () => {
  // ... render App, upload a file, wait for processing ...
  // Verify high-confidence candidates have status "approved"
  // Verify low-confidence candidates have status "rejected"
  // Verify medium-confidence candidates remain "pending"
});
```

**Step 2: Implement in processConversations**

After extraction completes (line 48 in App.tsx), before `setCandidates`:

```typescript
const withDefaults = memories.map((m) => ({
  ...m,
  status:
    m.confidence === "high" ? "approved" as const :
    m.confidence === "low" ? "rejected" as const :
    "pending" as const,
}));
setCandidates(withDefaults);
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add src/App.tsx src/components/__tests__/App.test.tsx
git commit -m "feat: auto-approve high and auto-reject low confidence memories"
```

---

## Task 5: Review Page — Show Only Pending by Default

**Files:**
- Modify: `src/components/ReviewPage.tsx`
- Modify: `src/components/ReviewPage.css`
- Modify: `src/components/__tests__/ReviewPage.test.tsx`

**Step 1: Add status filter state and "Show all" toggle**

Add to ReviewPage.tsx:

```typescript
const [showAll, setShowAll] = useState(false);
```

Update the filter logic to hide non-pending items unless showAll is true:

```typescript
const filteredCandidates = useMemo(
  () =>
    candidates.filter((c) => {
      if (!showAll && c.status !== "pending") return false;
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (confidenceFilter && c.confidence !== confidenceFilter) return false;
      return true;
    }),
  [candidates, categoryFilter, confidenceFilter, showAll],
);
```

Add a toggle bar:

```tsx
<div className="review-view-toggle">
  <span>
    {showAll ? `Showing all ${filteredCandidates.length} memories` : `${filteredCandidates.length} pending for review`}
  </span>
  <button className="btn btn-bulk" onClick={() => { setShowAll(!showAll); setPage(0); }}>
    {showAll ? "Show pending only" : "Show all"}
  </button>
</div>
```

**Step 2: Write tests**

```typescript
it("shows only pending candidates by default", () => {
  const candidates = [
    makeCandidate({ id: "1", status: "approved" }),
    makeCandidate({ id: "2", status: "pending" }),
    makeCandidate({ id: "3", status: "rejected" }),
  ];
  render(<ReviewPage candidates={candidates} onUpdateCandidate={vi.fn()} onExport={vi.fn()} />);
  // Only pending should be visible
  expect(screen.getAllByTestId("memory-card")).toHaveLength(1);
});

it("shows all candidates when Show all is clicked", () => {
  // ... click "Show all", verify all 3 visible
});
```

**Step 3: Add CSS for toggle bar**

```css
.review-view-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(100, 108, 255, 0.08);
  border-radius: 8px;
  font-size: 0.9rem;
  color: #aaa;
}
```

**Step 4: Run tests, commit**

```bash
git add src/components/ReviewPage.tsx src/components/ReviewPage.css src/components/__tests__/ReviewPage.test.tsx
git commit -m "feat: show only pending memories by default with Show All toggle"
```

---

## Task 6: Review Progress Bar

**Files:**
- Modify: `src/components/ReviewPage.tsx`
- Modify: `src/components/ReviewPage.css`

**Step 1: Add progress bar to header**

In ReviewPage.tsx, after the counter `<p>`:

```tsx
const reviewedCount = candidates.filter((c) => c.status !== "pending").length;
const reviewProgress = totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0;

// In JSX:
<div className="review-progress-bar">
  <div className="review-progress-fill" style={{ width: `${reviewProgress}%` }} />
</div>
<p className="review-counter">
  {reviewedCount} of {totalCount} reviewed — {approvedCount} approved
</p>
```

**Step 2: CSS**

```css
.review-progress-bar {
  height: 6px;
  background: #2a2a2a;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.review-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #64b5f6);
  border-radius: 3px;
  transition: width 0.3s ease;
}
```

**Step 3: Run tests, commit**

```bash
git add src/components/ReviewPage.tsx src/components/ReviewPage.css
git commit -m "feat: add review progress bar"
```

---

## Task 7: Search / Text Filter

**Files:**
- Modify: `src/components/ReviewPage.tsx`
- Modify: `src/components/ReviewPage.css`
- Modify: `src/components/__tests__/ReviewPage.test.tsx`

**Step 1: Add search state and input**

```typescript
const [searchQuery, setSearchQuery] = useState("");
```

Add to filter logic:

```typescript
if (searchQuery) {
  const q = searchQuery.toLowerCase();
  if (!c.text.toLowerCase().includes(q) && !c.sourceTitle.toLowerCase().includes(q)) return false;
}
```

Add input in the toolbar:

```tsx
<input
  type="text"
  placeholder="Search memories..."
  value={searchQuery}
  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
  className="review-search-input"
/>
```

**Step 2: CSS**

```css
.review-search-input {
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  border: 1px solid #444;
  background: #1a1a1a;
  color: inherit;
  font-size: 0.9rem;
  flex: 1;
  min-width: 150px;
}

.review-search-input::placeholder {
  color: #666;
}
```

**Step 3: Write test**

```typescript
it("filters candidates by search text", () => {
  const candidates = [
    makeCandidate({ id: "1", text: "I prefer dark mode", status: "pending" }),
    makeCandidate({ id: "2", text: "I use TypeScript", status: "pending" }),
  ];
  render(<ReviewPage candidates={candidates} onUpdateCandidate={vi.fn()} onExport={vi.fn()} />);
  const input = screen.getByPlaceholderText("Search memories...");
  fireEvent.change(input, { target: { value: "dark" } });
  expect(screen.getAllByTestId("memory-card")).toHaveLength(1);
});
```

**Step 4: Run tests, commit**

```bash
git add src/components/ReviewPage.tsx src/components/ReviewPage.css src/components/__tests__/ReviewPage.test.tsx
git commit -m "feat: add search filter to review page"
```

---

## Task 8: Bookmarklet — Date Range + Count Preview

**Files:**
- Modify: `bookmarklet/src/overlay.ts`
- Modify: `bookmarklet/src/bookmarklet.ts`
- Modify: `bookmarklet/src/__tests__/bookmarklet.test.ts`

**Step 1: Add `promptChoice` to overlay**

Add new method to the Overlay interface and implementation:

```typescript
promptChoice(statusText: string, options: { label: string; value: string }[]): Promise<string>;
```

Implementation creates a row of styled buttons, returns a promise resolving with the clicked option's value.

**Step 2: Update bookmarklet flow**

After fetching the conversation list, add two new prompts:

```typescript
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

// 5. Count preview and confirm
await overlay.promptAction(
  `Exporting ${filteredList.length} conversations.`,
  "Start export",
);
```

**Step 3: Update tests**

Update test mocks to include `promptChoice: vi.fn(() => Promise.resolve("all"))` on the mock overlay, and update the flow expectations.

**Step 4: Rebuild bookmarklet, run all tests**

Run: `npm run build:bookmarklet && npx vitest run`
Expected: All pass

**Step 5: Commit**

```bash
git add bookmarklet/src/overlay.ts bookmarklet/src/bookmarklet.ts bookmarklet/src/__tests__/bookmarklet.test.ts
git commit -m "feat: add date range filter and count preview to bookmarklet"
```

---

## Task 9: CLAUDE.md Export Format

**Files:**
- Create: `src/export/claudeMdExport.ts`
- Create: `src/export/__tests__/claudeMdExport.test.ts`
- Modify: `src/components/ExportModal.tsx`
- Modify: `src/App.tsx`

**Step 1: Write tests for CLAUDE.md formatter**

```typescript
// src/export/__tests__/claudeMdExport.test.ts
import { describe, it, expect } from "vitest";
import { exportToClaudeMd } from "../claudeMdExport";

describe("exportToClaudeMd", () => {
  it("groups approved memories under semantic headings", () => {
    const candidates = [
      make({ category: "identity", text: "Senior data engineer at fintech startup", status: "approved" }),
      make({ category: "preference", text: "Prefers dark mode in all editors", status: "approved" }),
      make({ category: "technical", text: "Uses React and TypeScript", status: "approved" }),
      make({ category: "preference", text: "Rejected memory", status: "rejected" }),
    ];
    const md = exportToClaudeMd(candidates);
    expect(md).toContain("# About Me");
    expect(md).toContain("# Preferences");
    expect(md).toContain("# Tech Stack");
    expect(md).not.toContain("Rejected memory");
  });
});
```

**Step 2: Implement**

```typescript
// src/export/claudeMdExport.ts
import type { MemoryCandidate, MemoryCategory } from "../types";

const SECTIONS: { key: MemoryCategory; heading: string }[] = [
  { key: "identity", heading: "About Me" },
  { key: "preference", heading: "Preferences" },
  { key: "technical", heading: "Tech Stack" },
  { key: "project", heading: "Current Projects" },
  { key: "theme", heading: "Interests & Recurring Topics" },
];

export function exportToClaudeMd(candidates: MemoryCandidate[]): string {
  const approved = candidates.filter((c) => c.status === "approved");
  const grouped = new Map<MemoryCategory, MemoryCandidate[]>();

  for (const c of approved) {
    const list = grouped.get(c.category) ?? [];
    list.push(c);
    grouped.set(c.category, list);
  }

  const sections: string[] = [];
  for (const { key, heading } of SECTIONS) {
    const items = grouped.get(key);
    if (!items || items.length === 0) continue;
    const bullets = items.map((c) => `- ${c.text}`).join("\n");
    sections.push(`# ${heading}\n\n${bullets}`);
  }

  return sections.join("\n\n");
}
```

**Step 3: Add format toggle to ExportModal**

Add state for format selection and render both options. Pass the format choice to the parent via a new prop or generate both formats and toggle display.

**Step 4: Add download button**

```tsx
const handleDownload = () => {
  const filename = format === "claudemd" ? "CLAUDE.md" : "claude-memories.md";
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Step 5: Run tests, commit**

```bash
git add src/export/claudeMdExport.ts src/export/__tests__/claudeMdExport.test.ts src/components/ExportModal.tsx src/App.tsx
git commit -m "feat: add CLAUDE.md export format and download button"
```

---

## Task 10: Hero Section

**Files:**
- Modify: `src/components/UploadPage.tsx`
- Modify: `src/components/UploadPage.css`
- Modify: `src/components/__tests__/UploadPage.test.tsx`

**Step 1: Add hero JSX above the stepper**

In UploadPage.tsx, add a hero section before the existing content. Only render when no data has been loaded:

```tsx
<section className="hero">
  <h1 className="hero-title">Migrate your ChatGPT memories to Claude</h1>
  <p className="hero-subtitle">100% in your browser. No sign-up. No data leaves your machine.</p>
  <div className="hero-pills">
    <span className="hero-pill">800+ conversations</span>
    <span className="hero-pill">One-click export</span>
    <span className="hero-pill">Open source</span>
  </div>
  <div className="hero-demo">
    {/* CSS-animated 3-step flow mockup */}
    <div className="demo-step demo-step-1">Click bookmarklet</div>
    <div className="demo-arrow">&rarr;</div>
    <div className="demo-step demo-step-2">Review memories</div>
    <div className="demo-arrow">&rarr;</div>
    <div className="demo-step demo-step-3">Export to Claude</div>
  </div>
  <button className="btn btn-primary hero-cta" onClick={() => {
    document.getElementById("wizard")?.scrollIntoView({ behavior: "smooth" });
  }}>
    Get started
  </button>
</section>

<div id="wizard">
  {/* existing stepper and wizard content */}
</div>
```

**Step 2: CSS for hero and animated demo**

```css
.hero {
  text-align: center;
  padding: 4rem 2rem 3rem;
  max-width: 700px;
  margin: 0 auto;
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 1.15rem;
  color: #999;
  margin-bottom: 2rem;
}

.hero-pills {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
}

.hero-pill {
  padding: 0.4rem 1rem;
  border-radius: 20px;
  border: 1px solid #444;
  font-size: 0.85rem;
  color: #bbb;
  background: rgba(255, 255, 255, 0.04);
}

.hero-demo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2.5rem;
}

.demo-step {
  padding: 1rem 1.5rem;
  border-radius: 10px;
  background: #1a1a2e;
  border: 1px solid #333;
  font-size: 0.9rem;
  animation: demo-fade 6s ease-in-out infinite;
}

.demo-step-1 { animation-delay: 0s; }
.demo-step-2 { animation-delay: 2s; }
.demo-step-3 { animation-delay: 4s; }

.demo-arrow {
  color: #555;
  font-size: 1.2rem;
}

@keyframes demo-fade {
  0%, 20% { opacity: 0.4; border-color: #333; }
  30%, 50% { opacity: 1; border-color: #646cff; }
  60%, 100% { opacity: 0.4; border-color: #333; }
}

.hero-cta {
  font-size: 1.1rem;
  padding: 0.75rem 2rem;
}
```

**Step 3: Write test**

```typescript
it("renders hero section with headline", () => {
  render(<UploadPage onFileSelected={vi.fn()} isProcessing={false} />);
  expect(screen.getByText("Migrate your ChatGPT memories to Claude")).toBeInTheDocument();
});

it("scrolls to wizard on Get Started click", () => {
  render(<UploadPage onFileSelected={vi.fn()} isProcessing={false} />);
  const scrollSpy = vi.fn();
  const el = document.createElement("div");
  el.id = "wizard";
  el.scrollIntoView = scrollSpy;
  document.body.appendChild(el);
  fireEvent.click(screen.getByText("Get started"));
  expect(scrollSpy).toHaveBeenCalled();
  el.remove();
});
```

**Step 4: Run tests, commit**

```bash
git add src/components/UploadPage.tsx src/components/UploadPage.css src/components/__tests__/UploadPage.test.tsx
git commit -m "feat: add hero section with animated demo and CTA"
```

---

## Task 11: Final — Full Test Run + Push

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All pass

**Step 2: Build production bundle**

Run: `npm run build`
Expected: Clean build, no errors

**Step 3: Push**

```bash
git push
```
