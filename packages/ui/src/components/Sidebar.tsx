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
};

export function Sidebar({ navItems }: SidebarProps) {
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
      <div className="rail-card">
        <div className="rail-card-title">Monthly Close</div>
        <div className="rail-card-body">3 unresolved items</div>
        <button className="ghost-btn" type="button">
          Open checklist
        </button>
      </div>
    </aside>
  );
}
