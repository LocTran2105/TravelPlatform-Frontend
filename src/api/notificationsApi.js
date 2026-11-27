import axiosClient from './axiosClient';

const BASE = '/api/notifications';

export const notificationsApi = {
  /** { items, page, size, total, hasMore, unreadCount } */
  list: ({ unreadOnly = false, page = 0, size = 20 } = {}) =>
    axiosClient
      .get(BASE, { params: { unreadOnly, page, size } })
      .then((response) => response.data),

  /** Số thông báo chưa đọc (number). */
  unreadCount: () =>
    axiosClient
      .get(`${BASE}/unread-count`)
      .then((response) => Number(response.data?.count) || 0),

  markRead: (id) =>
    axiosClient
      .patch(`${BASE}/${id}/read`)
      .then((response) => response.data),

  markAllRead: () =>
    axiosClient
      .patch(`${BASE}/read-all`)
      .then((response) => response.data),

  remove: (id) =>
    axiosClient
      .delete(`${BASE}/${id}`)
      .then((response) => response.data),
};

export default notificationsApi;
