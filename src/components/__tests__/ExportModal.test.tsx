import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportModal } from "../ExportModal";

describe("ExportModal - Claude Import Flow", () => {
  const defaultProps = {
    markdown: "# My Preferences\n- I prefer TypeScript",
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
