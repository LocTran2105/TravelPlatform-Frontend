import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Compass,
  MapPin,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Globe,
  CheckCircle2,
  X
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
  // Hàm này sẽ tự động chạy khi người dùng đăng nhập Google thành công trên popup
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      // 1. Lấy token Google cấp cho Frontend
      const googleToken = credentialResponse.credential;
      console.log("Token Google cấp:", googleToken);

      // 2. Gửi token đó xuống Backend Spring Boot của chúng ta
      const response = await axios.post('http://localhost:8080/api/auth/google', {
        token: googleToken
      });

      // 3. Backend trả về JWT, lưu vào két sắt và chuyển trang
      const jwt = response.data.token; 
      localStorage.setItem('token', jwt);
      alert("Đăng nhập Google thành công!");
      navigate('/home');

    } catch (error) {
      console.error("Lỗi gửi token xuống Backend:", error);
      alert("Đăng nhập thất bại. Xem console F12.");
    }
  };

  // Điền nhanh tài khoản thử nghiệm (tiện lợi khi test/chấm điểm)
  const handleQuickFillDemo = () => {
    setEmail('demo.traveler@example.com');
    setPassword('travel123456');
    setErrorMessage('');
  };

  // Xử lý gửi yêu cầu quên mật khẩu
  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotStatus({ loading: false, sent: false, error: 'Vui lòng nhập địa chỉ email.' });
      return;
    }
    setForgotStatus({ loading: true, sent: false, error: '' });

    // Giả lập gửi mail khôi phục mật khẩu thân thiện
    setTimeout(() => {
      setForgotStatus({
        loading: false,
        sent: true,
        error: '',
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full flex items-stretch bg-slate-900 font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* ================= PHẦN TRÁI: BANNER HÌNH ẢNH DU LỊCH (ẨN TRÊN MÀN HÌNH NHỎ) ================= */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-slate-950">
        {/* Hình nền du lịch tuyệt đẹp với hiệu ứng zoom nhẹ */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-45 scale-105 transition-transform duration-1000 ease-out"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop')`,
          }}
        />

        {/* Lớp phủ gradient tạo chiều sâu điện ảnh */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-900/40" />

        {/* Header thương hiệu phía trên banner */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-emerald-400 text-xs font-semibold tracking-wide uppercase shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Nền tảng Du lịch Tự túc Thông minh
          </div>

          <div className="flex items-center gap-3 mt-5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">TravelPlatform</h1>
              <p className="text-xs text-slate-300 font-medium">Khám phá theo cách riêng của bạn</p>
            </div>
          </div>
        </div>

        {/* Nội dung truyền cảm hứng du lịch */}
        <div className="relative z-10 my-auto max-w-lg">
          <h2 className="text-4xl font-extrabold text-white leading-tight">
            Mỗi chuyến đi là một <span className="text-emerald-400 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">hành trình diệu kỳ</span>.
          </h2>
          <p className="mt-4 text-slate-300 text-base leading-relaxed">
            Lên lịch trình tự túc cá nhân hóa, khám phá các địa điểm bản địa độc đáo, quản lý chi phí thông minh và lưu giữ trọn vẹn từng khoảnh khắc đáng nhớ.
          </p>

          {/* 3 tính năng nổi bật dạng thẻ glassmorphism */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-white transition-all hover:bg-white/15">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-white">Bản đồ du lịch tương tác</p>
                <p className="text-xs text-slate-300">Gợi ý lộ trình tối ưu và địa điểm ăn uống, nghỉ dưỡng</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-white transition-all hover:bg-white/15">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <p className="font-semibold text-white">Lịch trình tự túc theo ngày</p>
                <p className="text-xs text-slate-300">Tự do tùy biến điểm dừng chân theo sở thích riêng</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer của Banner */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-6 border-t border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Hệ thống bảo mật dữ liệu an toàn</span>
          </div>
          <span>© 2026 TravelPlatform</span>
        </div>
      </div>

      {/* ================= PHẦN PHẢI: KHU VỰC FORM ĐĂNG NHẬP ================= */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 lg:p-12 bg-slate-50 relative overflow-y-auto">
        {/* Background họa tiết mờ ảo nhẹ cho bên form */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-emerald-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-80 h-80 bg-teal-100/40 rounded-full blur-3xl pointer-events-none" />

        {/* Container Form Card */}
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10 relative z-10">
          {/* Header trên Mobile: Logo du lịch */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Compass className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-slate-800">TravelPlatform</span>
          </div>

          {/* Tiêu đề Chào mừng */}
          <div className="text-center sm:text-left mb-7">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Đăng nhập <span className="inline-block animate-bounce">👋</span>
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Chào mừng bạn trở lại! Sẵn sàng cho những chuyến đi mới cùng TravelPlatform.
            </p>
          </div>

          {/* Thông báo lỗi nếu có */}
          {errorMessage && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-700 text-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-rose-800">Đăng nhập chưa thành công</p>
                <p className="mt-0.5 text-rose-600 leading-relaxed text-xs sm:text-sm">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="text-rose-400 hover:text-rose-600 p-0.5"
                title="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Thông báo thành công */}
          {successMessage && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Nút Đăng nhập bằng Google (Chuẩn nhận diện thương hiệu Google) */}
         {/* Nút Đăng nhập bằng Google CHUẨN */}
          <div className="flex justify-center w-full mb-6 mt-2">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setErrorMessage('Đăng nhập Google thất bại');
              }}
              useOneTap
              theme="outline"
              size="large"
              text="continue_with"
              shape="rectangular"
            />
          </div>

          {/* Dải phân cách hoặc */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-medium tracking-wider">
                Hoặc bằng tài khoản
              </span>
            </div>
          </div>

          {/* Form nhập Email & Mật khẩu */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Địa chỉ Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Input Mật khẩu */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
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
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Hàng Ghi nhớ tài khoản */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-600">Ghi nhớ tài khoản này</span>
              </label>

              {/* Nút tiện ích thử nghiệm */}
              <button
                type="button"
                onClick={handleQuickFillDemo}
                className="text-xs text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1 font-medium"
                title="Tự động điền tài khoản mẫu để trải nghiệm nhanh"
              >
                <span>⚡ Điền mẫu demo</span>
              </button>
            </div>

            {/* Nút Đăng nhập chính */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl text-white font-semibold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Đang kiểm tra thông tin...</span>
                </>
              ) : (
                <>
                  <span>Bắt đầu hành trình</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Điều hướng đến Đăng ký tài khoản */}
          <div className="mt-7 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs sm:text-sm text-slate-500">
              Bạn chưa có tài khoản?{' '}
              <Link
                to="/register"
                className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
              >
                Đăng ký ngay miễn phí
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* ================= MODAL QUÊN MẬT KHẨU ================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotStatus({ loading: false, sent: false, error: '' });
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Khôi phục mật khẩu</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Nhập địa chỉ email đăng ký để nhận liên kết đặt lại mật khẩu của bạn.
              </p>
            </div>

            {forgotStatus.sent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-semibold text-slate-900">Đã gửi hướng dẫn!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Chúng tôi đã gửi thư hướng dẫn khôi phục mật khẩu đến <strong className="text-slate-800">{forgotEmail}</strong>. Vui lòng kiểm tra hộp thư (bao gồm cả thư rác).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotStatus({ loading: false, sent: false, error: '' });
                  }}
                  className="mt-5 w-full py-2.5 px-4 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Đã hiểu & Quay lại
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                {forgotStatus.error && (
                  <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    {forgotStatus.error}
                  </p>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Email của bạn
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="traveler@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={forgotStatus.loading}
                    className="w-1/2 py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                  >
                    {forgotStatus.loading ? (
                      <span>Đang gửi...</span>
                    ) : (
                      <span>Gửi yêu cầu</span>
                    )}
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
