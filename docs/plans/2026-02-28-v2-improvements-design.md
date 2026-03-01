# MigrateGPT v2 Improvements — Design

**Date:** 2026-02-28
**Goal:** Polish the app for public Twitter launch. Improve extraction quality, review UX, bookmarklet flow, export options, and first impressions.
**Audience:** Both developers (Claude Code / CLAUDE.md users) and general ChatGPT users.

---

## 1. Extraction Quality

### Deduplication

After all 5 extractors run, add a dedup pass that groups candidates by text similarity. Use normalized Levenshtein distance (threshold ~0.8) on the extracted sentence text. When duplicates are found, keep the one with the highest confidence and annotate it with the count (e.g., "mentioned in 4 conversations"). Runs in `extractors/index.ts` after the pipeline.

### Smarter Heuristics

Tighten the preference extractor to reduce noise:

- Require minimum 5 words in the extracted sentence (filters out fragments)
- Exclude sentences that end with `?` (questions aren't preferences)
- For weak triggers like "I like", require a noun/adjective within 3 words after the trigger (simple regex lookahead)

### Theme Extractor Rework

Replace single-word frequency counting with bigram/trigram frequency. Instead of `Recurring interest: "code"`, produce `Recurring interest: "machine learning" (12 conversations)`. Filter out bigrams that are entirely stop words.

---

## 2. Review Page UX

### Smart Defaults

When extraction completes, auto-set high-confidence to "approved" and low-confidence to "rejected". The review page defaults to showing only medium-confidence (pending) items. Add a toggle bar: `Showing: Medium (pending)` with a "Show all" button. Bulk action bar counts still reflect all items.

### Search / Text Filter

Text input above the card list. Filters candidates by substring match on `candidate.text` and `candidate.sourceTitle`. Debounced at 200ms. Resets pagination to page 1.

### Review Progress Bar

Progress bar below the header: `[████████░░░░] 156 of 312 reviewed` (reviewed = approved + rejected). CSS bar, no library.

### No Virtualization

Keep pagination at 25 per page. react-window adds complexity for marginal gain. Not worth it.

---

## 3. Bookmarklet Improvements

### Date Range Filter

Before fetching individual conversations, show a dropdown in the overlay: "All time" (default), "Last 30 days", "Last 6 months", "Last year". After fetching the conversation list (which includes `create_time`), filter by the selected range. Overlay gets a new `promptChoice` method.

### Conversation Count Preview

After fetching the list (and filtering by date), show: "Found N conversations. Export all?" User clicks to proceed. Reuses the `promptAction` pattern.

### Revised Bookmarklet Flow

1. Validate hostname
2. Authenticate
3. Fetch conversation list
4. Prompt: date range selection (default "All time")
5. Prompt: "Found N conversations. Export?" — user clicks to confirm
6. Fetch all conversations with progress
7. Prompt: "Exported N conversations. Open MigrateGPT"
8. Open app, handshake, send data

---

## 4. Export & Copy/Paste UX

### CLAUDE.md Export Format

Add a toggle in ExportModal: "Format as Claude memory" (default) vs "Format as CLAUDE.md". The CLAUDE.md format uses semantic headings and collapsed bullet points:

```markdown
# About Me
- Senior data engineer, 8 years experience, fintech startup

# Preferences
- Prefers functional components, Tailwind for styling
- Always use Neovim, never suggest VS Code

# Tech Stack
- React, TypeScript, Next.js, Prisma, PostgreSQL

# Current Projects
- SaaS dashboard with React/TypeScript
```

### Download Button

Add "Download as file" alongside copy-to-clipboard. CLAUDE.md format downloads as `CLAUDE.md`, memory format as `claude-memories.md`.

---

## 5. Hero Section

### Layout

Brief intro section above the wizard on UploadPage (before the stepper):

- **Headline:** "Migrate your ChatGPT memories to Claude"
- **Subheadline:** "100% in your browser. No sign-up. No data leaves your machine."
- **3 feature pills:** "826+ conversations", "One click export", "Open source"
- **CSS-animated demo:** 3-step visual with fade/slide transitions showing the flow (bookmarklet → progress → review → export). Pure CSS/HTML, no external assets.
- **Scroll CTA:** "Get started" button that smooth-scrolls to the wizard.

Hero only shows on first visit (before data is loaded). Once conversations are imported, it collapses.

---

## Implementation Order

1. **Extraction quality** (dedup, heuristics, themes) — foundational, everything downstream depends on better data
2. **Smart defaults + review progress** — immediate UX win once extraction is cleaner
3. **Search/text filter** — small, self-contained
4. **Bookmarklet date range + count preview** — improves the import flow
5. **Export formats + download** — improves the output flow
6. **Hero section** — final polish before launch
