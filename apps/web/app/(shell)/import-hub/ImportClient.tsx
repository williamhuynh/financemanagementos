"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

type ParsedRow = Record<string, string>;

type MappingKey =
  | "ignore"
  | "date"
  | "description"
  | "amount"
  | "debit"
  | "credit"
  | "account"
  | "category"
  | "currency";

const mappingOptions: { value: MappingKey; label: string }[] = [
  { value: "ignore", label: "Ignore" },
  { value: "date", label: "Date" },
  { value: "description", label: "Description" },
  { value: "amount", label: "Amount" },
  { value: "debit", label: "Debit Amount" },
  { value: "credit", label: "Credit Amount" },
  { value: "account", label: "Account" },
  { value: "category", label: "Category" },
  { value: "currency", label: "Currency" }
];

const requiredFields: MappingKey[] = ["date", "description"];

type Preset = {
  id: string;
  label: string;
  headerMap: Record<string, MappingKey>;
};

type ImportHistoryItem = {
  id: string;
  source_name: string;
  source_owner?: string;
  file_name?: string;
  row_count: number;
  status: string;
  uploaded_at: string;
};

const presets: Preset[] = [
  {
    id: "auto",
    label: "Auto (heuristics)",
    headerMap: {}
  },
  {
    id: "westpac",
    label: "Westpac CSV",
    headerMap: {
      "Bank Account": "account",
      Date: "date",
      Narrative: "description",
      "Debit Amount": "debit",
      "Credit Amount": "credit",
      Balance: "ignore",
      Categories: "ignore",
      Serial: "ignore"
    }
  }
];

const ownerOptions = ["William", "Peggy", "Joint"];
const headerOptions = [
  { value: "yes", label: "Yes, first row is headers" },
  { value: "no", label: "No, data starts immediately" }
];
const headerKeywords = [
  "date",
  "description",
  "amount",
  "debit",
  "credit",
  "account",
  "category",
  "currency",
  "narrative",
  "memo",
  "details",
  "balance",
  "merchant",
  "payee",
  "transaction"
];

function inferMapping(header: string): MappingKey {
  const normalized = header.toLowerCase();

  if (normalized.includes("date")) return "date";
  if (
    normalized.includes("description") ||
    normalized.includes("payee") ||
    normalized.includes("merchant") ||
    normalized.includes("narrative")
  ) {
    return "description";
  }
  if (normalized.includes("debit")) {
    return "debit";
  }
  if (normalized.includes("credit")) {
    return "credit";
  }
  if (normalized.includes("amount")) {
    return "amount";
  }
  if (normalized.includes("account")) return "account";
  if (normalized.includes("category")) return "category";
  if (normalized.includes("currency")) return "currency";
  return "ignore";
}

function buildColumnHeaders(columnCount: number) {
  return Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
}

function looksLikeHeaderLabel(value: string) {
  const normalized = value.toLowerCase();
  return headerKeywords.some((keyword) => normalized.includes(keyword));
}

function isDateLike(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) return true;
  if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(trimmed)) return true;
  return false;
}

function isAmountLike(value: string) {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return false;
  return /^-?\d+(\.\d{1,4})?$/.test(trimmed);
}

function isTextLike(value: string) {
  return /[a-zA-Z]/.test(value.trim());
}

function guessHasHeader(firstRow: string[], secondRow: string[]) {
  if (firstRow.length === 0) return true;
  const headerHits = firstRow.filter(looksLikeHeaderLabel).length;
  if (headerHits > 0) return true;

  const dataLikeFirst = firstRow.filter(
    (value) => isDateLike(value) || isAmountLike(value)
  ).length;
  const dataLikeSecond = secondRow.filter(
    (value) => isDateLike(value) || isAmountLike(value)
  ).length;
  const textLikeFirst = firstRow.filter(isTextLike).length;

  const firstCount = Math.max(firstRow.length, 1);
  const secondCount = Math.max(secondRow.length, 1);

  if (dataLikeFirst / firstCount >= 0.6 && dataLikeSecond / secondCount >= 0.4) {
    return false;
  }

  if (textLikeFirst / firstCount >= 0.6 && dataLikeSecond / secondCount >= 0.3) {
    return true;
  }

  return true;
}

function normalizeAmount(value: string) {
  if (!value) return "";
  return value.replace(/[^0-9.-]/g, "").trim();
}

