import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import PlanTrip from './components/PlanTrip';
import TripDetail from './components/TripDetail'; // Nhớ import ở trên cùng
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

        <Route path="/plan" element={<PlanTrip />} />
        <Route path="/trips/:tripId" element={<TripDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
