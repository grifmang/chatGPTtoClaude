# ChatGPT to Claude Memory

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tests](https://img.shields.io/badge/tests-251%20passing-brightgreen)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Migrate your ChatGPT conversation memories to Claude — entirely in your browser. No server, no data leaves your machine.

## How It Works

ChatGPT to Claude Memory extracts facts about you from your ChatGPT conversations (preferences, technical profile, projects, identity, recurring interests) and formats them for import into Claude's memory.

**Two ways to get your data:**

1. **ZIP export** — Request a data export from ChatGPT, download the ZIP, and upload it here
2. **Bookmarklet** (fast way) — Drag a bookmarklet to your bookmark bar, click it on chatgpt.com, and your conversations are sent directly to the app via `postMessage`

**Two extraction modes:**

- **Heuristic (default)** — Five pattern-matching extractors run locally with zero API calls
- **API-enhanced (optional)** — Provide your own Claude API key for LLM-powered extraction via Claude Haiku

After extraction, you review and approve each memory candidate, then copy the result into a new Claude conversation to save it.

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Run tests
npm test
```

The app will be available at `http://localhost:5173`.

### Building the Bookmarklet

```bash
cd bookmarklet
npm install
npm run build
```

This produces `bookmarklet/dist/bookmarklet.js`, which is imported by the web app at build time via Vite's `?raw` import.

## Project Structure

```
├── src/
│   ├── App.tsx                  # Main app with postMessage listener
│   ├── types.ts                 # Shared TypeScript types
│   ├── parser/
│   │   ├── zipParser.ts         # Extracts conversations.json from ZIP
│   │   └── conversationParser.ts # Walks ChatGPT mapping tree → flat messages
│   ├── extractors/
│   │   ├── index.ts             # Pipeline: runs all 5 extractors
│   │   ├── preferenceExtractor.ts
│   │   ├── technicalExtractor.ts
│   │   ├── projectExtractor.ts
│   │   ├── identityExtractor.ts
│   │   ├── themeExtractor.ts
│   │   └── apiExtractor.ts      # Claude API-powered extraction
│   ├── export/
│   │   └── markdownExport.ts    # Formats approved memories as Markdown
│   └── components/
│       ├── UploadPage.tsx       # 3-step wizard with bookmarklet install
│       ├── ReviewPage.tsx       # Review/approve/reject candidates
│       ├── MemoryCard.tsx       # Individual memory candidate card
│       ├── ExportModal.tsx      # Copy-to-clipboard export flow
│       └── Stepper.tsx          # Step indicator
├── bookmarklet/
│   ├── build.ts                 # esbuild → javascript: URI
│   └── src/
│       ├── bookmarklet.ts       # Main entry: auth → fetch → postMessage
│       ├── api.ts               # ChatGPT internal API helpers
│       └── overlay.ts           # Progress overlay injected into chatgpt.com
└── docs/plans/                  # Design and implementation docs
```

## Security

This app is designed with a privacy-first approach:

- **Runs entirely in your browser** — no backend server, no data transmitted to third parties
- **API key is memory-only** — if you use the optional Claude API extraction, your key is held in memory only, never persisted to storage, and sent directly to `api.anthropic.com`
- **postMessage origin validation** — the app only accepts messages from `chatgpt.com` and `chat.openai.com`; localhost is gated behind dev mode
- **No innerHTML** — all text rendering uses React JSX (auto-escaped) or `.textContent` (bookmarklet overlay)
- **Input validation** — ZIP contents are validated as JSON arrays; API responses are validated against category/confidence whitelists
- **Pagination safeguard** — bookmarklet limits to 500 pages to prevent infinite loops

## Testing

251 tests across 21 test files covering:

- Component rendering and interaction (UploadPage, ReviewPage, MemoryCard, ExportModal, Stepper)
- App state transitions and error handling
- postMessage listener security (origin validation, type checking)
- ZIP parsing edge cases (invalid JSON, missing files, non-array data)
- Conversation parser (tree walking, content types, null handling)
- All 5 heuristic extractors (pattern matching, deduplication, edge cases)
- API extractor (prompt building, response parsing, batching, error handling)
- Markdown export (grouping, sections, empty states)
- Bookmarklet (hostname validation, cancellation, popup blocking, timeouts)
- Overlay (DOM injection, XSS prevention, duplicate prevention)

```bash
# Run all tests (watch mode)
npm test

# Run once
npm run test:run

# Run bookmarklet tests
cd bookmarklet && npm test
```

## Tech Stack

- **React 19** + **TypeScript 5.9** — UI framework
- **Vite 7** — build tool and dev server
- **Vitest 4** + **React Testing Library** — testing
- **JSZip** — ZIP file parsing
- **esbuild** — bookmarklet bundling

## License

MIT
