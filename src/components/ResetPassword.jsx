import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Lock, Eye, EyeOff, Compass, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); // Lấy token từ URL

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (!token) {
      setMessage({ type: 'error', text: 'Đường dẫn không hợp lệ. Vui lòng kiểm tra lại link trong email.' });
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await axios.post(`http://localhost:8080/api/auth/reset-password?token=${token}`, {
        newPassword: password
      });
      
      setMessage({ type: 'success', text: 'Đặt lại mật khẩu thành công! Đang chuyển hướng...' });
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data || 'Có lỗi xảy ra, token có thể đã hết hạn.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 px-4">
      {/* Nền làm mờ giống trang Login */}
      <div className="absolute inset-0 bg-cover bg-center blur-md" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=2400&auto=format&fit=crop')` }} />
      <div className="absolute inset-0 bg-slate-950/55" />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Đặt lại mật khẩu mới</h2>
        </div>

        {message.text && (
          <div className={`mb-5 flex items-start gap-3 rounded-xl border p-3.5 text-sm ${message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {message.type === 'error' ? <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-500" /> : <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-700">Mật khẩu mới</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-11 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-700">Xác nhận mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input type={showPassword ? 'text' : 'password'} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-11 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3.5 text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={isLoading || !token} className="group mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-60">
            {isLoading ? <span>Đang xử lý...</span> : <span>Lưu mật khẩu mới</span>}
          </button>
        </form>
        
        <div className="mt-5 text-center">
            <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-emerald-600">Quay lại Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;