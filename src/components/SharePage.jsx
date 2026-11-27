import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Compass, MapPin, Calendar, UserRound, ShieldCheck, Eye, MailWarning, Loader2 } from 'lucide-react';
import { withRedirect } from '../utils/redirect';
import { API_BASE_URL } from '../config/api';

const API = API_BASE_URL;

// '2026-11-21' -> '21/11/2026' (không đi qua Date để khỏi lệch múi giờ)
const formatDate = (value) => (value ? String(value).split('-').reverse().join('/') : '');

const formatRange = (start, end) => {
  if (!start) return '';
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} - ${formatDate(end)}`;
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const errorText = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (!error?.response) return 'Không thể kết nối tới máy chủ. Vui lòng thử lại.';
  return fallback;
};

// Trang mở từ link chia sẻ chuyến đi: /share/:token
const SharePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [user] = useState(readStoredUser);
  const [hasToken, setHasToken] = useState(() => Boolean(localStorage.getItem('token')));
  const [joining, setJoining] = useState(false);
  const [actionError, setActionError] = useState('');

  const returnPath = `/share/${token}`;

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/api/share/preview/${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return;
        setInfo(res.data);
        setPhase('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(errorText(error, 'Không thể mở link này.'));
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const switchAccount = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate(withRedirect('/login', returnPath), { replace: true });
  };

  const join = async () => {
    if (joining) return;
    setJoining(true);
    setActionError('');
    try {
      const res = await axios.post(
        `${API}/api/share/join`,
        { token },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      navigate(`/trips/${res.data.tripId}`, { replace: true });
    } catch (error) {
      if (error.response?.status === 401) {
        // Phiên đăng nhập hết hạn: bắt đăng nhập lại rồi quay về đúng link
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setHasToken(false);
      }
      setActionError(errorText(error, 'Không thể tham gia chuyến đi, vui lòng thử lại.'));
    } finally {
      setJoining(false);
    }
  };

  const isViewer = info?.role === 'VIEWER';

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-900 antialiased">
      <header className="border-b border-slate-100 bg-white p-5">
        <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold text-slate-900 hover:opacity-80">
          <Compass className="h-7 w-7 text-[#FF5645]" /> TravelPlatform
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-8">
          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-10 text-slate-500" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF5645]" />
              <p className="text-sm font-medium">Đang mở link...</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                <MailWarning className="h-7 w-7" />
              </div>
              <h1 className="text-xl font-extrabold">Không mở được link</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{loadError}</p>
              <Link
                to="/"
                className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                Về trang chủ
              </Link>
            </div>
          )}

          {phase === 'ready' && info && (
            <>
              <p className="text-center text-sm text-slate-500">
                <span className="font-bold text-slate-800">{info.ownerName}</span> chia sẻ với bạn chuyến đi
              </p>
              <h1 className="mt-1 text-center text-2xl font-extrabold leading-snug tracking-tight">{info.tripTitle}</h1>

              <div className="mt-5 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
                {info.destination && (
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{info.destination}</span>
                  </div>
                )}
                {info.startDate && (
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{formatRange(info.startDate, info.endDate)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-slate-700">
                  {isViewer ? (
                    <Eye className="h-4 w-4 shrink-0 text-slate-400" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <span>{isViewer ? 'Quyền: chỉ xem' : 'Quyền: xem và chỉnh sửa'}</span>
                </div>
              </div>

              {!hasToken ? (
                <div className="mt-6">
                  <p className="text-center text-xs leading-relaxed text-slate-500">
                    Hãy đăng nhập hoặc tạo tài khoản để tham gia chuyến đi này.
                  </p>
                  {actionError && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-600" role="alert">
                      {actionError}
                    </p>
                  )}
                  <div className="mt-4 flex flex-col gap-2.5">
                    <Link
                      to={withRedirect('/login', returnPath)}
                      className="rounded-full bg-[#FF5645] px-6 py-3 text-center text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#E04B3B]"
                    >
                      Đăng nhập để tham gia
                    </Link>
                    <Link
                      to={withRedirect('/register', returnPath)}
                      className="rounded-full border border-slate-200 px-6 py-3 text-center text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Tạo tài khoản mới
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  {user?.email && (
                    <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                      <UserRound className="h-3.5 w-3.5" />
                      Đang đăng nhập: <strong className="text-slate-700">{user.email}</strong>
                    </p>
                  )}
                  {actionError && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-600" role="alert">
                      {actionError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={join}
                    disabled={joining}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#FF5645] px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#E04B3B] disabled:opacity-70"
                  >
                    {joining && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                    {joining ? 'Đang tham gia...' : 'Tham gia chuyến đi'}
                  </button>
                  <button
                    type="button"
                    onClick={switchAccount}
                    className="mt-4 block w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600 hover:underline"
                  >
                    Không phải bạn? Đăng nhập tài khoản khác
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SharePage;
