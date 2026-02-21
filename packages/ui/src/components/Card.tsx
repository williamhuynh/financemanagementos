import type { ReactNode, KeyboardEvent } from "react";

type CardTone = "default" | "glow" | "negative";

type CardProps = {
  title: string;
  value?: string;
  sub?: string;
  tone?: CardTone;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
};

export function Card({ title, value, sub, tone = "default", children, className, onClick, selected }: CardProps) {
  const toneClass = tone === "default" ? "" : tone;
  const selectedClass = selected ? "selected" : "";
  const interactiveProps = onClick
    ? {
        onClick,
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};
  return (
    <article
      className={`card ${toneClass} ${selectedClass} ${className ?? ""}`.trim()}
      {...interactiveProps}
    >
      <div className="card-title">{title}</div>
      {value ? <div className="card-value">{value}</div> : null}
      {sub ? <div className="card-sub">{sub}</div> : null}
      {children}
    </article>
  );
}
