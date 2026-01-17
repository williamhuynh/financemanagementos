"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  id: string;
  label: string;
  href: string;
};

type SidebarProps = {
  navItems: NavItem[];
  monthlyCloseData?: {
    unresolvedCount: number;
    monthKey: string;
  } | null;
};

export function Sidebar({ navItems, monthlyCloseData }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="rail">
      <div className="brand">
        <div className="brand-badge">FL</div>
        <div>
          <div className="brand-name">FinanceLab</div>
          <div className="brand-sub">Family Wealth OS</div>
        </div>
      </div>
      <nav className="rail-nav">
        {navItems.map((item) => (
          <Link
            key={item.id}
            className={`nav-btn ${pathname === item.href ? "active" : ""}`}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {monthlyCloseData && (
        <div className="rail-card">
          <div className="rail-card-title">Monthly Close</div>
          <div className="rail-card-body">
            {monthlyCloseData.unresolvedCount > 0
              ? `${monthlyCloseData.unresolvedCount} unresolved item${monthlyCloseData.unresolvedCount === 1 ? "" : "s"}`
              : "Ready to close month"}
          </div>
          <Link className="ghost-btn" href="/reports">
            {monthlyCloseData.unresolvedCount > 0
              ? "Open checklist"
              : "Close Month"}
          </Link>
        </div>
      )}
    </aside>
  );
}
