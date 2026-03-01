import { useState, useEffect } from "react";
import type { MemoryCandidate } from "../types";
import { exportToClaudeMd } from "../export/claudeMdExport";

type ExportFormat = "memory" | "claudemd";

type ExportModalProps = {
  markdown: string;
  candidates: MemoryCandidate[];
  onClose: () => void;
};

const CLAUDE_MESSAGE_PREFIX =
  "Please save all of these to your memory:\n\n";

export function ExportModal({ markdown, candidates, onClose }: ExportModalProps) {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("memory");

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const fullMessage = CLAUDE_MESSAGE_PREFIX + markdown;
  const claudeMdContent = exportToClaudeMd(candidates);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(fullMessage);
      setCopied(true);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleDownload = () => {
    const blob = new Blob([claudeMdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "CLAUDE.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

        <div className="format-toggle">
          <button
            className={`btn format-toggle-btn${format === "memory" ? " active" : ""}`}
            onClick={() => setFormat("memory")}
          >
            Claude Memory
          </button>
          <button
            className={`btn format-toggle-btn${format === "claudemd" ? " active" : ""}`}
            onClick={() => setFormat("claudemd")}
          >
            CLAUDE.md
          </button>
        </div>

        {format === "memory" && (
          <>
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
          </>
        )}

        {format === "claudemd" && (
          <div className="modal-section">
            <h3>CLAUDE.md file</h3>
            <p className="modal-instructions">
              Download this file and place it in your project root. Claude Code
              and Claude Desktop will read it automatically.
            </p>
            <textarea
              className="modal-textarea"
              value={claudeMdContent}
              readOnly
              rows={10}
            />
            <div className="import-actions">
              <button className="btn btn-primary" onClick={handleDownload}>
                Download CLAUDE.md
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
