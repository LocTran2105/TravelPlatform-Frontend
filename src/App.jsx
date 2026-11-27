import { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import axiosClient from './api/axiosClient';
import Toaster from './components/Toaster';

// Traveller
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import Profile from './components/Profile'; // Đây là trang Settings sửa mật khẩu/tên
import PlanTrip from './components/PlanTrip';
import TripDetail from './components/TripDetail';
import Community from './components/Community';
import PublicProfile from './components/PublicProfile';
import InvitePage from './components/InvitePage';
import SharePage from './components/SharePage';

// Phân quyền và Layout
import ProtectedRoute from './routes/ProtectedRoute';
import PartnerLayout from './layouts/PartnerLayout';
import AdminLayout from './layouts/AdminLayout';

// Partner
import PartnerApplication from './pages/partner/PartnerApplication';
import BecomePartner from './pages/partner/BecomePartner';
import PartnerDashboard from './pages/partner/PartnerDashboard';
import PartnerBusiness from './pages/partner/PartnerBusiness';
import PartnerSubmissions from './pages/partner/PartnerSubmissions';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminApplications from './pages/admin/AdminApplications';
import AdminSubmissions from './pages/admin/AdminSubmissions';
import AdminBusinesses from './pages/admin/AdminBusinesses';

// CSS
import './styles/portal.css';
import './styles/partner-admin.css';


function App() {
  // Kiểm tra JWT khi mở ứng dụng
  useEffect(() => {
    const token = localStorage.getItem('token');

    if (token) {
      axiosClient.get('/api/users/profile').catch(() => {
        // axiosClient xử lý trường hợp 401.
      });
    }
  }, []);

  return (
    <BrowserRouter>
      <Toaster />
      <Routes>

        {/* ================= PUBLIC / TRAVELLER ================= */}

        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Tách riêng trang Cài đặt tài khoản */}
        <Route path="/settings" element={<Profile />} /> 
        
        {/* Trang hồ sơ mạng xã hội (Public Profile) */}
        <Route path="/profile" element={<PublicProfile />} /> 
        <Route path="/profile/:username" element={<PublicProfile />} />

        <Route path="/plan" element={<PlanTrip />} />
        <Route path="/trips/:tripId" element={<TripDetail />} />

        {/* Mở lời mời tham gia chuyến đi từ link trong email */}
        <Route path="/invite/:token" element={<InvitePage />} />

        {/* Mở link chia sẻ chuyến đi (nút Share) */}
        <Route path="/share/:token" element={<SharePage />} />
        <Route path="/community" element={<Community />} />


        {/* ================= PARTNER APPLICATION ================= */}

        {/* Trang giới thiệu công khai cho đơn vị muốn làm đối tác */}
        <Route path="/tro-thanh-doi-tac" element={<BecomePartner />} />

        <Route
          path="/partner-application"
          element={
            <ProtectedRoute allowedRoles={['ROLE_TRAVELLER']}>
              <PartnerApplication />
            </ProtectedRoute>
          }
        />


        {/* ================= PARTNER PORTAL ================= */}

        <Route
          element={
            <ProtectedRoute allowedRoles={['ROLE_PARTNER']}>
              <PartnerLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/partner" element={<PartnerDashboard />} />

          <Route
            path="/partner/businesses"
            element={<PartnerBusiness />}
          />

          <Route
            path="/partner/submissions"
            element={<PartnerSubmissions />}
          />
        </Route>


        {/* ================= ADMIN PORTAL ================= */}

        <Route
          element={
            <ProtectedRoute allowedRoles={['ROLE_ADMIN']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />

          <Route
            path="/admin/applications"
            element={<AdminApplications />}
          />

          <Route
            path="/admin/submissions"
            element={<AdminSubmissions />}
          />

          <Route
            path="/admin/businesses"
            element={<AdminBusinesses />}
          />
        </Route>


        {/* ================= NOT FOUND ================= */}

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;