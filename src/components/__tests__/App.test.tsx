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

vi.mock("../../extractors/apiExtractor", () => ({
  extractWithApi: vi.fn(),
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

  it("renders the wizard stepper initially", () => {
    render(<App />);

    expect(screen.getByText("Get your data")).toBeInTheDocument();
    expect(screen.getByText("Download export")).toBeInTheDocument();
    expect(screen.getByText("Upload & extract")).toBeInTheDocument();
  });

  it("starts on step 1 with ChatGPT export instructions", () => {
    render(<App />);

    expect(
      screen.getByRole("link", { name: /open chatgpt data controls/i }),
    ).toBeInTheDocument();
  });
});
