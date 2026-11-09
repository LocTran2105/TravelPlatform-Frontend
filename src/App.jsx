
import { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import axiosClient from './api/axiosClient';

// Traveller
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import Profile from './components/Profile';
import PlanTrip from './components/PlanTrip';
import TripDetail from './components/TripDetail';
import Community from './components/Community';

// Phân quyền và Layout
import ProtectedRoute from './routes/ProtectedRoute';
import PartnerLayout from './layouts/PartnerLayout';
import AdminLayout from './layouts/AdminLayout';

// Partner
import PartnerApplication from './pages/partner/PartnerApplication';
import PartnerDashboard from './pages/partner/PartnerDashboard';
import PartnerBusiness from './pages/partner/PartnerBusiness';
import PartnerSubmissions from './pages/partner/PartnerSubmissions';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminApplications from './pages/admin/AdminApplications';
import AdminSubmissions from './pages/admin/Adminsubmissions';

// CSS
import './styles/partner-admin.css';
import './styles/portal-typography.css';

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
      <Routes>

        {/* ================= PUBLIC / TRAVELLER ================= */}

        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/profile" element={<Profile />} />
        <Route path="/plan" element={<PlanTrip />} />
        <Route path="/trips/:tripId" element={<TripDetail />} />
        <Route path="/community" element={<Community />} />


        {/* ================= PARTNER APPLICATION ================= */}

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
