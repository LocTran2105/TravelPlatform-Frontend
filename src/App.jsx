import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import Profile from './components/Profile';
import PlanTrip from './components/PlanTrip';
import TripDetail from './components/TripDetail'; // Nhớ import ở trên cùng

// 2. Thêm bộ đánh chặn (Interceptor) của Axios
axios.interceptors.response.use(
  (response) => {
    // Nếu request thành công, trả về bình thường
    return response;
  },
  (error) => {
    // Nếu lỗi là 401 (Unauthorized - Chưa xác thực hoặc Token hết hạn)
    if (error.response && error.response.status === 401) {
      console.warn("Token hết hạn hoặc không hợp lệ. Đang đăng xuất...");
      
      // Xóa thông tin cũ
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Chuyển hướng cưỡng bức về trang đăng nhập
      // Dùng window.location để đảm bảo toàn bộ state của web được reset
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Trang chủ — nội dung tự đổi theo trạng thái đăng nhập, xem Home.jsx */}
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* /home dùng chung component Home — hiển thị đúng khi vừa đăng nhập xong */}
        <Route path="/home" element={<Home />} />

        {/* TODO: /plan cho giao diện lập kế hoạch, /community cho trang chia sẻ chuyến đi */}
        {/* <Route path="/plan" element={<Plan />} /> */}
        {/* <Route path="/community" element={<Community />} /> */}

        {/* Đường dẫn không hợp lệ -> quay về trang chủ */}
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/plan" element={<PlanTrip />} />
        <Route path="/trips/:tripId" element={<TripDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
