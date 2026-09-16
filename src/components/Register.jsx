import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, MapPin, Sparkles, AlertCircle, ArrowRight, CheckCircle2, X } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();

  // State quản lý form
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: ''
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
      const response = await axios.post('http://localhost:8080/api/auth/register', {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.password
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
    <div className="min-h-screen w-full flex items-stretch bg-slate-900 font-sans text-slate-800">
      {/* Cột trái: Banner (Giữ nguyên phong cách của Login) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-cover bg-center opacity-45 scale-105"
             style={{ backgroundImage: `url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop')` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-900/40" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4" /> Bắt đầu hành trình mới
          </div>
          <h1 className="text-3xl font-bold text-white mt-6">Tạo tài khoản TravelPlatform</h1>
          <p className="mt-4 text-slate-300">Gia nhập cộng đồng du lịch tự túc và bắt đầu thiết kế những chuyến đi mang đậm dấu ấn cá nhân của riêng bạn.</p>
        </div>
      </div>

      {/* Cột phải: Form Register */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 bg-slate-50 relative overflow-y-auto">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 relative z-10 my-8">
          
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-900">Đăng ký tài khoản 🚀</h2>
            <p className="mt-1.5 text-sm text-slate-500">Điền thông tin bên dưới để tham gia hệ thống.</p>
          </div>

          {/* Hiển thị lỗi / thành công */}
          {errorMessage && (
            <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl flex gap-3 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex gap-3 text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Họ và tên */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">Họ và tên</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input type="text" name="fullName" required value={formData.fullName} onChange={handleChange} placeholder="VD: Nguyễn Văn A"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/40" />
              </div>
            </div>

            {/* Số điện thoại */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">Số điện thoại</label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input type="tel" name="phoneNumber" required value={formData.phoneNumber} onChange={handleChange} placeholder="VD: 0987654321"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/40" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="traveler@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/40" />
              </div>
            </div>

            {/* Mật khẩu & Xác nhận (Lưới 2 cột) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">Mật khẩu</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} name="password" required value={formData.password} onChange={handleChange} placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/40" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">Xác nhận MK</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500/40" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full mt-4 py-3 rounded-xl text-white font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 transition-all flex justify-center gap-2">
              {isLoading ? 'Đang xử lý...' : <>Đăng ký ngay <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500 border-t border-slate-100 pt-5">
            Đã có tài khoản? <Link to="/login" className="font-semibold text-emerald-600 hover:underline">Đăng nhập</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;