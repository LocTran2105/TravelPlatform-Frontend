import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Lock, Mail, Phone, Camera, CheckCircle2, AlertCircle, AtSign } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import SiteHeader from './site/SiteHeader';

const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{1,8}[a-z0-9]$/;

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('info'); // 'info' hoặc 'password'
  
  const [formData, setFormData] = useState({ fullName: '', phoneNumber: '', username: '' });
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!savedUser || !token) {
      navigate('/login');
      return;
    }
    
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser);
    setFormData({
      fullName: parsedUser.fullName || '',
      phoneNumber: parsedUser.phoneNumber || '',
      username: parsedUser.username || ''
    });

    // localStorage chỉ lưu id/email/fullName/role lúc đăng nhập,
    // nên tải hồ sơ đầy đủ (số điện thoại, username...) từ server.
    axios
      .get(`${API_BASE_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        const data = res.data || {};
        const merged = {
          ...parsedUser,
          fullName: data.fullName ?? parsedUser.fullName,
          phoneNumber: data.phoneNumber ?? parsedUser.phoneNumber ?? '',
          username: data.username ?? parsedUser.username ?? '',
          avatar: data.avatar ?? parsedUser.avatar
        };
        localStorage.setItem('user', JSON.stringify(merged));
        setUser(merged);
        setFormData({
          fullName: merged.fullName || '',
          phoneNumber: merged.phoneNumber || '',
          username: merged.username || ''
        });
      })
      .catch((error) => {
        // Lỗi 401 đã được interceptor trong App.jsx xử lý
        console.error('Lỗi tải hồ sơ người dùng:', error);
      });
  }, [navigate]);

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    const username = formData.username.trim().toLowerCase();
    if (!USERNAME_REGEX.test(username)) {
      setMessage({
        type: 'error',
        text: 'Username dài 3–10 ký tự, chỉ gồm chữ thường, số và . _ - ; phải bắt đầu và kết thúc bằng chữ hoặc số (không có khoảng trắng).'
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/users/profile`,
        { ...formData, username },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updatedUser = { ...user, fullName: formData.fullName, phoneNumber: formData.phoneNumber, username };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setFormData((prev) => ({ ...prev, username }));
      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data || 'Có lỗi xảy ra khi cập nhật.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/users/change-password`, 
        { oldPassword: passwordData.oldPassword, newPassword: passwordData.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data || 'Đổi mật khẩu thất bại.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header đơn giản */}
      <SiteHeader search={false} />

      <main className="mx-auto mt-8 max-w-5xl px-6 pb-20">
        <h1 className="text-2xl font-bold text-slate-900">Chỉnh sửa thông tin</h1>
        
        <div className="mt-6 flex flex-col gap-8 md:flex-row">
          {/* Sidebar Tabs */}
          <div className="w-full shrink-0 md:w-64">
            <div className="flex flex-col gap-1 rounded-2xl bg-white p-2 shadow-sm border border-slate-100">
              <button
                onClick={() => { setActiveTab('info'); setMessage({ type: '', text: '' }); }}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'info' ? 'bg-orange-50 text-[#E04B3B]' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User className="h-4.5 w-4.5" /> Thông tin cá nhân
              </button>
              <button
                onClick={() => { setActiveTab('password'); setMessage({ type: '', text: '' }); }}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'password' ? 'bg-orange-50 text-[#E04B3B]' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Lock className="h-4.5 w-4.5" /> Đổi mật khẩu
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 rounded-2xl bg-white p-6 shadow-sm border border-slate-100 sm:p-8">
            {message.text && (
              <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${
                message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}>
                {message.type === 'error' ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
                <p>{message.text}</p>
              </div>
            )}

            {activeTab === 'info' ? (
              <form onSubmit={handleUpdateInfo} className="max-w-md space-y-5">
                <div className="mb-8 flex items-center gap-5">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-2xl font-bold text-[#c43d2f]">
                    {user.fullName?.charAt(0).toUpperCase()}
                    <button type="button" className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200">
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{user.fullName}</h3>
                    <p className="text-sm text-slate-500">{user.role === 'ROLE_TRAVELLER' ? 'Khách du lịch' : 'Quản trị viên'}</p>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Email (Không thể đổi)</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input type="email" value={user.email} disabled className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-500 cursor-not-allowed" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Họ và tên</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input type="text" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} required className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-[#FF5645] focus:bg-white focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Số điện thoại</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input type="tel" value={formData.phoneNumber} onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-[#FF5645] focus:bg-white focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Username</label>
                  <div className="relative">
                    <AtSign className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })
                      }
                      maxLength={10}
                      required
                      placeholder="vd: loc.106"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-[#FF5645] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    3–10 ký tự: chữ thường, số và . _ - ; bắt đầu/kết thúc bằng chữ hoặc số; không có khoảng trắng, không phân biệt hoa thường.
                  </p>
                </div>

                <button type="submit" disabled={isLoading} className="tp-btn-primary mt-4 px-6 py-2.5 text-sm disabled:opacity-60">
                  {isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleChangePassword} className="max-w-md space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Mật khẩu hiện tại</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input type="password" value={passwordData.oldPassword} onChange={(e) => setPasswordData({...passwordData, oldPassword: e.target.value})} required className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-[#FF5645] focus:bg-white focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})} required className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-[#FF5645] focus:bg-white focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})} required className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-[#FF5645] focus:bg-white focus:outline-none" />
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="tp-btn-primary mt-4 px-6 py-2.5 text-sm disabled:opacity-60">
                  {isLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;