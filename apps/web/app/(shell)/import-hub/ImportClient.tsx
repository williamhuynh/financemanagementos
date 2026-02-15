"use client";

import { useEffect, useMemo, useState } from "react";
import { DetailPanel } from "@tandemly/ui";
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
  isWorkspacePreset?: boolean;
  invertAmount?: boolean;
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

type StoredMapping = {
  headers: string[];
  mapping: Record<string, MappingKey>;
  invertAmount: boolean;
  timestamp: number;
};

const MAPPING_STORAGE_KEY = "tandemly_recent_mappings";
const MAX_STORED_MAPPINGS = 10;

function loadRecentMappings(): StoredMapping[] {
  try {
    const raw = localStorage.getItem(MAPPING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMapping(entry: StoredMapping) {
  try {
    const existing = loadRecentMappings();
    existing.unshift(entry);
    const trimmed = existing.slice(0, MAX_STORED_MAPPINGS);
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable
  }
}

const builtInPresets: Preset[] = [
  {
    id: "auto",
    label: "Auto (heuristics)",
    headerMap: {}
  },
  {
    id: "llm",
    label: "AI (LLM)",
    headerMap: {}
  }
];

// ownerOptions is now passed in as a prop from workspace members
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

function applyAmountSign(value: string, invert: boolean) {
  if (!invert) return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return "0";
  return (-numeric).toString();
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

type ImportClientProps = {
  ownerOptions: string[];
};

export default function ImportClient({ ownerOptions }: ImportClientProps) {
  const [fileName, setFileName] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"csv" | "pdf" | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [headerMode, setHeaderMode] = useState<"auto" | "manual">("auto");
  const [invertAmount, setInvertAmount] = useState(false);
  const [sourceAccount, setSourceAccount] = useState<string>("");
  const [sourceOwner, setSourceOwner] = useState<string>("Joint");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, MappingKey>>({});
  const [presetId, setPresetId] = useState("auto");
  const [status, setStatus] = useState<string>("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressState, setProgressState] = useState<"idle" | "running" | "success" | "error">(
    "idle"
  );
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null);
  const [selectedImport, setSelectedImport] = useState<ImportHistoryItem | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [accountOptions, setAccountOptions] = useState<string[]>([]);
  const [headerSamples, setHeaderSamples] = useState<Record<string, string>>(
    {}
  );
  const [isSuggestingMapping, setIsSuggestingMapping] = useState(false);
  const [workspacePresets, setWorkspacePresets] = useState<Preset[]>([]);
  const [savePresetName, setSavePresetName] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetStatus, setPresetStatus] = useState("");

  const allPresets = useMemo(
    () => [...builtInPresets, ...workspacePresets],
    [workspacePresets]
  );

  // Unified mapped rows: applies column mapping to raw rows for both CSV and PDF
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
      mapped.amount = applyAmountSign(resolveAmount(row, mapping), invertAmount);
      return mapped;
    });
  }, [rows, mapping, invertAmount]);

  const canSubmit =
    mappedRows.length > 0 &&
    requiredFields.every((field) => mappedRows.some((row) => row[field])) &&
    mappedRows.some((row) => row.amount) &&
    Boolean(sourceOwner);

  const previewRows = mappedRows.slice(0, 8);

  const loadImportHistory = async () => {
    setHistoryLoading(true);
    setHistoryStatus("");
    try {
      const response = await fetch("/api/imports", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setHistoryStatus(payload?.detail ?? "Failed to load import history.");
        setImportHistory([]);
        setHistoryLoaded(false);
      } else {
        setImportHistory(payload?.imports ?? []);
      }
    } catch (error) {
      setHistoryStatus("Failed to load import history.");
      setImportHistory([]);
      setHistoryLoaded(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (historyOpen && !historyLoaded) {
      setHistoryLoaded(true);
      loadImportHistory();
    }
  }, [historyOpen, historyLoaded]);

  // Re-parse CSV when hasHeader toggle changes
  useEffect(() => {
    if (!selectedFile || fileType !== "csv") return;
    parseFile(selectedFile, hasHeader);
  }, [hasHeader, selectedFile, fileType]);

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

  // --- Load workspace presets ---
  const loadWorkspacePresets = async () => {
    try {
      const response = await fetch("/api/import-presets", { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && Array.isArray(payload?.presets)) {
        setWorkspacePresets(
          payload.presets.map((p: { id: string; name: string; headerMap: Record<string, MappingKey>; invertAmount: boolean }) => ({
            id: `ws_${p.id}`,
            label: p.name,
            headerMap: p.headerMap,
            invertAmount: p.invertAmount,
            isWorkspacePreset: true,
          }))
        );
      }
    } catch {
      // Workspace presets not available — not critical
    }
  };

  useEffect(() => {
    loadWorkspacePresets();
  }, []);

  const handleSavePreset = async () => {
    const name = savePresetName.trim();
    if (!name || Object.keys(mapping).length === 0) return;

    setIsSavingPreset(true);
    setPresetStatus("");
    try {
      const response = await fetch("/api/import-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          headerMap: mapping,
          invertAmount,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setPresetStatus(payload?.error ?? "Failed to save preset.");
      } else {
        setPresetStatus(`Saved preset "${name}".`);
        setSavePresetName("");
        setShowSavePreset(false);
        await loadWorkspacePresets();
      }
    } catch {
      setPresetStatus("Failed to save preset.");
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleDeletePreset = async (presetDocId: string) => {
    if (!window.confirm("Delete this saved preset?")) return;
    setPresetStatus("");
    try {
      const response = await fetch(`/api/import-presets/${presetDocId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setPresetStatus("Preset deleted.");
        await loadWorkspacePresets();
        // Reset to auto if the deleted preset was selected
        if (presetId === `ws_${presetDocId}`) {
          setPresetId("auto");
        }
      } else {
        const payload = await response.json();
        setPresetStatus(payload?.error ?? "Failed to delete preset.");
      }
    } catch {
      setPresetStatus("Failed to delete preset.");
    }
  };

  // --- LLM-assisted column mapping ---
  const requestLlmMapping = async (
    activeHeaders: string[],
    activeRows: ParsedRow[]
  ) => {
    setIsSuggestingMapping(true);
    setStatus("AI is analysing columns...");

    try {
      // Build sample rows as string[][] for the API
      const sampleRows = activeRows.slice(0, 5).map((row) =>
        activeHeaders.map((header) => row[header] ?? "")
      );

      const recentMappings = loadRecentMappings().map((stored) => ({
        headers: stored.headers,
        mapping: stored.mapping,
        invertAmount: stored.invertAmount,
      }));

      const response = await fetch("/api/suggest-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: activeHeaders,
          sampleRows,
          recentMappings,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setStatus(payload?.detail ?? "AI mapping failed. Using heuristics.");
        return null;
      }

      return payload as {
        mapping: Record<string, MappingKey>;
        invertAmount: boolean;
      };
    } catch {
      setStatus("AI mapping failed. Using heuristics.");
      return null;
    } finally {
      setIsSuggestingMapping(false);
    }
  };

  // --- PDF extraction (feeds into shared headers/rows/mapping pipeline) ---
  const handlePdfExtract = async (file: File) => {
    setFileName(file.name);
    setIsParsing(true);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setHeaderSamples({});
    setWarnings([]);
    setStatus("Extracting transactions from PDF...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (sourceAccount) {
        formData.append("sourceAccount", sourceAccount);
      }

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        setStatus(payload?.detail ?? payload?.error ?? "PDF extraction failed.");
        return;
      }

      const extracted: ParsedRow[] = (payload.rows ?? []).map(
        (row: Record<string, string>) => ({
          date: row.date ?? "",
          description: row.description ?? "",
          amount: row.amount ?? "",
          account: row.account ?? "",
          category: row.category ?? "",
          currency: row.currency ?? "",
        })
      );

      // Derive headers from fields that have data in at least one row
      const allKeys: MappingKey[] = ["date", "description", "amount", "account", "category", "currency"];
      const activeHeaders = allKeys.filter(key =>
        extracted.some(row => row[key]?.trim())
      );

      // Sample values from first row for the mapping grid
      const samples: Record<string, string> = {};
      activeHeaders.forEach(key => {
        const value = extracted[0]?.[key];
        if (value?.trim()) samples[key] = value.trim();
      });

      setHeaders(activeHeaders);
      setRows(extracted);
      setHeaderSamples(samples);

      // Identity mapping — LLM already assigned fields, user confirms or overrides
      const identityMapping: Record<string, MappingKey> = {};
      activeHeaders.forEach(h => { identityMapping[h] = h as MappingKey; });
      setMapping(identityMapping);
      setPresetId("auto");

      setWarnings(payload.warnings ?? []);
      setStatus(
        extracted.length > 0
          ? `Extracted ${extracted.length} transactions. Confirm column mapping below.`
          : "No transactions found in PDF."
      );
    } catch (error) {
      setStatus("PDF extraction failed.");
    } finally {
      setIsParsing(false);
    }
  };

  // --- CSV parsing ---
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
          const parsedRows = result.data as ParsedRow[];
          setRows(parsedRows);
          setHeaderSamples({});
          applyPreset("auto", fileHeaders, parsedRows);
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
        applyPreset("auto", fileHeaders, normalizedRows);
        setStatus(`Parsed ${normalizedRows.length} rows.`);
      },
      error: () => {
        setStatus("Failed to parse CSV.");
      }
    });
  };

  const resetFileState = () => {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setHeaderSamples({});
    setWarnings([]);
    setStatus("");
    setProgress(0);
    setProgressState("idle");
    setInvertAmount(false);
  };

  const detectAndProcess = (file: File) => {
    const ext = file.name.toLowerCase().split(".").pop();
    const detectedType = ext === "pdf" ? "pdf" as const : "csv" as const;
    setFileType(detectedType);
    setSelectedFile(file);
    resetFileState();

    if (detectedType === "pdf") {
      handlePdfExtract(file);
    } else {
      setHeaderMode("auto");
      parseFile(file, hasHeader);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    detectAndProcess(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    detectAndProcess(file);
  };

  const applyPreset = async (
    nextPresetId: string,
    activeHeaders = headers,
    activeRows = rows
  ) => {
    setPresetId(nextPresetId);

    if (nextPresetId === "llm") {
      const result = await requestLlmMapping(activeHeaders, activeRows);
      if (result) {
        setMapping(result.mapping);
        setInvertAmount(result.invertAmount);
        setStatus(
          result.invertAmount
            ? "AI mapped columns and detected reversed amount signs."
            : "AI mapped columns."
        );
      } else {
        // Fallback to heuristics
        const inferredMapping: Record<string, MappingKey> = {};
        activeHeaders.forEach((header) => {
          inferredMapping[header] = inferMapping(header);
        });
        setMapping(inferredMapping);
      }
      return;
    }

    const selectedPreset = allPresets.find((preset) => preset.id === nextPresetId);
    const presetMap = selectedPreset?.headerMap ?? {};
    const inferredMapping: Record<string, MappingKey> = {};
    activeHeaders.forEach((header) => {
      inferredMapping[header] = presetMap[header] ?? inferMapping(header);
    });
    setMapping(inferredMapping);
    if (selectedPreset?.invertAmount !== undefined) {
      setInvertAmount(selectedPreset.invertAmount);
    }
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
          sourceName: fileType === "pdf" ? "PDF" : "CSV",
          fileName,
          rows: mappedRows,
          sourceAccount,
          sourceOwner
        }),
        cache: "no-store"
      });
      const payload = await response.json();
      window.clearInterval(progressTimer);
      if (!response.ok) {
        setProgressState("error");
        setProgress(100);
        setStatus(payload?.detail ?? "Import failed.");
      } else {
        setProgressState("success");
        setProgress(100);
        setStatus(`Import saved. Batch ${payload.importId}.`);

        // Save confirmed mapping to localStorage for future LLM few-shot examples
        if (fileType === "csv" && headers.length > 0) {
          saveMapping({
            headers,
            mapping,
            invertAmount,
            timestamp: Date.now(),
          });
        }

        if (historyOpen) {
          await loadImportHistory();
        } else {
          setHistoryLoaded(false);
        }
      }
    } catch (error) {
      window.clearInterval(progressTimer);
      setProgressState("error");
      setProgress(100);
      setStatus("Import failed.");
    } finally {
      window.clearInterval(progressTimer);
      setIsSubmitting(false);
    }
  };

  const handleDeleteImport = async (importId: string): Promise<boolean> => {
    if (deletingImportId) return false;
    const confirmed = window.confirm(
      "Delete this import and all associated transactions?"
    );
    if (!confirmed) return false;
    setDeletingImportId(importId);
    setHistoryStatus("");
    try {
      const response = await fetch(`/api/imports/${importId}`, {
        method: "DELETE"
      });
      const payload = await response.json();
      if (!response.ok) {
        setHistoryStatus(payload?.detail ?? "Failed to delete import.");
        return false;
      } else {
        setHistoryStatus(`Deleted import ${importId}.`);
        await loadImportHistory();
        return true;
      }
    } catch (error) {
      setHistoryStatus("Failed to delete import.");
      return false;
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
        <div className="import-title">1. Upload File</div>
        <label
          className={`upload-area upload-input${isDragActive ? " drag-active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
        >
          <input type="file" accept=".csv,.pdf" onChange={handleFileChange} />
          <span className="upload-icon">+</span>
          <span className="row-title">Drop or browse CSV / PDF</span>
          <span className="row-sub">{fileName || "No file selected"}</span>
        </label>
        {isParsing ? (
          <div className="row-sub">
            {fileType === "pdf"
              ? "Extracting transactions... This may take a moment."
              : "Parsing file..."}
          </div>
        ) : null}
        <div className="field">
          <label className="field-label" htmlFor="sourceAccount">
            Source account
          </label>
          <input
            id="sourceAccount"
            className="field-input"
            type="text"
            placeholder="e.g. Savings Account"
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
        {warnings.length > 0 ? (
          <div className="row-sub">
            {warnings.map((warning, index) => (
              <div key={index}>{warning}</div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="import-panel">
        <div className="import-title">2. Map Columns</div>
        {headers.length === 0 ? (
          <div className="row-sub">Upload a file to map columns.</div>
        ) : (
          <>
            {fileType === "csv" ? (
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
                    disabled={isSuggestingMapping}
                    onChange={(event) => applyPreset(event.target.value)}
                  >
                    {builtInPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                    {workspacePresets.length > 0 ? (
                      <optgroup label="Saved presets">
                        {workspacePresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                  {isSuggestingMapping ? (
                    <span className="row-sub">Analysing...</span>
                  ) : null}
                  {presetId.startsWith("ws_") ? (
                    <button
                      className="ghost-btn danger-btn"
                      type="button"
                      onClick={() => handleDeletePreset(presetId.slice(3))}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
                {Object.keys(mapping).length > 0 ? (
                  <div className="preset-row">
                    {showSavePreset ? (
                      <>
                        <input
                          className="field-input"
                          type="text"
                          placeholder="Preset name, e.g. Westpac CSV"
                          value={savePresetName}
                          onChange={(e) => setSavePresetName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSavePreset();
                          }}
                        />
                        <button
                          className="ghost-btn"
                          type="button"
                          disabled={isSavingPreset || !savePresetName.trim()}
                          onClick={handleSavePreset}
                        >
                          {isSavingPreset ? "Saving..." : "Save"}
                        </button>
                        <button
                          className="ghost-btn"
                          type="button"
                          onClick={() => {
                            setShowSavePreset(false);
                            setSavePresetName("");
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => setShowSavePreset(true)}
                      >
                        Save as preset
                      </button>
                    )}
                  </div>
                ) : null}
                {presetStatus ? (
                  <div className="row-sub">{presetStatus}</div>
                ) : null}
              </>
            ) : null}
            <div className="preset-row">
              <span className="row-title">Amount sign</span>
              <button
                className="pill"
                type="button"
                aria-pressed={invertAmount}
                onClick={() => setInvertAmount((prev) => !prev)}
              >
                {invertAmount ? "Reverse: On" : "Reverse: Off"}
              </button>
            </div>
            <div className="row-sub">
              {fileType === "pdf"
                ? "Toggle if purchases show as positive numbers in your statement."
                : "Toggle if your statement exports debits as positive numbers (e.g. Amex)."}
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
        <div className="import-title">3. Preview &amp; Import</div>
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

      <details
        className="import-history-accordion"
        open={historyOpen}
        onToggle={(e) => setHistoryOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="import-history-summary">
          <span>Import History</span>
          <span className="import-history-chevron">{historyOpen ? "−" : "+"}</span>
        </summary>
        <div className="import-history-body">
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
                <div
                  key={item.id}
                  className="history-row history-row-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedImport(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedImport(item);
                    }
                  }}
                >
                  <span>{item.file_name || "Untitled"}</span>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteImport(item.id);
                      }}
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
      </details>

      <DetailPanel
        open={selectedImport !== null}
        onClose={() => setSelectedImport(null)}
        title="Import Details"
      >
        {selectedImport ? (
          <>
            <div className="right-drawer-detail">
              <span className="right-drawer-label">File</span>
              <span className="right-drawer-value">
                {selectedImport.file_name || "Untitled"}
              </span>
            </div>
            <div className="right-drawer-detail">
              <span className="right-drawer-label">Source</span>
              <span className="right-drawer-value">{selectedImport.source_name}</span>
            </div>
            <div className="right-drawer-detail">
              <span className="right-drawer-label">Owner</span>
              <span className="right-drawer-value">{selectedImport.source_owner || "-"}</span>
            </div>
            <div className="right-drawer-detail">
              <span className="right-drawer-label">Rows</span>
              <span className="right-drawer-value">{selectedImport.row_count}</span>
            </div>
            <div className="right-drawer-detail">
              <span className="right-drawer-label">Status</span>
              <span className="right-drawer-value">{selectedImport.status}</span>
            </div>
            <div className="right-drawer-detail">
              <span className="right-drawer-label">Uploaded</span>
              <span className="right-drawer-value">{formatDate(selectedImport.uploaded_at)}</span>
            </div>
            <div className="right-drawer-actions">
              <button
                className="ghost-btn danger-btn"
                type="button"
                disabled={deletingImportId === selectedImport.id}
                onClick={async () => {
                  const deleted = await handleDeleteImport(selectedImport.id);
                  if (deleted) {
                    setSelectedImport(null);
                  }
                }}
              >
                {deletingImportId === selectedImport.id
                  ? "Deleting..."
                  : "Delete Import"}
              </button>
            </div>
          </>
        ) : null}
      </DetailPanel>
    </div>
  );
}
