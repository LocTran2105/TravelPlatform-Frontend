import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Share2, Trash2, Check } from 'lucide-react';
import TripCoverImage from './TripCoverImage';
import { VISIBILITY_OPTIONS, visibilityInfo, formatDateRange, countPlaces } from '../utils/trips';

const MENU_WIDTH = 272;
const MENU_EST_HEIGHT = 330;

/**
 * Menu 3 chấm. Vẽ bằng portal + vị trí cố định để không bị khung ảnh (overflow-hidden) cắt mất.
 * Đóng khi bấm ra ngoài, nhấn Esc, cuộn trang hoặc đổi cỡ cửa sổ.
 */
function TripCardMenu({ anchor, current, busy, onClose, onPickVisibility, onDelete }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (ev) => { if (ref.current && !ref.current.contains(ev.target)) onClose(); };
    const onKey = (ev) => { if (ev.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    // Cuộn trang thì đóng menu; cuộn bên trong menu thì giữ nguyên
    const onScroll = (ev) => { if (!(ref.current && ref.current.contains(ev.target))) onClose(); };
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min(anchor.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
  const below = anchor.bottom + 6;
  const top = below + MENU_EST_HEIGHT > window.innerHeight ? Math.max(8, anchor.top - 6 - MENU_EST_HEIGHT) : below;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="Tùy chọn chuyến đi"
      onClick={(ev) => ev.stopPropagation()}
      style={{ position: 'fixed', top, left, width: MENU_WIDTH, maxHeight: window.innerHeight - 16 }}
      className="z-[2500] overflow-y-auto rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl"
    >
      <p className="px-3.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Ai được xem chuyến đi này</p>
      {VISIBILITY_OPTIONS.map(({ value, label, desc, Icon }) => {
        const selected = value === current;
        return (
          <button
            key={value}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            disabled={busy}
            onClick={() => onPickVisibility(value)}
            className={`flex w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 ${selected ? 'bg-red-50/60' : ''}`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-[#FF5645] text-white' : 'bg-slate-100 text-slate-500'}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-slate-800">{label}</span>
              <span className="block truncate text-xs text-slate-500">{desc}</span>
            </span>
            {selected && <Check className="h-4 w-4 shrink-0 text-[#FF5645]" />}
          </button>
        );
      })}
      <div className="my-1.5 border-t border-slate-100" />
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        onClick={onDelete}
        className="flex w-full items-center gap-3 px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50"><Trash2 className="h-4 w-4" /></span>
        Xóa chuyến đi
      </button>
    </div>,
    document.body
  );
}

/**
 * Thẻ chuyến đi dùng chung cho Trang chủ và Trang cá nhân.
 *   canManage     : chủ chuyến đi -> có nút Chia sẻ + menu 3 chấm (đổi quyền hiển thị, xóa) và nhãn quyền xem
 *   roleLabel     : nhãn cho tripmate ("Bạn đồng hành" / "Chỉ xem"), chỉ hiện khi không phải chủ
 *   ownerInitial  : chữ cái đầu của chủ chuyến đi (avatar nhỏ)
 *   busy          : 'delete' | 'visibility' | null  (thao tác đang chạy trên thẻ này)
 */
export default function TripCard({
  trip,
  canManage = false,
  roleLabel = null,
  ownerInitial = '',
  busy = null,
  onOpen,
  onShare,
  onChangeVisibility,
  onDelete,
}) {
  const [anchor, setAnchor] = useState(null);
  const menuOpen = anchor !== null;
  const info = visibilityInfo(trip.visibility);
  const VisIcon = info.Icon;
  const places = countPlaces(trip);

  const openMenu = (ev) => {
    ev.stopPropagation();
    if (menuOpen) { setAnchor(null); return; }
    const r = ev.currentTarget.getBoundingClientRect();
    setAnchor({ top: r.top, bottom: r.bottom, right: r.right });
  };
  const closeMenu = () => setAnchor(null);

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Mở chuyến đi ${trip.title}`}
      onClick={onOpen}
      onKeyDown={(ev) => { if (ev.key === 'Enter' && ev.target === ev.currentTarget) onOpen(); }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white outline-none transition-all hover:border-slate-200 hover:shadow-xl hover:shadow-slate-200/50 focus-visible:ring-2 focus-visible:ring-[#FF5645]"
    >
      {/* Ảnh bìa */}
      <div className="relative h-36 w-full overflow-hidden bg-slate-200 sm:h-44">
        <TripCoverImage
          trip={trip}
          width={800}
          height={480}
          className="transition-transform duration-500 group-hover:scale-105"
        />

        {canManage ? (
          <div
            className={`absolute inset-0 flex items-start justify-end gap-2 bg-black/20 p-3 transition-opacity group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 ${
              menuOpen || busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={(ev) => { ev.stopPropagation(); closeMenu(); onShare(); }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-[#FF5645]"
              title="Chia sẻ chuyến đi"
              aria-label="Chia sẻ chuyến đi"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={openMenu}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
              title="Tùy chọn"
              aria-label="Tùy chọn chuyến đi"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        ) : roleLabel ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm backdrop-blur">
            {roleLabel}
          </span>
        ) : null}
      </div>

      {/* Nội dung */}
      <div className="p-4">
        <h3 className="mb-1 line-clamp-1 text-base font-extrabold text-slate-900 transition-colors group-hover:text-[#FF5645]">
          {trip.title}
        </h3>
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
            {(ownerInitial || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex items-center whitespace-nowrap text-xs font-medium text-slate-500">
            <span>• {formatDateRange(trip.startDate, trip.endDate)}</span>
            <span className="mx-1.5">•</span>
            <span>{places} địa điểm</span>
          </div>
        </div>
        {canManage && (
          <div className="mt-3">
            <span
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
              title={`Quyền xem: ${info.label}`}
            >
              <VisIcon className="h-3 w-3" />
              {busy === 'visibility' ? 'Đang cập nhật...' : info.label}
            </span>
          </div>
        )}
      </div>

      {menuOpen && (
        <TripCardMenu
          anchor={anchor}
          current={trip.visibility || 'PRIVATE'}
          busy={Boolean(busy)}
          onClose={closeMenu}
          onPickVisibility={(value) => { closeMenu(); onChangeVisibility(value); }}
          onDelete={() => { closeMenu(); onDelete(); }}
        />
      )}
    </div>
  );
}
