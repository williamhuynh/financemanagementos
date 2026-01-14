"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@financelab/ui";
import VoiceInput from "./VoiceInput";

type CashLog = {
  id: string;
  text: string;
  date: string;
  month: string;
  status: "draft" | "processed" | "committed";
  source: "text" | "voice";
  isIncome: boolean;
  parsedItems: ParsedItem[] | null;
  createdAt: string;
};

type ParsedItem = {
  description: string;
  amount: number;
  category: string;
  confidence?: number;
};

type MonthOption = {
  value: string;
  label: string;
};

type CashLogClientProps = {
  initialLogs: CashLog[];
  categories: string[];
  monthOptions: MonthOption[];
  selectedMonth: string;
};

// Offline queue stored in localStorage
const OFFLINE_QUEUE_KEY = "cashLogOfflineQueue";

type OfflineEntry = {
  id: string;
  text: string;
  date: string;
  isIncome: boolean;
  source: "text" | "voice";
  createdAt: string;
};

function getOfflineQueue(): OfflineEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function addToOfflineQueue(entry: OfflineEntry) {
  const queue = getOfflineQueue();
  queue.push(entry);
  saveOfflineQueue(queue);
}

function removeFromOfflineQueue(id: string) {
  const queue = getOfflineQueue();
  saveOfflineQueue(queue.filter((e) => e.id !== id));
}

