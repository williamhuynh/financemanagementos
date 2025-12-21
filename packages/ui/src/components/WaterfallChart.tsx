export function WaterfallChart() {
  return (
    <article className="card chart wide">
      <div className="card-title">Cash Flow Waterfall</div>
      <div className="chart-body waterfall">
        <div className="bar income">+19k</div>
        <div className="bar expense">-2.3k</div>
        <div className="bar expense">-4.9k</div>
        <div className="bar expense">-652</div>
        <div className="bar expense">-634</div>
        <div className="bar expense">-231</div>
        <div className="bar net">Net</div>
      </div>
    </article>
  );
}
