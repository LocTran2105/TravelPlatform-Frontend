
import axiosClient from './axiosClient';

// Các endpoint Admin được gom tại đây để dễ điều chỉnh
// khi đối chiếu với @RequestMapping trong Backend.
export const ADMIN_ENDPOINTS = {
  dashboard: '/api/admin/dashboard',
  applications: '/api/admin/partner-applications',
  businessSubmissions: '/api/admin/partner-businesses/submissions',
};

export const adminApi = {
  // Dashboard
  getDashboard: () =>
    axiosClient.get(ADMIN_ENDPOINTS.dashboard).then((r) => r.data),

  // Danh sách đơn đăng ký Partner
  getApplications: (params = {}) =>
    axiosClient.get(ADMIN_ENDPOINTS.applications, { params }).then((r) => r.data),

  // Duyệt đơn Partner
  approveApplication: (id, note = '') =>
    axiosClient.put(
      `${ADMIN_ENDPOINTS.applications}/${id}/approve`,
      { note }
    ).then((r) => r.data),

  // Từ chối đơn Partner
  rejectApplication: (id, note) =>
    axiosClient.put(
      `${ADMIN_ENDPOINTS.applications}/${id}/reject`,
      { note }
    ).then((r) => r.data),

  // Danh sách yêu cầu xác minh địa điểm
  getBusinessSubmissions: (params = {}) =>
    axiosClient.get(ADMIN_ENDPOINTS.businessSubmissions, { params }).then((r) => r.data),

  // Phê duyệt địa điểm
  approveBusinessSubmission: (id, note = '') =>
    axiosClient.put(
      `${ADMIN_ENDPOINTS.businessSubmissions}/${id}/approve`,
      { note }
    ).then((r) => r.data),

  // Từ chối địa điểm
  rejectBusinessSubmission: (id, note) =>
    axiosClient.put(
      `${ADMIN_ENDPOINTS.businessSubmissions}/${id}/reject`,
      { note }
    ).then((r) => r.data),
};

export default adminApi;
