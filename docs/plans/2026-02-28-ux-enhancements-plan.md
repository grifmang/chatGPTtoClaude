# UX Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a guided ChatGPT export wizard, improved Claude import UX, and optional Claude API extraction mode.

**Architecture:** Refactor UploadPage into a multi-step wizard component. Enhance ExportModal with guided Claude import flow. Add a new API extraction module alongside existing heuristic extractors. App.tsx gains new state for wizard steps and API key.

**Tech Stack:** React 19, TypeScript, Anthropic SDK (browser-compatible fetch calls), existing Vitest + React Testing Library

---

### Task 1: Stepper Component

**Files:**
- Create: `src/components/Stepper.tsx`
- Create: `src/components/Stepper.css`
- Test: `src/components/__tests__/Stepper.test.tsx`

**Step 1: Write the failing test**

Create `src/components/__tests__/Stepper.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Stepper } from "../Stepper";

const STEPS = ["Get your data", "Download export", "Upload & extract"];

describe("Stepper", () => {
  it("renders all step labels", () => {
    render(<Stepper steps={STEPS} currentStep={0} onStepClick={vi.fn()} />);
    expect(screen.getByText("Get your data")).toBeInTheDocument();
    expect(screen.getByText("Download export")).toBeInTheDocument();
    expect(screen.getByText("Upload & extract")).toBeInTheDocument();
  });

  it("marks current step as active", () => {
    render(<Stepper steps={STEPS} currentStep={1} onStepClick={vi.fn()} />);
    const step2 = screen.getByText("Download export").closest(".stepper-step");
    expect(step2).toHaveClass("stepper-step--active");
  });

  it("marks completed steps", () => {
    render(<Stepper steps={STEPS} currentStep={2} onStepClick={vi.fn()} />);
    const step1 = screen.getByText("Get your data").closest(".stepper-step");
    expect(step1).toHaveClass("stepper-step--completed");
  });

  it("calls onStepClick when a completed step is clicked", async () => {
    const onClick = vi.fn();
    render(<Stepper steps={STEPS} currentStep={2} onStepClick={onClick} />);
    await userEvent.click(screen.getByText("Get your data"));
    expect(onClick).toHaveBeenCalledWith(0);
  });

  it("does not call onStepClick for future steps", async () => {
    const onClick = vi.fn();
    render(<Stepper steps={STEPS} currentStep={0} onStepClick={onClick} />);
    await userEvent.click(screen.getByText("Upload & extract"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/Stepper.test.tsx`
Expected: FAIL

**Step 3: Write implementation**

Create `src/components/Stepper.tsx`:
```tsx
import "./Stepper.css";

type StepperProps = {
  steps: string[];
  currentStep: number;
  onStepClick: (step: number) => void;
};

export function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="stepper">
      {steps.map((label, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;
        const className = [
          "stepper-step",
          isCompleted && "stepper-step--completed",
          isActive && "stepper-step--active",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div
            key={i}
            className={className}
            onClick={isCompleted ? () => onStepClick(i) : undefined}
            role={isCompleted ? "button" : undefined}
            tabIndex={isCompleted ? 0 : undefined}
          >
            <span className="stepper-number">
              {isCompleted ? "\u2713" : i + 1}
            </span>
            <span className="stepper-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
```

Create `src/components/Stepper.css`:
```css
.stepper {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
  width: 100%;
}

.stepper-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #666;
  transition: color 0.2s;
}

.stepper-step--active {
  color: #6366f1;
  font-weight: 600;
}

.stepper-step--completed {
  color: #16a34a;
  cursor: pointer;
}

.stepper-step--completed:hover {
  text-decoration: underline;
}

.stepper-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid currentColor;
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}

.stepper-step--completed .stepper-number {
  background: #16a34a;
  border-color: #16a34a;
  color: white;
}

.stepper-step--active .stepper-number {
  border-color: #6366f1;
  color: #6366f1;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/Stepper.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/Stepper.tsx src/components/Stepper.css src/components/__tests__/Stepper.test.tsx
git commit -m "feat: add Stepper component for multi-step wizard"
```

