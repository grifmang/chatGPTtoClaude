# UX Enhancements Design - Guided Export, Claude Import, API Mode

## Overview

Three enhancements to improve the end-to-end user experience:
1. Guided ChatGPT export wizard (replace simple instructions)
2. Better Claude Memory import UX (guided paste flow)
3. Optional Claude API key mode (enhanced extraction quality)

## Feature 1: Guided ChatGPT Export Wizard

Replace the Upload page's collapsible instructions with a multi-step wizard.

### Steps:

**Step 1 - "Get your ChatGPT data"**
- Explanation text about requesting the export
- Button: "Open ChatGPT Data Controls" → `https://chatgpt.com/#settings/DataControls`
- Numbered instructions: click Export data → confirm → check email
- "I've already requested my export" skip link

**Step 2 - "Download your export"**
- Instruction to check email for OpenAI download link
- Note that link expires in 24 hours
- "I have my ZIP file" button to proceed

**Step 3 - "Upload your export"**
- Existing drag-and-drop upload zone
- Optional API key toggle (see Feature 3)
- Processing spinner

Stepper UI at top shows Step 1 → 2 → 3 with current step highlighted.
Users can skip to Step 3 directly if they already have their ZIP.

## Feature 2: Better Claude Import UX

Replace the Export Modal with a richer guided import experience.

### Two-part modal:

**Part A - Review export**
- Read-only textarea with markdown (existing)
- Copy to clipboard button (existing)

**Part B - Import into Claude**
- Pre-composed message in copyable box: instruction prefix + markdown content
- "Copy message" button (copies full text including "Please save all of these to your memory:" prefix)
- "Open Claude" button → `https://claude.ai/new` (new tab)
- Step-by-step checklist:
  1. Click "Copy message" above
  2. Click "Open Claude" to start a new conversation
  3. Paste the message and send it
  4. Claude will confirm the memories have been saved

## Feature 3: Optional Claude API Key Mode

Add an opt-in mode that uses the Claude API for higher-quality extraction.

### UI:
- Toggle on Upload page Step 3: "Use Claude API for enhanced extraction"
- When enabled: API key text input appears
- Privacy notice about key usage (sessionStorage only, never persisted)

### Extraction flow:
- Model: claude-haiku-4-5-20251001 (cost efficient)
- Batch ~5-10 conversations per API call
- Direct browser → api.anthropic.com (CORS supported)
- Prompt asks Claude to extract memories in same 5 categories with confidence
- Progress indicator: "Analyzing batch 3 of 12..."
- Results feed into same review UI as heuristic extraction

### When disabled:
- Existing heuristic extraction (no change)

### Security:
- API key stored in sessionStorage only (cleared on tab close)
- Never sent anywhere except api.anthropic.com
- Never persisted to localStorage or cookies
