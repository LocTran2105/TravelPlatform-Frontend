import { AnimatePresence, motion } from 'motion/react';
import { Moon, Sun } from 'lucide-react';

/** Nút đổi giao diện sáng/tối: biểu tượng xoay và đổi chỗ khi bấm. */
export default function ThemeToggle({ theme, onToggle, className = 'portal-icon-button' }) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={dark ? 'Giao diện sáng' : 'Giao diện tối'}
      style={{ overflow: 'hidden' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          style={{ display: 'grid' }}
          initial={{ y: 14, rotate: -60, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -14, rotate: 60, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
        >
          {dark ? <Moon size={17} /> : <Sun size={17} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
