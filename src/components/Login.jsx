import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Compass,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  X,
} from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
  const navigate = useNavigate();

  // State form (khởi tạo email và ghi nhớ đăng nhập từ localStorage)
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('saved_travel_email') || '';
  });
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    return Boolean(localStorage.getItem('saved_travel_email'));
  });
  const [showPassword, setShowPassword] = useState(false);

  // State trạng thái
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // State Modal Quên mật khẩu
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState({ loading: false, sent: false, error: '' });

  // Xử lý gửi form đăng nhập
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Kiểm tra tính hợp lệ cơ bản
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ địa chỉ email và mật khẩu.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Địa chỉ email không đúng định dạng. Vui lòng kiểm tra lại.');
      return;
    }

    setIsLoading(true);

    try {
      // Gọi API login của backend Spring Boot
      const response = await axios.post('http://localhost:8080/api/auth/login', {
        email: trimmedEmail,
        password: password,
      });

      // Trích xuất dữ liệu trả về từ backend (AuthResponse: { token, id, email, fullName, role })
      const data = response.data;
      const token = data?.token || data?.accessToken || (typeof data === 'string' ? data : null);

      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.setItem('token', JSON.stringify(data));
      }

      // Lưu thông tin người dùng nếu có
      if (data && typeof data === 'object') {
        const userInfo = {
          id: data.id,
          email: data.email || trimmedEmail,
          fullName: data.fullName || 'Khách du lịch',
          role: data.role || 'USER',
        };
        localStorage.setItem('user', JSON.stringify(userInfo));
      }

      // Quản lý ghi nhớ email
      if (rememberMe) {
        localStorage.setItem('saved_travel_email', trimmedEmail);
      } else {
        localStorage.removeItem('saved_travel_email');
      }

      setSuccessMessage('Đăng nhập thành công! Đang chuyển hướng vào hệ thống...');

      setTimeout(() => {
        navigate('/home');
      }, 700);
    } catch (error) {
      console.error('Lỗi khi đăng nhập:', error);

      if (error.response) {
        const serverMsg = error.response.data?.message || (typeof error.response.data === 'string' ? error.response.data : '');
        if (serverMsg) {
          setErrorMessage(serverMsg);
        } else if (error.response.status === 401 || error.response.status === 400) {
          setErrorMessage('Email hoặc mật khẩu không chính xác. Vui lòng thử lại!');
        } else {
          setErrorMessage(`Máy chủ phản hồi lỗi (${error.response.status}). Vui lòng thử lại sau.`);
        }
      } else if (error.request) {
        setErrorMessage('Không thể kết nối tới máy chủ backend (http://localhost:8080). Hãy đảm bảo Backend đang chạy.');
      } else {
        setErrorMessage('Đã xảy ra sự cố ngoài ý muốn. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý Đăng nhập Google
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const googleToken = credentialResponse.credential;

      const response = await axios.post('http://localhost:8080/api/auth/google', {
        token: googleToken,
      });

      // Lưu token + thông tin user giống hệt luồng đăng nhập thường —
      // trước đây chỉ lưu token nên Home.jsx (dựa vào key 'user' để biết
      // đã đăng nhập hay chưa) vẫn hiển thị như khách dù đã có token.
      const data = response.data;
      const token = data?.token || data?.accessToken;

      if (token) {
        localStorage.setItem('token', token);
      }

      if (data && typeof data === 'object') {
        const userInfo = {
          id: data.id,
          email: data.email,
          fullName: data.fullName || 'Khách du lịch',
          role: data.role || 'USER',
        };
        localStorage.setItem('user', JSON.stringify(userInfo));
      }

      navigate('/home');
    } catch (error) {
      console.error('Lỗi gửi token xuống Backend:', error);
      setErrorMessage('Đăng nhập Google thất bại. Vui lòng thử lại.');
    }
  };

  // Điền nhanh tài khoản thử nghiệm (tiện lợi khi test/chấm điểm)
  const handleQuickFillDemo = () => {
    setEmail('demo.traveler@example.com');
    setPassword('travel123456');
    setErrorMessage('');
  };

  // Xử lý gửi yêu cầu quên mật khẩu
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotStatus({ loading: false, sent: false, error: 'Vui lòng nhập địa chỉ email.' });
      return;
    }
    setForgotStatus({ loading: true, sent: false, error: '' });

    try {
      // Gọi API thực tế
      await axios.post(`http://localhost:8080/api/auth/forgot-password?email=${forgotEmail}`);
      
      setForgotStatus({
        loading: false,
        sent: true,
        error: '',
      });
    } catch (error) {
      const msg = error.response?.data || 'Không thể gửi email. Vui lòng kiểm tra lại email hoặc thử lại sau.';
      setForgotStatus({ loading: false, sent: false, error: msg });
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 font-sans text-slate-800 antialiased">
      {/* ================= NỀN: ẢNH DU LỊCH LÀM MỜ ================= */}
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center blur-md"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2400&auto=format&fit=crop')`,
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

      {/* ================= MODAL ĐĂNG NHẬP ================= */}
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
              Đăng nhập
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Chào mừng bạn trở lại! Sẵn sàng cho những chuyến đi mới cùng
              TravelPlatform.
            </p>
          </div>

          {/* Thông báo lỗi nếu có */}
          {errorMessage && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-500" />
              <div className="flex-1">
                <p className="font-medium text-rose-800">Đăng nhập chưa thành công</p>
                <p className="mt-0.5 text-xs leading-relaxed text-rose-600 sm:text-sm">
                  {errorMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="p-0.5 text-rose-400 hover:text-rose-600"
                title="Đóng thông báo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Thông báo thành công */}
          {successMessage && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Nút Đăng nhập bằng Google */}
          <div className="mb-6 flex w-full justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setErrorMessage('Đăng nhập Google thất bại')}
              useOneTap
              theme="outline"
              size="large"
              text="continue_with"
              shape="rectangular"
            />
          </div>

          {/* Dải phân cách */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 font-medium tracking-wider text-slate-400">
                Hoặc bằng tài khoản
              </span>
            </div>
          </div>

          {/* Form nhập Email & Mật khẩu */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Địa chỉ Email
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="traveler@example.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-11 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs font-medium text-slate-600">Ghi nhớ tài khoản này</span>
              </label>

              <button
                type="button"
                onClick={handleQuickFillDemo}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-emerald-600"
                title="Tự động điền tài khoản mẫu để trải nghiệm nhanh"
              >
                <span>⚡ Điền mẫu demo</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition-all duration-200 hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Đang kiểm tra thông tin...</span>
                </>
              ) : (
                <>
                  <span>Bắt đầu hành trình</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Điều hướng đến Đăng ký tài khoản */}
          <div className="mt-7 border-t border-slate-100 pt-5 text-center">
            <p className="text-xs text-slate-500 sm:text-sm">
              Bạn chưa có tài khoản?{' '}
              <Link
                to="/register"
                className="font-semibold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline"
              >
                Đăng ký ngay miễn phí
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* ================= MODAL QUÊN MẬT KHẨU ================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl sm:p-8">
            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotStatus({ loading: false, sent: false, error: '' });
              }}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition-colors hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Khôi phục mật khẩu</h3>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                Nhập địa chỉ email đăng ký để nhận liên kết đặt lại mật khẩu của bạn.
              </p>
            </div>

            {forgotStatus.sent ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h4 className="text-base font-semibold text-slate-900">Đã gửi hướng dẫn!</h4>
                <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                  Chúng tôi đã gửi thư hướng dẫn khôi phục mật khẩu đến{' '}
                  <strong className="text-slate-800">{forgotEmail}</strong>. Vui lòng kiểm tra
                  hộp thư (bao gồm cả thư rác).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotStatus({ loading: false, sent: false, error: '' });
                  }}
                  className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Đã hiểu & Quay lại
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                {forgotStatus.error && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-600">
                    {forgotStatus.error}
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-700">
                    Email của bạn
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="traveler@example.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-1/2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={forgotStatus.loading}
                    className="flex w-1/2 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {forgotStatus.loading ? <span>Đang gửi...</span> : <span>Gửi yêu cầu</span>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
