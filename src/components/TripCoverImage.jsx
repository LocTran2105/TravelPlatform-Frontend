import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { resolveCoverUrl, cloudinaryResize, coverGradient } from '../utils/cover';

/**
 * Ảnh bìa của chuyến đi. Lấp đầy phần tử cha (cha cần có chiều cao).
 * Chưa có ảnh hoặc ảnh lỗi thì hiện nền gradient kèm tên điểm đến, không bao giờ hiện icon ảnh vỡ.
 */
export default function TripCoverImage({
  trip,
  width = 800,
  height = 480,
  eager = false,
  className = '',
  labelClassName = 'text-sm',
}) {
  const url = resolveCoverUrl(trip);
  // Nhớ URL đã lỗi (thay vì cờ true/false) để đổi sang ảnh khác thì tự thử lại
  const [failedUrl, setFailedUrl] = useState(null);
  const showImage = Boolean(url) && failedUrl !== url;

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={showImage ? undefined : { background: coverGradient(trip?.id) }}
    >
      {showImage ? (
        <img
          src={cloudinaryResize(url, width, height)}
          alt={trip?.title || 'Ảnh bìa chuyến đi'}
          loading={eager ? 'eager' : 'lazy'}
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center gap-1.5 px-4 text-white/90">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className={`truncate font-bold ${labelClassName}`}>{trip?.destination || trip?.title || 'Chuyến đi'}</span>
        </div>
      )}
    </div>
  );
}
