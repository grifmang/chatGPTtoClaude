import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadPage } from "../UploadPage";

describe("UploadPage", () => {
  it("renders title and subtitle", () => {
    render(
      <UploadPage onFileSelected={vi.fn()} isProcessing={false} />,
    );

    expect(
      screen.getByText("ChatGPT to Claude Memory"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/migrate your ChatGPT memories/i),
    ).toBeInTheDocument();
  });

  it("renders upload instructions", () => {
    render(
      <UploadPage onFileSelected={vi.fn()} isProcessing={false} />,
    );

    expect(
      screen.getByText(/how to export/i),
    ).toBeInTheDocument();
  });

  it("calls onFileSelected when a file is uploaded", async () => {
    const onFileSelected = vi.fn();
    render(
      <UploadPage onFileSelected={onFileSelected} isProcessing={false} />,
    );

    const input = screen.getByTestId("file-input") as HTMLInputElement;
    const file = new File(["content"], "export.zip", {
      type: "application/zip",
    });

    await userEvent.upload(input, file);

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("shows processing state when isProcessing is true", () => {
    render(
      <UploadPage onFileSelected={vi.fn()} isProcessing={true} />,
    );

    expect(
      screen.getByText(/processing your chatgpt export/i),
    ).toBeInTheDocument();
  });

  it("shows error message when error prop is provided", () => {
    render(
      <UploadPage
        onFileSelected={vi.fn()}
        isProcessing={false}
        error="Invalid ZIP file"
      />,
    );

    expect(screen.getByText("Invalid ZIP file")).toBeInTheDocument();
  });

  it("hides the drop zone when processing", () => {
    const { container } = render(
      <UploadPage onFileSelected={vi.fn()} isProcessing={true} />,
    );

    expect(
      container.querySelector(".upload-drop-zone"),
    ).not.toBeInTheDocument();
  });

  it("accepts only .zip files", () => {
    render(
      <UploadPage onFileSelected={vi.fn()} isProcessing={false} />,
    );

    const input = screen.getByTestId("file-input") as HTMLInputElement;
    expect(input.accept).toBe(".zip");
  });

  it("handles drag and drop", () => {
    const onFileSelected = vi.fn();
    const { container } = render(
      <UploadPage onFileSelected={onFileSelected} isProcessing={false} />,
    );

    const dropZone = container.querySelector(".upload-drop-zone")!;

    const file = new File(["content"], "export.zip", {
      type: "application/zip",
    });

    fireEvent.dragOver(dropZone, {
      dataTransfer: { files: [file] },
    });

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });
});