export default function CashLogClient({
  initialLogs,
  categories,
  monthOptions,
  selectedMonth
}: CashLogClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [logs, setLogs] = useState<CashLog[]>(initialLogs);
  const [offlineQueue, setOfflineQueue] = useState<OfflineEntry[]>([]);
  const [text, setText] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isIncome, setIsIncome] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [showProcess, setShowProcess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedItems, setProcessedItems] = useState<
    Array<{ logId: string; items: ParsedItem[] }>
  >([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync offline queue when back online
  const syncOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    for (const entry of queue) {
      try {
        const response = await fetch("/api/cash-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: entry.text,
            date: entry.date,
            isIncome: entry.isIncome
          })
        });

        if (response.ok) {
          removeFromOfflineQueue(entry.id);
          const newLog = await response.json();
          setLogs((prev) => [newLog, ...prev]);
        }
      } catch {
        // Keep in queue for next sync attempt
      }
    }
    setOfflineQueue(getOfflineQueue());
  }, []);

  // Check online status and sync when back online
  useEffect(() => {
    setIsOnline(navigator.onLine);
    setOfflineQueue(getOfflineQueue());

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOfflineQueue]);

  const handleMonthChange = (newMonth: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonth);
    router.push(`/cash?${params.toString()}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const entryText = text.trim();
    const entryDate = date;
    const entryIsIncome = isIncome;

    setText("");
    setIsIncome(false);

    if (!isOnline) {
      // Store offline
      const offlineEntry: OfflineEntry = {
        id: `offline-${Date.now()}`,
        text: entryText,
        date: entryDate,
        isIncome: entryIsIncome,
        source: "text",
        createdAt: new Date().toISOString()
      };
      addToOfflineQueue(offlineEntry);
      setOfflineQueue(getOfflineQueue());
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/cash-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: entryText,
          date: entryDate,
          isIncome: entryIsIncome
        })
      });

      if (response.ok) {
        const newLog = await response.json();
        setLogs((prev) => [newLog, ...prev]);
      } else {
        // Handle API error - show error message to user
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Failed to add entry (${response.status})`;
        setError(errorMessage);
        console.error("Failed to add cash log:", errorMessage);
      }
    } catch (err) {
      // Store offline on network error
      const offlineEntry: OfflineEntry = {
        id: `offline-${Date.now()}`,
        text: entryText,
        date: entryDate,
        isIncome: entryIsIncome,
        source: "text",
        createdAt: new Date().toISOString()
      };
      addToOfflineQueue(offlineEntry);
      setOfflineQueue(getOfflineQueue());
      console.error("Network error, saved to offline queue:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceInput = (transcribedText: string) => {
    setText((prev) => (prev ? `${prev} ${transcribedText}` : transcribedText));
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith("offline-")) {
      removeFromOfflineQueue(id);
      setOfflineQueue(getOfflineQueue());
      return;
    }

    try {
      const response = await fetch(`/api/cash-logs/${id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        setLogs((prev) => prev.filter((log) => log.id !== id));
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || `Failed to delete entry (${response.status})`);
      }
    } catch (err) {
      setError("Network error while deleting entry");
      console.error("Delete error:", err);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editText.trim()) return;

    try {
      const response = await fetch(`/api/cash-logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText.trim() })
      });

      if (response.ok) {
        const updated = await response.json();
        setLogs((prev) =>
          prev.map((log) => (log.id === id ? updated : log))
        );
        setEditingId(null);
        setEditText("");
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || `Failed to edit entry (${response.status})`);
      }
    } catch (err) {
      setError("Network error while editing entry");
      console.error("Edit error:", err);
    }
  };

  const handleProcess = async () => {
    const draftLogs = logs.filter((log) => log.status === "draft");
    if (draftLogs.length === 0) return;

    setIsProcessing(true);
    setShowProcess(true);
    setError(null);

    try {
      const response = await fetch("/api/cash-logs/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logIds: draftLogs.map((log) => log.id),
          categories
        })
      });

      if (response.ok) {
        const result = await response.json();
        setProcessedItems(result.processed);
        // Update logs with parsed items
        setLogs((prev) =>
          prev.map((log) => {
            const processed = result.processed.find(
              (p: { logId: string }) => p.logId === log.id
            );
            if (processed) {
              return {
                ...log,
                status: "processed" as const,
                parsedItems: processed.items
              };
            }
            return log;
          })
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || `Failed to process entries (${response.status})`);
        setShowProcess(false);
      }
    } catch (err) {
      setError("Network error while processing entries");
      setShowProcess(false);
      console.error("Process error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateCategory = (
    logId: string,
    itemIndex: number,
    newCategory: string
  ) => {
    setProcessedItems((prev) =>
      prev.map((p) => {
        if (p.logId === logId) {
          const newItems = [...p.items];
          newItems[itemIndex] = { ...newItems[itemIndex], category: newCategory };
          return { ...p, items: newItems };
        }
        return p;
      })
    );
  };

  const handleCommit = async () => {
    if (processedItems.length === 0) return;

    setIsCommitting(true);
    setError(null);
    try {
      const response = await fetch("/api/cash-logs/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processed: processedItems })
      });

      if (response.ok) {
        // Mark logs as committed
        setLogs((prev) =>
          prev.map((log) => {
            if (processedItems.some((p) => p.logId === log.id)) {
              return { ...log, status: "committed" as const };
            }
            return log;
          })
        );
        setShowProcess(false);
        setProcessedItems([]);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || `Failed to commit entries (${response.status})`);
      }
    } catch (err) {
      setError("Network error while committing entries");
      console.error("Commit error:", err);
    } finally {
      setIsCommitting(false);
    }
  };

  const draftLogs = logs.filter((log) => log.status === "draft");
  const committedLogs = logs.filter((log) => log.status === "committed");

  // Calculate estimated total for draft logs
  const estimatedTotal = draftLogs.reduce((sum, log) => {
    const matches = log.text.match(/\$?\d+(?:\.\d{2})?/g);
    if (matches) {
      return (
        sum +
        matches.reduce((acc, m) => acc + parseFloat(m.replace("$", "")), 0)
      );
    }
    return sum;
  }, 0);

  return (
    <div className="cash-log-container">
      <style jsx>{`
        .cash-log-container {
          display: grid;
          gap: 20px;
        }

        .cash-input-section {
          display: grid;
          gap: 16px;
        }

        .voice-row {
          display: flex;
          justify-content: center;
        }

        .text-input-wrap {
          position: relative;
        }

        .text-input {
          width: 100%;
          min-height: 80px;
          padding: 14px 16px;
          background: rgba(20, 25, 35, 0.9);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          color: var(--text-primary);
          font-size: 16px;
          resize: none;
          font-family: inherit;
        }

        .text-input:focus {
          outline: none;
          border-color: rgba(242, 164, 59, 0.5);
          box-shadow: 0 0 0 2px rgba(242, 164, 59, 0.1);
        }

        .text-input::placeholder {
          color: var(--text-secondary);
        }

        .input-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .input-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .date-input {
          background: rgba(20, 25, 35, 0.9);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 8px 14px;
          color: var(--text-primary);
          font-size: 13px;
        }

        .income-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: rgba(20, 25, 35, 0.9);
          border: 1px solid var(--border);
          border-radius: 999px;
          cursor: pointer;
          font-size: 13px;
          color: var(--text-secondary);
          transition: all 0.2s ease;
        }

        .income-toggle.active {
          border-color: rgba(76, 195, 138, 0.6);
          color: #92f0bf;
          background: rgba(76, 195, 138, 0.1);
        }

        .submit-btn {
          padding: 10px 20px;
          background: var(--accent);
          border: none;
          border-radius: 999px;
          color: #0b0e14;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .submit-btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(242, 164, 59, 0.25);
        }

        .offline-banner {
          background: rgba(242, 164, 59, 0.15);
          border: 1px solid rgba(242, 164, 59, 0.4);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          font-size: 13px;
          color: #f6c16b;
          text-align: center;
        }

        .month-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .log-entry {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          background: rgba(26, 33, 46, 0.6);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }

        .log-entry.offline {
          border-style: dashed;
          border-color: rgba(242, 164, 59, 0.4);
        }

        .log-entry.income {
          border-color: rgba(76, 195, 138, 0.4);
        }

        .log-content {
          flex: 1;
          min-width: 0;
        }

        .log-text {
          font-size: 15px;
          word-break: break-word;
        }

        .log-meta {
          display: flex;
          gap: 8px;
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-secondary);
          flex-wrap: wrap;
        }

        .log-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }

        .action-btn {
          padding: 6px 10px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 999px;
          color: var(--text-secondary);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          border-color: rgba(242, 164, 59, 0.5);
          color: var(--text-primary);
        }

        .action-btn.delete:hover {
          border-color: rgba(226, 106, 90, 0.6);
          color: #f28b7d;
        }

        .edit-input {
          width: 100%;
          padding: 10px 12px;
          background: rgba(20, 25, 35, 0.9);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 14px;
          margin-bottom: 8px;
        }

        .edit-actions {
          display: flex;
          gap: 8px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-top: 1px solid var(--border);
          margin-top: 8px;
        }

        .summary-text {
          color: var(--text-secondary);
          font-size: 13px;
        }

        .process-btn {
          padding: 10px 18px;
          background: rgba(242, 164, 59, 0.15);
          border: 1px solid rgba(242, 164, 59, 0.5);
          border-radius: 999px;
          color: var(--accent);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .process-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .process-btn:not(:disabled):hover {
          background: rgba(242, 164, 59, 0.2);
        }

        .process-modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .process-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(8, 12, 20, 0.8);
        }

        .process-panel {
          position: relative;
          width: min(600px, 95vw);
          max-height: 85vh;
          overflow: auto;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 24px;
          box-shadow: var(--shadow);
        }

        .process-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .process-title {
          font-size: 20px;
          font-weight: 600;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          display: grid;
          place-items: center;
          font-size: 18px;
        }

        .processed-group {
          margin-bottom: 20px;
        }

        .processed-source {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 10px;
          padding: 8px 12px;
          background: rgba(20, 25, 35, 0.6);
          border-radius: var(--radius-sm);
        }

        .processed-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(26, 33, 46, 0.6);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          margin-bottom: 8px;
        }

        .item-info {
          flex: 1;
        }

        .item-desc {
          font-weight: 500;
        }

        .item-amount {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .item-category {
          background: rgba(20, 25, 35, 0.9);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 6px 12px;
          color: var(--text-primary);
          font-size: 12px;
        }

        .process-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 0;
          border-top: 1px solid var(--border);
          margin-top: 12px;
        }

        .total-label {
          font-weight: 600;
        }

        .total-value {
          font-size: 18px;
          font-weight: 600;
          color: var(--accent);
        }

        .process-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 20px;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: var(--text-secondary);
        }

        .logs-section {
          margin-top: 8px;
        }

        .section-title {
          font-size: 13px;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 12px;
        }

        .logs-list {
          display: grid;
          gap: 10px;
        }

        .error-banner {
          background: rgba(226, 106, 90, 0.15);
          border: 1px solid rgba(226, 106, 90, 0.4);
          border-radius: var(--radius-md);
          padding: 12px 14px;
          font-size: 13px;
          color: #f28b7d;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .error-dismiss {
          background: transparent;
          border: none;
          color: #f28b7d;
          cursor: pointer;
          font-size: 18px;
          padding: 0 4px;
        }
      `}</style>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="error-dismiss" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Offline Banner */}
      {!isOnline && (
        <div className="offline-banner">
          You're offline. Entries will sync when back online.
        </div>
      )}

      {/* Input Section */}
      <Card title="Quick Entry" className="cash-input-section">
        <form onSubmit={handleSubmit}>
          <div className="cash-input-section">
            <div className="voice-row">
              <VoiceInput onTranscription={handleVoiceInput} disabled={false} />
            </div>

            <div className="text-input-wrap">
              <textarea
                className="text-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="eggs $20.10 rice $15 vegetables $8.50..."
                rows={3}
              />
            </div>

            <div className="input-controls">
              <div className="input-left">
                <input
                  type="date"
                  className="date-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <button
                  type="button"
                  className={`income-toggle ${isIncome ? "active" : ""}`}
                  onClick={() => setIsIncome(!isIncome)}
                >
                  {isIncome ? "Income" : "Expense"}
                </button>
              </div>
              <button
                type="submit"
                className="submit-btn"
                disabled={!text.trim() || isSubmitting}
              >
                {isSubmitting ? "Adding..." : "+ Add Entry"}
              </button>
            </div>
          </div>
        </form>
      </Card>

      {/* Month Selector & Summary */}
      <div className="month-row">
        <div className="pill-month-control">
          <button
            className="pill-month-btn"
            onClick={() => {
              const currentIndex = monthOptions.findIndex(
                (o) => o.value === selectedMonth
              );
              if (currentIndex < monthOptions.length - 1) {
                handleMonthChange(monthOptions[currentIndex + 1].value);
              }
            }}
            disabled={
              monthOptions.findIndex((o) => o.value === selectedMonth) >=
              monthOptions.length - 1
            }
          >
            &lt;
          </button>
          <select
            className="pill-select"
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            className="pill-month-btn"
            onClick={() => {
              const currentIndex = monthOptions.findIndex(
                (o) => o.value === selectedMonth
              );
              if (currentIndex > 0) {
                handleMonthChange(monthOptions[currentIndex - 1].value);
              }
            }}
            disabled={
              monthOptions.findIndex((o) => o.value === selectedMonth) <= 0
            }
          >
            &gt;
          </button>
        </div>
      </div>

      {/* Offline Queue */}
      {offlineQueue.length > 0 && (
        <Card title="Pending Sync">
          <div className="logs-list">
            {offlineQueue.map((entry) => (
              <div key={entry.id} className="log-entry offline">
                <div className="log-content">
                  <div className="log-text">{entry.text}</div>
                  <div className="log-meta">
                    <span>{entry.date}</span>
                    <span>Pending sync</span>
                  </div>
                </div>
                <div className="log-actions">
                  <button
                    className="action-btn delete"
                    onClick={() => handleDelete(entry.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Draft Logs */}
      {draftLogs.length > 0 && (
        <Card title="Draft Entries">
          <div className="logs-list">
            {draftLogs.map((log) => (
              <div
                key={log.id}
                className={`log-entry ${log.isIncome ? "income" : ""}`}
              >
                {editingId === log.id ? (
                  <div className="log-content">
                    <input
                      type="text"
                      className="edit-input"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button
                        className="action-btn"
                        onClick={() => handleEdit(log.id)}
                      >
                        Save
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => {
                          setEditingId(null);
                          setEditText("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="log-content">
                      <div className="log-text">{log.text}</div>
                      <div className="log-meta">
                        <span>{log.date}</span>
                        {log.source === "voice" && <span>Voice</span>}
                        {log.isIncome && (
                          <span style={{ color: "#92f0bf" }}>Income</span>
                        )}
                      </div>
                    </div>
                    <div className="log-actions">
                      <button
                        className="action-btn"
                        onClick={() => {
                          setEditingId(log.id);
                          setEditText(log.text);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDelete(log.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="summary-row">
            <span className="summary-text">
              {draftLogs.length} entries · ~$
              {estimatedTotal.toFixed(2)} estimated
            </span>
            <button
              className="process-btn"
              onClick={handleProcess}
              disabled={isProcessing || draftLogs.length === 0}
            >
              {isProcessing ? "Processing..." : "Process & Review"}
            </button>
          </div>
        </Card>
      )}

      {/* Committed Logs */}
      {committedLogs.length > 0 && (
        <Card title="Committed to Ledger">
          <div className="logs-list">
            {committedLogs.map((log) => (
              <div
                key={log.id}
                className={`log-entry ${log.isIncome ? "income" : ""}`}
              >
                <div className="log-content">
                  <div className="log-text">{log.text}</div>
                  <div className="log-meta">
                    <span>{log.date}</span>
                    <span style={{ color: "#92f0bf" }}>Committed</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {logs.length === 0 && offlineQueue.length === 0 && (
        <div className="empty-state">
          <p>No cash entries for this month yet.</p>
          <p style={{ marginTop: "8px", fontSize: "13px" }}>
            Use the voice button or type to add entries.
          </p>
        </div>
      )}

      {/* Process/Review Modal */}
      {showProcess && (
        <div className="process-modal">
          <div
            className="process-backdrop"
            onClick={() => !isProcessing && setShowProcess(false)}
          />
          <div className="process-panel">
            <div className="process-head">
              <span className="process-title">Review Transactions</span>
              <button
                className="close-btn"
                onClick={() => setShowProcess(false)}
                disabled={isProcessing}
              >
                ×
              </button>
            </div>

            {isProcessing ? (
              <div className="empty-state">Processing with AI...</div>
            ) : (
              <>
                {processedItems.map((group) => {
                  const originalLog = logs.find((l) => l.id === group.logId);
                  return (
                    <div key={group.logId} className="processed-group">
                      <div className="processed-source">
                        From: "{originalLog?.text}"
                      </div>
                      {group.items.map((item, index) => (
                        <div key={index} className="processed-item">
                          <div className="item-info">
                            <div className="item-desc">{item.description}</div>
                            <div className="item-amount">
                              ${item.amount.toFixed(2)}
                            </div>
                          </div>
                          <select
                            className="item-category"
                            value={item.category}
                            onChange={(e) =>
                              handleUpdateCategory(
                                group.logId,
                                index,
                                e.target.value
                              )
                            }
                          >
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  );
                })}

                <div className="process-total">
                  <span className="total-label">
                    Total (
                    {processedItems.reduce((s, g) => s + g.items.length, 0)}{" "}
                    transactions)
                  </span>
                  <span className="total-value">
                    $
                    {processedItems
                      .reduce(
                        (sum, g) =>
                          sum + g.items.reduce((s, i) => s + i.amount, 0),
                        0
                      )
                      .toFixed(2)}
                  </span>
                </div>

                <div className="process-actions">
                  <button
                    className="ghost-btn"
                    onClick={() => setShowProcess(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-btn"
                    onClick={handleCommit}
                    disabled={isCommitting}
                  >
                    {isCommitting ? "Committing..." : "Commit to Ledger"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
