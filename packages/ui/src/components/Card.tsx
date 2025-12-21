import type { ReactNode } from "react";

type CardTone = "default" | "glow" | "negative";

type CardProps = {
  title: string;
  value?: string;
  sub?: string;
  tone?: CardTone;
  children?: ReactNode;
  className?: string;
};

export function Card({ title, value, sub, tone = "default", children, className }: CardProps) {
  const toneClass = tone === "default" ? "" : tone;
  return (
    <article className={`card ${toneClass} ${className ?? ""}`.trim()}>
      <div className="card-title">{title}</div>
      {value ? <div className="card-value">{value}</div> : null}
      {sub ? <div className="card-sub">{sub}</div> : null}
      {children}
    </article>
  );
}
