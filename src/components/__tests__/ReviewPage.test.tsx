import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewPage } from "../ReviewPage";
import type { MemoryCandidate } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCandidate(
  overrides: Partial<MemoryCandidate> = {},
): MemoryCandidate {
  return {
    id: "test-1",
    text: "Test memory text",
    category: "preference",
    confidence: "high",
    sourceTitle: "Test Chat",
    sourceTimestamp: 1700000000,
    status: "pending",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ReviewPage", () => {
  it("renders all candidates", () => {
    const candidates = [
      makeCandidate({ id: "1", text: "Memory one" }),
      makeCandidate({ id: "2", text: "Memory two" }),
      makeCandidate({ id: "3", text: "Memory three" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText("Memory one")).toBeInTheDocument();
    expect(screen.getByText("Memory two")).toBeInTheDocument();
    expect(screen.getByText("Memory three")).toBeInTheDocument();
  });

  it("shows approval counter", () => {
    const candidates = [
      makeCandidate({ id: "1", status: "approved" }),
      makeCandidate({ id: "2", status: "approved" }),
      makeCandidate({ id: "3", status: "pending" }),
      makeCandidate({ id: "4", status: "rejected" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 of 4 memories approved/i)).toBeInTheDocument();
  });

  it("calls onUpdateCandidate with approved status when approve button is clicked", () => {
    const onUpdateCandidate = vi.fn();
    const candidates = [
      makeCandidate({ id: "c1", status: "pending" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={onUpdateCandidate}
        onExport={vi.fn()}
      />,
    );

    const approveButton = screen.getByRole("button", { name: /^approve$/i });
    fireEvent.click(approveButton);

    expect(onUpdateCandidate).toHaveBeenCalledWith("c1", {
      status: "approved",
    });
  });

  it("calls onUpdateCandidate with rejected status when reject button is clicked", () => {
    const onUpdateCandidate = vi.fn();
    const candidates = [
      makeCandidate({ id: "c1", status: "pending" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={onUpdateCandidate}
        onExport={vi.fn()}
      />,
    );

    const rejectButton = screen.getByRole("button", { name: /^reject$/i });
    fireEvent.click(rejectButton);

    expect(onUpdateCandidate).toHaveBeenCalledWith("c1", {
      status: "rejected",
    });
  });

  it("shows undo button for approved candidates", () => {
    const onUpdateCandidate = vi.fn();
    const candidates = [
      makeCandidate({ id: "c1", status: "approved" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={onUpdateCandidate}
        onExport={vi.fn()}
      />,
    );

    const undoButton = screen.getByRole("button", { name: /undo/i });
    fireEvent.click(undoButton);

    expect(onUpdateCandidate).toHaveBeenCalledWith("c1", {
      status: "pending",
    });
  });

  it("shows export button when there are approved candidates", () => {
    const onExport = vi.fn();
    const candidates = [
      makeCandidate({ id: "1", status: "approved" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={onExport}
      />,
    );

    const exportButton = screen.getByRole("button", { name: /export/i });
    expect(exportButton).toBeInTheDocument();
    fireEvent.click(exportButton);
    expect(onExport).toHaveBeenCalled();
  });

  it("hides export button when no approved candidates", () => {
    const candidates = [
      makeCandidate({ id: "1", status: "pending" }),
      makeCandidate({ id: "2", status: "rejected" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /export/i }),
    ).not.toBeInTheDocument();
  });

  it("bulk approves high-confidence candidates", () => {
    const onUpdateCandidate = vi.fn();
    const candidates = [
      makeCandidate({ id: "1", confidence: "high", status: "pending" }),
      makeCandidate({ id: "2", confidence: "medium", status: "pending" }),
      makeCandidate({ id: "3", confidence: "high", status: "pending" }),
      makeCandidate({ id: "4", confidence: "low", status: "pending" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={onUpdateCandidate}
        onExport={vi.fn()}
      />,
    );

    const bulkApproveButton = screen.getByRole("button", {
      name: /approve all high/i,
    });
    fireEvent.click(bulkApproveButton);

    expect(onUpdateCandidate).toHaveBeenCalledWith("1", {
      status: "approved",
    });
    expect(onUpdateCandidate).toHaveBeenCalledWith("3", {
      status: "approved",
    });
    // Should not have been called for medium or low
    expect(onUpdateCandidate).toHaveBeenCalledTimes(2);
  });

  it("renders the review header", () => {
    render(
      <ReviewPage
        candidates={[]}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Review Extracted Memories"),
    ).toBeInTheDocument();
  });

  it("shows confidence badges with correct text", () => {
    const candidates = [
      makeCandidate({ id: "1", confidence: "high", text: "High conf item" }),
      makeCandidate({ id: "2", confidence: "medium", text: "Medium conf item" }),
      makeCandidate({ id: "3", confidence: "low", text: "Low conf item" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText("High conf item")).toBeInTheDocument();
    expect(screen.getByText("Medium conf item")).toBeInTheDocument();
    expect(screen.getByText("Low conf item")).toBeInTheDocument();
  });
});

describe("ReviewPage - Filter gap tests", () => {
  it("category filter changes displayed cards", () => {
    const candidates = [
      makeCandidate({ id: "1", category: "preference", text: "I like dark mode" }),
      makeCandidate({ id: "2", category: "technical", text: "Uses TypeScript" }),
      makeCandidate({ id: "3", category: "preference", text: "Prefers tabs" }),
      makeCandidate({ id: "4", category: "project", text: "Working on CLI tool" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    // All candidates visible initially
    expect(screen.getByText("I like dark mode")).toBeInTheDocument();
    expect(screen.getByText("Uses TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Prefers tabs")).toBeInTheDocument();
    expect(screen.getByText("Working on CLI tool")).toBeInTheDocument();

    // Select "Technical" category
    const categorySelect = screen.getByDisplayValue("All categories");
    fireEvent.change(categorySelect, { target: { value: "technical" } });

    // Only technical candidate should be visible
    expect(screen.getByText("Uses TypeScript")).toBeInTheDocument();
    expect(screen.queryByText("I like dark mode")).not.toBeInTheDocument();
    expect(screen.queryByText("Prefers tabs")).not.toBeInTheDocument();
    expect(screen.queryByText("Working on CLI tool")).not.toBeInTheDocument();
  });

  it("confidence filter changes displayed cards", () => {
    const candidates = [
      makeCandidate({ id: "1", confidence: "high", text: "High confidence item" }),
      makeCandidate({ id: "2", confidence: "medium", text: "Medium confidence item" }),
      makeCandidate({ id: "3", confidence: "low", text: "Low confidence item" }),
      makeCandidate({ id: "4", confidence: "high", text: "Another high item" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    // All candidates visible initially
    expect(screen.getByText("High confidence item")).toBeInTheDocument();
    expect(screen.getByText("Medium confidence item")).toBeInTheDocument();
    expect(screen.getByText("Low confidence item")).toBeInTheDocument();
    expect(screen.getByText("Another high item")).toBeInTheDocument();

    // Select "Medium" confidence
    const confidenceSelect = screen.getByDisplayValue("All confidence");
    fireEvent.change(confidenceSelect, { target: { value: "medium" } });

    // Only medium confidence candidate should be visible
    expect(screen.getByText("Medium confidence item")).toBeInTheDocument();
    expect(screen.queryByText("High confidence item")).not.toBeInTheDocument();
    expect(screen.queryByText("Low confidence item")).not.toBeInTheDocument();
    expect(screen.queryByText("Another high item")).not.toBeInTheDocument();
  });

  it("shows no cards when filters exclude all candidates", () => {
    const candidates = [
      makeCandidate({ id: "1", category: "preference", confidence: "high", text: "Pref high" }),
      makeCandidate({ id: "2", category: "technical", confidence: "medium", text: "Tech medium" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    // Both visible initially
    expect(screen.getByText("Pref high")).toBeInTheDocument();
    expect(screen.getByText("Tech medium")).toBeInTheDocument();

    // Set category to "preference" -- shows only "Pref high"
    const categorySelect = screen.getByDisplayValue("All categories");
    fireEvent.change(categorySelect, { target: { value: "preference" } });

    expect(screen.getByText("Pref high")).toBeInTheDocument();
    expect(screen.queryByText("Tech medium")).not.toBeInTheDocument();

    // Now set confidence to "low" -- "Pref high" is preference+high, so nothing matches
    const confidenceSelect = screen.getByDisplayValue("All confidence");
    fireEvent.change(confidenceSelect, { target: { value: "low" } });

    // Both card texts should be absent
    expect(screen.queryByText("Pref high")).not.toBeInTheDocument();
    expect(screen.queryByText("Tech medium")).not.toBeInTheDocument();

    // The card list container should be empty (no memory-card-text elements)
    const cardList = document.querySelector(".review-card-list");
    expect(cardList).toBeInTheDocument();
    expect(cardList!.children.length).toBe(0);
  });
});
