// Đếm số request API đang chạy để hiện thanh tiến trình "đang xử lý" trên cùng portal.
// Dùng với useSyncExternalStore(subscribePending, getPending).
const listeners = new Set();
let pending = 0;

const emit = () => listeners.forEach((listener) => listener());

export const requestStarted = () => { pending += 1; emit(); };
export const requestFinished = () => { pending = Math.max(0, pending - 1); emit(); };

export const getPending = () => pending;

export const subscribePending = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