function resolveAmount(
  row: ParsedRow,
  mapping: Record<string, MappingKey>
): string {
  let amountValue = "";
  let debitValue = "";
  let creditValue = "";

  Object.entries(mapping).forEach(([header, key]) => {
    const rawValue = row[header] ?? "";
    if (key === "amount") {
      amountValue = normalizeAmount(String(rawValue));
    } else if (key === "debit") {
      debitValue = normalizeAmount(String(rawValue));
    } else if (key === "credit") {
      creditValue = normalizeAmount(String(rawValue));
    }
  });

  if (amountValue) {
    return amountValue;
  }

  if (debitValue) {
    return debitValue.startsWith("-") ? debitValue : `-${debitValue}`;
  }

  if (creditValue) {
    return creditValue.startsWith("-") ? creditValue : creditValue;
  }

  return "";
}

export default function ImportClient() {
  const [fileName, setFileName] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [headerMode, setHeaderMode] = useState<"auto" | "manual">("auto");
  const [sourceAccount, setSourceAccount] = useState<string>("");
  const [sourceOwner, setSourceOwner] = useState<string>("Joint");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, MappingKey>>({});
  const [presetId, setPresetId] = useState("auto");
  const [status, setStatus] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressState, setProgressState] = useState<"idle" | "running" | "success" | "error">(
    "idle"
  );
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [headerSamples, setHeaderSamples] = useState<Record<string, string>>(
    {}
  );

  const mappedRows = useMemo(() => {
    if (rows.length === 0) return [];

    return rows.map((row) => {
      const mapped: Record<string, string> = {};
      Object.entries(mapping).forEach(([header, key]) => {
        if (key === "ignore") return;
        if (key === "debit" || key === "credit") return;
        const rawValue = row[header] ?? "";
        mapped[key] = key === "amount" ? normalizeAmount(String(rawValue)) : String(rawValue);
      });
      mapped.amount = resolveAmount(row, mapping);
      return mapped;
    });
  }, [rows, mapping]);

  const canSubmit =
    requiredFields.every((field) => mappedRows.some((row) => row[field])) &&
    mappedRows.some((row) => row.amount) &&
    Boolean(sourceOwner);

  const previewRows = mappedRows.slice(0, 8);

  const loadImportHistory = async () => {
    setHistoryLoading(true);
    setHistoryStatus("");
    try {
      const response = await fetch("/api/imports");
      const payload = await response.json();
      if (!response.ok) {
        setHistoryStatus(payload?.detail ?? "Failed to load import history.");
        setImportHistory([]);
      } else {
        setImportHistory(payload?.imports ?? []);
      }
    } catch (error) {
      setHistoryStatus("Failed to load import history.");
      setImportHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadImportHistory();
  }, []);

  useEffect(() => {
    if (!selectedFile) return;
    parseFile(selectedFile, hasHeader);
  }, [hasHeader, selectedFile]);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const response = await fetch("/api/accounts");
        const payload = await response.json();
        if (response.ok && Array.isArray(payload?.accounts)) {
          setAccountOptions(payload.accounts);
        }
      } catch (error) {
        setAccountOptions([]);
      }
    };
    loadAccounts();
  }, []);

  const parseFile = async (file: File, includeHeader: boolean) => {
    setFileName(file.name);
    setStatus("Parsing CSV...");
    if (headerMode === "auto") {
      const detected = await new Promise<boolean>((resolve) => {
        Papa.parse<string[]>(file, {
          header: false,
          skipEmptyLines: true,
          preview: 2,
          complete: (result) => {
            const rows = result.data as string[][];
            const firstRow = rows[0] ?? [];
            const secondRow = rows[1] ?? [];
            resolve(guessHasHeader(firstRow, secondRow));
          },
          error: () => resolve(true)
        });
      });

      if (detected !== includeHeader) {
        setHasHeader(detected);
        return;
      }
    }

    Papa.parse<ParsedRow | string[]>(file, {
      header: includeHeader,
      skipEmptyLines: true,
      complete: (result) => {
        if (includeHeader) {
          const fileHeaders = result.meta.fields?.filter(Boolean) ?? [];
          setHeaders(fileHeaders);
          setRows(result.data as ParsedRow[]);
          setHeaderSamples({});
          applyPreset("auto", fileHeaders);
          setStatus(`Parsed ${result.data.length} rows.`);
          return;
        }

        const dataRows = (result.data as string[][]).filter(
          (row) => Array.isArray(row) && row.some((cell) => String(cell).trim())
        );
        const maxColumns = dataRows.reduce(
          (max, row) => Math.max(max, row.length),
          0
        );
        const fileHeaders = buildColumnHeaders(maxColumns);
        const sampleRow = dataRows[0] ?? [];
        const normalizedRows = dataRows.map((row) => {
          const mapped: ParsedRow = {};
          fileHeaders.forEach((header, index) => {
            mapped[header] = row[index] ?? "";
          });
          return mapped;
        });
        const samples: Record<string, string> = {};
        fileHeaders.forEach((header, index) => {
          const value = sampleRow[index];
          if (value !== undefined && String(value).trim()) {
            samples[header] = String(value).trim();
          }
        });
        setHeaders(fileHeaders);
        setRows(normalizedRows);
        setHeaderSamples(samples);
        applyPreset("auto", fileHeaders);
        setStatus(`Parsed ${normalizedRows.length} rows.`);
      },
      error: () => {
        setStatus("Failed to parse CSV.");
      }
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setHeaderMode("auto");
    parseFile(file, hasHeader);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setHeaderMode("auto");
    parseFile(file, hasHeader);
  };

  const applyPreset = (nextPresetId: string, activeHeaders = headers) => {
    const selectedPreset = presets.find((preset) => preset.id === nextPresetId);
    const presetMap = selectedPreset?.headerMap ?? {};
    const inferredMapping: Record<string, MappingKey> = {};
    activeHeaders.forEach((header) => {
      inferredMapping[header] = presetMap[header] ?? inferMapping(header);
    });
    setPresetId(nextPresetId);
    setMapping(inferredMapping);
  };

  const handleMappingChange = (header: string, value: MappingKey) => {
    setMapping((prev) => ({ ...prev, [header]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setProgressState("running");
    setProgress(10);
    setStatus("Saving import...");
    const progressTimer = window.setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.random() * 12 + 6, 92));
    }, 400);
    try {
      const response = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceName: "CSV",
          fileName,
          rows: mappedRows,
          sourceAccount,
          sourceOwner
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setProgressState("error");
        setProgress(100);
        setStatus(payload?.detail ?? "Import failed.");
      } else {
        setProgressState("success");
        setProgress(100);
        setStatus(`Import saved. Batch ${payload.importId}.`);
        await loadImportHistory();
      }
    } catch (error) {
      setProgressState("error");
      setProgress(100);
      setStatus("Import failed.");
    } finally {
      window.clearInterval(progressTimer);
      setIsSubmitting(false);
    }
  };

  const handleDeleteImport = async (importId: string) => {
    if (deletingImportId) return;
    const confirmed = window.confirm(
      "Delete this import and all associated transactions?"
    );
    if (!confirmed) return;
    setDeletingImportId(importId);
    setHistoryStatus("");
    try {
      const response = await fetch(`/api/imports/${importId}`, {
        method: "DELETE"
      });
      const payload = await response.json();
      if (!response.ok) {
        setHistoryStatus(payload?.detail ?? "Failed to delete import.");
      } else {
        setHistoryStatus(`Deleted import ${importId}.`);
        await loadImportHistory();
      }
    } catch (error) {
      setHistoryStatus("Failed to delete import.");
    } finally {
      setDeletingImportId(null);
    }
  };

  const formatDate = (value: string) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  return (
    <div className="import-flow">
      <div className="import-panel">
        <div className="import-title">1. Upload CSV</div>
        <label
          className={`upload-area upload-input${isDragActive ? " drag-active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
        >
          <input type="file" accept=".csv" onChange={handleFileChange} />
          <span className="upload-icon">+</span>
          <span className="row-title">Drop or browse CSV</span>
          <span className="row-sub">{fileName || "No file selected"}</span>
        </label>
        <div className="field">
          <label className="field-label" htmlFor="sourceAccount">
            Source account
          </label>
          <input
            id="sourceAccount"
            className="field-input"
            type="text"
            placeholder="Westpac Altitude Credit Card"
            value={sourceAccount}
            onChange={(event) => setSourceAccount(event.target.value)}
            list="source-account-options"
          />
          <datalist id="source-account-options">
            {accountOptions.map((account) => (
              <option key={account} value={account} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="sourceOwner">
            Account owner
          </label>
          <select
            id="sourceOwner"
            className="field-input"
            value={sourceOwner}
            onChange={(event) => setSourceOwner(event.target.value)}
          >
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>
        <div className="row-sub">{status}</div>
      </div>

      <div className="import-panel">
        <div className="import-title">2. Map Columns</div>
        {headers.length === 0 ? (
          <div className="row-sub">Upload a CSV to map columns.</div>
        ) : (
          <>
            <div className="preset-row">
              <span className="row-title">CSV headers</span>
              <select
                className="mapping-select"
                value={hasHeader ? "yes" : "no"}
                onChange={(event) => {
                  setHeaderMode("manual");
                  setHasHeader(event.target.value === "yes");
                }}
              >
                {headerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {!hasHeader ? (
              <div className="row-sub">
                No headers detected. Columns are labeled Column 1, Column 2, etc.
                with a sample value to help mapping.
              </div>
            ) : null}
            <div className="preset-row">
              <span className="row-title">Preset</span>
              <select
                className="mapping-select"
                value={presetId}
                onChange={(event) => applyPreset(event.target.value)}
              >
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mapping-grid">
              {headers.map((header) => (
                <div key={header} className="mapping-row">
                  <div className="row-title">
                    {header}
                    {headerSamples[header] ? (
                      <span className="row-sub">
                        e.g. {headerSamples[header]}
                      </span>
                    ) : null}
                  </div>
                  <select
                    className="mapping-select"
                    value={mapping[header] ?? "ignore"}
                    onChange={(event) => handleMappingChange(header, event.target.value as MappingKey)}
                  >
                    {mappingOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="import-panel">
        <div className="import-title">3. Preview Rows</div>
        {previewRows.length === 0 ? (
          <div className="row-sub">Mapped rows will appear here.</div>
        ) : (
          <div className="preview-table">
            <div className="preview-header">
              <span>Date</span>
              <span>Description</span>
              <span>Amount</span>
              <span>Account</span>
              <span>Category</span>
            </div>
            {previewRows.map((row, index) => (
              <div key={`${row.description}-${index}`} className="preview-row">
                <span>{row.date}</span>
                <span>{row.description}</span>
                <span>{row.amount}</span>
                <span>{row.account ?? sourceAccount ?? "-"}</span>
                <span>{row.category ?? "Uncategorised"}</span>
              </div>
            ))}
          </div>
        )}
        <div className="progress-wrap">
          <div className="progress-bar">
            <div className={`progress-fill ${progressState}`} style={{ width: `${progress}%` }} />
          </div>
          <div className={`progress-label ${progressState}`}>
            {progressState === "success"
              ? "Import complete"
              : progressState === "error"
              ? "Import failed"
              : progressState === "running"
              ? "Importing..."
              : "Ready to import"}
          </div>
        </div>
        <button
          className="primary-btn"
          type="button"
          disabled={!canSubmit || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Saving..." : "Save Import"}
        </button>
      </div>

      <div className="import-panel import-history">
        <div className="import-title">Import History</div>
        {historyLoading ? (
          <div className="row-sub">Loading imports...</div>
        ) : importHistory.length === 0 ? (
          <div className="row-sub">No imports yet.</div>
        ) : (
          <div className="history-table">
            <div className="history-header">
              <span>File</span>
              <span>Source</span>
              <span>Owner</span>
              <span>Rows</span>
              <span>Status</span>
              <span>Uploaded</span>
              <span>Action</span>
            </div>
            {importHistory.map((item) => (
              <div key={item.id} className="history-row">
                <span>{item.file_name || "Untitled CSV"}</span>
                <span>{item.source_name}</span>
                <span>{item.source_owner || "-"}</span>
                <span>{item.row_count}</span>
                <span>{item.status}</span>
                <span>{formatDate(item.uploaded_at)}</span>
                <span>
                  <button
                    className="ghost-btn danger-btn"
                    type="button"
                    disabled={deletingImportId === item.id}
                    onClick={() => handleDeleteImport(item.id)}
                  >
                    {deletingImportId === item.id ? "Deleting..." : "Delete"}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        {historyStatus ? <div className="row-sub">{historyStatus}</div> : null}
      </div>
    </div>
  );
}
