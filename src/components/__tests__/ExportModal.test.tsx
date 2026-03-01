import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportModal } from "../ExportModal";
import type { MemoryCandidate } from "../../types";

// --- Helpers ----------------------------------------------------------------

function makeCandidate(
  overrides: Partial<MemoryCandidate> = {},
): MemoryCandidate {
  return {
    id: "test-1",
    text: "Test memory",
    category: "preference",
    confidence: "high",
    sourceTitle: "Test Chat",
    sourceTimestamp: 1700000000,
    status: "approved",
    ...overrides,
  };
}

// --- Tests ------------------------------------------------------------------

describe("ExportModal - Claude Import Flow", () => {
  const defaultProps = {
    markdown: "# My Preferences\n- I prefer TypeScript",
    candidates: [
      makeCandidate({ id: "1", text: "I prefer TypeScript", category: "preference" }),
    ],
    onClose: vi.fn(),
  };

  it("renders markdown in a readonly textarea", () => {
    render(<ExportModal {...defaultProps} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue(defaultProps.markdown);
    expect(textarea).toHaveAttribute("readonly");
  });

  it("shows the pre-composed Claude message", () => {
    render(<ExportModal {...defaultProps} />);
    expect(
      screen.getByText(/please save all of these to your memory/i)
    ).toBeInTheDocument();
  });

  it("has a 'Copy message' button that copies instruction + markdown", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ExportModal {...defaultProps} />);
    await userEvent.click(
      screen.getByRole("button", { name: /copy message/i })
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Please save all of these to your memory")
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("# My Preferences")
    );
  });

  it("has an 'Open Claude' link to claude.ai/new", () => {
    render(<ExportModal {...defaultProps} />);
    const link = screen.getByRole("link", { name: /open claude/i });
    expect(link).toHaveAttribute("href", "https://claude.ai/new");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows a step-by-step checklist", () => {
    render(<ExportModal {...defaultProps} />);
    expect(screen.getByText(/click "copy message"/i)).toBeInTheDocument();
    expect(screen.getByText(/click "open claude"/i)).toBeInTheDocument();
    expect(screen.getByText(/paste the message/i)).toBeInTheDocument();
  });

  it("close button calls onClose", async () => {
    const onClose = vi.fn();
    render(<ExportModal {...defaultProps} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking overlay calls onClose", async () => {
    const onClose = vi.fn();
    render(<ExportModal {...defaultProps} onClose={onClose} />);
    await userEvent.click(screen.getByTestId("modal-overlay"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("ExportModal - Format Toggle", () => {
  const candidates: MemoryCandidate[] = [
    makeCandidate({ id: "1", text: "I prefer TypeScript", category: "preference" }),
    makeCandidate({ id: "2", text: "Software engineer", category: "identity" }),
  ];

  const defaultProps = {
    markdown: "# My Preferences\n- I prefer TypeScript\n\n# About Me\n- Software engineer",
    candidates,
    onClose: vi.fn(),
  };

  it("shows format toggle with Claude Memory selected by default", () => {
    render(<ExportModal {...defaultProps} />);
    const memoryBtn = screen.getByRole("button", { name: /claude memory/i });
    const claudeMdBtn = screen.getByRole("button", { name: /claude\.md/i });
    expect(memoryBtn).toHaveClass("active");
    expect(claudeMdBtn).not.toHaveClass("active");
  });

  it("shows Claude Memory flow by default", () => {
    render(<ExportModal {...defaultProps} />);
    expect(screen.getByRole("button", { name: /copy message/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open claude/i })).toBeInTheDocument();
  });

  it("switches to CLAUDE.md view when toggle is clicked", async () => {
    render(<ExportModal {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /claude\.md/i }));

    // CLAUDE.md view should show download button
    expect(screen.getByRole("button", { name: /download claude\.md/i })).toBeInTheDocument();
    // Claude Memory flow should be hidden
    expect(screen.queryByRole("button", { name: /copy message/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open claude/i })).not.toBeInTheDocument();
  });

  it("shows CLAUDE.md formatted content in textarea when toggled", async () => {
    render(<ExportModal {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /claude\.md/i }));

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    const value = textarea.value;
    // CLAUDE.md format uses different headings
    expect(value).toContain("# About Me");
    expect(value).toContain("# Preferences");
    expect(value).toContain("- I prefer TypeScript");
    expect(value).toContain("- Software engineer");
  });

  it("switches back to Claude Memory view", async () => {
    render(<ExportModal {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /claude\.md/i }));
    await userEvent.click(screen.getByRole("button", { name: /claude memory/i }));

    expect(screen.getByRole("button", { name: /copy message/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download claude\.md/i })).not.toBeInTheDocument();
  });

  it("updates active class on toggle buttons", async () => {
    render(<ExportModal {...defaultProps} />);
    const memoryBtn = screen.getByRole("button", { name: /claude memory/i });
    const claudeMdBtn = screen.getByRole("button", { name: /claude\.md/i });

    await userEvent.click(claudeMdBtn);
    expect(claudeMdBtn).toHaveClass("active");
    expect(memoryBtn).not.toHaveClass("active");

    await userEvent.click(memoryBtn);
    expect(memoryBtn).toHaveClass("active");
    expect(claudeMdBtn).not.toHaveClass("active");
  });
});

describe("ExportModal - CLAUDE.md Download", () => {
  const candidates: MemoryCandidate[] = [
    makeCandidate({ id: "1", text: "I prefer TypeScript", category: "preference" }),
  ];

  const defaultProps = {
    markdown: "# My Preferences\n- I prefer TypeScript",
    candidates,
    onClose: vi.fn(),
  };

  it("triggers a file download when Download CLAUDE.md is clicked", async () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockUrl = "blob:http://localhost/mock-blob";
    const createObjectURL = vi.fn().mockReturnValue(mockUrl);
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    // Render first, then set up DOM spies so React rendering isn't affected
    render(<ExportModal {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /claude\.md/i }));

    // Track the anchor created for download
    let capturedAnchor: HTMLAnchorElement | null = null;
    const clickSpy = vi.fn();
    const originalAppendChild = document.body.appendChild.bind(document.body);
    const originalRemoveChild = document.body.removeChild.bind(document.body);

    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation(function (node: Node) {
      if (node instanceof HTMLAnchorElement && node.download === "CLAUDE.md") {
        capturedAnchor = node;
        node.click = clickSpy;
        return node;
      }
      return originalAppendChild(node);
    });
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation(function (node: Node) {
      if (node instanceof HTMLAnchorElement && node.download === "CLAUDE.md") {
        return node;
      }
      return originalRemoveChild(node);
    });

    await userEvent.click(screen.getByRole("button", { name: /download claude\.md/i }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith(mockUrl);

    // Verify the anchor was given the correct download attribute
    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor!.download).toBe("CLAUDE.md");
    expect(capturedAnchor!.href).toBe(mockUrl);

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
