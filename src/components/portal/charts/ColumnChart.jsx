import { useState } from 'react';
import { motion } from 'motion/react';

const niceMax = (max) => {
  if (max <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s * 4 >= max) || magnitude * 10;
  return step * 4;
};

/**
 * Biểu đồ cột một chuỗi theo ngày. Cột cuối (hôm nay) màu nhấn kèm số trên đỉnh;
 * rê chuột hoặc tab vào cột để xem chi tiết; có bảng ẩn cho trình đọc màn hình.
 *
 * data: [{ key, label, axisLabel, value, details: [[tên, giá trị], ...] }]
 */
export default function ColumnChart({ data = [], height = 200, valueLabel = 'Giá trị', caption, tone = 'sunset' }) {
  const [active, setActive] = useState(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const activeItem = active === null ? null : data[active];

  return (
    <div className={`dash-columns tone-${tone}`}>
      <div className="dash-columns-plot" style={{ height }}>
        <div className="dash-columns-axis" aria-hidden="true">
          {ticks.slice().reverse().map((t) => <span key={t}>{t.toLocaleString('vi-VN')}</span>)}
        </div>
        <div className="dash-columns-area" onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => <i key={t} className="dash-columns-grid" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden="true" />)}
          {data.map((d, i) => {
            const isLast = i === data.length - 1;
            const pct = max ? (d.value / max) * 100 : 0;
            return (
              <button
                key={d.key}
                type="button"
                className={`dash-column-slot ${active === i ? 'is-active' : ''}`}
                aria-label={`${d.label}: ${d.value} ${valueLabel.toLowerCase()}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                {isLast && d.value > 0 && (
                  <motion.span className="dash-column-cap" initial={{ opacity: 0, bottom: '0%' }}
                    animate={{ opacity: 1, bottom: `calc(${pct}% + 6px)` }}
                    transition={{ type: 'spring', stiffness: 140, damping: 20, delay: 0.3 + i * 0.06 }}>
                    {d.value}
                  </motion.span>
                )}
                {/* Cột mọc lần lượt từ trái sang khi mở trang; đổi chỉ số thì chiều cao chuyển mượt */}
                <motion.span
                  className={`dash-column ${isLast ? 'is-today' : ''}`}
                  initial={{ height: '0%' }}
                  animate={{ height: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 140, damping: 20, delay: 0.3 + i * 0.06 }}
                />
              </button>
            );
          })}
          {activeItem && (
            <div
              className="dash-tooltip"
              role="presentation"
              style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
            >
              <strong>{activeItem.value.toLocaleString('vi-VN')}</strong>
              <span>{activeItem.label}</span>
              {activeItem.details?.map(([name, value]) => (
                <span key={name} className="dash-tooltip-row"><em>{name}</em><b>{value}</b></span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="dash-columns-x" aria-hidden="true">
        <span />
        {data.map((d, i) => <span key={d.key} className={i === data.length - 1 ? 'is-today' : ''}>{d.axisLabel}</span>)}
      </div>

      {/* Bảng chỉ dành cho trình đọc màn hình; bọc div vì <table> không co về 1px */}
      <div className="sr-only">
        <table>
          {caption && <caption>{caption}</caption>}
          <thead><tr><th scope="col">Ngày</th><th scope="col">{valueLabel}</th>
            {data[0]?.details?.map(([name]) => <th key={name} scope="col">{name}</th>)}</tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}><th scope="row">{d.label}</th><td>{d.value}</td>
                {d.details?.map(([name, value]) => <td key={name}>{value}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
