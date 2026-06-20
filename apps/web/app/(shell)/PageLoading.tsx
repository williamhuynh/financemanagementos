type PageLoadingProps = {
  cards?: number;
  rows?: number;
  showAction?: boolean;
};

export default function PageLoading({ cards = 0, rows = 6, showAction = false }: PageLoadingProps) {
  return (
    <div>
      <div className="page-loading-head">
        <div className="skeleton-block page-loading-title" />
        {showAction && <div className="skeleton-block page-loading-action" />}
      </div>
      {cards > 0 && (
        <div className="page-loading-cards">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="skeleton-block page-loading-card" />
          ))}
        </div>
      )}
      <div className="page-loading-list">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-block page-loading-row" />
        ))}
      </div>
    </div>
  );
}
