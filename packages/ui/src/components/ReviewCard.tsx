type ReviewCardProps = {
  title: string;
  sub: string;
  amount: string;
  actions: string[];
};

export function ReviewCard({ title, sub, amount, actions }: ReviewCardProps) {
  return (
    <article className="card review-card">
      <div className="row-title">{title}</div>
      <div className="row-sub">{sub}</div>
      <div className="amount negative">{amount}</div>
      <div className="actions">
        {actions.map((action) => (
          <button
            key={action}
            className={action.toLowerCase().includes("split") ? "ghost-btn" : "pill"}
            type="button"
          >
            {action}
          </button>
        ))}
      </div>
    </article>
  );
}
