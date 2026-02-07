import type { ReactNode } from "react";

type SectionHeadProps = {
  title: string;
  actions?: ReactNode;
};

export function SectionHead({ title, actions }: SectionHeadProps) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
      </div>
      {actions ? <div className="filters">{actions}</div> : null}
    </div>
  );
}
