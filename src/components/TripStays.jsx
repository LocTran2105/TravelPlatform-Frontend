import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { BedDouble, CalendarDays, MapPin, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { searchPlaces } from '../utils/placeSearch';
import { toast } from '../utils/toast';

// Mục "Nơi ở" của chuyến đi: khách sạn/homestay theo từng khoảng đêm, tách khỏi các điểm đi chơi trong ngày.
// Nơi ở là điểm xuất phát/kết thúc mỗi ngày khi tối ưu lộ trình, và là mốc khi AI gợi ý ngày hôm sau.

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const apiError = (e, fallback) => (typeof e?.response?.data === 'string' && e.response.data ? e.response.data : fallback);

const toInputDate = (value) => (value ? String(value).slice(0, 10) : '');
const addDays = (iso, n) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shortDate = (iso) => {
  if (!iso) return '';
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
};

const emptyForm = (trip, stays) => {
  // Mặc định nối tiếp nơi ở cuối cùng, hoặc cả chuyến đi.
  const last = stays[stays.length - 1];
  const checkIn = last ? toInputDate(last.checkOutDate) : toInputDate(trip?.startDate);
  const end = toInputDate(trip?.endDate);
  const checkOut = end && end > checkIn ? end : addDays(checkIn, 1);
  return { id: null, place: null, name: '', address: '', checkInDate: checkIn, checkOutDate: checkOut, note: '' };
};

const TripStays = ({ trip, stays, canEdit, onChanged, legacyAccommodations = [] }) => {
  const [form, setForm] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const searchBoxRef = useRef(null);

  // Tìm địa điểm (DB trước, Photon sau) giống ô thêm địa điểm của lịch trình.
  useEffect(() => {
    const q = query.trim();
    if (!form || q.length < 2 || (form.place && q === form.place.name)) return undefined;
    const controller = new AbortController();
    const anchorStay = stays.find((s) => s.latitude != null);
    const anchorDest = (trip?.tripDays || []).flatMap((d) => d.destinations || [])
      .find((d) => d.latitude != null && d.longitude != null);
    const anchor = anchorStay ? { lat: Number(anchorStay.latitude), lng: Number(anchorStay.longitude) }
      : anchorDest ? { lat: Number(anchorDest.latitude), lng: Number(anchorDest.longitude) } : null;
    const timer = setTimeout(() => {
      searchPlaces({ q, destination: trip?.destination || '', anchor, signal: controller.signal })
        .then((list) => { if (!controller.signal.aborted) setResults(list); })
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, form?.place, trip?.destination]);

  const openNew = () => { setForm(emptyForm(trip, stays)); setQuery(''); setResults([]); };
  const openEdit = (stay) => {
    setForm({
      id: stay.id,
      place: stay.latitude != null ? { placeId: stay.placeId, name: stay.name, lat: Number(stay.latitude), lon: Number(stay.longitude) } : null,
      name: stay.name,
      address: stay.address || '',
      checkInDate: toInputDate(stay.checkInDate),
      checkOutDate: toInputDate(stay.checkOutDate),
      note: stay.note || '',
    });
    setQuery(stay.name);
    setResults([]);
  };
  const close = () => { setForm(null); setQuery(''); setResults([]); };

  const pick = (place) => {
    setForm((f) => ({ ...f, place, name: place.name, address: place.address || '' }));
    setQuery(place.name);
    setResults([]);
  };

  const save = async () => {
    if (!form) return;
    if (!form.place) { toast.error('Hãy chọn nơi ở từ kết quả tìm kiếm để có vị trí trên bản đồ.'); return; }
    if (!form.checkInDate || !form.checkOutDate || form.checkOutDate <= form.checkInDate) {
      toast.error('Ngày trả phòng phải sau ngày nhận phòng.');
      return;
    }
    const body = {
      placeId: form.place.placeId ?? null, // chỉ kết quả từ DB mới có placeId
      name: form.name.trim() || form.place.name,
      address: form.address || null,
      latitude: form.place.lat,
      longitude: form.place.lon,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      note: form.note.trim() || null,
    };
    setSaving(true);
    try {
      if (form.id) {
        await axios.put(`${API_BASE_URL}/api/trips/${trip.id}/stays/${form.id}`, body, { headers: authHeaders() });
        toast.success('Đã cập nhật nơi ở.');
      } else {
        await axios.post(`${API_BASE_URL}/api/trips/${trip.id}/stays`, body, { headers: authHeaders() });
        toast.success(`Đã thêm "${body.name}" vào Nơi ở.`);
      }
      close();
      onChanged?.();
    } catch (e) {
      toast.error(apiError(e, 'Không lưu được nơi ở.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (stay) => {
    if (!window.confirm(`Xóa "${stay.name}" khỏi Nơi ở?`)) return;
    setDeletingId(stay.id);
    try {
      await axios.delete(`${API_BASE_URL}/api/trips/${trip.id}/stays/${stay.id}`, { headers: authHeaders() });
      onChanged?.();
    } catch (e) {
      toast.error(apiError(e, 'Không xóa được nơi ở.'));
    } finally {
      setDeletingId(null);
    }
  };

  // Dùng điểm lưu trú cũ trong lịch trình làm nơi ở (chỉ gợi ý; điểm trong ngày vẫn giữ nguyên).
  const adoptLegacy = (item) => {
    const dest = item.dest;
    const checkIn = toInputDate(item.dayDate) || toInputDate(trip?.startDate);
    setForm({
      id: null,
      place: { placeId: dest.place?.id ?? null, source: dest.place?.id ? 'db' : 'photon', name: dest.placeName, lat: Number(dest.latitude), lon: Number(dest.longitude) },
      name: dest.placeName,
      address: dest.place?.address || '',
      checkInDate: checkIn,
      checkOutDate: toInputDate(trip?.endDate) > checkIn ? toInputDate(trip?.endDate) : addDays(checkIn, 1),
      note: '',
    });
    setQuery(dest.placeName);
    setResults([]);
  };
  const legacyNotAdopted = legacyAccommodations.filter((item) =>
    !stays.some((s) => s.name?.trim().toLowerCase() === item.dest.placeName?.trim().toLowerCase()));

  return (
    <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <BedDouble className="h-5 w-5 text-indigo-500" /> Nơi ở
          </h3>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Khách sạn/homestay mỗi đêm. Lộ trình mỗi ngày sẽ xuất phát và trở về đây khi tối ưu.
          </p>
        </div>
        {canEdit && !form && (
          <button type="button" onClick={openNew}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600">
            <Plus className="h-4 w-4" /> Thêm nơi ở
          </button>
        )}
      </div>

      {stays.length === 0 && !form && (
        <p className="mt-4 rounded-2xl border-2 border-dashed border-slate-100 px-4 py-4 text-center text-sm font-medium text-slate-400">
          Chưa có nơi ở. Thêm khách sạn/homestay để AI xếp lộ trình từ chỗ bạn ở.
        </p>
      )}

      {stays.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {stays.map((stay) => (
            <li key={stay.id} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <BedDouble className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-slate-800">{stay.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />
                    {shortDate(stay.checkInDate)} → {shortDate(stay.checkOutDate)} · {stay.nights} đêm</span>
                  {stay.address && <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" />{stay.address}</span>}
                </p>
                {stay.latitude == null && <p className="mt-1 text-xs font-semibold text-amber-600">Chưa có vị trí, không dùng được khi tối ưu lộ trình.</p>}
                {stay.note && <p className="mt-1 text-xs text-slate-500">{stay.note}</p>}
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => openEdit(stay)} aria-label="Sửa nơi ở"
                    className="rounded-full p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => remove(stay)} disabled={deletingId === stay.id} aria-label="Xóa nơi ở"
                    className="rounded-full p-1.5 text-slate-400 transition hover:bg-white hover:text-rose-600 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && !form && legacyNotAdopted.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          <p className="font-bold">Lịch trình đang có chỗ ở nằm lẫn trong các ngày:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {legacyNotAdopted.slice(0, 4).map((item) => (
              <button key={item.dest.id} type="button" onClick={() => adoptLegacy(item)}
                className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200 transition hover:bg-amber-100">
                Dùng “{item.dest.placeName}” (Ngày {item.dayNumber}) làm nơi ở
              </button>
            ))}
          </div>
        </div>
      )}

      {form && (
        <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">{form.id ? 'Sửa nơi ở' : 'Thêm nơi ở'}</p>
            <button type="button" onClick={close} aria-label="Đóng" className="rounded-full p-1 text-slate-400 hover:bg-white"><X className="h-4 w-4" /></button>
          </div>

          <div ref={searchBoxRef} className="relative mt-3">
            <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-indigo-400">
              <Search className="mr-2 h-4 w-4 text-slate-400" />
              <input type="text" autoFocus value={query}
                onChange={(e) => { setQuery(e.target.value); setForm((f) => ({ ...f, place: null })); }}
                placeholder="Tìm khách sạn, homestay, resort…"
                className="flex-1 bg-transparent text-sm font-medium outline-none" />
            </div>
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                {results.map((place) => (
                  <button key={place.key} type="button" onClick={() => pick(place)}
                    className="flex w-full items-start gap-2.5 border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-indigo-50">
                    <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${place.source === 'db' ? 'text-emerald-600' : 'text-indigo-500'}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800">{place.name}</span>
                      {place.address && <span className="block truncate text-xs text-slate-500">{place.address}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {form.place && <p className="mt-1.5 text-xs font-semibold text-emerald-600">Đã chọn vị trí: {form.place.name}</p>}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-slate-500">Nhận phòng
              <input type="date" value={form.checkInDate} onChange={(e) => setForm((f) => ({ ...f, checkInDate: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400" />
            </label>
            <label className="text-xs font-bold text-slate-500">Trả phòng
              <input type="date" value={form.checkOutDate} min={form.checkInDate ? addDays(form.checkInDate, 1) : undefined}
                onChange={(e) => setForm((f) => ({ ...f, checkOutDate: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-400" />
            </label>
          </div>
          <input type="text" value={form.note} maxLength={500} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Ghi chú (mã đặt phòng, giờ nhận phòng…)"
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400" />

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={close} className="rounded-full px-4 py-2 text-sm font-bold text-slate-500 hover:bg-white">Hủy</button>
            <button type="button" onClick={save} disabled={saving} className="tp-btn-primary px-5 py-2 text-sm disabled:opacity-60">
              {saving ? 'Đang lưu…' : form.id ? 'Lưu' : 'Thêm nơi ở'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripStays;
