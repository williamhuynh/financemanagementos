export function TrendChart() {
  return (
    <article className="card chart wide">
      <div className="card-title">Monthly Net Worth</div>
      <div className="chart-body">
        <svg viewBox="0 0 360 140" aria-hidden="true">
          <polyline
            className="trend"
            points="0,110 40,95 80,70 120,60 160,55 200,48 240,35 280,28 320,40 360,50"
          />
        </svg>
      </div>
    </article>
  );
}
