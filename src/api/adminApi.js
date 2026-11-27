
import axiosClient from './axiosClient';

export const ADMIN_ENDPOINTS = {
  dashboard: '/api/admin/dashboard',
  applications: '/api/admin/partner-applications',
  businessSubmissions: '/api/admin/partner-submissions',
  businesses: '/api/admin/businesses',
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

  // Quản lý địa điểm đã có: lọc, ẩn/hiện, trạng thái hoạt động, vị trí.
  // params: { verificationStatus, publicationStatus, businessType, keyword, page, size } -> Spring Page
  getBusinesses: (params = {}) =>
    axiosClient
      .get(ADMIN_ENDPOINTS.businesses, { params })
      .then((response) => response.data),

  // publicationStatus: PUBLISHED | HIDDEN | DRAFT
  updateBusinessVisibility: (id, publicationStatus) =>
    axiosClient
      .put(`${ADMIN_ENDPOINTS.businesses}/${id}/visibility`, { publicationStatus })
      .then((response) => response.data),

  // operatingStatus: OPEN | TEMPORARILY_CLOSED | CLOSED_PERMANENTLY
  updateBusinessOperatingStatus: (id, operatingStatus) =>
    axiosClient
      .put(`${ADMIN_ENDPOINTS.businesses}/${id}/operating-status`, { operatingStatus })
      .then((response) => response.data),

  // location: { address, ward, district, city, province, latitude, longitude }
  updateBusinessLocation: (id, location) =>
    axiosClient
      .put(`${ADMIN_ENDPOINTS.businesses}/${id}/location`, location)
      .then((response) => response.data),
};

export default adminApi;
