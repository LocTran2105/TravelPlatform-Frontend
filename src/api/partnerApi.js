
import axiosClient from './axiosClient';

const BUSINESS_BASE = '/api/partner/businesses';
const APPLICATION_BASE = '/api/partner-applications';

export const partnerApi = {
  // Đăng ký trở thành Partner
  applyForPartner: (payload) =>
    axiosClient.post(APPLICATION_BASE, payload).then((r) => r.data),

  // Lịch sử đăng ký Partner
  getMyApplications: () =>
    axiosClient.get(`${APPLICATION_BASE}/mine`).then((r) => r.data),

  // Dashboard
  getDashboard: () =>
    axiosClient.get('/api/partner/dashboard').then((r) => r.data),

  // Danh sách địa điểm của Partner
  getBusinesses: () =>
    axiosClient.get(`${BUSINESS_BASE}/mine`).then((r) => r.data),

  // Chi tiết địa điểm
  getBusiness: (businessId) =>
    axiosClient.get(`${BUSINESS_BASE}/${businessId}`).then((r) => r.data),

  // Thêm địa điểm
  createBusiness: (payload) =>
    axiosClient.post(BUSINESS_BASE, payload).then((r) => r.data),

  // Cập nhật địa điểm
  updateBusiness: (businessId, payload) =>
    axiosClient.put(`${BUSINESS_BASE}/${businessId}`, payload).then((r) => r.data),

  // Ẩn địa điểm
  hideBusiness: (businessId) =>
    axiosClient.delete(`${BUSINESS_BASE}/${businessId}`).then((r) => r.data),

  // Gửi địa điểm để Admin xét duyệt
  submitBusiness: (businessId) =>
    axiosClient.post(`${BUSINESS_BASE}/${businessId}/submit`).then((r) => r.data),

  // Lịch sử xét duyệt địa điểm
  getSubmissions: (businessId) =>
    axiosClient.get(`${BUSINESS_BASE}/${businessId}/submissions`).then((r) => r.data),
};

export default partnerApi;
