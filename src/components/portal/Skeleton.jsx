// Khối giữ chỗ khi đang tải, có ánh sáng lướt qua (tự tắt khi người dùng bật giảm chuyển động).

export function Skeleton({ width = '100%', height = 14, radius, className = '', style }) {
  return (
    <span
      aria-hidden="true"
      className={`portal-skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

/** Bảng giữ chỗ: `rows` hàng × `columns` cột, cột đầu có ô ảnh như các bảng địa điểm. */
export function SkeletonTable({ rows = 6, columns = 5, label = 'Đang tải dữ liệu' }) {
  return (
    <div role="status" aria-label={label} className="portal-table-wrap">
      <table className="portal-table">
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c}>
                  {c === 0 ? (
                    <div className="portal-place-cell">
                      <Skeleton width={36} height={36} radius={10} />
                      <div style={{ display: 'grid', gap: 6, flex: 1 }}>
                        <Skeleton width={`${60 + ((r * 7) % 30)}%`} height={12} />
                        <Skeleton width="45%" height={10} />
                      </div>
                    </div>
                  ) : (
                    <Skeleton width={`${50 + ((r + c) * 11) % 40}%`} height={12} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
