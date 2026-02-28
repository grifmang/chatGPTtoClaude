import { useState } from "react";
import type { MemoryCandidate } from "./types";
import { extractConversations } from "./parser/zipParser";
import { parseConversation } from "./parser/conversationParser";
import { extractAllMemories } from "./extractors";
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

  const handleFileSelected = async (file: File) => {
    setIsProcessing(true);
    setError(undefined);

    try {
      const rawConversations = await extractConversations(file);
      const parsed = rawConversations.map(parseConversation);
      const memories = extractAllMemories(parsed);
      setCandidates(memories);
      setState("review");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateCandidate = (
    id: string,
    updates: Partial<Pick<MemoryCandidate, "status" | "text">>,
  ) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
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
