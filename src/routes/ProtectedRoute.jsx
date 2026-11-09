import { Navigate, Outlet } from 'react-router-dom';
import {
  getHomePathForRole,
  normalizeRole
} from '../utils/auth.jsx';

export default function ProtectedRoute({
  allowedRoles = [],
  children
}) {
  const token = localStorage.getItem('token');
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    localStorage.removeItem('user');
  }

  // Chưa đăng nhập
  if (!token || !user) {
    return <Navigate to="/login" replace />;
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