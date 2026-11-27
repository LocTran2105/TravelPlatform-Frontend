import { useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { normalizeRole } from './auth.jsx';

const MIN_INTERVAL_MS = 30000;
const RELOAD_GUARD_KEY = 'roleSyncReloadAt';
const RELOAD_GUARD_MS = 10000;

/**
 * Đồng bộ vai trò trong localStorage('user') với vai trò thật trên server.
 *
 * Backend đọc vai trò từ DB ở mỗi request, nhưng giao diện lấy vai trò từ localStorage lúc đăng nhập.
 * Khi quản trị viên cấp / thu hồi quyền kiểm duyệt (hoặc đổi vai trò khác), hook này gọi
 * GET /api/users/profile lúc mở ứng dụng và mỗi khi tab được focus lại (tối đa 30 giây / lần).
 * Nếu vai trò khác thì cập nhật localStorage và tải lại trang một lần để menu, route được tính lại.
 *
 * Lỗi 401 vẫn do axiosClient xử lý như trước; các lỗi khác bị bỏ qua.
 */
export default function useRoleSync() {
  useEffect(() => {
    let lastRun = 0;

    const sync = () => {
      if (!localStorage.getItem('token')) return;
      const now = Date.now();
      if (now - lastRun < MIN_INTERVAL_MS) return;
      lastRun = now;

      axiosClient
        .get('/api/users/profile')
        .then((response) => {
          // normalizeRole('') trả về ROLE_TRAVELLER nên phải bỏ qua phản hồi không có role.
          if (!response?.data?.role) return;
          const serverRole = normalizeRole(response.data.role);
          let stored = null;
          try {
            stored = JSON.parse(localStorage.getItem('user') || 'null');
          } catch {
            stored = null;
          }
          if (!stored || normalizeRole(stored.role) === serverRole) return;
          localStorage.setItem('user', JSON.stringify({ ...stored, role: serverRole }));
          // Chốt chặn: không tải lại quá một lần trong 10 giây để tuyệt đối không bị vòng lặp reload.
          try {
            const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
            if (Date.now() - last < RELOAD_GUARD_MS) return;
            sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
          } catch {
            // sessionStorage không dùng được: vẫn tải lại một lần như bình thường.
          }
          window.location.reload();
        })
        .catch(() => {
          // 401 do axiosClient xử lý; lỗi mạng thì thử lại ở lần focus sau.
        });
    };

    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);
}
