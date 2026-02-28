import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadPage } from "../UploadPage";

describe("UploadPage - Wizard", () => {
  const defaultProps = {
    onFileSelected: vi.fn(),
    isProcessing: false,
  };

  it("renders the stepper with 3 steps", () => {
    render(<UploadPage {...defaultProps} />);
    expect(screen.getByText("Get your data")).toBeInTheDocument();
    expect(screen.getByText("Download export")).toBeInTheDocument();
    expect(screen.getByText("Upload & extract")).toBeInTheDocument();
  });

  it("starts on step 1 with ChatGPT export instructions", () => {
    render(<UploadPage {...defaultProps} />);
    expect(screen.getByText(/request your data export/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open chatgpt data controls/i })
    ).toHaveAttribute("href", "https://chatgpt.com/#settings/DataControls");
  });

  it("has a skip link to go directly to step 3", async () => {
    render(<UploadPage {...defaultProps} />);
    await userEvent.click(screen.getByText(/already have my zip/i));
    expect(screen.getByText(/drop your/i)).toBeInTheDocument();
  });

  it("navigates from step 1 to step 2", async () => {
    render(<UploadPage {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/check your email/i)).toBeInTheDocument();
  });

  it("navigates from step 2 to step 3", async () => {
    render(<UploadPage {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /i have my zip/i })
    );
    expect(screen.getByText(/drop your/i)).toBeInTheDocument();
  });

  it("step 3 shows the file upload zone", async () => {
    render(<UploadPage {...defaultProps} />);
    await userEvent.click(screen.getByText(/already have my zip/i));
    expect(screen.getByTestId("file-input")).toBeInTheDocument();
  });

  it("calls onFileSelected when a file is uploaded on step 3", async () => {
    const onFileSelected = vi.fn();
    render(<UploadPage {...{ ...defaultProps, onFileSelected }} />);
    await userEvent.click(screen.getByText(/already have my zip/i));
    const input = screen.getByTestId("file-input");
    const file = new File(["test"], "export.zip", { type: "application/zip" });
    await userEvent.upload(input, file);
    expect(onFileSelected).toHaveBeenCalledWith(file, undefined);
  });

  it("shows processing state on step 3", async () => {
    render(<UploadPage {...defaultProps} isProcessing={true} />);
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<UploadPage {...defaultProps} error="Bad file" />);
    expect(screen.getByText("Bad file")).toBeInTheDocument();
  });
});
