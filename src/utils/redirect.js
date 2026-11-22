// Địa chỉ cần quay lại sau khi đăng nhập / đăng ký, ví dụ /login?redirect=/invite/abc
// Chỉ nhận đường dẫn nội bộ của ứng dụng để tránh bị lợi dụng chuyển hướng ra trang lạ.
export function getSafeRedirect(search) {
  const raw = new URLSearchParams(search).get('redirect');
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (/[\r\n\\]/.test(raw)) return null;
  return raw;
}

// withRedirect('/login', '/invite/abc') => '/login?redirect=%2Finvite%2Fabc'
export function withRedirect(path, redirect) {
  return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
}
