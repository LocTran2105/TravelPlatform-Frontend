import axiosClient from './axiosClient';

/**
 * Tuyển kiểm duyệt viên phía người dùng. Backend: /api/moderator-recruitments
 * (xem không cần đăng nhập; nộp / rút đơn cần đăng nhập).
 */
const BASE = '/api/moderator-recruitments';

export const recruitmentApi = {
  /** Bài đang đăng / đã đóng, mới nhất trước. */
  list: () => axiosClient.get(BASE).then((res) => (Array.isArray(res.data) ? res.data : [])),

  /** Bài ưu tiên đang nhận đơn cho banner, hoặc null (server trả 204). */
  featured: () => axiosClient.get(`${BASE}/featured`).then((res) => (res.status === 204 ? null : res.data || null)),

  /** { recruitment, myApplication, canApply, applyBlockedReason } */
  detail: (id) => axiosClient.get(`${BASE}/${id}`).then((res) => res.data),

  /** body: { motivation, experience, weeklyHours, contactPhone } -> chi tiết mới */
  apply: (id, body) => axiosClient.post(`${BASE}/${id}/applications`, body).then((res) => res.data),

  withdraw: (id) => axiosClient.delete(`${BASE}/${id}/applications/me`).then((res) => res.data),
};

export default recruitmentApi;
