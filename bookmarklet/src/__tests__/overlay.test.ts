import { createOverlay, type Overlay } from "../overlay";

describe("createOverlay", () => {
  let overlay: Overlay;

  afterEach(() => {
    // Clean up any leftover overlay elements
    document.getElementById("cgpt-export-overlay")?.remove();
  });

  it("creates an overlay element in the DOM", () => {
    overlay = createOverlay();
    const el = document.getElementById("cgpt-export-overlay");
    expect(el).not.toBeNull();
    expect(el!.parentElement).toBe(document.body);
  });

  it("displays initial title and status text", () => {
    overlay = createOverlay();
    const el = document.getElementById("cgpt-export-overlay")!;
    expect(el.textContent).toContain("Exporting ChatGPT Data");
    expect(el.textContent).toContain("Starting...");
  });

  it("displays a Cancel button", () => {
    overlay = createOverlay();
    const el = document.getElementById("cgpt-export-overlay")!;
    const button = el.querySelector("button");
    expect(button).not.toBeNull();
    expect(button!.textContent).toBe("Cancel");
  });

  it("setProgress updates the status text", () => {
    overlay = createOverlay();
    overlay.setProgress("Fetching conversations (3/10)...");
    const el = document.getElementById("cgpt-export-overlay")!;
    expect(el.textContent).toContain("Fetching conversations (3/10)...");
    expect(el.textContent).not.toContain("Starting...");
  });

  it("setError shows error state", () => {
    overlay = createOverlay();
    overlay.setError("Network request failed");
    const el = document.getElementById("cgpt-export-overlay")!;
    expect(el.textContent).toContain("Export Error");
    expect(el.textContent).toContain("Network request failed");
    expect(el.textContent).not.toContain("Exporting ChatGPT Data");
    const button = el.querySelector("button");
    expect(button!.textContent).toBe("Close");
  });

  it("setDone shows done state", () => {
    overlay = createOverlay();
    overlay.setDone();
    const el = document.getElementById("cgpt-export-overlay")!;
    expect(el.textContent).toContain("Done!");
    expect(el.textContent).toContain("Check the new tab to continue.");
    expect(el.textContent).not.toContain("Exporting ChatGPT Data");
    const button = el.querySelector("button");
    expect(button!.textContent).toBe("Close");
  });

  it("destroy removes the element from the DOM", () => {
    overlay = createOverlay();
    expect(document.getElementById("cgpt-export-overlay")).not.toBeNull();
    overlay.destroy();
    expect(document.getElementById("cgpt-export-overlay")).toBeNull();
  });

  it("cancel button calls onCancel callback when clicked", () => {
    const onCancel = vi.fn();
    overlay = createOverlay(onCancel);
    const el = document.getElementById("cgpt-export-overlay")!;
    const button = el.querySelector("button")!;
    button.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancel button works without onCancel callback", () => {
    overlay = createOverlay();
    const el = document.getElementById("cgpt-export-overlay")!;
    const button = el.querySelector("button")!;
    // Should not throw
    expect(() => button.click()).not.toThrow();
  });

  it("creating a second overlay removes the first", () => {
    const first = createOverlay();
    const firstEl = document.getElementById("cgpt-export-overlay")!;
    expect(firstEl).not.toBeNull();

    // Create a second overlay — the first element should be removed
    const second = createOverlay();
    const allOverlays = document.querySelectorAll("#cgpt-export-overlay");
    expect(allOverlays).toHaveLength(1);

    // The surviving element should belong to the second overlay
    second.setProgress("second");
    expect(allOverlays[0].textContent).toContain("second");

    // The original DOM node should no longer be in the document
    expect(firstEl.parentElement).toBeNull();
  });

  it("applies correct inline styles to the container", () => {
    overlay = createOverlay();
    const el = document.getElementById("cgpt-export-overlay")!;
    expect(el.style.position).toBe("fixed");
    expect(el.style.zIndex).toBe("99999");
  });

  // -------------------------------------------------------------------------
  // Security: XSS prevention
  // -------------------------------------------------------------------------

  it("does not render HTML in setProgress status text (XSS prevention)", () => {
    overlay = createOverlay();
    const xssPayload = '<img src=x onerror=alert(1)>';
    overlay.setProgress(xssPayload);

    const el = document.getElementById("cgpt-export-overlay")!;

    // The raw XSS string should appear as visible text content
    expect(el.textContent).toContain(xssPayload);

    // No <img> element should have been injected into the DOM
    expect(el.querySelector("img")).toBeNull();

    // The status <p> element should not contain any HTML children
    const statusP = el.querySelector("p")!;
    expect(statusP.children).toHaveLength(0);
    expect(statusP.textContent).toBe(xssPayload);
  });

  it("does not render HTML in setError error text (XSS prevention)", () => {
    overlay = createOverlay();
    const xssPayload = '<img src=x onerror=alert(1)>';
    overlay.setError(xssPayload);

    const el = document.getElementById("cgpt-export-overlay")!;

    // The raw XSS string should appear as visible text content
    expect(el.textContent).toContain(xssPayload);

    // No <img> element should have been injected into the DOM
    expect(el.querySelector("img")).toBeNull();

    // The status <p> element should not contain any HTML children
    const statusP = el.querySelector("p")!;
    expect(statusP.children).toHaveLength(0);
    expect(statusP.textContent).toBe(xssPayload);
  });
});
