import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryCard } from "../MemoryCard";
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

describe("MemoryCard", () => {
  // ─── Rendering ───────────────────────────────────────────────────────────

  it("renders candidate text", () => {
    render(<MemoryCard candidate={makeCandidate()} onUpdate={vi.fn()} />);

    expect(screen.getByText("Test memory text")).toBeInTheDocument();
  });

  it("renders category badge", () => {
    render(
      <MemoryCard
        candidate={makeCandidate({ category: "technical" })}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("technical")).toBeInTheDocument();
  });

  it("renders confidence badge with correct text", () => {
    render(
      <MemoryCard
        candidate={makeCandidate({ confidence: "medium" })}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("renders confidence badge with correct CSS class for high", () => {
    const { container } = render(
      <MemoryCard
        candidate={makeCandidate({ confidence: "high" })}
        onUpdate={vi.fn()}
      />,
    );

    const badge = container.querySelector(".confidence-badge");
    expect(badge).toHaveClass("confidence-high");
  });

  it("renders confidence badge with correct CSS class for medium", () => {
    const { container } = render(
      <MemoryCard
        candidate={makeCandidate({ confidence: "medium" })}
        onUpdate={vi.fn()}
      />,
    );

    const badge = container.querySelector(".confidence-badge");
    expect(badge).toHaveClass("confidence-medium");
  });

  it("renders confidence badge with correct CSS class for low", () => {
    const { container } = render(
      <MemoryCard
        candidate={makeCandidate({ confidence: "low" })}
        onUpdate={vi.fn()}
      />,
    );

    const badge = container.querySelector(".confidence-badge");
    expect(badge).toHaveClass("confidence-low");
  });

  it("renders source title", () => {
    render(
      <MemoryCard
        candidate={makeCandidate({ sourceTitle: "My Important Chat" })}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("My Important Chat")).toBeInTheDocument();
  });

  // ─── Timestamp formatting ────────────────────────────────────────────────

  it("formats timestamp as a readable date", () => {
    // 1700000000 seconds since epoch = Nov 14, 2023 (UTC)
    const { container } = render(
      <MemoryCard
        candidate={makeCandidate({ sourceTimestamp: 1700000000 })}
        onUpdate={vi.fn()}
      />,
    );

    const dateSpan = container.querySelector(".memory-card-date");
    expect(dateSpan).toBeInTheDocument();
    // The date element should contain some text (locale-dependent)
    expect(dateSpan!.textContent).toBeTruthy();
    // Verify it contains the year 2023
    expect(dateSpan!.textContent).toContain("2023");
  });

  it("handles null timestamp gracefully (no date element rendered)", () => {
    const { container } = render(
      <MemoryCard
        candidate={makeCandidate({ sourceTimestamp: null })}
        onUpdate={vi.fn()}
      />,
    );

    const dateSpan = container.querySelector(".memory-card-date");
    expect(dateSpan).not.toBeInTheDocument();
  });

  // ─── Status-based button rendering ───────────────────────────────────────

  it("shows Approve and Reject buttons when status is pending", () => {
    render(
      <MemoryCard
        candidate={makeCandidate({ status: "pending" })}
        onUpdate={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^approve$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^reject$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /undo/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Undo button when status is approved", () => {
    render(
      <MemoryCard
        candidate={makeCandidate({ status: "approved" })}
        onUpdate={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /undo/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^approve$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^reject$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Undo button when status is rejected", () => {
    render(
      <MemoryCard
        candidate={makeCandidate({ status: "rejected" })}
        onUpdate={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /undo/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^approve$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^reject$/i }),
    ).not.toBeInTheDocument();
  });

  // ─── Button callbacks ────────────────────────────────────────────────────

  it("calls onUpdate with { status: 'approved' } when Approve is clicked", () => {
    const onUpdate = vi.fn();
    render(
      <MemoryCard
        candidate={makeCandidate({ id: "abc-123", status: "pending" })}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith("abc-123", { status: "approved" });
  });

  it("calls onUpdate with { status: 'rejected' } when Reject is clicked", () => {
    const onUpdate = vi.fn();
    render(
      <MemoryCard
        candidate={makeCandidate({ id: "abc-123", status: "pending" })}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^reject$/i }));

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith("abc-123", { status: "rejected" });
  });

  it("calls onUpdate with { status: 'pending' } when Undo is clicked on approved card", () => {
    const onUpdate = vi.fn();
    render(
      <MemoryCard
        candidate={makeCandidate({ id: "abc-123", status: "approved" })}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /undo/i }));

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith("abc-123", { status: "pending" });
  });

  it("calls onUpdate with { status: 'pending' } when Undo is clicked on rejected card", () => {
    const onUpdate = vi.fn();
    render(
      <MemoryCard
        candidate={makeCandidate({ id: "abc-123", status: "rejected" })}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /undo/i }));

    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onUpdate).toHaveBeenCalledWith("abc-123", { status: "pending" });
  });

  // ─── CSS class changes based on status ───────────────────────────────────

  it("applies memory-card-approved class when status is approved", () => {
    const { container } = render(
      <MemoryCard
        candidate={makeCandidate({ status: "approved" })}
        onUpdate={vi.fn()}
      />,
    );

    const card = container.querySelector(".memory-card");
    expect(card).toHaveClass("memory-card-approved");
    expect(card).not.toHaveClass("memory-card-rejected");
  });

  it("applies memory-card-rejected class when status is rejected", () => {
    const { container } = render(
      <MemoryCard
        candidate={makeCandidate({ status: "rejected" })}
        onUpdate={vi.fn()}
      />,
    );

    const card = container.querySelector(".memory-card");
    expect(card).toHaveClass("memory-card-rejected");
    expect(card).not.toHaveClass("memory-card-approved");
  });

  it("does not apply approved or rejected class when status is pending", () => {
    const { container } = render(
      <MemoryCard
        candidate={makeCandidate({ status: "pending" })}
        onUpdate={vi.fn()}
      />,
    );

    const card = container.querySelector(".memory-card");
    expect(card).toHaveClass("memory-card");
    expect(card).not.toHaveClass("memory-card-approved");
    expect(card).not.toHaveClass("memory-card-rejected");
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  it("renders long text without breaking", () => {
    const longText =
      "This is a very long memory candidate text that goes on and on. ".repeat(
        50,
      );

    const { container } = render(
      <MemoryCard
        candidate={makeCandidate({ text: longText })}
        onUpdate={vi.fn()}
      />,
    );

    const textElement = container.querySelector(".memory-card-text");
    expect(textElement).toBeInTheDocument();
    expect(textElement!.textContent).toBe(longText);
  });

  it("renders special characters correctly (not escaped or corrupted)", () => {
    const specialText =
      'User prefers <TypeScript> & "strict mode" over \'loose\' — 100% of the time';

    render(
      <MemoryCard
        candidate={makeCandidate({ text: specialText })}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText(specialText)).toBeInTheDocument();
  });

  it("renders unicode and emoji characters correctly", () => {
    const unicodeText = "Likes caf\u00e9s, na\u00efve designs, and \u2014 dashes";

    render(
      <MemoryCard
        candidate={makeCandidate({ text: unicodeText })}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText(unicodeText)).toBeInTheDocument();
  });

  // ─── All categories render correctly ─────────────────────────────────────

  it.each<[string]>([
    ["preference"],
    ["technical"],
    ["project"],
    ["identity"],
    ["theme"],
  ])("renders category badge for '%s'", (category) => {
    render(
      <MemoryCard
        candidate={makeCandidate({ category: category as MemoryCandidate["category"] })}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText(category)).toBeInTheDocument();
  });
});
