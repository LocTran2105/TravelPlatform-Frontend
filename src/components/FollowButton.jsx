import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

/**
 * Nút theo dõi.
 *  - initialIsFollowing: mình có đang theo dõi người này không
 *  - isFollowingMe:      người này có đang theo dõi mình không
 *  - onFollowChange(newState, info): báo cho component cha; info là phản hồi của server
 *    (followersCount, followingCount, followedByMe, followingMe, relationship)
 *
 * Nhãn hiển thị:
 *  mình follow + họ follow  -> "Bạn bè"
 *  chỉ mình follow          -> "Đang theo dõi"
 *  chỉ họ follow            -> "Theo dõi lại"
 *  không ai follow          -> "Theo dõi"
 */
const FollowButton = ({ targetUsername, initialIsFollowing = false, isFollowingMe = false, onFollowChange }) => {
  const [isFollowing, setIsFollowing] = useState(Boolean(initialIsFollowing));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  // Đồng bộ lại khi chuyển sang hồ sơ khác hoặc dữ liệu từ server thay đổi
  useEffect(() => {
    setIsFollowing(Boolean(initialIsFollowing));
    setErrorMsg('');
  }, [initialIsFollowing, targetUsername]);

  const handleToggleFollow = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg('');
      const url = `${API_BASE_URL}/api/social/users/${encodeURIComponent(targetUsername)}/follow`;
      const config = { headers: { Authorization: `Bearer ${token}` } };

      // Gửi đúng hành động mà người dùng nhìn thấy trên nút (không dùng toggle):
      // đang theo dõi -> DELETE (hủy theo dõi); chưa theo dõi -> POST (theo dõi).
      // Cả hai đều idempotent nên giao diện cũ/hai tab không làm đảo ngược hành động.
      const response = isFollowing ? await axios.delete(url, config) : await axios.post(url, {}, config);

      const info = response.data;
      const newStatus = Boolean(info.followedByMe);
      setIsFollowing(newStatus);
      if (onFollowChange) onFollowChange(newStatus, info);
    } catch (error) {
      console.error('Lỗi khi theo dõi:', error);
      if (error.response?.status === 401) {
        // Token hết hạn: xóa và yêu cầu đăng nhập lại
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }
      setErrorMsg(typeof error.response?.data === 'string' ? error.response.data : 'Không thể thực hiện, vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  let label = 'Theo dõi';
  let tone = 'primary';
  if (isFollowing && isFollowingMe) {
    label = 'Bạn bè';
    tone = 'neutral';
  } else if (isFollowing) {
    label = 'Đang theo dõi';
    tone = 'neutral';
  } else if (isFollowingMe) {
    label = 'Theo dõi lại';
  }

  const toneClass =
    tone === 'neutral'
      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
      : 'tp-btn-primary';

  return (
    <div className="inline-flex flex-col items-center">
      <button
        type="button"
        onClick={handleToggleFollow}
        disabled={isLoading}
        title={isFollowing ? 'Bấm để hủy theo dõi' : undefined}
        className={`px-5 py-2 rounded-full font-bold text-sm transition-all duration-300 flex items-center justify-center min-w-[120px] ${toneClass} ${
          isLoading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Xử lý...
          </span>
        ) : (
          label
        )}
      </button>
      {errorMsg && <span className="mt-1 max-w-[200px] text-center text-xs text-rose-600">{errorMsg}</span>}
    </div>
  );
};

export default FollowButton;