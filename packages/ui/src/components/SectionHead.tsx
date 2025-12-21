import type { ReactNode } from "react";

type SectionHeadProps = {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
};

export function SectionHead({ eyebrow, title, actions, breadcrumbs }: SectionHeadProps) {
  return (
    <div className="section-head">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <span key={`${crumb.label}-${index}`} className={isLast ? "crumb current" : "crumb"}>
                  {crumb.href && !isLast ? (
                    <a href={crumb.href}>{crumb.label}</a>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                  {!isLast ? <span className="sep">/</span> : null}
                </span>
              );
            })}
          </nav>
        ) : null}
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {actions ? <div className="filters">{actions}</div> : null}
    </div>
  );
}
