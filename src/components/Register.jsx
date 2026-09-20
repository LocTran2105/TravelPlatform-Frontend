import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  Compass,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  X,
} from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();

  // State quản lý form
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Validation cơ bản
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp!');
      return;
    }

    if (formData.phoneNumber.length < 10) {
      setErrorMessage('Số điện thoại không hợp lệ!');
      return;
    }

    setIsLoading(true);

    try {
      // Gọi API Spring Boot
      await axios.post('http://localhost:8080/api/auth/register', {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.password,
      });

      setSuccessMessage('Đăng ký thành công! Đang chuyển hướng đến trang đăng nhập...');

      // Chuyển về trang login sau 2 giây
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      if (error.response) {
        setErrorMessage(error.response.data || 'Đăng ký thất bại. Vui lòng thử lại!');
      } else {
        setErrorMessage('Không thể kết nối đến máy chủ.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 font-sans text-slate-800 antialiased">
      {/* ================= NỀN: ẢNH DU LỊCH LÀM MỜ ================= */}
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center blur-md"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2400&auto=format&fit=crop')`,
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-slate-950/55" aria-hidden="true" />

      {/* Logo góc trên bên trái — bấm để quay lại trang chủ */}
      <Link to="/" className="relative z-10 inline-flex items-center gap-2 p-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/25">
          <Compass className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold text-white">TravelPlatform</span>
      </Link>

      {/* ================= MODAL ĐĂNG KÝ ================= */}
      <div className="relative z-10 flex min-h-[calc(100vh-84px)] items-center justify-center px-4 pb-10">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl sm:p-9">
          {/* Nút đóng — quay về trang chủ */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="absolute right-5 top-5 text-slate-400 transition-colors hover:text-slate-600"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Tiêu đề */}
          <div className="mb-7 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Tạo tài khoản
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Gia nhập cộng đồng du lịch tự túc và bắt đầu thiết kế chuyến đi
              của riêng bạn.
            </p>
          </div>

          {/* Thông báo lỗi / thành công */}
          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Họ và tên */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Họ và tên
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            {/* Số điện thoại */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Số điện thoại
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Phone className="h-4 w-4" />
                </div>
                <input
                  type="tel"
                  name="phoneNumber"
                  required
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="VD: 0987654321"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="traveler@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            {/* Mật khẩu & Xác nhận (Lưới 2 cột) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Mật khẩu
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Xác nhận MK
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition-all duration-200 hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span>Đăng ký ngay</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Điều hướng đến Đăng nhập */}
          <div className="mt-7 border-t border-slate-100 pt-5 text-center">
            <p className="text-xs text-slate-500 sm:text-sm">
              Đã có tài khoản?{' '}
              <Link
                to="/login"
                className="font-semibold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
              >
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
