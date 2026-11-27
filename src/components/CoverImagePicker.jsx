import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { X, Search, Check, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cloudinaryResize, normalizeText } from '../utils/cover';
import { API_BASE_URL } from '../config/api';

const API = API_BASE_URL;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

function apiError(e, fallback) {
  const data = e?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data.message === 'string' && data.message.trim()) return data.message;
  if (e?.response?.status === 413) return 'Ảnh quá lớn. Tối đa 5MB.';
  return fallback;
}

/**
 * Hộp thoại đổi ảnh bìa: chọn từ thư viện của hệ thống hoặc tải ảnh của riêng mình.
 *   tripId     : id chuyến đi
 *   currentUrl : ảnh bìa riêng hiện tại (trip.coverImageUrl), null nếu đang dùng ảnh gợi ý
 *   onChanged  : ({ coverImageUrl, suggestedCoverUrl }) => void, gọi sau khi lưu thành công
 *   onClose    : () => void
 */
export default function CoverImagePicker({ tripId, currentUrl, onChanged, onClose }) {
  const [tab, setTab] = useState('library'); // 'library' | 'upload'
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [percent, setPercent] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Tải thư viện ảnh
  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem('token');
    axios
      .get(`${API}/api/cover-images`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => { if (alive) setImages(Array.isArray(res.data) ? res.data : []); })
      .catch((e) => { if (alive) setLoadError(apiError(e, 'Không tải được thư viện ảnh.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Esc để đóng (không đóng khi đang tải lên)
  useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  // Giải phóng URL xem trước khi đóng hộp thoại
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const visibleImages = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return images;
    return images.filter((img) => normalizeText(`${img.title} ${img.keywords || ''}`).includes(q));
  }, [images, query]);

  const currentLibraryId = useMemo(
    () => images.find((img) => img.imageUrl === currentUrl)?.id ?? null,
    [images, currentUrl]
  );

  const pickFile = (f) => {
    setError('');
    if (!f) return;
    if (!ALLOWED.includes(f.type)) { setError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.'); return; }
    if (f.size > MAX_BYTES) { setError('Ảnh quá lớn. Tối đa 5MB.'); return; }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(f);
    previewRef.current = url;
    setFile(f);
    setPreview(url);
    setPercent(0);
  };

  const finish = (data) => {
    onChanged({ coverImageUrl: data?.coverImageUrl ?? null, suggestedCoverUrl: data?.suggestedCoverUrl ?? null });
    onClose();
  };

  const saveLibrary = async () => {
    if (!selectedId || busy) return;
    try {
      setBusy(true); setError('');
      const token = localStorage.getItem('token');
      const res = await axios.put(`${API}/api/trips/${tripId}/cover`, { coverImageId: selectedId },
        { headers: { Authorization: `Bearer ${token}` } });
      finish(res.data);
    } catch (e) {
      setError(apiError(e, 'Không đổi được ảnh bìa. Vui lòng thử lại!'));
      setBusy(false);
    }
  };

  const saveUpload = async () => {
    if (!file || busy) return;
    try {
      setBusy(true); setError(''); setPercent(0);
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post(`${API}/api/trips/${tripId}/cover/upload`, form, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (ev) => { if (ev.total) setPercent(Math.round((ev.loaded * 100) / ev.total)); },
      });
      finish(res.data);
    } catch (e) {
      setError(apiError(e, 'Không tải được ảnh lên. Vui lòng thử lại!'));
      setBusy(false);
    }
  };

  const removeCover = async () => {
    if (busy) return;
    try {
      setBusy(true); setError('');
      const token = localStorage.getItem('token');
      const res = await axios.delete(`${API}/api/trips/${tripId}/cover`, { headers: { Authorization: `Bearer ${token}` } });
      finish(res.data);
    } catch (e) {
      setError(apiError(e, 'Không gỡ được ảnh bìa. Vui lòng thử lại!'));
      setBusy(false);
    }
  };

  const tabBtn = (id, label, Icon) => (
    <button
      type="button"
      onClick={() => { if (!busy) { setTab(id); setError(''); } }}
      className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
        tab === id ? 'border-[#FF5645] text-[#FF5645]' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/60 p-4"
      onMouseDown={(ev) => { if (ev.target === ev.currentTarget && !busy) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Đổi ảnh bìa"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-extrabold text-slate-900">Đổi ảnh bìa</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-3">
          {tabBtn('library', 'Thư viện ảnh', ImageIcon)}
          {tabBtn('upload', 'Tải ảnh của bạn', Upload)}
        </div>

        <div className="min-h-[22rem] flex-1 overflow-y-auto p-5">
          {tab === 'library' && (
            <>
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(ev) => setQuery(ev.target.value)}
                  placeholder="Tìm theo điểm đến, ví dụ: Đà Lạt"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#FF5645] focus:ring-2 focus:ring-[#FF5645]/20"
                />
              </div>

              {loading && (
                <div className="flex items-center justify-center py-16 text-sm font-medium text-slate-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải thư viện ảnh...
                </div>
              )}
              {!loading && loadError && (
                <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{loadError}</p>
              )}
              {!loading && !loadError && images.length === 0 && (
                <p className="py-16 text-center text-sm font-medium text-slate-400">Thư viện chưa có ảnh nào. Bạn vẫn có thể tải ảnh của mình lên.</p>
              )}
              {!loading && !loadError && images.length > 0 && visibleImages.length === 0 && (
                <p className="py-16 text-center text-sm font-medium text-slate-400">Không có ảnh nào khớp “{query}”.</p>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {visibleImages.map((img) => {
                  const selected = selectedId === img.id;
                  const inUse = currentLibraryId === img.id;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setSelectedId(img.id)}
                      aria-pressed={selected}
                      title={img.title}
                      className={`group relative aspect-[3/2] overflow-hidden rounded-xl bg-slate-100 outline-none ring-offset-2 transition-all focus-visible:ring-2 focus-visible:ring-[#FF5645] ${
                        selected ? 'ring-2 ring-[#FF5645]' : 'hover:ring-2 hover:ring-slate-300'
                      }`}
                    >
                      <img
                        src={cloudinaryResize(img.imageUrl, 400, 267)}
                        alt={img.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 text-left text-xs font-bold text-white">
                        {img.title}
                      </span>
                      {inUse && (
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700">Đang dùng</span>
                      )}
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#FF5645] text-white shadow">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(ev) => { pickFile(ev.target.files?.[0]); ev.target.value = ''; }}
              />
              {!preview ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(ev) => { ev.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(ev) => { ev.preventDefault(); setDragOver(false); pickFile(ev.dataTransfer.files?.[0]); }}
                  className={`flex h-64 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-slate-500 transition-colors ${
                    dragOver ? 'border-[#FF5645] bg-[#FF5645]/5' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <Upload className="h-8 w-8" />
                  <span className="text-sm font-bold text-slate-700">Bấm để chọn ảnh hoặc kéo thả vào đây</span>
                  <span className="text-xs font-medium text-slate-400">JPG, PNG hoặc WEBP · tối đa 5MB</span>
                </button>
              ) : (
                <div>
                  <div className="aspect-[16/6] w-full overflow-hidden rounded-2xl bg-slate-100">
                    <img src={preview} alt="Xem trước ảnh bìa" className="h-full w-full object-cover" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-slate-600">{file?.name}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 font-bold text-[#FF5645] hover:underline disabled:opacity-50"
                    >
                      Chọn ảnh khác
                    </button>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-400">Ảnh sẽ được cắt giữa để vừa khung bìa.</p>
                  {busy && percent > 0 && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-[#FF5645] transition-all" style={{ width: `${percent}%` }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3.5">
          {currentUrl ? (
            <button
              type="button"
              onClick={removeCover}
              disabled={busy}
              className="text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50"
              title="Bỏ ảnh đã chọn, dùng ảnh gợi ý theo điểm đến"
            >
              Dùng ảnh gợi ý tự động
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
            >
              Hủy
            </button>
            {tab === 'library' ? (
              <button
                type="button"
                onClick={saveLibrary}
                disabled={!selectedId || busy}
                className="flex items-center gap-1.5 rounded-full bg-[#FF5645] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#E04B3B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Dùng ảnh này
              </button>
            ) : (
              <button
                type="button"
                onClick={saveUpload}
                disabled={!file || busy}
                className="flex items-center gap-1.5 rounded-full bg-[#FF5645] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#E04B3B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? (percent > 0 && percent < 100 ? `Đang tải ${percent}%` : 'Đang xử lý...') : 'Tải lên và dùng làm bìa'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
