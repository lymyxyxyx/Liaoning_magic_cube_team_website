import type { ReactNode } from "react";

export function PageHero({
  label,
  title,
  children,
  actions,
  className = ""
}: {
  label: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`page-hero ${className}`.trim()}>
      <div>
        <span className="eyebrow">{label}</span>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      {actions ? <div className="hero-actions">{actions}</div> : null}
    </section>
  );
}
