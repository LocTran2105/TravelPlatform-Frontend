import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import Profile from './components/Profile';
import PlanTrip from './components/PlanTrip';
import TripDetail from './components/TripDetail';
import Community from './components/Community';

// Interceptor toàn cục: gặp 401 thì xoá thông tin đăng nhập và về /login
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn("Token hết hạn hoặc không hợp lệ. Đang đăng xuất...");

      localStorage.removeItem('token');
      localStorage.removeItem('user');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

function App() {
  // Xác thực ngầm khi mở app: gọi API bắt buộc đăng nhập để kiểm tra
  // token còn hợp lệ và user còn tồn tại trong DB.
  // Nếu backend trả 401, interceptor ở trên sẽ tự đăng xuất.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.get('http://localhost:8080/api/users/profile', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {
        // Không cần xử lý ở đây, interceptor đã lo phần 401
      });
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/plan" element={<PlanTrip />} />
        <Route path="/trips/:tripId" element={<TripDetail />} />
        <Route path="/community" element={<Community />} />

        {/* Đường dẫn không hợp lệ -> quay về trang chủ */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;