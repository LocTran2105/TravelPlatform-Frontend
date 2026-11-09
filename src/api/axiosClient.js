
import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  timeout: 20000,
  headers: {
    Accept: 'application/json',
  },
});

// Tự động gắn JWT vào mỗi request
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Xử lý token hết hạn hoặc không hợp lệ
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
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
    return 'Không thể kết nối Backend. Hãy kiểm tra máy chủ tại localhost:8080.';
  }

  return fallback;
}

export default axiosClient;
