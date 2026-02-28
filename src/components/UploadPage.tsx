import { useState, useRef } from "react";
import "./UploadPage.css";

type UploadPageProps = {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
  error?: string;
};

export function UploadPage({
  onFileSelected,
  isProcessing,
  error,
}: UploadPageProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".zip")) {
      onFileSelected(file);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleDropZoneClick();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="upload-page">
      <h1 className="upload-title">ChatGPT to Claude Memory</h1>
      <p className="upload-subtitle">
        Migrate your ChatGPT memories to Claude. Upload your ChatGPT data export
        and we'll extract your preferences, technical profile, and more.
      </p>

      {error && <div className="upload-error">{error}</div>}

      {isProcessing ? (
        <div className="upload-processing">
          <div className="upload-spinner" />
          <p>Processing your ChatGPT export...</p>
        </div>
      ) : (
        <div
          className={`upload-drop-zone ${isDragging ? "dragging" : ""}`}
          role="button"
          tabIndex={0}
          onClick={handleDropZoneClick}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
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
      )}

      <details
        className="upload-instructions"
        open={instructionsOpen}
        onToggle={(e) =>
          setInstructionsOpen((e.target as HTMLDetailsElement).open)
        }
      >
        <summary>How to export your ChatGPT data</summary>
        <ol>
          <li>Go to ChatGPT Settings</li>
          <li>Click on "Data controls"</li>
          <li>Click "Export data"</li>
          <li>Confirm the export request</li>
          <li>Wait for an email from OpenAI with a download link</li>
          <li>Download the ZIP file and upload it here</li>
        </ol>
      </details>
    </div>
  );
}
