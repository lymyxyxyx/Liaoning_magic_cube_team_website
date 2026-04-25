import type { ReactNode } from "react";

export function PageHero({
  label,
  title,
  children,
  actions
}: {
  label: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="page-hero">
      <div>
        <span className="eyebrow">{label}</span>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      {actions ? <div className="hero-actions">{actions}</div> : null}
    </section>
  );
}
