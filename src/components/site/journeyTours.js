/*
 * Lịch trình mẫu cho bản đồ minh họa ở trang chủ: bản đồ và thẻ "lịch trình tham khảo" lần lượt đổi qua từng chuyến.
 * x/y là tọa độ trong khung SVG 1200×560 của JourneyScene (không phải tọa độ địa lý).
 * Giữ điểm ở nửa phải (x ≥ 600, nửa trái có lớp sương che chữ) và tránh góc dưới phải (thẻ lịch trình nổi ở đó).
 */
export const JOURNEY_TOURS = [
  {
    id: 'dalat', city: 'Đà Lạt', day: 1, people: 4, cost: '312.500 ₫', vehicle: 'motorbike',
    stops: [
      { x: 620, y: 380, time: '08:00', name: 'Chợ Đà Lạt', color: '#ff5645' },
      { x: 760, y: 190, time: '10:30', name: 'Đồi chè Cầu Đất', color: '#7c5cf0' },
      { x: 1030, y: 115, time: '15:00', name: 'Langbiang', color: '#0f7d68' },
      { x: 860, y: 300, time: '18:30', name: 'Hồ Xuân Hương', color: '#2f6fd6' },
    ],
  },
  {
    id: 'hoian', city: 'Hội An', day: 2, people: 2, cost: '450.000 ₫', vehicle: 'car',
    stops: [
      { x: 650, y: 250, time: '07:30', name: 'Chùa Cầu', color: '#ff5645' },
      { x: 820, y: 400, time: '10:00', name: 'Rừng dừa Bảy Mẫu', color: '#0f7d68' },
      { x: 960, y: 220, time: '15:30', name: 'Biển An Bàng', color: '#2f6fd6' },
      { x: 1110, y: 95, time: '19:00', name: 'Phố đèn lồng', color: '#ffa53b' },
    ],
  },
  {
    id: 'hanoi', city: 'Hà Nội', day: 1, people: 3, cost: '280.000 ₫', vehicle: 'motorbike',
    stops: [
      { x: 700, y: 120, time: '07:00', name: 'Hồ Gươm', color: '#0f7d68' },
      { x: 640, y: 340, time: '09:30', name: 'Văn Miếu', color: '#ff5645' },
      { x: 850, y: 250, time: '12:00', name: 'Phố cổ Hà Nội', color: '#7c5cf0' },
      { x: 990, y: 140, time: '17:30', name: 'Hồ Tây', color: '#2f6fd6' },
    ],
  },
  {
    id: 'phuquoc', city: 'Phú Quốc', day: 3, people: 5, cost: '690.000 ₫', vehicle: 'car',
    stops: [
      { x: 610, y: 440, time: '07:30', name: 'Chợ Dương Đông', color: '#ffa53b' },
      { x: 780, y: 330, time: '10:00', name: 'Bãi Sao', color: '#2f6fd6' },
      { x: 870, y: 160, time: '14:00', name: 'Cáp treo Hòn Thơm', color: '#7c5cf0' },
      { x: 1080, y: 225, time: '18:00', name: 'Dinh Cậu', color: '#ff5645' },
    ],
  },
  {
    id: 'sapa', city: 'Sa Pa', day: 2, people: 4, cost: '520.000 ₫', vehicle: 'motorbike',
    stops: [
      { x: 680, y: 210, time: '08:00', name: 'Bản Cát Cát', color: '#0f7d68' },
      { x: 880, y: 105, time: '11:00', name: 'Đỉnh Fansipan', color: '#7c5cf0' },
      { x: 1060, y: 175, time: '15:00', name: 'Núi Hàm Rồng', color: '#ffa53b' },
      { x: 760, y: 370, time: '18:30', name: 'Nhà thờ Đá', color: '#ff5645' },
    ],
  },
];

/** Đường cong mượt đi qua các điểm (Catmull-Rom -> Bézier bậc ba), trả về từng chặng để đo và vẽ riêng. */
export const tourLegs = (stops) => {
  const p = stops;
  const at = (i) => p[Math.max(0, Math.min(p.length - 1, i))];
  const legs = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = at(i - 1); const p1 = at(i); const p2 = at(i + 1); const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    legs.push(`M ${p1.x} ${p1.y} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${p2.x} ${p2.y}`);
  }
  return legs;
};
