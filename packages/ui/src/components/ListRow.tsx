type ListRowProps = {
  title: string;
  sub: string;
  category: string;
  amount: string;
  tone?: "positive" | "negative";
  chipTone?: "warn" | "neutral";
  highlight?: boolean;
};

export function ListRow({
  title,
  sub,
  category,
  amount,
  tone = "negative",
  chipTone,
  highlight
}: ListRowProps) {
  const rowClass = highlight ? "list-row highlight" : "list-row";
  const chipClass = chipTone ? `chip ${chipTone}` : "chip";
  return (
    <div className={rowClass}>
      <div>
        <div className="row-title">{title}</div>
        <div className="row-sub">{sub}</div>
      </div>
      <div className="row-meta">
        <span className={chipClass}>{category}</span>
        <span className={`amount ${tone}`}>{amount}</span>
      </div>
    </div>
  );
}
