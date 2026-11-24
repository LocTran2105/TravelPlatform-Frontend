
import axiosClient from './axiosClient';

export const ADMIN_ENDPOINTS = {
  dashboard: '/api/admin/dashboard',
  applications: '/api/admin/partner-applications',
  businessSubmissions: '/api/admin/partner-submissions',
};

export const adminApi = {
  getDashboard: () =>
    axiosClient
      .get(ADMIN_ENDPOINTS.dashboard)
      .then((response) => response.data),

  getApplications: (params = {}) =>
    axiosClient
      .get(ADMIN_ENDPOINTS.applications, { params })
      .then((response) => response.data),

  approveApplication: (id, note = '') =>
    axiosClient
      .put(`${ADMIN_ENDPOINTS.applications}/${id}/approve`, { note })
      .then((response) => response.data),

  rejectApplication: (id, note) =>
    axiosClient
      .put(`${ADMIN_ENDPOINTS.applications}/${id}/reject`, { note })
      .then((response) => response.data),

  getBusinessSubmissions: (params = {}) =>
    axiosClient
      .get(ADMIN_ENDPOINTS.businessSubmissions, { params })
      .then((response) => response.data),

  // Tìm kiếm các địa điểm OSM xung quanh tọa độ Partner cung cấp.
  getOsmCandidates: (submissionId, params = {}) =>
    axiosClient
      .get(
        `${ADMIN_ENDPOINTS.businessSubmissions}/${submissionId}/osm-candidates`,
        {
          params: {
            radiusMeters: 2000,
            ...params,
          },
        },
      )
      .then((response) => response.data),

  // Admin xác nhận địa điểm trước khi phê duyệt.
  // placeProvider: OSM hoặc PARTNER.
  approveBusinessSubmission: (id, decision) =>
    axiosClient
      .put(
        `${ADMIN_ENDPOINTS.businessSubmissions}/${id}/approve`,
        decision,
      )
      .then((response) => response.data),

  rejectBusinessSubmission: (id, note) =>
    axiosClient
      .put(
        `${ADMIN_ENDPOINTS.businessSubmissions}/${id}/reject`,
        { note },
      )
      .then((response) => response.data),
};

export default adminApi;
