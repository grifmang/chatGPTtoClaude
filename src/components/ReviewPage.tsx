import { useState, useMemo } from "react";
import type { MemoryCandidate, MemoryCategory, Confidence } from "../types";
import { MemoryCard } from "./MemoryCard";
import "./ReviewPage.css";

type ReviewPageProps = {
  candidates: MemoryCandidate[];
  onUpdateCandidate: (
    id: string,
    updates: Partial<Pick<MemoryCandidate, "status" | "text">>,
  ) => void;
  onExport: () => void;
};

const CATEGORY_OPTIONS: { value: "" | MemoryCategory; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "preference", label: "Preferences" },
  { value: "technical", label: "Technical" },
  { value: "project", label: "Projects" },
  { value: "identity", label: "Identity" },
  { value: "theme", label: "Themes" },
];

const CONFIDENCE_OPTIONS: { value: "" | Confidence; label: string }[] = [
  { value: "", label: "All confidence" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CONFIDENCE_LEVELS: Confidence[] = ["high", "medium", "low"];

const PAGE_SIZE = 25;

export function ReviewPage({
  candidates,
  onUpdateCandidate,
  onExport,
}: ReviewPageProps) {
  const [categoryFilter, setCategoryFilter] = useState<"" | MemoryCategory>("");
  const [confidenceFilter, setConfidenceFilter] = useState<"" | Confidence>("");
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const approvedCount = candidates.filter((c) => c.status === "approved").length;
  const totalCount = candidates.length;
  const reviewedCount = candidates.filter((c) => c.status !== "pending").length;
  const reviewProgress = totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0;
  const pendingCount = totalCount - reviewedCount;

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

  const totalPages = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageCandidates = filteredCandidates.slice(pageStart, pageStart + PAGE_SIZE);

  const confidenceCounts = useMemo(() => {
    const counts: Record<Confidence, { total: number; pending: number }> = {
      high: { total: 0, pending: 0 },
      medium: { total: 0, pending: 0 },
      low: { total: 0, pending: 0 },
    };
    for (const c of candidates) {
      counts[c.confidence].total++;
      if (c.status === "pending") counts[c.confidence].pending++;
    }
    return counts;
  }, [candidates]);

  const handleBulkAction = (confidence: Confidence, status: "approved" | "rejected") => {
    for (const c of candidates) {
      if (c.confidence === confidence && c.status === "pending") {
        onUpdateCandidate(c.id, { status });
      }
    }
  };

  const handleFilterChange = () => {
    setPage(0);
  };

  return (
    <div className="review-page">
      <div className="review-header">
        <h1>Review Extracted Memories</h1>
        <p className="review-counter">
          {reviewedCount} of {totalCount} reviewed &mdash; {approvedCount} approved
        </p>
      </div>

      <div className="review-progress-bar">
        <div
          className="review-progress-fill"
          style={{ width: `${reviewProgress}%` }}
        />
      </div>

      <div className="review-view-toggle">
        <span>
          {showAll
            ? `Showing all ${totalCount} memories`
            : `Showing ${pendingCount} pending memories`}
        </span>
        <button
          className="btn btn-toggle-view"
          onClick={() => {
            setShowAll((prev) => !prev);
            setPage(0);
          }}
        >
          {showAll ? "Show pending only" : "Show all"}
        </button>
      </div>

      <div className="bulk-confidence-bar">
        {CONFIDENCE_LEVELS.map((level) => {
          const { total, pending } = confidenceCounts[level];
          if (total === 0) return null;
          return (
            <div key={level} className="bulk-confidence-group">
              <span className={`bulk-confidence-label confidence-${level}`}>
                {level} ({pending} pending / {total})
              </span>
              <button
                className="btn btn-bulk-approve"
                disabled={pending === 0}
                onClick={() => handleBulkAction(level, "approved")}
              >
                Approve all
              </button>
              <button
                className="btn btn-bulk-reject"
                disabled={pending === 0}
                onClick={() => handleBulkAction(level, "rejected")}
              >
                Reject all
              </button>
            </div>
          );
        })}
      </div>

      <div className="review-toolbar">
        <div className="review-filters">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as "" | MemoryCategory);
              handleFilterChange();
            }}
            className="review-filter-select"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={confidenceFilter}
            onChange={(e) => {
              setConfidenceFilter(e.target.value as "" | Confidence);
              handleFilterChange();
            }}
            className="review-filter-select"
          >
            {CONFIDENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <span className="review-showing">
            Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredCandidates.length)} of{" "}
            {filteredCandidates.length}
          </span>
        </div>
      </div>

      <div className="review-card-list">
        {pageCandidates.map((candidate) => (
          <MemoryCard
            key={candidate.id}
            candidate={candidate}
            onUpdate={onUpdateCandidate}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="review-pagination">
          <button
            className="btn btn-page"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            Previous
          </button>
          <span className="page-indicator">
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            className="btn btn-page"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {approvedCount > 0 && (
        <div className="review-export-bar">
          <button className="btn btn-export" onClick={onExport}>
            Export {approvedCount} memories
          </button>
        </div>
      )}
    </div>
  );
}