---

### Task 2: Refactor UploadPage into Wizard

**Files:**
- Modify: `src/components/UploadPage.tsx`
- Modify: `src/components/UploadPage.css`
- Modify: `src/components/__tests__/UploadPage.test.tsx`

**Step 1: Write the failing tests**

Replace `src/components/__tests__/UploadPage.test.tsx` with tests covering the wizard:
```tsx
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
```

**Step 2: Run test to verify failures**

Run: `npx vitest run src/components/__tests__/UploadPage.test.tsx`
Expected: FAIL (old component doesn't have wizard)

**Step 3: Rewrite UploadPage with wizard**

Replace `src/components/UploadPage.tsx`:
```tsx
import { useState, useRef } from "react";
import { Stepper } from "./Stepper";
import "./UploadPage.css";

const STEPS = ["Get your data", "Download export", "Upload & extract"];

type UploadPageProps = {
  onFileSelected: (file: File, apiKey?: string) => void;
  isProcessing: boolean;
  error?: string;
};

export function UploadPage({
  onFileSelected,
  isProcessing,
  error,
}: UploadPageProps) {
  const [step, setStep] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [apiKeyEnabled, setApiKeyEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".zip")) {
      onFileSelected(file, apiKeyEnabled ? apiKey : undefined);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file, apiKeyEnabled ? apiKey : undefined);
    }
  };

  const handleDropZoneClick = () => fileInputRef.current?.click();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleDropZoneClick();
    }
  };

  return (
    <div className="upload-page">
      <h1 className="upload-title">ChatGPT to Claude Memory</h1>
      <p className="upload-subtitle">
        Migrate your ChatGPT memories to Claude in three easy steps.
      </p>

      <Stepper steps={STEPS} currentStep={step} onStepClick={setStep} />

      {error && <div className="upload-error">{error}</div>}

      {step === 0 && (
        <div className="wizard-step">
          <h2>Request your data export from ChatGPT</h2>
          <p className="wizard-text">
            Click the button below to open ChatGPT's Data Controls settings,
            then click "Export data" and confirm.
          </p>
          <a
            href="https://chatgpt.com/#settings/DataControls"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Open ChatGPT Data Controls
          </a>
          <div className="wizard-nav">
            <button className="btn" onClick={() => setStep(1)}>
              Next
            </button>
            <button
              className="btn btn-link"
              onClick={() => setStep(2)}
            >
              I already have my ZIP file
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wizard-step">
          <h2>Download your export</h2>
          <p className="wizard-text">
            Check your email for a message from OpenAI with a download link.
            It usually arrives within a few minutes. The link expires in 24
            hours.
          </p>
          <div className="wizard-nav">
            <button
              className="btn btn-primary"
              onClick={() => setStep(2)}
            >
              I have my ZIP file
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step">
          {isProcessing ? (
            <div className="upload-processing">
              <div className="upload-spinner" />
              <p>Processing your ChatGPT export...</p>
            </div>
          ) : (
            <>
              <div
                className={`upload-drop-zone ${isDragging ? "dragging" : ""}`}
                role="button"
                tabIndex={0}
                onClick={handleDropZoneClick}
                onKeyDown={handleKeyDown}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
              >
                <p className="upload-drop-text">
                  Drop your <strong>.zip</strong> here or click to browse
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange}
                  data-testid="file-input"
                  className="upload-file-input"
                />
              </div>

              <div className="api-key-section">
                <label className="api-key-toggle">
                  <input
                    type="checkbox"
                    checked={apiKeyEnabled}
                    onChange={(e) => setApiKeyEnabled(e.target.checked)}
                  />
                  <span>Use Claude API for enhanced extraction (optional)</span>
                </label>
                {apiKeyEnabled && (
                  <div className="api-key-input-wrapper">
                    <input
                      type="password"
                      className="api-key-input"
                      placeholder="sk-ant-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      data-testid="api-key-input"
                    />
                    <p className="api-key-notice">
                      Your key is stored in memory only and sent directly to
                      api.anthropic.com. It is never saved or sent elsewhere.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

Add to `src/components/UploadPage.css` (append):
```css
/* ─── Wizard Steps ──────────────────────────────────────────────────────────── */

.wizard-step {
  width: 100%;
  text-align: center;
}

.wizard-step h2 {
  font-size: 1.3rem;
  margin-bottom: 0.75rem;
}

.wizard-text {
  color: #888;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.wizard-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  border: 1px solid #444;
  background: #2a2a2a;
  color: #ddd;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background-color 0.15s, border-color 0.15s;
}

.btn:hover {
  background: #333;
  border-color: #666;
}

.btn-primary {
  background: #6366f1;
  border-color: #6366f1;
  color: white;
  text-decoration: none;
  display: inline-block;
}

.btn-primary:hover {
  background: #4f46e5;
}

.btn-link {
  background: none;
  border: none;
  color: #888;
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-link:hover {
  color: #aaa;
}

/* ─── API Key ────────────────────────────────────────────────────────────────── */

.api-key-section {
  margin-top: 1.5rem;
  width: 100%;
  text-align: left;
}

.api-key-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: #aaa;
}

.api-key-input-wrapper {
  margin-top: 0.75rem;
}

.api-key-input {
  width: 100%;
  padding: 0.6rem 0.8rem;
  background: #111;
  border: 1px solid #444;
  border-radius: 8px;
  color: #ddd;
  font-family: monospace;
  font-size: 0.9rem;
}

.api-key-notice {
  color: #666;
  font-size: 0.8rem;
  margin-top: 0.4rem;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/UploadPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/UploadPage.tsx src/components/UploadPage.css src/components/__tests__/UploadPage.test.tsx
git commit -m "feat: refactor UploadPage into guided 3-step wizard with API key option"
```

---

### Task 3: Enhanced Export Modal with Claude Import Flow

**Files:**
- Modify: `src/components/ExportModal.tsx`
- Modify: `src/components/__tests__/ExportModal.test.tsx`
- Modify: `src/App.css` (add new styles)

**Step 1: Write the failing tests**

Replace `src/components/__tests__/ExportModal.test.tsx`:
```tsx
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
```

**Step 2: Run test to verify failures**

Run: `npx vitest run src/components/__tests__/ExportModal.test.tsx`
Expected: FAIL

**Step 3: Rewrite ExportModal**

Replace `src/components/ExportModal.tsx`:
```tsx
import { useState, useEffect } from "react";

type ExportModalProps = {
  markdown: string;
  onClose: () => void;
};

const CLAUDE_MESSAGE_PREFIX =
  "Please save all of these to your memory:\n\n";

export function ExportModal({ markdown, onClose }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const fullMessage = CLAUDE_MESSAGE_PREFIX + markdown;

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(fullMessage);
      setCopied(true);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      data-testid="modal-overlay"
      onClick={handleOverlayClick}
    >
      <div
        className="modal-content"
        data-testid="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Import into Claude</h2>
          <button className="btn modal-close-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-section">
          <h3>Your extracted memories</h3>
          <textarea
            className="modal-textarea"
            value={markdown}
            readOnly
            rows={10}
          />
        </div>

        <div className="modal-section">
          <h3>Import to Claude's memory</h3>
          <p className="modal-instructions">
            The message below includes the instruction{" "}
            <strong>"Please save all of these to your memory"</strong>{" "}
            followed by your extracted memories.
          </p>

          <ol className="import-checklist">
            <li>Click "Copy message" to copy the full message</li>
            <li>Click "Open Claude" to start a new conversation</li>
            <li>Paste the message and send it</li>
            <li>Claude will confirm the memories have been saved</li>
          </ol>

          <div className="import-actions">
            <button className="btn btn-primary" onClick={handleCopyMessage}>
              {copied ? "Copied!" : "Copy message"}
            </button>
            <a
              href="https://claude.ai/new"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Open Claude
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Add to `src/App.css` (append):
```css
/* ─── Enhanced Export Modal ──────────────────────────────────────────────────── */

.modal-section {
  margin-bottom: 1.5rem;
}

.modal-section h3 {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.import-checklist {
  list-style: decimal;
  padding-left: 1.5rem;
  color: #aaa;
  line-height: 1.8;
  margin-bottom: 1.25rem;
}

.import-actions {
  display: flex;
  gap: 0.75rem;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/ExportModal.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ExportModal.tsx src/components/__tests__/ExportModal.test.tsx src/App.css
git commit -m "feat: enhance ExportModal with guided Claude import flow"
```

---

### Task 4: Claude API Extraction Module

**Files:**
- Create: `src/extractors/apiExtractor.ts`
- Test: `src/extractors/__tests__/apiExtractor.test.ts`

This module sends conversations to Claude Haiku for intelligent extraction, returning the same `MemoryCandidate[]` format as heuristic extractors.

**Step 1: Write the failing test**

Create `src/extractors/__tests__/apiExtractor.test.ts`:
```ts
import { extractWithApi, buildExtractionPrompt, parseApiResponse } from "../apiExtractor";
import type { ParsedConversation, MemoryCandidate } from "../../types";

describe("buildExtractionPrompt", () => {
  it("includes conversation text in the prompt", () => {
    const conversations: ParsedConversation[] = [
      {
        id: "1",
        title: "Test Chat",
        model: "gpt-4o",
        createdAt: 1700000000,
        gizmoId: null,
        messages: [
          { role: "user", text: "I prefer TypeScript", timestamp: 1700000000 },
          { role: "assistant", text: "Good choice!", timestamp: 1700000001 },
        ],
      },
    ];
    const prompt = buildExtractionPrompt(conversations);
    expect(prompt).toContain("I prefer TypeScript");
    expect(prompt).toContain("Test Chat");
  });

  it("asks for categorized JSON output", () => {
    const prompt = buildExtractionPrompt([]);
    expect(prompt).toContain("preference");
    expect(prompt).toContain("technical");
    expect(prompt).toContain("project");
    expect(prompt).toContain("identity");
    expect(prompt).toContain("theme");
    expect(prompt).toContain("JSON");
  });
});

describe("parseApiResponse", () => {
  it("parses a valid JSON response into MemoryCandidates", () => {
    const json = JSON.stringify([
      {
        text: "Prefers TypeScript over JavaScript",
        category: "preference",
        confidence: "high",
      },
      {
        text: "Works with React and Node.js",
        category: "technical",
        confidence: "medium",
      },
    ]);
    const results = parseApiResponse(json, "Test Chat", 1700000000);
    expect(results).toHaveLength(2);
    expect(results[0].category).toBe("preference");
    expect(results[0].confidence).toBe("high");
    expect(results[0].status).toBe("pending");
    expect(results[0].sourceTitle).toBe("Test Chat");
    expect(results[1].category).toBe("technical");
  });

  it("handles JSON wrapped in markdown code fences", () => {
    const response = "```json\n[{\"text\":\"test\",\"category\":\"preference\",\"confidence\":\"high\"}]\n```";
    const results = parseApiResponse(response, "Chat", 0);
    expect(results).toHaveLength(1);
  });

  it("returns empty array on invalid JSON", () => {
    const results = parseApiResponse("not json", "Chat", 0);
    expect(results).toEqual([]);
  });

  it("filters out entries with invalid categories", () => {
    const json = JSON.stringify([
      { text: "valid", category: "preference", confidence: "high" },
      { text: "invalid", category: "unknown", confidence: "high" },
    ]);
    const results = parseApiResponse(json, "Chat", 0);
    expect(results).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/extractors/__tests__/apiExtractor.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/extractors/apiExtractor.ts`:
```ts
import type {
  ParsedConversation,
  MemoryCandidate,
  MemoryCategory,
  Confidence,
} from "../types";

const VALID_CATEGORIES: Set<string> = new Set([
  "preference",
  "technical",
  "project",
  "identity",
  "theme",
]);

const VALID_CONFIDENCES: Set<string> = new Set(["high", "medium", "low"]);

let nextId = 0;

export function buildExtractionPrompt(
  conversations: ParsedConversation[]
): string {
  const conversationTexts = conversations.map((conv) => {
    const msgs = conv.messages
      .map((m) => `[${m.role}]: ${m.text}`)
      .join("\n");
    return `--- Conversation: "${conv.title}" ---\n${msgs}`;
  });

  return `Analyze these ChatGPT conversations and extract facts about the user that should be remembered. Focus on their preferences, technical profile, projects, identity, and recurring interests.

For each fact, output a JSON array of objects with these fields:
- "text": a concise statement about the user (e.g., "Prefers TypeScript over JavaScript")
- "category": one of "preference", "technical", "project", "identity", "theme"
- "confidence": one of "high", "medium", "low"

Only extract facts stated or strongly implied by the USER (not the assistant). Be concise. Deduplicate. Output only the JSON array, nothing else.

${conversationTexts.join("\n\n")}`;
}

export function parseApiResponse(
  response: string,
  sourceTitle: string,
  sourceTimestamp: number | null
): MemoryCandidate[] {
  // Strip markdown code fences if present
  let cleaned = response.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const candidates: MemoryCandidate[] = [];
  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof item.text !== "string" ||
      !VALID_CATEGORIES.has(item.category) ||
      !VALID_CONFIDENCES.has(item.confidence)
    ) {
      continue;
    }
    candidates.push({
      id: `api-${nextId++}`,
      text: item.text,
      category: item.category as MemoryCategory,
      confidence: item.confidence as Confidence,
      sourceTitle,
      sourceTimestamp,
      status: "pending",
    });
  }

  return candidates;
}

type ProgressCallback = (current: number, total: number) => void;

export async function extractWithApi(
  conversations: ParsedConversation[],
  apiKey: string,
  onProgress?: ProgressCallback
): Promise<MemoryCandidate[]> {
  const BATCH_SIZE = 5;
  const batches: ParsedConversation[][] = [];

  for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
    batches.push(conversations.slice(i, i + BATCH_SIZE));
  }

  const allCandidates: MemoryCandidate[] = [];

  for (let i = 0; i < batches.length; i++) {
    onProgress?.(i + 1, batches.length);

    const prompt = buildExtractionPrompt(batches[i]);
    const batchTitle =
      batches[i].length === 1
        ? batches[i][0].title
        : `batch ${i + 1} (${batches[i].length} conversations)`;
    const batchTimestamp = batches[i][0].createdAt;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Claude API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    const text =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";
    const candidates = parseApiResponse(text, batchTitle, batchTimestamp);
    allCandidates.push(...candidates);
  }

  return allCandidates;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/extractors/__tests__/apiExtractor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/extractors/apiExtractor.ts src/extractors/__tests__/apiExtractor.test.ts
git commit -m "feat: add Claude API extraction module with batching and progress"
```

---

### Task 5: Update App.tsx for API Key and Progress

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/__tests__/App.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/__tests__/App.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import App from "../../App";

describe("App", () => {
  it("renders the upload wizard initially", () => {
    render(<App />);
    expect(screen.getByText("ChatGPT to Claude Memory")).toBeInTheDocument();
    expect(screen.getByText("Get your data")).toBeInTheDocument();
  });

  it("shows stepper steps", () => {
    render(<App />);
    expect(screen.getByText("Get your data")).toBeInTheDocument();
    expect(screen.getByText("Download export")).toBeInTheDocument();
    expect(screen.getByText("Upload & extract")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/App.test.tsx`
Expected: FAIL (old UploadPage props don't include apiKey)

**Step 3: Update App.tsx**

Replace `src/App.tsx`:
```tsx
import { useState } from "react";
import type { MemoryCandidate } from "./types";
import { extractConversations } from "./parser/zipParser";
import { parseConversation } from "./parser/conversationParser";
import { extractAllMemories } from "./extractors";
import { extractWithApi } from "./extractors/apiExtractor";
import { exportToMarkdown } from "./export/markdownExport";
import { UploadPage } from "./components/UploadPage";
import { ReviewPage } from "./components/ReviewPage";
import { ExportModal } from "./components/ExportModal";
import "./App.css";

type AppState = "upload" | "review" | "export";

function App() {
  const [state, setState] = useState<AppState>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [exportMarkdown, setExportMarkdown] = useState("");
  const [progress, setProgress] = useState("");

  const handleFileSelected = async (file: File, apiKey?: string) => {
    setIsProcessing(true);
    setError(undefined);
    setProgress("");

    try {
      const rawConversations = await extractConversations(file);
      const parsed = rawConversations.map(parseConversation);

      let memories: MemoryCandidate[];

      if (apiKey) {
        memories = await extractWithApi(parsed, apiKey, (current, total) => {
          setProgress(`Analyzing batch ${current} of ${total}...`);
        });
      } else {
        memories = extractAllMemories(parsed);
      }

      setCandidates(memories);
      setState("review");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsProcessing(false);
      setProgress("");
    }
  };

  const handleUpdateCandidate = (
    id: string,
    updates: Partial<Pick<MemoryCandidate, "status" | "text">>
  ) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleExport = () => {
    const markdown = exportToMarkdown(candidates);
    setExportMarkdown(markdown);
    setState("export");
  };

  const handleCloseModal = () => {
    setState("review");
  };

  return (
    <div className="app">
      {state === "upload" && (
        <UploadPage
          onFileSelected={handleFileSelected}
          isProcessing={isProcessing}
          error={error}
          progress={progress}
        />
      )}

      {(state === "review" || state === "export") && (
        <ReviewPage
          candidates={candidates}
          onUpdateCandidate={handleUpdateCandidate}
          onExport={handleExport}
        />
      )}

      {state === "export" && (
        <ExportModal markdown={exportMarkdown} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default App;
```

Update `UploadPage` props type and processing display to also accept `progress?: string`:

In `src/components/UploadPage.tsx`, add `progress?: string` to props type and display it below the spinner:
```tsx
type UploadPageProps = {
  onFileSelected: (file: File, apiKey?: string) => void;
  isProcessing: boolean;
  error?: string;
  progress?: string;
};
```

In the processing section:
```tsx
<div className="upload-processing">
  <div className="upload-spinner" />
  <p>Processing your ChatGPT export...</p>
  {progress && <p className="upload-progress">{progress}</p>}
</div>
```

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/App.tsx src/components/UploadPage.tsx src/components/__tests__/App.test.tsx
git commit -m "feat: wire API extraction mode into App with progress reporting"
```

---

### Task 6: Final Integration Test and Cleanup

**Files:**
- Run: full test suite
- Run: production build
- Verify: `npm run dev` loads correctly

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (should be ~140+ tests)

**Step 2: Run production build**

Run: `npm run build`
Expected: Successful build, no TypeScript errors

**Step 3: Manual verification**

Run: `npm run dev`
Verify:
- App loads with stepper (Step 1 → 2 → 3)
- Step 1 has "Open ChatGPT Data Controls" link
- "I already have my ZIP" skips to Step 3
- Step 3 has file upload zone and API key toggle
- Processing works
- Review page shows memories
- Export modal has "Copy message" + "Open Claude" buttons

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: final integration verification for UX enhancements"
```
