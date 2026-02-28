# ChatGPT to Claude Memory Migration - Design

## Overview

A browser-only static web app that extracts memories from a ChatGPT data export and produces Claude Memory-compatible markdown for import. Fully client-side, no backend, no API keys needed. Distributable as a static site.

## Architecture

- **Stack:** React + TypeScript + Vite
- **Dependencies:** JSZip (in-browser ZIP extraction)
- **Deployment:** Static site (GitHub Pages, Netlify, Vercel, etc.)
- **Privacy:** All processing happens in the browser. No data leaves the user's machine.

### Core Flow

1. User opens the app in their browser
2. User uploads their ChatGPT export ZIP (from Settings > Data Controls > Export Data)
3. App unzips in-browser via JSZip, parses `conversations.json`
4. App walks each conversation's message tree to reconstruct linear threads
5. Heuristic extractors scan messages for memory-worthy content
6. Extracted candidates are displayed in a review UI
7. User approves, edits, or rejects each candidate
8. User exports approved memories as markdown, ready to paste into Claude

## Conversation Parser

ChatGPT's export uses a tree structure in `mapping` (not a flat list) to represent branching conversations (regenerated responses, edited messages).

### Parsing steps:

1. Unzip uploaded file, locate `conversations.json`
2. For each conversation, walk the `mapping` tree from `current_node` up through `parent` links to root, then reverse for chronological order
3. Extract metadata: title, model (`default_model_slug`), timestamps, Custom GPT usage (`gizmo_id`)
4. Flatten message content: handle `content_type` variants (`text`, `multimodal_text`, `code`, `execution_output`) into plain text. Skip image asset pointers.
5. Filter: keep only `user` and `assistant` role messages. Skip `system` and `tool` messages.

## Heuristic Memory Extractors

Five extractors, each producing categorized memory candidates:

### 1. Preference Extractor (`preference`)
- Pattern-matches: "I prefer", "I always", "I like", "don't ever", "please always", "my style is", "I want you to"
- Captures surrounding sentence/paragraph

### 2. Technical Profile Extractor (`technical`)
- Detects programming languages, frameworks, tools, platforms against a curated keyword list
- Tracks frequency across conversations (recurring vs. one-off)
- Extracts explicit stack/pattern descriptions

### 3. Project/Goal Extractor (`project`)
- Pattern-matches: "I'm working on", "my project", "the goal is", "I'm building", "my company", "my team"
- Captures project names, descriptions, goals

### 4. Identity/Context Extractor (`identity`)
- Pattern-matches: "I'm a", "my role is", "I work at", "my background is"
- Captures professional and personal context

### 5. Recurring Theme Detector (`theme`)
- Cross-conversation analysis: topics appearing in 3+ conversations
- Uses conversation titles + keyword frequency

### Candidate format:
- Extracted text
- Source conversation title
- Timestamp
- Confidence level (high/medium/low)
- Category tag

## Review UI

- Memory cards grouped by category
- Each card: extracted text, source conversation, date, confidence badge
- Per-card actions: Approve, Edit, Reject
- Bulk actions: "Approve all high-confidence", "Reject all low-confidence"
- Filter/sort by category, confidence, date
- Counter: "X of Y memories approved"

## Export Format

Structured markdown grouped by category, ready for Claude Memory import:

```markdown
# My Preferences
- I prefer TypeScript over JavaScript
- Always use functional components in React

# Technical Profile
- Primary stack: React, TypeScript, Node.js
- Uses Vite for build tooling

# Projects
- Working on a migration tool
- Building a SaaS dashboard

# About Me
- Senior frontend engineer
- 8 years experience

# Recurring Interests
- AI/ML integration in web apps
- Developer tooling
```

User copies this and pastes into Claude with "Please save all of these to your memory."
