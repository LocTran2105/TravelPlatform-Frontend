// Báo cho PortalLayout tải lại số việc đang chờ (badge trên menu) sau khi duyệt/từ chối/gửi hồ sơ.
export const PORTAL_COUNTS_EVENT = 'portal:counts-changed';

export const refreshPortalCounts = () => {
  window.dispatchEvent(new Event(PORTAL_COUNTS_EVENT));
};
