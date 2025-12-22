"use client";

import { useState } from "react";
import Link from "next/link";
import { ListRow } from "@financelab/ui";
import type { ExpenseCategoryBreakdown } from "../../../../lib/data";

type ExpenseCategoryListProps = {
  categories: ExpenseCategoryBreakdown[];
  selectedMonth: string;
};

export default function ExpenseCategoryList({
  categories,
  selectedMonth
}: ExpenseCategoryListProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleCategory = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="breakdown-grid">
      {categories.map((category) => {
        const isExpanded = expanded[category.name] ?? false;
        const visibleTransactions = isExpanded
          ? category.transactions
          : category.transactions.slice(0, 4);
        const shouldToggle = category.transactions.length > 4;
        const categoryPath = `/reports/expenses/category/${encodeURIComponent(category.name)}`;
        const categoryLink = selectedMonth
          ? `${categoryPath}?month=${encodeURIComponent(selectedMonth)}`
          : categoryPath;

        return (
          <article key={category.name} className="card">
            <div className="card-title">{category.name}</div>
            <div className="card-sub">
              {category.formattedAmount} - {category.count} transactions
            </div>
            <div className="list">
              {visibleTransactions.map((txn) => (
                <ListRow
                  key={txn.id}
                  title={txn.title}
                  sub={txn.sub}
                  category={txn.category}
                  amount={txn.amount}
                  tone={txn.tone}
                />
              ))}
            </div>
            {shouldToggle ? (
              <div className="category-actions">
                <button className="pill" type="button" onClick={() => toggleCategory(category.name)}>
                  {isExpanded ? "Show less" : `Show ${category.transactions.length - 4} more`}
                </button>
                <Link className="pill" href={categoryLink}>
                  View all
                </Link>
              </div>
            ) : (
              <div className="category-actions">
                <Link className="pill" href={categoryLink}>
                  View all
                </Link>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
