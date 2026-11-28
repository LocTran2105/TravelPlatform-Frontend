import { useEffect, useRef, useState } from 'react';

/**
 * Cửa sổ nổi không chặn trang (giống khung chat AI): kéo tiêu đề để di chuyển, kéo góc để đổi kích thước,
 * phóng to/thu nhỏ, "Về góc". Vị trí/kích thước được nhớ trong localStorage theo {@code storageKey}.
 * Màn hình hẹp (< 640px) thì cố định gần toàn màn hình.
 */
const EDGE = 8;
const COMPACT_BREAKPOINT = 640;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function useFloatingWindow({ storageKey, minW = 360, minH = 320, defaultWindow }) {
  const clampWindow = (win) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = clamp(win.w, Math.min(minW, vw - EDGE * 2), vw - EDGE * 2);
    const h = clamp(win.h, Math.min(minH, vh - EDGE * 2), vh - EDGE * 2);
    return { w, h, x: clamp(win.x, EDGE, vw - w - EDGE), y: clamp(win.y, EDGE, vh - h - EDGE) };
  };
  const fallback = () => clampWindow(defaultWindow());
  const save = (win) => { try { localStorage.setItem(storageKey, JSON.stringify(win)); } catch { /* bỏ qua */ } };

  const [win, setWin] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(saved[k]))) return clampWindow(saved);
    } catch { /* localStorage hỏng: dùng mặc định */ }
    return fallback();
  });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < COMPACT_BREAKPOINT);
  const [interaction, setInteraction] = useState(null); // null | 'move' | 'resize-se' | 'resize-nw'
  const interactionRef = useRef(null);

  useEffect(() => {
    const onResize = () => {
      setIsCompact(window.innerWidth < COMPACT_BREAKPOINT);
      setWin((current) => clampWindow(current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!interaction) return undefined;
    const onMove = (event) => {
      const state = interactionRef.current;
      if (!state) return;
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      const start = state.startWin;
      let next;
      if (state.mode === 'move') {
        next = { ...start, x: start.x + dx, y: start.y + dy };
      } else if (state.mode === 'resize-se') {
        next = { ...start, w: start.w + dx, h: start.h + dy };
      } else {
        const w = clamp(start.w - dx, minW, start.x + start.w - EDGE);
        const h = clamp(start.h - dy, minH, start.y + start.h - EDGE);
        next = { w, h, x: start.x + start.w - w, y: start.y + start.h - h };
      }
      setWin(clampWindow(next));
    };
    const onUp = () => {
      interactionRef.current = null;
      setInteraction(null);
      setWin((current) => { save(current); return current; });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = interaction === 'move' ? 'grabbing' : 'nwse-resize';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction]);

  const startInteraction = (event, mode) => {
    if (isCompact || isMaximized || event.button !== 0) return;
    if (mode === 'move' && event.target.closest('button, a, input, select, textarea, label')) return;
    event.preventDefault();
    interactionRef.current = { mode, startX: event.clientX, startY: event.clientY, startWin: win };
    setInteraction(mode);
  };

  const resetWindow = () => {
    const next = fallback();
    setIsMaximized(false);
    setWin(next);
    save(next);
  };

  const style = isCompact
    ? { left: EDGE, right: EDGE, top: 64, bottom: 88 }
    : isMaximized
      ? { left: 16, top: 16, width: 'calc(100vw - 32px)', height: 'calc(100vh - 32px)' }
      : { left: win.x, top: win.y, width: win.w, height: win.h };

  return { style, isCompact, isMaximized, setIsMaximized, interaction, startInteraction, resetWindow };
}
