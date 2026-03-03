"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomDrawer } from "@tandemly/ui";
import { apiFetch } from "../../../lib/api-fetch";

interface Category {
  name: string;
  group: string;
}

interface NewTransactionFormProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: string[];
  defaultCurrency: string;
}

export default function NewTransactionForm({
  open,
  onClose,
  categories,
  accounts,
  defaultCurrency,
}: NewTransactionFormProps) {
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [categoryName, setCategoryName] = useState("Uncategorised");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setDate(today);
      setAmount("");
      setAccountName("");
      setCategoryName("Uncategorised");
      setDescription("");
      setCurrency(defaultCurrency);
      setNotes("");
      setError("");
    }
  }, [open, defaultCurrency, today]);

  const isValid = date && amount && accountName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) return;

    setSaving(true);
    setError("");

    try {
      const response = await apiFetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date,
          amount: parseFloat(amount),
          account_name: accountName,
          category_name: categoryName,
          description,
          currency,
          notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create transaction");
        setSaving(false);
        return;
      }

      // Success - close drawer and refresh
      router.refresh();
      onClose();
    } catch (err) {
      setError("An unexpected error occurred");
      setSaving(false);
    }
  };

  return (
    <BottomDrawer open={open} onClose={onClose} title="Add Transaction">
      <form onSubmit={handleSubmit} style={{ padding: "0 16px 16px" }}>
        <div className="form-field">
          <label htmlFor="date">Date *</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="amount">Amount *</label>
          <input
            id="amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Negative for expense, positive for income"
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="account">Account *</label>
          <select
            id="account"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
          >
            <option value="">Select account...</option>
            {accounts.map((account) => (
              <option key={account} value={account}>
                {account}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          >
            <option value="Uncategorised">Uncategorised</option>
            {categories.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="form-field">
          <label htmlFor="currency">Currency</label>
          <input
            id="currency"
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={10}
          />
        </div>

        <div className="form-field">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {error && (
          <div className="error-message" style={{ color: "red", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            className="primary-btn"
            disabled={!isValid || saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </BottomDrawer>
  );
}
