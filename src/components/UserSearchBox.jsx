import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search } from 'lucide-react';

const API_BASE = 'http://localhost:8080';

const UserSearchBox = () => {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchedQuery, setSearchedQuery] = useState(''); // từ khóa của kết quả đang hiển thị
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Từ khóa đã chuẩn hóa: bỏ khoảng trắng và dấu @ ở đầu
  const keyword = query.trim().replace(/^@+/, '');
  const isLoggedIn = Boolean(localStorage.getItem('token'));

  // Gọi API sau khi người dùng ngừng gõ 300ms
  useEffect(() => {
    if (!keyword) {
      setResults([]);
      setSearchedQuery('');
      setError('');
      setLoading(false);
      return undefined;
    }

    const token = localStorage.getItem('token');
    if (!token) return undefined; // chưa đăng nhập: hiển thị lời nhắc đăng nhập

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await axios.get(`${API_BASE}/api/search/users`, {
          params: { q: keyword, limit: 8 },
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        setResults(Array.isArray(res.data) ? res.data : []);
        setSearchedQuery(keyword);
        setActiveIndex(-1);
        setLoading(false);
      } catch (err) {
        if (axios.isCancel(err) || err.code === 'ERR_CANCELED') return; // request cũ bị hủy
        console.error('Lỗi tìm kiếm người dùng:', err);
        setResults([]);
        setError(
          err.response?.status === 401
            ? 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.'
            : 'Không thể tìm kiếm lúc này, vui lòng thử lại.'
        );
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [keyword]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const onMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const goToProfile = (username) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    navigate(`/profile/${username}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (results.length === 0) return;
    const target = results[activeIndex >= 0 ? activeIndex : 0];
    goToProfile(target.username);
  };

  const showDropdown = open && keyword.length > 0;
  const hasFreshResults = searchedQuery === keyword;

  return (
    <div ref={wrapperRef} className="relative hidden max-w-md flex-1 md:block">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 transition-colors focus-within:border-[#FF5645] focus-within:bg-white"
      >
        <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search users by username..."
          autoComplete="off"
          maxLength={30}
          aria-label="Tìm người dùng theo username"
          className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
        />
        {loading && (
          <span className="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF5645]" />
        )}
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-2xl border border-slate-100 bg-white py-2 shadow-xl">
          {!isLoggedIn ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              <Link to="/login" className="font-bold text-[#FF5645] hover:underline">
                Đăng nhập
              </Link>{' '}
              để tìm kiếm người dùng.
            </p>
          ) : error ? (
            <p className="px-4 py-3 text-sm text-rose-600">{error}</p>
          ) : !hasFreshResults ? (
            <p className="px-4 py-3 text-sm text-slate-400">Đang tìm...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              Không tìm thấy người dùng nào cho &ldquo;{keyword}&rdquo;.
            </p>
          ) : (
            <ul role="listbox">
              {results.map((u, index) => (
                <li key={u.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    onClick={() => goToProfile(u.username)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      index === activeIndex ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      {u.avatar ? (
                        <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (u.fullName || u.username).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-900">{u.fullName}</div>
                      <div className="truncate text-xs text-slate-500">@{u.username}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default UserSearchBox;