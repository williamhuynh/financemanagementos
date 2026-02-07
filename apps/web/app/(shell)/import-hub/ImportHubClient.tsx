"use client";

import { useState } from "react";
import ImportClient from "./ImportClient";

type ImportMode = "csv" | "pdf";

const modes: { value: ImportMode; label: string }[] = [
  { value: "csv", label: "CSV" },
  { value: "pdf", label: "PDF" },
];

export default function ImportHubClient() {
  const [mode, setMode] = useState<ImportMode>("csv");

  return (
    <>
      <div className="mode-toggle">
        {modes.map((m) => (
          <button
            key={m.value}
            className={`pill${mode === m.value ? " pill-active" : ""}`}
            type="button"
            onClick={() => setMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <ImportClient mode={mode} />
    </>
  );
}
