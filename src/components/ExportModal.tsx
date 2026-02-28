import { useState, useEffect } from "react";

type ExportModalProps = {
  markdown: string;
  onClose: () => void;
};

export function ExportModal({ markdown, onClose }: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
    } catch {
      // Clipboard API unavailable (e.g., non-HTTPS context)
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
          <h2>Export Your Memories</h2>
          <button className="btn modal-close-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="modal-instructions">
          Copy the text below and paste it into Claude with the message:{" "}
          <strong>"Please save all of these to your memory."</strong>
        </p>

        <textarea
          className="modal-textarea"
          value={markdown}
          readOnly
          rows={15}
        />

        <div className="modal-actions">
          <button className="btn btn-copy" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
}
