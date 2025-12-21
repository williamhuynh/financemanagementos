"use client";

import { useMemo, useState } from "react";
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
  const [sourceAccount, setSourceAccount] = useState<string>("");
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
    mappedRows.some((row) => row.amount);

  const previewRows = mappedRows.slice(0, 8);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus("Parsing CSV...");
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const fileHeaders = result.meta.fields?.filter(Boolean) ?? [];
        setHeaders(fileHeaders);
        setRows(result.data as ParsedRow[]);
        applyPreset("auto", fileHeaders);
        setStatus(`Parsed ${result.data.length} rows.`);
      },
      error: () => {
        setStatus("Failed to parse CSV.");
      }
    });
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
          sourceAccount
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

  return (
    <div className="import-flow">
      <div className="import-panel">
        <div className="import-title">1. Upload CSV</div>
        <label className="upload-area upload-input">
          <input type="file" accept=".csv" onChange={handleFileChange} />
          <span className="upload-icon">+</span>
          <span className="row-title">Drop or browse CSV</span>
          <span className="row-sub">{fileName || "No file selected"}</span>
        </label>
        <div className="field">
          <label className="field-label" htmlFor="sourceAccount">
            Source account (optional)
          </label>
          <input
            id="sourceAccount"
            className="field-input"
            type="text"
            placeholder="Westpac Altitude Credit Card"
            value={sourceAccount}
            onChange={(event) => setSourceAccount(event.target.value)}
          />
          <div className="row-sub">
            Used when the CSV does not include an account column.
          </div>
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
                  <div className="row-title">{header}</div>
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
    </div>
  );
}
