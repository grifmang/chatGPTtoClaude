import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ExportModal } from "../ExportModal";

const SAMPLE_MARKDOWN = `# My Preferences
- I prefer dark mode
- I like TypeScript

# Technical Profile
- Uses React and Node.js
`;

describe("ExportModal", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders markdown in a textarea", () => {
    render(<ExportModal markdown={SAMPLE_MARKDOWN} onClose={vi.fn()} />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe(SAMPLE_MARKDOWN);
    expect(textarea).toHaveAttribute("readOnly");
  });

  it("shows Claude import instructions", () => {
    render(<ExportModal markdown={SAMPLE_MARKDOWN} onClose={vi.fn()} />);

    expect(
      screen.getByText(/please save all of these to your memory/i),
    ).toBeInTheDocument();
  });

  it("copy button calls navigator.clipboard.writeText", async () => {
    render(<ExportModal markdown={SAMPLE_MARKDOWN} onClose={vi.fn()} />);

    const copyButton = screen.getByRole("button", { name: /copy to clipboard/i });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      SAMPLE_MARKDOWN,
    );
  });

  it("shows 'Copied!' feedback after clicking copy", async () => {
    vi.useFakeTimers();

    render(<ExportModal markdown={SAMPLE_MARKDOWN} onClose={vi.fn()} />);

    const copyButton = screen.getByRole("button", { name: /copy to clipboard/i });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    // Button text should change to "Copied!"
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();

    // After 2 seconds, it should revert back to "Copy to clipboard"
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy to clipboard/i })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    render(<ExportModal markdown={SAMPLE_MARKDOWN} onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it("clicking overlay calls onClose", () => {
    const onClose = vi.fn();
    render(<ExportModal markdown={SAMPLE_MARKDOWN} onClose={onClose} />);

    const overlay = screen.getByTestId("modal-overlay");
    fireEvent.click(overlay);

    expect(onClose).toHaveBeenCalled();
  });

  it("clicking modal content does not call onClose", () => {
    const onClose = vi.fn();
    render(<ExportModal markdown={SAMPLE_MARKDOWN} onClose={onClose} />);

    const content = screen.getByTestId("modal-content");
    fireEvent.click(content);

    expect(onClose).not.toHaveBeenCalled();
  });
});
