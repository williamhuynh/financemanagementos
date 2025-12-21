export function Topbar() {
  return (
    <header className="topbar">
      <div className="month-control">
        <span className="label">Month</span>
        <button className="pill" type="button">
          Mar 2025
        </button>
      </div>
      <div className="topbar-actions">
        <div className="search">
          <input type="search" placeholder="Search merchants, categories, accounts" />
        </div>
        <button className="ghost-btn" type="button">
          Export
        </button>
        <button className="primary-btn" type="button">
          Import
        </button>
        <div className="user-chip">William + Peggy</div>
      </div>
    </header>
  );
}
