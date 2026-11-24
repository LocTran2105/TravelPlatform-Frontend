// Tiện ích ảnh bìa chuyến đi

/** Ảnh bìa hiển thị: ảnh người dùng đã chọn, nếu chưa có thì ảnh gợi ý theo điểm đến (server tính). */
export function resolveCoverUrl(trip) {
  if (!trip) return null;
  return trip.coverImageUrl || trip.suggestedCoverUrl || null;
}

/**
 * Với ảnh Cloudinary, thêm phép biến đổi để tải đúng kích thước cần (nhẹ hơn nhiều so với ảnh gốc).
 * URL không phải Cloudinary hoặc đã có sẵn biến đổi thì giữ nguyên.
 */
export function cloudinaryResize(url, width, height) {
  if (!url || typeof url !== 'string') return url;
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (at === -1 || !/^https?:\/\/res\.cloudinary\.com\//.test(url)) return url;
  const head = url.slice(0, at + marker.length);
  const tail = url.slice(at + marker.length);
  // Đã có biến đổi (đoạn đầu dạng "w_400,h_300,...") thì không chèn thêm
  if (/^[a-z]{1,3}_[^/]+\//.test(tail) && !/^v\d+\//.test(tail)) return url;
  return `${head}w_${width},h_${height},c_fill,q_auto/${tail}`;
}

const GRADIENTS = [
  'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
  'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
  'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)',
];

/** Nền gradient ổn định theo id chuyến đi, dùng khi chưa có ảnh hoặc ảnh lỗi. */
export function coverGradient(seed) {
  const n = Number(seed);
  const index = Number.isFinite(n) ? Math.abs(Math.trunc(n)) % GRADIENTS.length : 0;
  return GRADIENTS[index];
}

/** Bỏ dấu tiếng Việt + chữ thường, để tìm kiếm ảnh trong thư viện. */
export function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
