"use client";

import { useState } from "react";
import type {
  TransferPairReview,
  TransferSuggestion,
  TransferTransaction
} from "../../../lib/data";

type TransferMatchClientProps = {
  suggestions: TransferSuggestion[];
  unmatched: TransferTransaction[];
  paired: TransferPairReview[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function TransferMatchClient({
  suggestions,
  unmatched,
  paired
}: TransferMatchClientProps) {
  const [rows, setRows] = useState<TransferSuggestion[]>(suggestions);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [status, setStatus] = useState("");
  const [pairedRows, setPairedRows] = useState<TransferPairReview[]>(paired);
  const [unpairState, setUnpairState] = useState<Record<string, SaveState>>({});

  const formatDelta = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency || "AUD"
    }).format(amount);

  const handleConfirm = async (suggestion: TransferSuggestion) => {
    setSaveState((prev) => ({ ...prev, [suggestion.id]: "saving" }));
    setStatus("");
    try {
      const response = await fetch("/api/transfer-pairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromId: suggestion.outflow.id,
          toId: suggestion.inflow.id
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail ?? "Pairing failed");
      }
      setSaveState((prev) => ({ ...prev, [suggestion.id]: "saved" }));
      setRows((prev) => prev.filter((row) => row.id !== suggestion.id));
    } catch (error) {
      setSaveState((prev) => ({ ...prev, [suggestion.id]: "error" }));
      setStatus("Failed to confirm transfer pair.");
    }
  };

  const handleUnpair = async (pair: TransferPairReview) => {
    setUnpairState((prev) => ({ ...prev, [pair.id]: "saving" }));
    setStatus("");
    try {
      const response = await fetch(`/api/transfer-pairs/${pair.id}`, {
        method: "DELETE"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail ?? "Unpair failed");
      }
      setUnpairState((prev) => ({ ...prev, [pair.id]: "idle" }));
      setPairedRows((prev) => prev.filter((row) => row.id !== pair.id));
    } catch (error) {
      setUnpairState((prev) => ({ ...prev, [pair.id]: "error" }));
      setStatus("Failed to unpair transfer.");
    }
  };

  if (rows.length === 0 && unmatched.length === 0 && pairedRows.length === 0) {
    return <div className="empty-state">No transfer pairs to review.</div>;
  }

  return (
    <div className="transfer-stack">
      {pairedRows.length > 0 ? (
        <div className="transfer-table">
          <div className="transfer-subtitle">Paired transfers</div>
          <div className="transfer-header">
            <span>Outflow</span>
            <span>Inflow</span>
            <span>Matched</span>
            <span></span>
            <span>Action</span>
          </div>
          {pairedRows.map((pair) => {
            const state = unpairState[pair.id] ?? "idle";
            return (
              <div key={pair.id} className="transfer-row">
                <div>
                  <div className="row-title">{pair.outflow.description}</div>
                  <div className="row-sub">
                    {pair.outflow.date} - {pair.outflow.accountName} -{" "}
                    {pair.outflow.amount}
                  </div>
                </div>
                <div>
                  <div className="row-title">{pair.inflow.description}</div>
                  <div className="row-sub">
                    {pair.inflow.date} - {pair.inflow.accountName} -{" "}
                    {pair.inflow.amount}
                  </div>
                </div>
                <span className="row-sub">{pair.matchedAt || "-"}</span>
                <span className="row-sub"> </span>
                <button
                  className="pill"
                  type="button"
                  onClick={() => handleUnpair(pair)}
                  disabled={state === "saving"}
                >
                  {state === "saving"
                    ? "Removing..."
                    : state === "error"
                    ? "Retry"
                    : "Unpair"}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="transfer-table">
          <div className="transfer-subtitle">Suggested matches</div>
          <div className="transfer-header">
            <span>Outflow</span>
            <span>Inflow</span>
            <span>Delta</span>
            <span>Window</span>
            <span>Action</span>
          </div>
          {rows.map((suggestion) => {
            const state = saveState[suggestion.id] ?? "idle";
            const deltaLabel = formatDelta(
              suggestion.amountDiff,
              suggestion.outflow.currency
            );
            const windowLabel = `${suggestion.dateDiffDays}d`;
            return (
              <div key={suggestion.id} className="transfer-row">
                <div>
                  <div className="row-title">{suggestion.outflow.description}</div>
                  <div className="row-sub">
                    {suggestion.outflow.date} - {suggestion.outflow.accountName} -{" "}
                    {suggestion.outflow.amount}
                  </div>
                </div>
                <div>
                  <div className="row-title">{suggestion.inflow.description}</div>
                  <div className="row-sub">
                    {suggestion.inflow.date} - {suggestion.inflow.accountName} -{" "}
                    {suggestion.inflow.amount}
                  </div>
                </div>
                <span className="row-sub">{deltaLabel}</span>
                <span className="row-sub">{windowLabel}</span>
                <button
                  className="pill"
                  type="button"
                  onClick={() => handleConfirm(suggestion)}
                  disabled={state === "saving"}
                >
                  {state === "saving"
                    ? "Saving..."
                    : state === "saved"
                    ? "Saved"
                    : state === "error"
                    ? "Retry"
                    : "Confirm"}
                </button>
              </div>
            );
          })}
          {status ? <div className="row-sub">{status}</div> : null}
        </div>
      ) : null}

      {unmatched.length > 0 ? (
        <div className="transfer-unmatched">
          <div className="transfer-subtitle">Unmatched transfers</div>
          <div className="transfer-unmatched-table">
            <div className="transfer-unmatched-header">
              <span>Transaction</span>
              <span>Amount</span>
              <span>Date</span>
              <span>Account</span>
            </div>
            {unmatched.map((item) => (
              <div key={item.id} className="transfer-unmatched-row">
                <span className="row-title">{item.description}</span>
                <span className="row-sub">{item.amount}</span>
                <span className="row-sub">{item.date}</span>
                <span className="row-sub">
                  {item.accountName}
                  {item.debugReason ? ` · ${item.debugReason}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
