import type { ParsedConversation, MemoryCandidate } from "../types";
import { extractSentence } from "./preferenceExtractor";

// ─── Tech Keywords (~50 popular languages, frameworks, tools) ────────────────

const TECH_KEYWORDS: string[] = [
  // Languages
  "JavaScript", "TypeScript", "Python", "Java", "Kotlin", "Swift",
  "Rust", "Go", "Ruby", "PHP", "C\\+\\+", "C#", "Scala", "Elixir",
  "Haskell", "Lua", "Perl", "R", "Dart", "Zig",
  // Frontend frameworks/libraries
  "React", "Vue", "Angular", "Svelte", "Next\\.js", "Nuxt",
  "Tailwind", "Bootstrap",
  // Backend frameworks
  "Node\\.js", "Express", "Django", "Flask", "FastAPI", "Spring",
  "Rails", "Laravel", "NestJS",
  // Databases
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "DynamoDB",
  "Supabase", "Firebase",
  // DevOps / Cloud / Tools
  "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Terraform",
  "Ansible", "Jenkins", "GitHub Actions", "Vercel", "Netlify",
  // Other tools
  "GraphQL", "REST", "gRPC", "Webpack", "Vite", "ESLint",
  "Prettier", "Jest", "Vitest", "Cypress",
];

// Build word-boundary regex for each keyword
const TECH_REGEXES: Array<{ keyword: string; regex: RegExp }> =
  TECH_KEYWORDS.map((kw) => ({
    keyword: kw.replace(/\\[+.#]/g, (m) => m.slice(1)), // unescape for display
    regex: new RegExp(`\\b${kw}\\b`, "i"),
  }));

// ─── Stack Description Patterns ──────────────────────────────────────────────

const STACK_PATTERNS: RegExp[] = [
  /\bmy stack is\b/i,
  /\bI use\b/i,
  /\bI'm using\b/i,
  /\bwe use\b/i,
  /\bI build with\b/i,
  /\bI develop with\b/i,
  /\bI work with\b/i,
];

// ─── Extractor ───────────────────────────────────────────────────────────────

export function extractTechnical(
  conversations: ParsedConversation[],
): MemoryCandidate[] {
  const candidates: MemoryCandidate[] = [];
  let counter = 0;

  // ── Pass 1: Count tech keyword frequency (one count per conversation) ──
  const techFrequency = new Map<string, number>();

  for (const conv of conversations) {
    // Collect all user text in this conversation
    const mentionedInConv = new Set<string>();

    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;

      for (const { keyword, regex } of TECH_REGEXES) {
        if (regex.test(msg.text)) {
          mentionedInConv.add(keyword);
        }
      }
    }

    // Increment frequency for each unique keyword found in this conversation
    for (const keyword of mentionedInConv) {
      techFrequency.set(keyword, (techFrequency.get(keyword) ?? 0) + 1);
    }
  }

  // ── Pass 2: Extract explicit stack descriptions ──
  for (const conv of conversations) {
    for (const msg of conv.messages) {
      if (msg.role !== "user") continue;

      for (const pattern of STACK_PATTERNS) {
        const match = pattern.exec(msg.text);
        if (match) {
          const sentence = extractSentence(msg.text, match.index);
          candidates.push({
            id: `tech-${counter++}`,
            text: sentence,
            category: "technical",
            confidence: "high",
            sourceTitle: conv.title,
            sourceTimestamp: conv.createdAt,
            status: "pending",
          });
          break; // one match per message
        }
      }
    }
  }

  // ── Pass 3: Report technologies appearing in 3+ conversations ──
  for (const [keyword, count] of techFrequency.entries()) {
    if (count >= 3) {
      candidates.push({
        id: `tech-${counter++}`,
        text: `Frequently uses ${keyword} (mentioned in ${count} conversations)`,
        category: "technical",
        confidence: "high",
        sourceTitle: "multiple",
        sourceTimestamp: null,
        status: "pending",
      });
    }
  }

  return candidates;
}
