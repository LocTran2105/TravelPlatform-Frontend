import { useState } from 'react';
import {
  BadgeCheck, Clock, ChevronDown, Phone, Globe, MapPin, Lightbulb, Wallet, AlertTriangle, Mail, Info,
} from 'lucide-react';
import { DAY_LABELS, formatDayHours, isoWeekday, openStatusOf, PRICE_LEVEL_LABELS } from '../utils/openingHours';

// Thông tin do Partner cung cấp và Admin đã duyệt, hiển thị trong tab "Giới thiệu" của panel địa điểm.

const NOTE_STYLES = {
  PRICE_INFO: { icon: Wallet, className: 'bg-emerald-50 border-emerald-100 text-emerald-900', iconClass: 'text-emerald-600' },
  TRAVEL_TIP: { icon: Lightbulb, className: 'bg-amber-50 border-amber-100 text-amber-900', iconClass: 'text-amber-600' },
  ACCESS: { icon: MapPin, className: 'bg-sky-50 border-sky-100 text-sky-900', iconClass: 'text-sky-600' },
  IMPORTANT: { icon: AlertTriangle, className: 'bg-rose-50 border-rose-100 text-rose-900', iconClass: 'text-rose-600' },
};

const safeUrl = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
};

const PartnerPlaceDetails = ({ profile, gallery }) => {
  const [showWeek, setShowWeek] = useState(false);
  const today = isoWeekday(new Date());
  const status = openStatusOf(profile);
  const todayHours = formatDayHours(profile.hours, today);
  const hasHours = (profile.hours || []).length > 0;
  const fullAddress = [profile.address, profile.ward, profile.city, profile.province].filter(Boolean).join(', ');
  const links = [
    { label: 'Website', url: safeUrl(profile.websiteUrl) },
    { label: 'Facebook', url: safeUrl(profile.facebookUrl) },
    { label: 'Instagram', url: safeUrl(profile.instagramUrl) },
  ].filter(l => l.url);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-3.5 py-2.5 text-[13px] text-sky-900">
        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <span>Thông tin do chủ địa điểm cung cấp và đã được quản trị viên xác minh.</span>
      </div>

      {gallery}

      {(profile.shortDescription || profile.description) && (
        <div className="space-y-2">
          {profile.shortDescription && <p className="text-[15px] font-semibold leading-relaxed text-slate-800">{profile.shortDescription}</p>}
          {profile.description && <p className="text-[14px] leading-relaxed text-slate-600">{profile.description}</p>}
        </div>
      )}

      {/* Giờ mở cửa */}
      {(hasHours || status) && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => hasHours && setShowWeek(v => !v)}
            className="flex w-full items-center gap-2 text-left"
            aria-expanded={showWeek}
          >
            <Clock className="h-4 w-4 shrink-0 text-slate-500" />
            {status && (
              <span className={`text-sm font-bold ${status.open ? 'text-emerald-600' : 'text-rose-600'}`}>{status.label}</span>
            )}
            {todayHours && <span className="text-sm text-slate-600">· Hôm nay {todayHours}</span>}
            {hasHours && <ChevronDown className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${showWeek ? 'rotate-180' : ''}`} />}
          </button>
          {showWeek && (
            <table className="mt-3 w-full text-sm">
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7].map(day => {
                  const text = formatDayHours(profile.hours, day);
                  return (
                    <tr key={day} className={day === today ? 'font-bold text-slate-900' : 'text-slate-600'}>
                      <td className="py-1 pr-3">{DAY_LABELS[day]}</td>
                      <td className="py-1 text-right">{text || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Ghi chú của Partner: giá tham khảo, mẹo, lưu ý */}
      {(profile.notes || []).length > 0 && (
        <div className="space-y-2">
          {profile.notes.map((note, i) => {
            const style = NOTE_STYLES[note.noteType] || { icon: Info, className: 'bg-slate-50 border-slate-100 text-slate-800', iconClass: 'text-slate-500' };
            const Icon = style.icon;
            return (
              <div key={`${note.title}-${i}`} className={`flex gap-2.5 rounded-2xl border px-3.5 py-3 ${style.className}`}>
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconClass}`} />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold">{note.title}</p>
                  <p className="text-[13px] leading-relaxed whitespace-pre-line">{note.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Liên hệ */}
      <div className="space-y-2.5 rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700 shadow-sm">
        {fullAddress && (
          <p className="flex gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>{fullAddress}</span></p>
        )}
        {PRICE_LEVEL_LABELS[profile.priceLevel] && (
          <p className="flex gap-2.5">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span><span className="font-bold text-slate-900">{'₫'.repeat(profile.priceLevel)}</span> · {PRICE_LEVEL_LABELS[profile.priceLevel]}</span>
          </p>
        )}
        {profile.phoneNumber && (
          <a href={`tel:${profile.phoneNumber.replace(/[^\d+]/g, '')}`} className="flex gap-2.5 hover:text-[#FF5645]">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>{profile.phoneNumber}</span>
          </a>
        )}
        {profile.email && (
          <a href={`mailto:${profile.email}`} className="flex gap-2.5 hover:text-[#FF5645]">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{profile.email}</span>
          </a>
        )}
        {links.map(link => (
          <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer" className="flex gap-2.5 hover:text-[#FF5645]">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>{link.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
};

export default PartnerPlaceDetails;
