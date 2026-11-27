// Trạng thái trống: nói rõ vì sao trống và bước tiếp theo (action).

export default function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="portal-empty">
      {Icon && <div className="portal-empty-icon"><Icon size={22} aria-hidden="true" /></div>}
      {title && <strong>{title}</strong>}
      {children && <span>{children}</span>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
