import { useState, useRef, useEffect } from "react";
import { Stepper } from "./Stepper";
import bookmarkletRaw from "../../bookmarklet/dist/bookmarklet.js?raw";
import "./UploadPage.css";

const STEPS = ["Get your data", "Download export", "Upload & extract"];
const BOOKMARKLET_CODE = bookmarkletRaw.trim();

type UploadPageProps = {
  onFileSelected: (file: File, apiKey?: string) => void;
  isProcessing: boolean;
  error?: string;
  progress?: string;
};

export function UploadPage({
  onFileSelected,
  isProcessing,
  error,
  progress,
}: UploadPageProps) {
  const [step, setStep] = useState(isProcessing ? 2 : 0);
  const [isDragging, setIsDragging] = useState(false);
  const [apiKeyEnabled, setApiKeyEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  // Set bookmarklet href via DOM ref to bypass React's javascript: URL blocking
  useEffect(() => {
    if (bookmarkletRef.current) {
      bookmarkletRef.current.href = BOOKMARKLET_CODE;
    }
  }, []);

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
          <div className="bookmarklet-section">
            <p className="bookmarklet-divider">or try the fast way</p>
            <p className="bookmarklet-instructions">
              Drag this to your bookmark bar, then click it while on chatgpt.com:
            </p>
            <a
              ref={bookmarkletRef}
              href="#bookmarklet"
              className="bookmarklet-link"
              onClick={(e) => {
                e.preventDefault();
                alert('Drag this link to your bookmark bar, then click it while on chatgpt.com.');
              }}
            >
              Export ChatGPT Data
            </a>
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
            <button className="btn" onClick={() => setStep(0)}>
              Back
            </button>
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
              {progress && <p className="upload-progress">{progress}</p>}
            </div>
          ) : (
            <>
              <div className="wizard-nav wizard-nav-top">
                <button className="btn" onClick={() => setStep(1)}>
                  Back
                </button>
              </div>
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
