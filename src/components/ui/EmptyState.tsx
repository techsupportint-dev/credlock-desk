export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      {hint && <p className="muted">{hint}</p>}
    </div>
  )
}
