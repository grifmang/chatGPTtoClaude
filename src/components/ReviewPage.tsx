import { useState } from "react";
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

export function ReviewPage({
  candidates,
  onUpdateCandidate,
  onExport,
}: ReviewPageProps) {
  const [categoryFilter, setCategoryFilter] = useState<"" | MemoryCategory>("");
  const [confidenceFilter, setConfidenceFilter] = useState<"" | Confidence>("");

  const approvedCount = candidates.filter((c) => c.status === "approved").length;
  const totalCount = candidates.length;

  const filteredCandidates = candidates.filter((c) => {
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (confidenceFilter && c.confidence !== confidenceFilter) return false;
    return true;
  });

  const handleBulkApproveHigh = () => {
    for (const c of candidates) {
      if (c.confidence === "high" && c.status === "pending") {
        onUpdateCandidate(c.id, { status: "approved" });
      }
    }
  };

  const handleBulkRejectLow = () => {
    for (const c of candidates) {
      if (c.confidence === "low" && c.status === "pending") {
        onUpdateCandidate(c.id, { status: "rejected" });
      }
    }
  };

  return (
    <div className="review-page">
      <div className="review-header">
        <h1>Review Extracted Memories</h1>
        <p className="review-counter">
          {approvedCount} of {totalCount} memories approved
        </p>
      </div>

      <div className="review-toolbar">
        <div className="review-filters">
          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as "" | MemoryCategory)
            }
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
            onChange={(e) =>
              setConfidenceFilter(e.target.value as "" | Confidence)
            }
            className="review-filter-select"
          >
            {CONFIDENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="review-bulk-actions">
          <button className="btn btn-bulk" onClick={handleBulkApproveHigh}>
            Approve all high-confidence
          </button>
          <button className="btn btn-bulk" onClick={handleBulkRejectLow}>
            Reject all low-confidence
          </button>
        </div>
      </div>

      <div className="review-card-list">
        {filteredCandidates.map((candidate) => (
          <MemoryCard
            key={candidate.id}
            candidate={candidate}
            onUpdate={onUpdateCandidate}
          />
        ))}
      </div>

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
