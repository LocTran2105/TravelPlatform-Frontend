import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  MapPin,
  Calendar,
  UserRound,
  ShieldCheck,
  Eye,
  MailWarning,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { withRedirect } from '../utils/redirect';
import { API_BASE_URL } from '../config/api';
import SiteHeader from './site/SiteHeader';

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

// Các trạng thái lời mời không còn dùng được
const DEAD_MESSAGES = {
  EXPIRED: {
    title: 'Lời mời đã hết hạn',
    text: 'Hãy nhờ người mời gửi lại lời mời cho bạn.',
  },
  REVOKED: {
    title: 'Lời mời đã bị thu hồi',
    text: 'Chủ chuyến đi đã hủy lời mời này.',
  },
  DECLINED: {
    title: 'Bạn đã từ chối lời mời này',
    text: 'Nếu bạn đổi ý, hãy nhờ người mời gửi lại.',
  },
};

const InvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [user] = useState(readStoredUser);
  const [hasToken, setHasToken] = useState(() => Boolean(localStorage.getItem('token')));
  const [busy, setBusy] = useState(''); // '' | 'accept' | 'decline'
  const [actionError, setActionError] = useState('');
  const [wrongAccount, setWrongAccount] = useState(false);
  const [declined, setDeclined] = useState(false);

  const returnPath = `/invite/${token}`;

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/api/invitations/preview/${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return;
        setInvite(res.data);
        setPhase('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(errorText(error, 'Không thể mở lời mời này.'));
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const switchAccount = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate(withRedirect('/login', returnPath), { replace: true });
  };

  const respond = async (action) => {
    if (busy) return;
    setBusy(action);
    setActionError('');
    try {
      const res = await axios.post(
        `${API}/api/invitations/${action}`,
        { token },
        { headers: authHeaders() }
      );
      if (action === 'accept') {
        navigate(`/trips/${res.data.tripId}`, { replace: true });
      } else {
        setDeclined(true);
      }
    } catch (error) {
      const status = error.response?.status;
      if (status === 401) {
        // Phiên đăng nhập hết hạn: bắt đăng nhập lại rồi quay về đúng lời mời
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setHasToken(false);
      } else if (status === 403) {
        setWrongAccount(true);
      }
      setActionError(errorText(error, 'Không thể xử lý lời mời, vui lòng thử lại.'));
    } finally {
      setBusy('');
    }
  };

  const isViewer = invite?.role === 'VIEWER';
  const dead = invite ? DEAD_MESSAGES[invite.status] : null;
  const loggedIn = hasToken;

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-50 font-sans text-slate-900 antialiased">
      <SiteHeader search={false} />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-8">
          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-10 text-slate-500" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF5645]" />
              <p className="text-sm font-medium">Đang mở lời mời...</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
                <MailWarning className="h-7 w-7" />
              </div>
              <h1 className="text-xl font-extrabold">Không mở được lời mời</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{loadError}</p>
              <Link
                to="/"
                className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                Về trang chủ
              </Link>
            </div>
          )}

          {phase === 'ready' && invite && (
            <>
              {/* ---- Thông tin chuyến đi ---- */}
              <p className="text-center text-sm text-slate-500">
                <span className="font-bold text-slate-800">{invite.inviterName}</span> mời bạn tham gia chuyến đi
              </p>
              <h1 className="mt-1 text-center text-2xl font-extrabold leading-snug tracking-tight">
                {invite.tripTitle}
              </h1>

              <div className="mt-5 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
                {invite.destination && (
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{invite.destination}</span>
                  </div>
                )}
                {invite.startDate && (
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                    <span>{formatRange(invite.startDate, invite.endDate)}</span>
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

              {/* ---- Lời mời không còn dùng được ---- */}
              {dead && !declined && (
                <div className="mt-6 text-center">
                  <p className="font-bold text-slate-800">{dead.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{dead.text}</p>
                  <Link
                    to="/"
                    className="mt-5 inline-flex rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Về trang chủ
                  </Link>
                </div>
              )}

              {/* ---- Vừa từ chối ---- */}
              {declined && (
                <div className="mt-6 text-center">
                  <CheckCircle2 className="mx-auto h-9 w-9 text-slate-400" />
                  <p className="mt-2 font-bold text-slate-800">Đã từ chối lời mời</p>
                  <Link
                    to="/"
                    className="mt-5 inline-flex rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    Về trang chủ
                  </Link>
                </div>
              )}

              {/* ---- Chưa đăng nhập ---- */}
              {!dead && !declined && !loggedIn && (
                <div className="mt-6">
                  <p className="text-center text-xs leading-relaxed text-slate-500">
                    Lời mời gửi tới <strong className="text-slate-700">{invite.maskedEmail}</strong>.{' '}
                    {invite.accountExists
                      ? 'Hãy đăng nhập bằng tài khoản dùng email này để tham gia.'
                      : 'Hãy tạo tài khoản bằng đúng email này để tham gia.'}
                  </p>
                  {actionError && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-600">
                      {actionError}
                    </p>
                  )}
                  <div className="mt-4 flex flex-col gap-2.5">
                    <Link
                      to={withRedirect(invite.accountExists ? '/login' : '/register', returnPath)}
                      className="rounded-full bg-[#FF5645] px-6 py-3 text-center text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#E04B3B]"
                    >
                      {invite.accountExists ? 'Đăng nhập để tham gia' : 'Tạo tài khoản để tham gia'}
                    </Link>
                    <Link
                      to={withRedirect(invite.accountExists ? '/register' : '/login', returnPath)}
                      className="rounded-full border border-slate-200 px-6 py-3 text-center text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      {invite.accountExists ? 'Tạo tài khoản mới' : 'Tôi đã có tài khoản'}
                    </Link>
                  </div>
                </div>
              )}

              {/* ---- Đã đăng nhập ---- */}
              {!dead && !declined && loggedIn && (
                <div className="mt-6">
                  {user?.email && (
                    <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                      <UserRound className="h-3.5 w-3.5" />
                      Đang đăng nhập: <strong className="text-slate-700">{user.email}</strong>
                    </p>
                  )}

                  {actionError && (
                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-600">
                      {actionError}
                    </p>
                  )}

                  {wrongAccount ? (
                    <button
                      type="button"
                      onClick={switchAccount}
                      className="mt-4 w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Đăng nhập tài khoản khác
                    </button>
                  ) : (
                    <div className="mt-4 flex gap-3">
                      {invite.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => respond('decline')}
                          disabled={Boolean(busy)}
                          className="flex-1 rounded-full border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                        >
                          {busy === 'decline' ? 'Đang xử lý...' : 'Từ chối'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => respond('accept')}
                        disabled={Boolean(busy)}
                        className="flex flex-[1.4] items-center justify-center gap-2 rounded-full bg-[#FF5645] px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#E04B3B] disabled:opacity-70"
                      >
                        {busy === 'accept' && (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        )}
                        {invite.status === 'ACCEPTED' ? 'Mở chuyến đi' : busy === 'accept' ? 'Đang tham gia...' : 'Tham gia chuyến đi'}
                      </button>
                    </div>
                  )}

                  {!wrongAccount && (
                    <button
                      type="button"
                      onClick={switchAccount}
                      className="mt-4 block w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600 hover:underline"
                    >
                      Không phải bạn? Đăng nhập tài khoản khác
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default InvitePage;
