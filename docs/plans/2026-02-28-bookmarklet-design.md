# ChatGPT Export Bookmarklet Design

## Overview

A JavaScript bookmarklet that extracts ChatGPT conversations directly from the ChatGPT web app, bypassing the slow email-based ZIP export. Runs on `chatgpt.com` (same origin), fetches conversations via internal API, and sends them to the web app via `postMessage`.

## Bookmarklet Architecture

### Folder Structure

```
bookmarklet/
├── src/
│   └── bookmarklet.ts      # Main bookmarklet source
├── build.ts                 # Bundles + minifies to bookmarklet one-liner
├── package.json
└── tsconfig.json
```

Separate from the web app to avoid mixing concerns. The build output is a `javascript:` URI that gets embedded in the web app's UI.

### Execution Flow

1. User clicks bookmarklet while on `chatgpt.com`
2. Bookmarklet fetches access token from `https://chatgpt.com/api/auth/session`
3. Paginates `GET /backend-api/conversations?offset=0&limit=100` to collect all conversation IDs
4. Fetches each full conversation via `GET /backend-api/conversation/{id}`
5. Shows floating progress overlay on ChatGPT page ("Fetching conversation 12 of 347...")
6. Opens web app in new tab via `window.open()`
7. Handshake: waits for app to post `{ type: "ready" }`, then sends `{ type: "conversations", data: ChatGPTConversation[] }`
8. Overlay updates to "Done! Check the new tab." and fades out

### Auth

Access token obtained from `https://chatgpt.com/api/auth/session` (returns `{ accessToken: "..." }`). Same-origin request, no CORS issues.

### Rate Limiting

Conversations fetched sequentially with ~100ms delay between requests. For 500 conversations, total fetch time is approximately 50 seconds.

### Progress Overlay

Floating div injected into the ChatGPT page:
- Semi-transparent backdrop with centered card
- Progress text: "Fetching conversation 12 of 347..."
- Progress bar
- Cancel button
- Error state with retry option

### Error Handling

- Not on chatgpt.com → alert with instructions
- Not logged in (401) → alert to log in first
- Rate limited (429) → exponential backoff with retry
- Network error on individual conversation → skip and report at end

## Web App Integration

### postMessage Protocol

**Handshake:**
1. App posts `{ type: "ready" }` to `window.opener` on load
2. Bookmarklet receives "ready" and sends `{ type: "conversations", data: ChatGPTConversation[] }`

**Message shape:**
```typescript
interface BookmarkletMessage {
  type: "conversations";
  data: ChatGPTConversation[];
}
```

### App Changes

1. **Message listener in App.tsx** — `window.addEventListener("message", ...)` on mount
   - Validates message shape (has `type: "conversations"` and `data` array)
   - Skips ZIP parser, passes directly to `conversationParser.parseConversation()`
   - Feeds into existing extraction pipeline

2. **UploadPage "receiving" state** — when data arrives via postMessage, wizard shows "Receiving from ChatGPT..." with auto-advance to processing

3. **Bookmarklet install UI** — on Step 0 of the wizard, a section: "Want it faster? Drag this to your bookmark bar:" with a draggable `<a href="javascript:...">` link. Instructions appear when clicked directly.

4. **Ready signal** — App posts `{ type: "ready" }` to `window.opener` on mount to complete the handshake

## Security

- Bookmarklet only runs on chatgpt.com (checks `window.location.hostname`)
- Access token never leaves the browser (used only for same-origin API calls)
- postMessage data validated before processing
- No external services contacted
