import { render, screen, fireEvent } from "@testing-library/react";
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

  it("shows bookmarklet install link on step 1", () => {
    render(<UploadPage {...defaultProps} />);
    const bookmarkletLink = screen.getByText(/export chatgpt data/i);
    expect(bookmarkletLink).toBeInTheDocument();
    expect(bookmarkletLink.tagName).toBe("A");
  });

  it("shows bookmarklet instructions text", () => {
    render(<UploadPage {...defaultProps} />);
    expect(screen.getByText(/drag this to your bookmark bar/i)).toBeInTheDocument();
  });
});

describe("UploadPage - Gap tests", () => {
  const defaultProps = {
    onFileSelected: vi.fn(),
    isProcessing: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects non-zip files on drop", async () => {
    const onFileSelected = vi.fn();
    render(<UploadPage {...{ ...defaultProps, onFileSelected }} />);
    await userEvent.click(screen.getByText(/already have my zip/i));

    const dropZone = screen.getByRole("button", { name: /drop your/i });
    const txtFile = new File(["hello"], "notes.txt", { type: "text/plain" });

    const dataTransfer = {
      files: [txtFile],
      types: ["Files"],
    };

    fireEvent.drop(dropZone, { dataTransfer });

    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it("shows progress text when provided", () => {
    render(
      <UploadPage
        {...defaultProps}
        isProcessing={true}
        progress="Analyzing batch 2 of 5..."
      />,
    );

    expect(screen.getByText("Analyzing batch 2 of 5...")).toBeInTheDocument();
  });

  it("drop zone keyboard accessibility - Enter triggers file input click", async () => {
    render(<UploadPage {...defaultProps} />);
    await userEvent.click(screen.getByText(/already have my zip/i));

    const fileInput = screen.getByTestId("file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    const dropZone = screen.getByRole("button", { name: /drop your/i });
    fireEvent.keyDown(dropZone, { key: "Enter" });

    expect(clickSpy).toHaveBeenCalled();
  });

  it("drop zone keyboard accessibility - Space triggers file input click", async () => {
    render(<UploadPage {...defaultProps} />);
    await userEvent.click(screen.getByText(/already have my zip/i));

    const fileInput = screen.getByTestId("file-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    const dropZone = screen.getByRole("button", { name: /drop your/i });
    fireEvent.keyDown(dropZone, { key: " " });

    expect(clickSpy).toHaveBeenCalled();
  });

  it("API key toggle shows and hides input", async () => {
    render(<UploadPage {...defaultProps} />);
    await userEvent.click(screen.getByText(/already have my zip/i));

    // Initially the API key input should not be visible
    expect(screen.queryByTestId("api-key-input")).not.toBeInTheDocument();

    // Check the toggle checkbox
    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);

    // Now the API key input should be visible
    expect(screen.getByTestId("api-key-input")).toBeInTheDocument();

    // Uncheck the toggle
    await userEvent.click(checkbox);

    // API key input should disappear
    expect(screen.queryByTestId("api-key-input")).not.toBeInTheDocument();
  });

  it("passes API key when enabled and file is uploaded", async () => {
    const onFileSelected = vi.fn();
    render(<UploadPage {...{ ...defaultProps, onFileSelected }} />);
    await userEvent.click(screen.getByText(/already have my zip/i));

    // Enable the API key checkbox
    const checkbox = screen.getByRole("checkbox");
    await userEvent.click(checkbox);

    // Type the API key
    const apiKeyInput = screen.getByTestId("api-key-input");
    await userEvent.type(apiKeyInput, "sk-ant-test-key-123");

    // Upload a file
    const fileInput = screen.getByTestId("file-input");
    const file = new File(["test"], "export.zip", { type: "application/zip" });
    await userEvent.upload(fileInput, file);

    expect(onFileSelected).toHaveBeenCalledWith(file, "sk-ant-test-key-123");
  });
});
