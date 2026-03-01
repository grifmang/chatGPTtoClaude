/** Methods exposed by the progress overlay. */
export interface Overlay {
  /** Update the status text while export is in progress. */
  setProgress(text: string): void;
  /** Switch to the error state with the given message. */
  setError(text: string): void;
  /** Show an action button and resolve when the user clicks it. */
  promptAction(statusText: string, buttonLabel: string): Promise<void>;
  /** Show a row of choice buttons and resolve with the clicked option's value. */
  promptChoice(statusText: string, options: { label: string; value: string }[]): Promise<string>;
  /** Switch to the "done" state. */
  setDone(): void;
  /** Remove the overlay from the DOM entirely. */
  destroy(): void;
}

/**
 * Create a floating progress overlay injected into `document.body`.
 *
 * @param onCancel - optional callback invoked when the user clicks Cancel / Close.
 */
export function createOverlay(onCancel?: () => void): Overlay {
  // Remove any existing overlay to prevent duplicates
  const existing = document.getElementById("cgpt-export-overlay");
  if (existing) existing.remove();

  // ── Container (full-screen backdrop) ──────────────────────────────
  const container = document.createElement("div");
  container.id = "cgpt-export-overlay";
  Object.assign(container.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "99999",
  } satisfies Partial<CSSStyleDeclaration>);

  // ── Card ──────────────────────────────────────────────────────────
  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#1e1e2e",
    borderRadius: "12px",
    padding: "2rem",
    maxWidth: "400px",
    width: "90%",
    color: "#ddd",
    fontFamily: "system-ui, sans-serif",
    textAlign: "center",
  } satisfies Partial<CSSStyleDeclaration>);

  // ── Title ─────────────────────────────────────────────────────────
  const title = document.createElement("h2");
  title.textContent = "Exporting ChatGPT Data";
  Object.assign(title.style, {
    margin: "0 0 1rem",
    fontSize: "1.25rem",
    fontWeight: "600",
  } satisfies Partial<CSSStyleDeclaration>);

  // ── Status text ───────────────────────────────────────────────────
  const status = document.createElement("p");
  status.textContent = "Starting...";
  Object.assign(status.style, {
    margin: "0 0 1.5rem",
    fontSize: "0.95rem",
    lineHeight: "1.4",
  } satisfies Partial<CSSStyleDeclaration>);

  // ── Cancel / Close button ─────────────────────────────────────────
  const button = document.createElement("button");
  button.textContent = "Cancel";
  Object.assign(button.style, {
    background: "#2a2a2a",
    border: "1px solid #444",
    borderRadius: "8px",
    color: "#ddd",
    padding: "0.5rem 1.5rem",
    fontSize: "0.9rem",
    cursor: "pointer",
  } satisfies Partial<CSSStyleDeclaration>);
  button.addEventListener("click", () => onCancel?.());

  // ── Assemble ──────────────────────────────────────────────────────
  card.append(title, status, button);
  container.appendChild(card);
  document.body.appendChild(container);

  // ── Overlay API ───────────────────────────────────────────────────
  return {
    setProgress(text: string) {
      status.textContent = text;
    },

    setError(text: string) {
      title.textContent = "Export Error";
      status.textContent = text;
      button.textContent = "Close";
    },

    promptAction(statusText: string, buttonLabel: string): Promise<void> {
      status.textContent = statusText;
      button.textContent = buttonLabel;
      return new Promise<void>((resolve) => {
        button.replaceWith(button.cloneNode(true) as HTMLButtonElement);
        const newButton = card.querySelector("button")!;
        Object.assign(newButton.style, {
          background: "#2563eb",
          border: "1px solid #3b82f6",
          borderRadius: "8px",
          color: "#fff",
          padding: "0.6rem 1.5rem",
          fontSize: "0.95rem",
          cursor: "pointer",
          fontWeight: "600",
        } satisfies Partial<CSSStyleDeclaration>);
        newButton.addEventListener("click", () => resolve(), { once: true });
      });
    },

    promptChoice(
      statusText: string,
      options: { label: string; value: string }[],
    ): Promise<string> {
      status.textContent = statusText;
      return new Promise<string>((resolve) => {
        // Replace the cancel button with a row of choice buttons
        button.remove();
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "flex",
          gap: "0.5rem",
          justifyContent: "center",
          flexWrap: "wrap",
        } satisfies Partial<CSSStyleDeclaration>);

        for (const option of options) {
          const btn = document.createElement("button");
          btn.textContent = option.label;
          Object.assign(btn.style, {
            background: "#2563eb",
            border: "1px solid #3b82f6",
            borderRadius: "8px",
            color: "#fff",
            padding: "0.6rem 1.5rem",
            fontSize: "0.95rem",
            cursor: "pointer",
            fontWeight: "600",
          } satisfies Partial<CSSStyleDeclaration>);
          btn.addEventListener(
            "click",
            () => {
              row.replaceWith(button);
              resolve(option.value);
            },
            { once: true },
          );
          row.appendChild(btn);
        }

        card.appendChild(row);
      });
    },

    setDone() {
      title.textContent = "Done!";
      status.textContent = "Check the new tab to continue.";
      button.textContent = "Close";
    },

    destroy() {
      container.remove();
    },
  };
}
