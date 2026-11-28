// Lựa chọn sáng/tối dùng chung cho cả ứng dụng (trang du khách + Admin/Partner portal).
// Lưu ở localStorage (giữ khóa cũ 'portal-theme' để không mất lựa chọn đã có); chưa chọn thì theo cài đặt của máy.

const STORAGE_KEY = 'portal-theme';
const listeners = new Set();

const readStored = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
};

const media = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : null;
let stored = readStored();
let system = media?.matches ? 'dark' : 'light';

const emit = () => listeners.forEach((fn) => fn());
media?.addEventListener?.('change', (event) => { system = event.matches ? 'dark' : 'light'; emit(); });

export const getTheme = () => stored || system;

export const subscribeTheme = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const setTheme = (next) => {
  stored = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* chế độ riêng tư: chỉ giữ trong phiên */ }
  emit();
};
