export function EmptyState({ title, action }: { title: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm text-ink-2">{title}</p>
      {action ? (
        <a href={action.href} className="btn mt-4">
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
