import type { MemoryCandidate } from "../types";

type MemoryCardProps = {
  candidate: MemoryCandidate;
  onUpdate: (
    id: string,
    updates: Partial<Pick<MemoryCandidate, "status" | "text">>,
  ) => void;
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "confidence-high",
  medium: "confidence-medium",
  low: "confidence-low",
};

function formatDate(timestamp: number | null): string {
  if (timestamp === null) return "";
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function MemoryCard({ candidate, onUpdate }: MemoryCardProps) {
  const { id, text, category, confidence, sourceTitle, sourceTimestamp, status } =
    candidate;

  const cardClass = [
    "memory-card",
    status === "approved" && "memory-card-approved",
    status === "rejected" && "memory-card-rejected",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} data-testid="memory-card">
      <div className="memory-card-header">
        <span className={`confidence-badge ${CONFIDENCE_COLORS[confidence]}`}>
          {confidence}
        </span>
        <span className="memory-category">{category}</span>
      </div>
      <div className="memory-card-source">
        {sourceTitle}
        {sourceTimestamp && (
          <span className="memory-card-date">
            {" "}
            &middot; {formatDate(sourceTimestamp)}
          </span>
        )}
      </div>
      <p className="memory-card-text">{text}</p>
      <div className="memory-card-actions">
        {status === "pending" ? (
          <>
            <button
              className="btn btn-approve"
              onClick={() => onUpdate(id, { status: "approved" })}
            >
              Approve
            </button>
            <button
              className="btn btn-reject"
              onClick={() => onUpdate(id, { status: "rejected" })}
            >
              Reject
            </button>
          </>
        ) : (
          <button
            className="btn btn-undo"
            onClick={() => onUpdate(id, { status: "pending" })}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
