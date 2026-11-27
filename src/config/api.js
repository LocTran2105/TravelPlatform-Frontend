// Địa chỉ backend dùng chung cho toàn bộ frontend.
// Đặt VITE_API_BASE_URL trong .env (vd. VITE_API_BASE_URL=https://api.example.com) khi deploy.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
