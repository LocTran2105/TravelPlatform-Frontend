// Thông báo dạng toast thay cho window.alert: gọi được từ bất kỳ đâu, <Toaster /> (gắn một lần ở App) hiển thị.
// toast.error('...'), toast.success('...'), toast.info('...')

const listeners = new Set();
let nextId = 1;

const push = (type, message, { duration } = {}) => {
  const text = typeof message === 'string' ? message : String(message ?? '');
  if (!text.trim()) return null;
  const item = { id: nextId++, type, message: text, duration: duration ?? (type === 'error' ? 6000 : 4000) };
  listeners.forEach((listener) => listener(item));
  return item.id;
};

export const toast = {
  error: (message, options) => push('error', message, options),
  success: (message, options) => push('success', message, options),
  info: (message, options) => push('info', message, options),
};

/** Dùng nội bộ bởi <Toaster />. Trả về hàm hủy đăng ký. */
export const subscribeToasts = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
