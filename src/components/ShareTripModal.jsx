import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  X,
  Link2,
  Mail,
  Copy,
  Check,
  Users,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Trash2,
  Send,
  AlertCircle,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const API = API_BASE_URL;

// Trùng với kiểm tra ở trang PlanTrip; server kiểm tra lại chặt hơn một lần nữa
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INVITEES = 20;

const ROLE_TABS = [
  { value: 'EDITOR', label: 'Có thể chỉnh sửa' },
  { value: 'VIEWER', label: 'Chỉ xem' },
];

const ROLE_LABEL = { OWNER: 'Chủ chuyến đi', EDITOR: 'Có thể chỉnh sửa', VIEWER: 'Chỉ xem' };

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const errorText = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (!error?.response) return 'Không thể kết nối tới máy chủ. Vui lòng thử lại.';
  return fallback;
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Trình duyệt chặn Clipboard API (http, iframe...): dùng cách cũ
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
};

const Avatar = ({ src, name, size = 'h-9 w-9' }) =>
  src ? (
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600`}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );

/**
 * Modal "Mời bạn đồng hành" của một chuyến đi (chỉ chủ chuyến đi mở).
 *   trip      : { id, title }
 *   onClose   : đóng modal
 *   onChanged : (tuỳ chọn) gọi khi danh sách thành viên đổi, để trang cha tải lại
 *   initialView : 'share' (mặc định) | 'manage' (mở thẳng màn quản lý bạn đồng hành)
 */
const ShareTripModal = ({ trip, onClose, onChanged, initialView = 'share' }) => {
  const [view, setView] = useState(initialView); // share | manage
  const [role, setRole] = useState('EDITOR');

  // ----- link chia sẻ -----
  const [links, setLinks] = useState(null);
  const [linkError, setLinkError] = useState('');
  const [linkReload, setLinkReload] = useState(0); // tăng lên để tải lại link
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ----- mời -----
  const [chips, setChips] = useState([]); // { key, type: 'email' | 'user', label, email?, userId?, avatar? }
  const [text, setText] = useState('');
  const [inputError, setInputError] = useState('');
  const [found, setFound] = useState({ q: '', list: [] }); // kết quả tìm kiếm kèm từ khóa đã tìm
  const [highlight, setHighlight] = useState(-1);
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'ok' | 'error', text }

  // ----- quản lý -----
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [manageLoading, setManageLoading] = useState(initialView === 'manage'); // mở thẳng màn quản lý: đang tải ngay từ đầu
  const [manageError, setManageError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const manageStale = useRef(true);

  const dialogRef = useRef(null);
  const searchSeq = useRef(0);
  const [me] = useState(readStoredUser);

  const tripId = trip.id;

  // ---------- Đóng bằng Esc, khóa cuộn nền (chỉ chạy một lần khi mở) ----------
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose; // luôn gọi bản onClose mới nhất mà không phải gắn lại bộ lắng nghe phím
  });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, []);

  // ---------- Tải link chia sẻ ----------
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/api/trips/${tripId}/share-links`, { headers: authHeaders() })
      .then((res) => {
        if (!cancelled) setLinks(res.data);
      })
      .catch((error) => {
        if (!cancelled) setLinkError(errorText(error, 'Không tải được link chia sẻ.'));
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, linkReload]);

  const retryLinks = () => {
    setLinkError('');
    setLinkReload((n) => n + 1);
  };

  const currentToken = links ? (role === 'EDITOR' ? links.editorToken : links.viewerToken) : null;
  const shareUrl = currentToken ? `${window.location.origin}/share/${currentToken}` : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setNotice({ type: 'error', text: 'Không sao chép được. Hãy bôi đen link rồi sao chép thủ công.' });
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setNotice(null);
    try {
      const res = await axios.post(`${API}/api/trips/${tripId}/share-links/${role}/reset`, {}, { headers: authHeaders() });
      setLinks(res.data);
      setConfirmReset(false);
      setNotice({ type: 'ok', text: 'Đã tạo link mới. Link cũ không còn dùng được.' });
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error, 'Không tạo được link mới.') });
    } finally {
      setResetting(false);
    }
  };

  // ---------- Tìm người dùng khi gõ ----------
  const query = text.trim();
  const searchable = query.length >= 2 && !query.includes('@');

  useEffect(() => {
    if (!searchable) {
      searchSeq.current += 1; // hủy kết quả đang bay về
      return undefined;
    }
    const q = query;
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/api/search/users`, {
          params: { q, limit: 6 },
          headers: authHeaders(),
        });
        if (seq !== searchSeq.current) return; // đã có lần gõ mới hơn
        setFound({ q, list: Array.isArray(res.data) ? res.data : [] });
        setHighlight(-1);
      } catch {
        if (seq === searchSeq.current) setFound({ q, list: [] });
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, searchable]);

  // Chỉ hiện gợi ý của đúng từ khóa đang gõ (kết quả của từ khóa cũ không hiện lại)
  const visibleSuggestions =
    searchable && found.q === query
      ? found.list.filter((u) => u.id !== me?.id && !chips.some((c) => c.type === 'user' && c.userId === u.id))
      : [];

  // ---------- Thêm / bớt người được mời ----------
  const addEmails = (raws) => {
    const next = [...chips];
    let ok = true;
    for (const raw of raws) {
      const email = raw.trim().toLowerCase();
      if (!email) continue;
      if (!EMAIL_REGEX.test(email)) {
        setInputError(`Email không hợp lệ: ${email}`);
        ok = false;
        continue;
      }
      if (me?.email && email === me.email.toLowerCase()) continue;
      if (next.some((c) => c.type === 'email' && c.email === email)) continue;
      if (next.length >= MAX_INVITEES) {
        setInputError(`Mỗi lần chỉ mời được tối đa ${MAX_INVITEES} người.`);
        ok = false;
        break;
      }
      next.push({ key: `e:${email}`, type: 'email', label: email, email });
    }
    setChips(next);
    return ok; // false: còn email chưa nhận được, giữ lại chữ trong ô để người dùng sửa
  };

  const addUser = (u) => {
    if (chips.length >= MAX_INVITEES) {
      setInputError(`Mỗi lần chỉ mời được tối đa ${MAX_INVITEES} người.`);
      return;
    }
    setChips((prev) =>
      prev.some((c) => c.type === 'user' && c.userId === u.id)
        ? prev
        : [...prev, { key: `u:${u.id}`, type: 'user', label: u.fullName || u.username, sub: `@${u.username}`, userId: u.id, avatar: u.avatar }]
    );
    setText('');
    setInputError('');
    setNotice(null);
  };

  const removeChip = (key) => setChips((prev) => prev.filter((c) => c.key !== key));

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' && visibleSuggestions.length) {
      e.preventDefault();
      setHighlight((h) => (h + 1) % visibleSuggestions.length);
    } else if (e.key === 'ArrowUp' && visibleSuggestions.length) {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? visibleSuggestions.length - 1 : h - 1));
    } else if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      const value = text.trim();
      if (e.key === 'Enter' && highlight >= 0 && visibleSuggestions[highlight]) {
        e.preventDefault();
        addUser(visibleSuggestions[highlight]);
      } else if (value) {
        e.preventDefault();
        if (value.includes('@')) {
          setInputError('');
          if (addEmails([value])) setText('');
        } else if (e.key === 'Enter' && visibleSuggestions.length === 1) {
          addUser(visibleSuggestions[0]);
        } else if (e.key === 'Enter') {
          setInputError('Hãy chọn một người trong danh sách gợi ý hoặc nhập email.');
        }
      }
    } else if (e.key === 'Backspace' && !text && chips.length) {
      setChips((prev) => prev.slice(0, -1));
    } else if (e.key === 'Escape' && (visibleSuggestions.length || text)) {
      e.preventDefault(); // chỉ đóng gợi ý, không đóng cả modal
      setText('');
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData?.getData('text') || '';
    if (!/[\s,;]/.test(pasted.trim())) return; // dán một giá trị: để ô nhập xử lý bình thường
    e.preventDefault();
    setInputError('');
    addEmails(pasted.split(/[\s,;]+/));
  };

  const handleInvite = async () => {
    // Email gõ dở nhưng chưa bấm Enter vẫn được tính
    const pending = text.trim();
    let list = chips;
    if (pending.includes('@')) {
      if (!EMAIL_REGEX.test(pending.toLowerCase())) {
        setInputError(`Email không hợp lệ: ${pending}`);
        return;
      }
      const email = pending.toLowerCase();
      if (!list.some((c) => c.type === 'email' && c.email === email)) {
        list = [...list, { key: `e:${email}`, type: 'email', label: email, email }];
      }
    }
    if (list.length === 0 || inviting) return;
    if (list.length > MAX_INVITEES) {
      setInputError(`Mỗi lần chỉ mời được tối đa ${MAX_INVITEES} người.`);
      return;
    }

    setInviting(true);
    setNotice(null);
    setInputError('');
    try {
      const res = await axios.post(
        `${API}/api/trips/${tripId}/invitations`,
        {
          emails: list.filter((c) => c.type === 'email').map((c) => c.email),
          userIds: list.filter((c) => c.type === 'user').map((c) => c.userId),
          role,
        },
        { headers: authHeaders() }
      );
      const sent = res.data?.invited?.length || 0;
      const skipped = res.data?.skipped?.length || 0;
      setChips([]);
      setText('');
      manageStale.current = true;
      setNotice({
        type: 'ok',
        text:
          sent > 0
            ? `Đã gửi ${sent} lời mời.${skipped ? ` Bỏ qua ${skipped} người đã là thành viên hoặc đã được mời.` : ''}`
            : 'Những người này đã là thành viên hoặc đã được mời rồi.',
      });
    } catch (error) {
      setNotice({ type: 'error', text: errorText(error, 'Không gửi được lời mời, vui lòng thử lại.') });
    } finally {
      setInviting(false);
    }
  };

  // ---------- Quản lý bạn đồng hành ----------
  const loadManage = useCallback(async () => {
    setManageLoading(true);
    setManageError('');
    try {
      const [m, i] = await Promise.all([
        axios.get(`${API}/api/trips/${tripId}/members`, { headers: authHeaders() }),
        axios.get(`${API}/api/trips/${tripId}/invitations`, { headers: authHeaders() }),
      ]);
      setMembers(m.data || []);
      setInvitations(i.data || []);
      manageStale.current = false;
    } catch (error) {
      setManageError(errorText(error, 'Không tải được danh sách bạn đồng hành.'));
    } finally {
      setManageLoading(false);
    }
  }, [tripId]);

  // Mở thẳng màn quản lý (từ hộp thoại thành viên): tải ngay khi mở
  useEffect(() => {
    if (initialView !== 'manage') return undefined;
    let cancelled = false;
    Promise.all([
      axios.get(`${API}/api/trips/${tripId}/members`, { headers: authHeaders() }),
      axios.get(`${API}/api/trips/${tripId}/invitations`, { headers: authHeaders() }),
    ])
      .then(([m, i]) => {
        if (cancelled) return;
        setMembers(m.data || []);
        setInvitations(i.data || []);
        manageStale.current = false;
      })
      .catch((error) => {
        if (!cancelled) setManageError(errorText(error, 'Không tải được danh sách bạn đồng hành.'));
      })
      .finally(() => {
        if (!cancelled) setManageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, initialView]);

  const openManage = () => {
    setView('manage');
    setNotice(null);
    setConfirmRemoveId(null);
    if (manageStale.current) loadManage();
  };

  const runAction = async (key, action, failText) => {
    if (busyKey) return;
    setBusyKey(key);
    setManageError('');
    try {
      await action();
    } catch (error) {
      setManageError(errorText(error, failText));
    } finally {
      setBusyKey('');
    }
  };

  const changeMemberRole = (member, newRole) =>
    runAction(`m${member.memberId}`, async () => {
      const res = await axios.patch(
        `${API}/api/trips/${tripId}/members/${member.memberId}`,
        { role: newRole },
        { headers: authHeaders() }
      );
      setMembers((prev) => prev.map((x) => (x.memberId === member.memberId ? res.data : x)));
      onChanged?.();
    }, 'Không đổi được quyền.');

  const removeMember = (member) =>
    runAction(`m${member.memberId}`, async () => {
      await axios.delete(`${API}/api/trips/${tripId}/members/${member.memberId}`, { headers: authHeaders() });
      setMembers((prev) => prev.filter((x) => x.memberId !== member.memberId));
      setConfirmRemoveId(null);
      onChanged?.();
    }, 'Không xóa được thành viên.');

  const resendInvitation = (inv) =>
    runAction(`i${inv.id}`, async () => {
      const res = await axios.post(`${API}/api/trips/${tripId}/invitations/${inv.id}/resend`, {}, { headers: authHeaders() });
      setInvitations((prev) => prev.map((x) => (x.id === inv.id ? res.data : x)));
    }, 'Không gửi lại được lời mời.');

  const revokeInvitation = (inv) =>
    runAction(`i${inv.id}`, async () => {
      await axios.delete(`${API}/api/trips/${tripId}/invitations/${inv.id}`, { headers: authHeaders() });
      setInvitations((prev) => prev.filter((x) => x.id !== inv.id));
    }, 'Không thu hồi được lời mời.');

  // ---------- Giao diện ----------
  const roleHint =
    role === 'EDITOR'
      ? 'Ai có link (và đăng nhập) sẽ xem và chỉnh sửa được chuyến đi.'
      : 'Ai có link (và đăng nhập) chỉ xem được chuyến đi, không chỉnh sửa.';

  return (
    <div
      className="tp-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </button>

        {view === 'share' ? (
          <>
            <h2 id="share-modal-title" className="px-8 text-center text-xl font-extrabold text-slate-900">
              Mời bạn đồng hành
            </h2>
            <p className="mt-1 line-clamp-1 px-8 text-center text-xs text-slate-400">{trip.title}</p>

            {/* ----- Quyền ----- */}
            <div className="mt-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Quyền của người được mời">
              {ROLE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={role === tab.value}
                  onClick={() => {
                    setRole(tab.value);
                    setConfirmReset(false);
                    setCopied(false);
                  }}
                  className={`rounded-lg py-2 text-sm font-semibold transition-all ${
                    role === tab.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ----- Link ----- */}
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 p-1.5 pl-3">
              <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
              {linkError ? (
                <button
                  type="button"
                  onClick={retryLinks}
                  className="min-w-0 flex-1 truncate text-left text-sm text-red-600 hover:underline"
                >
                  {linkError} Bấm để thử lại.
                </button>
              ) : !links ? (
                <span className="flex flex-1 items-center gap-2 text-sm text-slate-400" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo link...
                </span>
              ) : (
                <input
                  readOnly
                  value={shareUrl}
                  aria-label="Link chia sẻ"
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"
                />
              )}
              <button
                type="button"
                onClick={handleCopy}
                disabled={!shareUrl}
                className="tp-btn-primary flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Đã sao chép' : 'Sao chép link'}
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{roleHint}</p>

            {links &&
              (confirmReset ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span className="flex-1">Link cũ sẽ ngừng hoạt động. Người đã tham gia không bị ảnh hưởng.</span>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={resetting}
                    className="rounded-md bg-amber-600 px-2.5 py-1 font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {resetting ? 'Đang tạo...' : 'Tạo link mới'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    disabled={resetting}
                    className="font-semibold text-amber-800 hover:underline"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600"
                >
                  <RefreshCw className="h-3 w-3" /> Tạo link mới
                </button>
              ))}

            {/* ----- Mời bằng email hoặc người dùng ----- */}
            <div className="relative mt-4">
              <div className="flex min-h-[3rem] flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 focus-within:ring-2 focus-within:ring-[#FF5645]/40">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                {chips.map((c) => (
                  <span
                    key={c.key}
                    className="flex max-w-full items-center gap-1.5 rounded-full bg-white py-0.5 pl-1 pr-1.5 text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    {c.type === 'user' ? <Avatar src={c.avatar} name={c.label} size="h-5 w-5" /> : <Mail className="ml-1 h-3 w-3 text-slate-400" />}
                    <span className="truncate">{c.label}</span>
                    <button
                      type="button"
                      onClick={() => removeChip(c.key)}
                      aria-label={`Bỏ ${c.label}`}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setInputError('');
                  }}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder={chips.length ? '' : 'Mời bằng email hoặc tên người dùng'}
                  aria-label="Mời bằng email hoặc tên người dùng"
                  autoComplete="off"
                  className="min-w-[8rem] flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
              </div>

              {visibleSuggestions.length > 0 && (
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-100 bg-white py-1 shadow-lg"
                >
                  {visibleSuggestions.map((u, index) => (
                    <li key={u.id} role="option" aria-selected={index === highlight}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addUser(u)}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${
                          index === highlight ? 'bg-slate-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <Avatar src={u.avatar} name={u.fullName || u.username} size="h-8 w-8" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800">{u.fullName || u.username}</span>
                          <span className="block truncate text-xs text-slate-400">@{u.username}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {inputError && (
              <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
                {inputError}
              </p>
            )}

            {(chips.length > 0 || text.includes('@')) && (
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviting}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {inviting ? 'Đang gửi...' : `Gửi lời mời (${role === 'EDITOR' ? 'có thể chỉnh sửa' : 'chỉ xem'})`}
              </button>
            )}

            {notice && (
              <p
                role={notice.type === 'error' ? 'alert' : 'status'}
                className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                  notice.type === 'error' ? 'border border-red-200 bg-red-50 text-red-600' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {notice.text}
              </p>
            )}

            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={openManage}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-slate-800"
              >
                <Users className="h-4 w-4" /> Quản lý bạn đồng hành
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 pr-10">
              <button
                type="button"
                onClick={() => setView('share')}
                aria-label="Quay lại"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h2 id="share-modal-title" className="text-lg font-extrabold text-slate-900">
                Quản lý bạn đồng hành
              </h2>
            </div>

            {manageError && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {manageError}
              </p>
            )}

            {manageLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
                <Loader2 className="h-5 w-5 animate-spin text-[#FF5645]" /> Đang tải...
              </div>
            ) : (
              <>
                <ul className="mt-4 divide-y divide-slate-100">
                  {members.map((m) => (
                    <li key={m.owner ? 'owner' : m.memberId} className="flex items-center gap-3 py-2.5">
                      <Avatar src={m.avatar} name={m.fullName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{m.fullName}</p>
                        <p className="truncate text-xs text-slate-400">@{m.username}</p>
                      </div>
                      {m.owner ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                          {ROLE_LABEL.OWNER}
                        </span>
                      ) : confirmRemoveId === m.memberId ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => removeMember(m)}
                            disabled={busyKey === `m${m.memberId}`}
                            className="rounded-md bg-red-600 px-2.5 py-1 font-bold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            Xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(null)}
                            className="font-semibold text-slate-500 hover:underline"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={m.role}
                            onChange={(e) => changeMemberRole(m, e.target.value)}
                            disabled={busyKey === `m${m.memberId}`}
                            aria-label={`Quyền của ${m.fullName}`}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#FF5645] disabled:opacity-60"
                          >
                            {ROLE_TABS.map((tab) => (
                              <option key={tab.value} value={tab.value}>
                                {tab.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(m.memberId)}
                            aria-label={`Xóa ${m.fullName} khỏi chuyến đi`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                {members.length <= 1 && (
                  <p className="mt-2 text-sm text-slate-500">Chưa có bạn đồng hành nào. Hãy gửi link hoặc lời mời.</p>
                )}

                {invitations.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-xs font-bold text-slate-400">Lời mời đang chờ</h3>
                    <ul className="mt-1 divide-y divide-slate-100">
                      {invitations.map((inv) => (
                        <li key={inv.id} className="flex items-center gap-3 py-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{inv.email}</p>
                            <p className="text-xs text-slate-400">
                              {ROLE_LABEL[inv.role] || inv.role} · {inv.status === 'EXPIRED' ? 'Đã hết hạn' : 'Chưa phản hồi'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => resendInvitation(inv)}
                            disabled={busyKey === `i${inv.id}`}
                            className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          >
                            Gửi lại
                          </button>
                          <button
                            type="button"
                            onClick={() => revokeInvitation(inv)}
                            disabled={busyKey === `i${inv.id}`}
                            aria-label={`Thu hồi lời mời ${inv.email}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ShareTripModal;
