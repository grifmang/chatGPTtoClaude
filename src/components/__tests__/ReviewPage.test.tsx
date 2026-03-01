import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
  it("renders all pending candidates by default", () => {
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

  it("shows reviewed/approved counter", () => {
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

    // Counter now shows: "{reviewedCount} of {totalCount} reviewed — {approvedCount} approved"
    expect(screen.getByText(/3 of 4 reviewed/)).toBeInTheDocument();
    expect(screen.getByText(/2 approved/)).toBeInTheDocument();
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

  it("shows undo button for approved candidates when showAll is toggled on", () => {
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

    // Approved candidates are hidden by default (pending-only view)
    // Click "Show all" to reveal them
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));

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

    // Find the "Approve all" button in the high-confidence row
    const highRow = screen.getByText(/high/i, { selector: ".bulk-confidence-label" })
      .closest(".bulk-confidence-group")!;
    const bulkApproveButton = within(highRow).getByRole("button", {
      name: /approve all/i,
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

// ─── Pending-only view + toggle ─────────────────────────────────────────────

describe("ReviewPage - pending-only view", () => {
  it("shows only pending items by default", () => {
    const candidates = [
      makeCandidate({ id: "1", text: "Pending item", status: "pending" }),
      makeCandidate({ id: "2", text: "Approved item", status: "approved" }),
      makeCandidate({ id: "3", text: "Rejected item", status: "rejected" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    // Only the pending item card should be visible
    expect(screen.getByText("Pending item")).toBeInTheDocument();
    expect(screen.queryByText("Approved item")).not.toBeInTheDocument();
    expect(screen.queryByText("Rejected item")).not.toBeInTheDocument();
  });

  it("shows toggle bar with pending count by default", () => {
    const candidates = [
      makeCandidate({ id: "1", status: "pending" }),
      makeCandidate({ id: "2", status: "approved" }),
      makeCandidate({ id: "3", status: "rejected" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText(/showing 1 pending/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show all/i })).toBeInTheDocument();
  });

  it("reveals all candidates when 'Show all' is clicked", () => {
    const candidates = [
      makeCandidate({ id: "1", text: "Pending item", status: "pending" }),
      makeCandidate({ id: "2", text: "Approved item", status: "approved" }),
      makeCandidate({ id: "3", text: "Rejected item", status: "rejected" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    // Click "Show all"
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));

    // All items should now be visible
    expect(screen.getByText("Pending item")).toBeInTheDocument();
    expect(screen.getByText("Approved item")).toBeInTheDocument();
    expect(screen.getByText("Rejected item")).toBeInTheDocument();

    // Toggle text should change
    expect(screen.getByText(/showing all 3 memories/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show pending only/i })).toBeInTheDocument();
  });

  it("switches back to pending-only when 'Show pending only' is clicked", () => {
    const candidates = [
      makeCandidate({ id: "1", text: "Pending item", status: "pending" }),
      makeCandidate({ id: "2", text: "Approved item", status: "approved" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    // Toggle to show all
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    expect(screen.getByText("Approved item")).toBeInTheDocument();

    // Toggle back to pending only
    fireEvent.click(screen.getByRole("button", { name: /show pending only/i }));
    expect(screen.queryByText("Approved item")).not.toBeInTheDocument();
    expect(screen.getByText("Pending item")).toBeInTheDocument();
  });
});

// ─── Progress bar ───────────────────────────────────────────────────────────

describe("ReviewPage - progress bar", () => {
  it("shows progress bar with correct counts", () => {
    const candidates = [
      makeCandidate({ id: "1", status: "approved" }),
      makeCandidate({ id: "2", status: "rejected" }),
      makeCandidate({ id: "3", status: "pending" }),
      makeCandidate({ id: "4", status: "pending" }),
    ];

    render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    // 2 of 4 reviewed (1 approved + 1 rejected), 1 approved
    expect(screen.getByText(/2 of 4 reviewed/)).toBeInTheDocument();
    expect(screen.getByText(/1 approved/)).toBeInTheDocument();
  });

  it("renders progress bar fill at correct width", () => {
    const candidates = [
      makeCandidate({ id: "1", status: "approved" }),
      makeCandidate({ id: "2", status: "pending" }),
    ];

    const { container } = render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    const fill = container.querySelector(".review-progress-fill") as HTMLElement;
    expect(fill).toBeInTheDocument();
    // 1 of 2 reviewed = 50%
    expect(fill.style.width).toBe("50%");
  });

  it("shows 0% progress when no candidates are reviewed", () => {
    const candidates = [
      makeCandidate({ id: "1", status: "pending" }),
      makeCandidate({ id: "2", status: "pending" }),
    ];

    const { container } = render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    const fill = container.querySelector(".review-progress-fill") as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });

  it("shows 100% progress when all candidates are reviewed", () => {
    const candidates = [
      makeCandidate({ id: "1", status: "approved" }),
      makeCandidate({ id: "2", status: "rejected" }),
    ];

    const { container } = render(
      <ReviewPage
        candidates={candidates}
        onUpdateCandidate={vi.fn()}
        onExport={vi.fn()}
      />,
    );

    const fill = container.querySelector(".review-progress-fill") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });
});

// ─── Filter gap tests ───────────────────────────────────────────────────────

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

    // All pending candidates visible initially
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

    // All pending candidates visible initially
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

    // Both visible initially (both are pending)
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
