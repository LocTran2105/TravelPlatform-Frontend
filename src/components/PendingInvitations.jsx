import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mail, MapPin, Calendar } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const API = API_BASE_URL;

const formatDate = (value) => (value ? String(value).split('-').reverse().join('/') : '');

// Lời mời tham gia chuyến đi đang chờ của người dùng hiện tại (hiện trên trang chủ).
// Không có lời mời nào thì không hiện gì cả.
const PendingInvitations = ({ onJoined }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return undefined;

    let cancelled = false;
    axios
      .get(`${API}/api/invitations/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!cancelled) setItems(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        // Không lấy được lời mời thì thôi, không làm hỏng trang chủ
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const respond = async (invitation, action) => {
    if (busyId !== null) return;
    setBusyId(invitation.id);
    setError('');
    try {
      const res = await axios.post(
        `${API}/api/invitations/${invitation.id}/${action}`,
        null,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setItems((prev) => prev.filter((item) => item.id !== invitation.id));
      if (action === 'accept') {
        if (onJoined) onJoined();
        navigate(`/trips/${res.data.tripId}`);
      }
    } catch (err) {
      const data = err.response?.data;
      setError(typeof data === 'string' && data ? data : 'Không thể xử lý lời mời, vui lòng thử lại.');
      // Lời mời đã hết hiệu lực thì bỏ khỏi danh sách
      if ([404, 410].includes(err.response?.status)) {
        setItems((prev) => prev.filter((item) => item.id !== invitation.id));
      }
    } finally {
      setBusyId(null);
    }
  };

  if (items.length === 0) {
    // Lời mời cuối vừa hết hiệu lực: vẫn cho người dùng đọc thông báo lỗi
    return error ? (
      <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {error}
      </p>
    ) : null;
  }

  return (
    <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5" aria-label="Lời mời tham gia chuyến đi">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
        <Mail className="h-5 w-5 text-amber-600" />
        Lời mời tham gia chuyến đi
        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{items.length}</span>
      </h2>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm text-slate-500">
                <span className="font-bold text-slate-800">{item.inviterName}</span> mời bạn tham gia
              </p>
              <p className="truncate text-base font-extrabold text-slate-900">{item.tripTitle}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                {item.destination && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {item.destination}
                  </span>
                )}
                {item.startDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(item.startDate)}
                    {item.endDate && item.endDate !== item.startDate ? ` - ${formatDate(item.endDate)}` : ''}
                  </span>
                )}
                <span>{item.role === 'VIEWER' ? 'Chỉ xem' : 'Xem và chỉnh sửa'}</span>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => respond(item, 'decline')}
                disabled={busyId !== null}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={() => respond(item, 'accept')}
                disabled={busyId !== null}
                className="rounded-full bg-[#FF5645] px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#E04B3B] disabled:opacity-60"
              >
                {busyId === item.id ? 'Đang xử lý...' : 'Tham gia'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default PendingInvitations;
