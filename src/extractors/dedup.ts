import type { Confidence, MemoryCandidate } from "../types";

// ─── Confidence ranking ──────────────────────────────────────────────────────

const CONFIDENCE_RANK: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

// ─── LCS-based similarity ────────────────────────────────────────────────────

/**
 * Compute the length of the Longest Common Subsequence of two strings.
 * Uses a standard DP approach with O(m*n) time and O(min(m,n)) space.
 */
function lcsLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;

  // Ensure `b` is the shorter string for space optimisation
  if (a.length < b.length) [a, b] = [b, a];

  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return prev[n];
}

/**
 * Compute LCS-based similarity between two strings.
 * Returns a value in [0, 1] where 1 means identical.
 */
function lcsSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const lcs = lcsLength(a, b);
  return (2 * lcs) / (a.length + b.length);
}

// ─── Deduplication ───────────────────────────────────────────────────────────

const SIMILARITY_THRESHOLD = 0.8;

/**
 * Normalise text for comparison: lowercase and trim.
 */
function normalise(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Deduplicate an array of MemoryCandidate entries using LCS-based similarity.
 *
 * When two candidates have similarity >= threshold (~0.8), they are considered
 * duplicates. The candidate with the highest confidence is kept. In case of a
 * tie, the first occurrence wins.
 *
 * The output preserves the order of first occurrence for each surviving group.
 */
export function dedup(candidates: MemoryCandidate[]): MemoryCandidate[] {
  if (candidates.length === 0) return [];

  // Each element starts in its own group. Groups are represented as indices
  // into the `best` array, which tracks the best candidate for each group.
  // `groupOf[i]` stores the group representative index for candidate i.
  const n = candidates.length;
  const groupOf = new Array<number>(n);
  for (let i = 0; i < n; i++) groupOf[i] = i;

  // Find the root representative for a candidate (with path compression).
  function root(i: number): number {
    while (groupOf[i] !== i) {
      groupOf[i] = groupOf[groupOf[i]];
      i = groupOf[i];
    }
    return i;
  }

  // Merge candidate j's group into candidate i's group (i is the earlier one).
  function merge(i: number, j: number): void {
    const ri = root(i);
    const rj = root(j);
    if (ri !== rj) {
      // Always point the later root toward the earlier root so that
      // the first-occurrence ordering is preserved.
      if (ri < rj) {
        groupOf[rj] = ri;
      } else {
        groupOf[ri] = rj;
      }
    }
  }

  // Pre-compute normalised texts
  const norms = candidates.map((c) => normalise(c.text));

  // O(n^2) pairwise comparison — fine for the expected scale of candidates.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Skip if already in same group
      if (root(i) === root(j)) continue;

      const sim = lcsSimilarity(norms[i], norms[j]);
      if (sim >= SIMILARITY_THRESHOLD) {
        merge(i, j);
      }
    }
  }

  // For each group, pick the candidate with the highest confidence.
  // Map: group root index -> best candidate in that group
  const bestByGroup = new Map<number, MemoryCandidate>();

  for (let i = 0; i < n; i++) {
    const r = root(i);
    const existing = bestByGroup.get(r);
    if (
      !existing ||
      CONFIDENCE_RANK[candidates[i].confidence] >
        CONFIDENCE_RANK[existing.confidence]
    ) {
      bestByGroup.set(r, candidates[i]);
    }
  }

  // Collect results in order of group root index (preserves first occurrence).
  const roots = [...bestByGroup.keys()].sort((a, b) => a - b);
  return roots.map((r) => bestByGroup.get(r)!);
}
