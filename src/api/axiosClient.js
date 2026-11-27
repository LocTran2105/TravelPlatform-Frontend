
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { requestFinished, requestStarted } from '../utils/loadingBus';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    Accept: 'application/json',
  },
});

// Tự động gắn JWT vào mỗi request
axiosClient.interceptors.request.use(
  (config) => {
    requestStarted();
    const token = localStorage.getItem('token');

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => { requestFinished(); return Promise.reject(error); }
);

// Xử lý token hết hạn hoặc không hợp lệ
axiosClient.interceptors.response.use(
  (response) => { requestFinished(); return response; },
  (error) => {
    requestFinished();
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Chuẩn hóa thông báo lỗi API
export function getApiError(
  error,
  fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.'
) {
  const data = error?.response?.data;

  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (data?.message) return data.message;
  if (data?.error) return data.error;

  if (error?.code === 'ECONNABORTED') {
    return 'Kết nối đến máy chủ quá thời gian chờ.';
  }

  if (!error?.response) {
    return `Không thể kết nối Backend. Hãy kiểm tra máy chủ tại ${API_BASE_URL}.`;
  }

  return fallback;
}

export default axiosClient;
