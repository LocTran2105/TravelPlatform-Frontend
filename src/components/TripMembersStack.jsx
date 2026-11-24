import { Users } from 'lucide-react';

const MAX_VISIBLE = 3;

const Avatar = ({ member }) =>
  member.avatar ? (
    <img src={member.avatar} alt="" className="h-full w-full rounded-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
      {(member.fullName || member.username || 'U').charAt(0).toUpperCase()}
    </span>
  );

/**
 * Hàng avatar thành viên ở đầu trang chuyến đi: tối đa 3 người + chip "+N".
 *   members : [{ userId, fullName, username, avatar, role, owner }] (chủ chuyến đi đứng đầu)
 *   canOpen : chủ chuyến đi / người chỉnh sửa bấm vào được; người chỉ xem chỉ nhìn thấy
 *   onOpen  : mở hộp thoại thành viên
 */
const TripMembersStack = ({ members, canOpen, onOpen }) => {
  const list = members || [];
  const visible = list.slice(0, MAX_VISIBLE);
  const extra = list.length - visible.length;

  const body = (
    <>
      <span className="flex items-center -space-x-2.5">
        {visible.map((m) => (
          <span
            key={m.userId}
            title={m.fullName || m.username}
            className="h-10 w-10 rounded-full border-2 border-white bg-white shadow-sm"
          >
            <Avatar member={m} />
          </span>
        ))}
        {extra > 0 && (
          <span
            title={`${extra} thành viên khác`}
            className="relative flex h-10 min-w-[2.5rem] items-center justify-center rounded-full border-2 border-white bg-slate-800 px-1.5 text-xs font-bold text-white shadow-sm"
          >
            +{extra}
          </span>
        )}
        {list.length === 0 && (
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 text-slate-400">
            <Users className="h-4 w-4" />
          </span>
        )}
      </span>
    </>
  );

  if (!canOpen) {
    return (
      <div className="flex items-center" aria-label={`${list.length} thành viên`} data-testid="members-stack">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Xem ${list.length} thành viên của chuyến đi`}
      data-testid="members-stack"
      className="flex items-center rounded-full p-0.5 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5645]/50"
    >
      {body}
    </button>
  );
};

export default TripMembersStack;
