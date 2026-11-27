import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'portal-primary-button',
  secondary: 'portal-secondary-button',
  ghost: 'portal-ghost-button',
  danger: 'portal-danger-button',
};

/**
 * Nút của portal. `loading` thay icon bằng vòng quay và khóa nút để không bấm hai lần.
 * Có `to` thì render thành Link (giữ nguyên giao diện nút).
 */
export default function Button({
  variant = 'secondary', size, loading = false, icon: Icon, to, className = '', type = 'button', disabled, children, ...rest
}) {
  const classes = [VARIANTS[variant] || VARIANTS.secondary, size === 'sm' ? 'portal-button-sm' : '', loading ? 'portal-button-busy' : '', className]
    .filter(Boolean).join(' ');
  const iconSize = size === 'sm' ? 14 : 16;
  const content = (
    <>
      {loading
        ? <Loader2 size={iconSize} className="portal-spin" aria-hidden="true" />
        : Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children}
    </>
  );

  if (to) return <Link to={to} className={classes} {...rest}>{content}</Link>;
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}
