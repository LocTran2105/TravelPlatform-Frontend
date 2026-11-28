
import axiosClient from './axiosClient';

export const ADMIN_ENDPOINTS = {
  dashboard: '/api/admin/dashboard',
  applications: '/api/admin/partner-applications',
  businessSubmissions: '/api/admin/partner-submissions',
  businesses: '/api/admin/businesses',
  moderators: '/api/admin/moderators',
  recruitments: '/api/admin/moderator-recruitments',
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

  // Quản lý kiểm duyệt viên (chỉ ADMIN).
  getModerators: () =>
    axiosClient
      .get(ADMIN_ENDPOINTS.moderators)
      .then((response) => response.data),

  // Gợi ý người dùng thường đang hoạt động để cấp quyền (từ khóa tối thiểu 2 ký tự).
  searchModeratorCandidates: (q) =>
    axiosClient
      .get(`${ADMIN_ENDPOINTS.moderators}/candidates`, { params: { q } })
      .then((response) => response.data),

  grantModerator: (userId) =>
    axiosClient
      .post(ADMIN_ENDPOINTS.moderators, { userId })
      .then((response) => response.data),

  revokeModerator: (userId) =>
    axiosClient
      .delete(`${ADMIN_ENDPOINTS.moderators}/${userId}`)
      .then((response) => response.data),

  // Tuyển kiểm duyệt viên (chỉ ADMIN).
  getRecruitments: () =>
    axiosClient.get(ADMIN_ENDPOINTS.recruitments).then((response) => response.data),

  // body: { title, summary, content, coverImageUrl, slots, deadline, publish }
  createRecruitment: (body) =>
    axiosClient.post(ADMIN_ENDPOINTS.recruitments, body).then((response) => response.data),

  updateRecruitment: (id, body) =>
    axiosClient.put(`${ADMIN_ENDPOINTS.recruitments}/${id}`, body).then((response) => response.data),

  // status: PUBLISHED | HIDDEN | CLOSED
  setRecruitmentStatus: (id, status) =>
    axiosClient.patch(`${ADMIN_ENDPOINTS.recruitments}/${id}/status`, { status }).then((response) => response.data),

  setRecruitmentFeatured: (id, featured) =>
    axiosClient.patch(`${ADMIN_ENDPOINTS.recruitments}/${id}/featured`, { featured }).then((response) => response.data),

  deleteRecruitment: (id) =>
    axiosClient.delete(`${ADMIN_ENDPOINTS.recruitments}/${id}`).then((response) => response.data),

  getRecruitmentApplications: (id, status) =>
    axiosClient
      .get(`${ADMIN_ENDPOINTS.recruitments}/${id}/applications`, { params: status ? { status } : {} })
      .then((response) => response.data),

  approveModeratorApplication: (applicationId, note) =>
    axiosClient
      .put(`${ADMIN_ENDPOINTS.recruitments}/applications/${applicationId}/approve`, { note: note || null })
      .then((response) => response.data),

  rejectModeratorApplication: (applicationId, note) =>
    axiosClient
      .put(`${ADMIN_ENDPOINTS.recruitments}/applications/${applicationId}/reject`, { note })
      .then((response) => response.data),

  // Ảnh bìa: dùng API upload sẵn có, trả về URL ảnh (chuỗi).
  uploadImage: (file) => {
    const data = new FormData();
    data.append('file', file);
    return axiosClient
      .post('/api/upload/image', data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
      .then((response) => (typeof response.data === 'string' ? response.data.trim() : ''));
  },
};

export default adminApi;
