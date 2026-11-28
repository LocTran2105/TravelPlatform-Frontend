// Xe nhìn từ trên xuống cho bản đồ minh họa (đầu xe hướng +x để animateMotion/rotate xoay theo đường).
// Vệt đèn pha dùng gradient #tp-beam khai báo trong JourneyScene, chỉ hiện ở giao diện tối (--tp-beam-opacity).

export function Car({ color }) {
  return (
    <g>
      <rect x="-11" y="-4" width="22" height="12" rx="4" fill="#1c2421" opacity=".18" />
      <rect x="-11" y="-6" width="22" height="12" rx="4" fill={color} />
      <rect x="2" y="-4.6" width="5" height="9.2" rx="1.6" fill="#1c2421" opacity=".55" />
      <rect x="-8.5" y="-4.6" width="4" height="9.2" rx="1.3" fill="#1c2421" opacity=".38" />
      <path d="M11 -4 L34 -11 L34 11 L11 4 Z" fill="url(#tp-beam)" style={{ opacity: 'var(--tp-beam-opacity)' }} />
      <circle cx="10.6" cy="-3.4" r="1.2" style={{ fill: 'var(--tp-headlight)' }} />
      <circle cx="10.6" cy="3.4" r="1.2" style={{ fill: 'var(--tp-headlight)' }} />
    </g>
  );
}

export function Motorbike({ color }) {
  return (
    <g>
      <rect x="-11" y="-1.2" width="22" height="4.4" rx="2.2" fill="#1c2421" opacity=".2" />
      <rect x="5" y="-2" width="6" height="3.6" rx="1.6" fill="#1c2421" />
      <rect x="-11" y="-2" width="6" height="3.6" rx="1.6" fill="#1c2421" />
      <rect x="-7" y="-3.2" width="14" height="5.6" rx="2.8" fill={color} />
      <rect x="4.6" y="-5.8" width="1.6" height="11" rx=".8" fill="#1c2421" />
      <ellipse cx="-1.4" cy="-.3" rx="3.6" ry="4.8" fill="#2b3a35" />
      <circle cx="0" cy="-.3" r="2.7" fill={color} stroke="#fff" strokeWidth=".9" />
      <path d="M11 -2 L30 -8 L30 8 L11 2 Z" fill="url(#tp-beam)" style={{ opacity: 'var(--tp-beam-opacity)' }} />
      <circle cx="11.2" cy="-.3" r="1.2" style={{ fill: 'var(--tp-headlight)' }} />
    </g>
  );
}
