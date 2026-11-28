import {
  Bell, Copy, CornerDownRight, EyeOff, Heart, Megaphone, MessageCircle, RotateCcw, ShieldCheck, UserPlus, X,
} from 'lucide-react';
import { describeNotification, timeAgo } from '../utils/notificationText';

const ICONS = {
  follow: UserPlus,
  like: Heart,
  comment: MessageCircle,
  reply: CornerDownRight,
  hidden: EyeOff,
  restored: RotateCcw,
  report: ShieldCheck,
  copy: Copy,
  recruit: Megaphone,
};

const TONES = {
  emerald: 'bg-emerald-100 text-emerald-600',
  rose: 'bg-rose-100 text-rose-600',
  amber: 'bg-amber-100 text-amber-600',
  sky: 'bg-sky-100 text-sky-600',
  slate: 'bg-slate-100 text-slate-600',
};

/** Một dòng thông báo, dùng chung cho chuông và trang /notifications. */
export default function NotificationItem({ item, onOpen, onRemove }) {
  const view = describeNotification(item);
  const Icon = ICONS[view.icon] || Bell;
  const avatar = item.actor?.avatar;

  return (
    <li
      data-testid="notification-item"
      data-unread={item.read ? 'false' : 'true'}
      className={`group relative flex items-start gap-3 px-4 py-3 transition-colors ${
        item.read ? 'bg-white hover:bg-slate-50' : 'bg-orange-50/70 hover:bg-orange-50'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
      >
        <span className="relative mt-0.5 shrink-0">
          {avatar ? (
            <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${TONES[view.tone] || TONES.slate}`}>
              <Icon className="h-5 w-5" />
            </span>
          )}
          {avatar && (
            <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white ${TONES[view.tone] || TONES.slate}`}>
              <Icon className="h-3 w-3" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug text-slate-700">
            {view.name && <strong className="font-semibold text-slate-900">{view.name}</strong>}
            {view.text}
          </span>
          {view.detail && (
            <span className="mt-1 block rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 break-words">
              {view.detail}
            </span>
          )}
          <span className={`mt-1 block text-xs ${item.read ? 'text-slate-400' : 'font-medium text-[#E04B3B]'}`}>
            {timeAgo(item.eventAt || item.createdAt)}
          </span>
        </span>
      </button>

      {!item.read && (
        <span aria-label="Chưa đọc" className="mt-3 h-2.5 w-2.5 shrink-0 rounded-full bg-[#FF5645]" />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label="Xóa thông báo"
          title="Xóa thông báo"
          className="mt-1 shrink-0 rounded-full p-1.5 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
