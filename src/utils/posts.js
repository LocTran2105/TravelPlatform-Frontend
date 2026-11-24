// Danh sách ảnh/video của bài theo đúng thứ tự đăng. Bản backend cũ chưa có "media"
// thì ghép từ imageUrls + videoUrls để vẫn hiển thị được.
export function getMedia(post) {
  if (Array.isArray(post?.media) && post.media.length > 0) {
    return post.media.filter((m) => m && m.url).map((m) => ({ url: m.url, type: m.type === 'VIDEO' ? 'VIDEO' : 'IMAGE' }));
  }
  return [
    ...(post?.imageUrls || []).map((url) => ({ url, type: 'IMAGE' })),
    ...(post?.videoUrls || []).map((url) => ({ url, type: 'VIDEO' })),
  ];
}

const toDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** '24/11/2026' (rỗng nếu dữ liệu ngày không hợp lệ) */
export function formatPostDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString('vi-VN') : '';
}

/** '24/11/2026 lúc 15:22' */
export function formatPostDateTime(value) {
  const d = toDate(value);
  if (!d) return '';
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${d.toLocaleDateString('vi-VN')} lúc ${time}`;
}
