// Rút gọn số lượng kiểu Việt Nam: 1000 -> "1N", 1500 -> "1,5N", 2.300.000 -> "2,3Tr".
//   N  = nghìn, Tr = triệu, Tỷ = tỷ
// Luôn LÀM TRÒN XUỐNG (như Facebook/TikTok) để không bao giờ hiện số cao hơn
// thực tế, và để 999.999 không bị hiện thành "1000N".

const UNITS = [
  { value: 1_000_000_000, label: 'Tỷ' },
  { value: 1_000_000, label: 'Tr' },
  { value: 1_000, label: 'N' },
];

export function formatCount(input) {
  const n = Math.floor(Number(input));
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1000) return String(n);

  const unit = UNITS.find((u) => n >= u.value);
  const whole = Math.floor(n / unit.value);

  // Dưới 100 đơn vị thì giữ 1 chữ số thập phân (12,3N); từ 100 trở lên bỏ lẻ (123N).
  if (whole < 100) {
    const decimal = Math.floor((n * 10) / unit.value) % 10;
    if (decimal > 0) return `${whole},${decimal}${unit.label}`;
  }
  return `${whole}${unit.label}`;
}

// Số đầy đủ có dấu chấm ngăn cách (1.234.567) để hiện trong tooltip.
export function formatCountFull(input) {
  const n = Math.floor(Number(input));
  return Number.isFinite(n) && n > 0 ? n.toLocaleString('vi-VN') : '0';
}