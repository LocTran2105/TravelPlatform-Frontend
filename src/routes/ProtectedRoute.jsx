import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  getHomePathForRole,
  normalizeRole
} from '../utils/auth.jsx';
import { withRedirect } from '../utils/redirect';

export default function ProtectedRoute({
  allowedRoles = [],
  children
}) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    localStorage.removeItem('user');
  }

  // Chưa đăng nhập: đăng nhập xong quay lại đúng trang đang mở (vd. /partner-application)
  if (!token || !user) {
    return <Navigate to={withRedirect('/login', `${location.pathname}${location.search}`)} replace />;
  }

  // Kiểm tra quyền
  const role = normalizeRole(user.role);

  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(role)
  ) {
    return (
      <Navigate
        to={getHomePathForRole(role)}
        replace
      />
    );
  }

  return children ?? <Outlet />;
}