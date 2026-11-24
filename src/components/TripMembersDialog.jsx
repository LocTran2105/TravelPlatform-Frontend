import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { X, Loader2, AlertCircle, UserPlus, Clock } from 'lucide-react';
import { actorLabel, describeActivity, dayKey, fullTime, timeAgo } from '../utils/activity';

const API = 'http://localhost:8080';
const PAGE_SIZE = 20;

const ROLE_LABEL = { OWNER: 'Chủ chuyến đi', EDITOR: 'Có thể chỉnh sửa', VIEWER: 'Chỉ xem' };

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const errorText = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (!error?.response) return 'Không thể kết nối tới máy chủ. Vui lòng thử lại.';
  return fallback;
};

const Avatar = ({ src, name, size = 'h-9 w-9' }) =>
  src ? (
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );

/**
 * Hộp thoại thành viên + lịch sử thao tác (chỉ chủ chuyến đi và người chỉnh sửa mở được).
 *   trip      : { id, title }
 *   members   : danh sách thành viên đã tải ở trang cha
 *   myId      : id người đang đăng nhập (để hiện "Bạn")
 *   isOwner   : chủ chuyến đi mới thấy nút "Mời & quản lý"
 *   onManage  : mở modal mời / quản lý bạn đồng hành
 *   onClose   : đóng
 */
const TripMembersDialog = ({ trip, members, myId, isOwner, onManage, onClose }) => {
  const [tab, setTab] = useState('members'); // members | activity
  const [activity, setActivity] = useState({ items: [], nextBefore: null, loaded: false, now: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const requestSeq = useRef(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const seq = requestSeq;
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      seq.current += 1; // bỏ kết quả còn đang bay về sau khi đóng
    };
  }, []);

  const loadActivity = (before) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    axios
      .get(`${API}/api/trips/${trip.id}/activities`, {
        params: before ? { before, size: PAGE_SIZE } : { size: PAGE_SIZE },
        headers: authHeaders(),
      })
      .then((res) => {
        if (seq !== requestSeq.current) return;
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        setActivity((prev) => ({
          items: before ? [...prev.items, ...items.filter((i) => !prev.items.some((p) => p.id === i.id))] : items,
          nextBefore: res.data?.nextBefore ?? null,
          loaded: true,
          now: Date.now(),
        }));
      })
      .catch((e) => {
        if (seq === requestSeq.current) setError(errorText(e, 'Không tải được lịch sử thao tác.'));
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  };

  const openActivity = () => {
    setTab('activity');
    if (!activity.loaded) loadActivity(null);
  };

  // Nhóm theo ngày, giữ thứ tự mới nhất trước
  const groups = [];
  for (const item of activity.items) {
    const key = dayKey(item.createdAt, activity.now);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }

  const tabClass = (active) =>
    `rounded-lg py-2 text-sm font-semibold transition-all ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-dialog-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] min-h-[26rem] w-full max-w-md flex-col rounded-3xl bg-white p-6 shadow-2xl outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 id="members-dialog-title" className="px-8 text-center text-xl font-extrabold text-slate-900">
          Thành viên chuyến đi
        </h2>
        <p className="mt-1 line-clamp-1 px-8 text-center text-xs text-slate-400">{trip.title}</p>

        <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'members'} onClick={() => setTab('members')} className={tabClass(tab === 'members')}>
            Thành viên ({members.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === 'activity'} onClick={openActivity} className={tabClass(tab === 'activity')}>
            Hoạt động
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {tab === 'members' ? (
            <ul className="divide-y divide-slate-100" aria-label="Danh sách thành viên">
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 py-2.5">
                  <Avatar src={m.avatar} name={m.fullName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {m.fullName}
                      {String(m.userId) === String(myId) && <span className="ml-1.5 text-xs font-medium text-slate-400">(Bạn)</span>}
                    </p>
                    <p className="truncate text-xs text-slate-400">@{m.username}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {ROLE_LABEL[m.role] || m.role}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div aria-label="Lịch sử thao tác">
              {error && (
                <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button type="button" onClick={() => loadActivity(activity.items.length ? activity.nextBefore : null)} className="font-bold underline">
                    Thử lại
                  </button>
                </p>
              )}

              {activity.loaded && activity.items.length === 0 && !error && (
                <p className="py-10 text-center text-sm text-slate-400">Chưa có hoạt động nào.</p>
              )}

              {groups.map((g) => (
                <section key={g.key} className="mt-2 first:mt-0">
                  <h3 className="sticky top-0 bg-white py-1 text-xs font-bold uppercase tracking-wide text-slate-400">{g.key}</h3>
                  <ul className="space-y-3 pb-1 pt-1">
                    {g.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-2.5" data-activity={item.action}>
                        <Avatar src={item.actorAvatar} name={item.actorName || item.actorUsername} size="h-8 w-8" />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm leading-snug text-slate-700">
                            <span className="font-bold text-slate-900">{actorLabel(item, myId)}</span> {describeActivity(item)}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400" title={fullTime(item.createdAt)}>
                            <Clock className="h-3 w-3" /> {timeAgo(item.createdAt, activity.now)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {loading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500" role="status">
                  <Loader2 className="h-5 w-5 animate-spin text-[#FF5645]" /> Đang tải...
                </div>
              )}

              {!loading && activity.nextBefore && (
                <button
                  type="button"
                  onClick={() => loadActivity(activity.nextBefore)}
                  className="mt-3 w-full rounded-xl bg-slate-100 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
                >
                  Xem thêm
                </button>
              )}
            </div>
          )}
        </div>

        {isOwner && tab === 'members' && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onManage}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
            >
              <UserPlus className="h-4 w-4" /> Mời &amp; quản lý thành viên
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripMembersDialog;
