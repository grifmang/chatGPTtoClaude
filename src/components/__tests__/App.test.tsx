import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../App";

// Mock the heavy dependencies to keep App tests fast and focused
vi.mock("../../parser/zipParser", () => ({
  extractConversations: vi.fn(),
}));

vi.mock("../../parser/conversationParser", () => ({
  parseConversation: vi.fn(),
}));

vi.mock("../../extractors", () => ({
  extractAllMemories: vi.fn(),
}));

describe("App", () => {
  it("renders upload page initially", () => {
    render(<App />);

    expect(
      screen.getByText("ChatGPT to Claude Memory"),
    ).toBeInTheDocument();
  });

  it("shows the app title on the upload page", () => {
    render(<App />);

    expect(
      screen.getByText("ChatGPT to Claude Memory"),
    ).toBeInTheDocument();
  });

  it("renders the file upload zone initially", () => {
    const { container } = render(<App />);

    expect(container.querySelector(".upload-drop-zone")).toBeInTheDocument();
  });

  it("renders the file input accepting .zip files", () => {
    render(<App />);

    const input = screen.getByTestId("file-input") as HTMLInputElement;
    expect(input.accept).toBe(".zip");
  });
});
