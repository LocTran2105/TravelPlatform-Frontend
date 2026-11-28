import ThemeToggle from '../portal/ThemeToggle';
import useAppTheme from '../../hooks/useAppTheme';

/** Nút sáng/tối tự chứa, dùng ở trang không có SiteHeader (đăng nhập, chi tiết chuyến đi, kiểm duyệt). */
export default function SiteThemeToggle({ className = 'tp-icon-button' }) {
  const { theme, toggleTheme } = useAppTheme();
  return <ThemeToggle theme={theme} onToggle={toggleTheme} className={className} />;
}
