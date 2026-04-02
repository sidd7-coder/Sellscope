export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-surface-border bg-white p-5 shadow-sm ${className}`}
    >
      {title ? (
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}
