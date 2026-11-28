import axiosClient from './axiosClient';

/**
 * Lịch trình gắn trong bài viết cộng đồng.
 * Backend: GET /api/posts/{postId}/trip, POST /api/posts/{postId}/copy-trip
 */

/**
 * Lịch trình (từ bản chụp trong bài):
 * { trip, days: [{ dayNumber, dayDate, destinations: [{ placeName, itemType, startTime, endTime, note,
 *   estimatedCost, actualCost, expenses }] }], costByCategory: [{ category, amount }],
 *   generalExpenses: [{ title, category, amount }] }
 */
export const getPostItinerary = (postId) =>
  axiosClient.get(`/api/posts/${postId}/trip`).then((res) => res.data);

/** body: { title?, startDate? ('YYYY-MM-DD') } -> { tripId, title } */
export const copyTripFromPost = (postId, body) =>
  axiosClient.post(`/api/posts/${postId}/copy-trip`, body || {}).then((res) => res.data);

/** Tác giả chụp lại lịch trình từ chuyến đi gốc hiện tại -> trả bài viết đã cập nhật. */
export const refreshPostTrip = (postId) =>
  axiosClient.post(`/api/posts/${postId}/trip/refresh`).then((res) => res.data);

/** Tác giả gỡ lịch trình khỏi bài -> trả bài viết đã cập nhật. */
export const removePostTrip = (postId) =>
  axiosClient.delete(`/api/posts/${postId}/trip`).then((res) => res.data);

/** Các chuyến đi người dùng tham gia (gồm cả chuyến mình là bạn đồng hành). */
export const getMyTrips = () =>
  axiosClient.get('/api/trips/my-trips').then((res) => (Array.isArray(res.data) ? res.data : []));
