# MigrateGPT

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tests](https://img.shields.io/badge/tests-255%20passing-brightgreen)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[migrategpt.org](https://migrategpt.org)**

Migrate your ChatGPT conversation memories to Claude. Runs entirely in your browser — no server, no sign-up, no data leaves your machine.

## What It Does

MigrateGPT scans your ChatGPT conversations and extracts facts about you — preferences, tech stack, projects, identity, recurring interests — then formats them for Claude's memory. You review everything before exporting.

## Getting Started

### Option 1: Bookmarklet (fastest)

1. Visit [migrategpt.org](https://migrategpt.org)
2. Drag the **"Export ChatGPT"** button to your bookmark bar
3. Open [chatgpt.com](https://chatgpt.com) and click the bookmarklet
4. Watch the progress overlay as it fetches your conversations
5. Click **"Open MigrateGPT"** when the export finishes
6. Review, approve, and export your memories

### Option 2: ZIP Upload

1. Go to [ChatGPT Settings > Data Controls > Export Data](https://chatgpt.com/#settings/DataControls)
2. Request and download your data export ZIP
3. Upload it at [migrategpt.org](https://migrategpt.org)

### Reviewing Memories

After import, you'll see a list of extracted memory candidates with confidence levels (high / medium / low). Use the bulk action buttons at the top to quickly approve or reject by confidence level, or page through and decide individually. When you're done, hit **Export** and paste the result into Claude.

## Privacy & Security

- **100% client-side** — no backend, no database, no analytics. Your conversations never leave your browser.
- **Bookmarklet is read-only** — it reads your ChatGPT session token to fetch conversations via ChatGPT's own API. The token is never sent anywhere else.
- **postMessage origin validation** — the app only accepts data from `chatgpt.com` and `chat.openai.com`
- **Open source** — audit the code yourself. The bookmarklet source is in [`bookmarklet/src/`](bookmarklet/src/).
- **Optional API key** — if you use Claude API extraction, your key is held in memory only and sent directly to `api.anthropic.com`

## Development

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev

# Run tests
npm test

# Build for production (includes bookmarklet)
npm run build
```

### Building the Bookmarklet

```bash
cd bookmarklet
npm install
npm run build
```

Produces `bookmarklet/dist/bookmarklet.js`, imported by the web app at build time via Vite's `?raw` import.

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
│       ├── ReviewPage.tsx       # Paginated review with bulk actions
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

## Tech Stack

- **React 19** + **TypeScript 5.9** — UI
- **Vite 7** — build tool and dev server
- **Vitest 4** + **React Testing Library** — 255 tests across 21 files
- **JSZip** — ZIP file parsing
- **esbuild** — bookmarklet bundling
- **Netlify** — static hosting

## License

MIT
