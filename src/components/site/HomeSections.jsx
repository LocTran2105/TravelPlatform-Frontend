import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowUpRight, CalendarDays, MapPin, Plus, Receipt, Search, Users } from 'lucide-react';
import JourneyScene from './JourneyScene';
import { JOURNEY_TOURS } from './journeyTours';
import { greeting } from '../../utils/portalFormat';

const EASE = [0.2, 0.8, 0.2, 1];

/**
 * Thẻ lịch trình nổi trên bản đồ: cho người mới thấy ngay sản phẩm làm gì.
 * Đổi theo chuyến mẫu đang chạy trên bản đồ; điểm xe đã tới được tô đậm, điểm đang đứng có chấm nhấp nháy.
 */
function ItineraryCard({ index, reached }) {
  const tour = JOURNEY_TOURS[index] || JOURNEY_TOURS[0];
  return (
    <motion.div className="tp-float-card hidden w-64 overflow-hidden p-4 lg:block" style={{ right: '5%', bottom: '9%' }}
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.6, ease: EASE }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tour.id}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.35, ease: EASE }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">Ngày {tour.day}, {tour.city}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{tour.stops.length} điểm</span>
          </div>
          <ol className="relative mt-3 space-y-2.5 before:absolute before:bottom-1.5 before:left-[5px] before:top-1.5 before:w-px before:bg-slate-200">
            {tour.stops.map((s, i) => {
              const done = reached >= i;
              const here = reached === i;
              return (
                <motion.li key={s.name} className="relative flex items-center gap-3 text-sm"
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08, ease: EASE }}>
                  <span className="relative z-10 h-[11px] w-[11px] rounded-full ring-2 ring-white transition-transform duration-300"
                    style={{ background: done ? s.color : 'transparent', boxShadow: done ? 'none' : `inset 0 0 0 2px ${s.color}`, transform: here ? 'scale(1.35)' : 'none' }}>
                    {here && <span className="tp-card-here absolute inset-0 rounded-full" style={{ background: s.color }} />}
                  </span>
                  <span className="w-11 font-semibold tabular-nums text-slate-500">{s.time}</span>
                  <span className={`truncate transition-colors duration-300 ${done ? 'font-semibold text-slate-900' : 'font-medium text-slate-400'}`}>{s.name}</span>
                </motion.li>
              );
            })}
          </ol>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500"><Users className="h-3.5 w-3.5" /> {tour.people} người đi cùng</span>
            <span className="font-semibold tabular-nums text-slate-800">{tour.cost}/người</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/** Hero cho khách chưa đăng nhập: chữ bên trái, bản đồ hành trình sống phía sau. */
export function HomeHero() {
  // Chuyến mẫu đang chạy trên bản đồ + điểm xe đã tới, để thẻ lịch trình đổi theo
  const [progress, setProgress] = useState({ index: 0, reached: 0 });
  return (
    <section className="relative">
      <JourneyScene className="tp-hero-scene lg:min-h-[600px]" onTourProgress={setProgress}>
        {/* Lớp sương trắng giữ chữ dễ đọc: từ trên xuống trên điện thoại, từ trái sang trên màn rộng */}
        <div className="tp-hero-fog pointer-events-none absolute inset-0 z-[2]" />
        <div className="relative z-[5] mx-auto flex max-w-7xl px-4 pb-[350px] pt-12 sm:px-6 lg:min-h-[600px] lg:items-center lg:px-8 lg:py-20">
          <div className="max-w-xl">
            <h1 className="text-[2.6rem] font-bold leading-[1.08] text-slate-900 sm:text-6xl">
              <span className="tp-reveal-line"><span>Tự lên lịch trình</span></span>
              <span className="tp-reveal-line"><span style={{ animationDelay: '.12s' }}>cho chuyến đi</span></span>
              <span className="tp-reveal-line"><span style={{ animationDelay: '.24s' }}>của riêng bạn</span></span>
            </h1>
            <motion.p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6, ease: EASE }}>
              Ghim địa điểm lên bản đồ, sắp xếp từng ngày, chia tiền với bạn đồng hành và giữ lại từng chặng đường.
            </motion.p>
            <motion.div className="mt-9 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6, ease: EASE }}>
              <Link to="/plan" className="tp-btn-primary group px-7 py-3.5 text-base">
                Bắt đầu lên kế hoạch
                <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
              <Link to="/community" className="tp-btn-ghost px-6 py-3.5 text-base">Xem lịch trình cộng đồng</Link>
            </motion.div>
          </div>
        </div>
        <ItineraryCard index={progress.index} reached={progress.reached} />
      </JourneyScene>
    </section>
  );
}

const parseDay = (value) => {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Tóm tắt chuyến đi sắp tới cho lời chào: "Chuyến đi đến Đà Lạt bắt đầu sau 3 ngày." */
function upcomingLine(trips) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = trips
    .map((t) => ({ t, start: parseDay(t.startDate), end: parseDay(t.endDate) }))
    .filter((x) => x.start && (x.end || x.start) >= today)
    .sort((a, b) => a.start - b.start);
  if (!upcoming.length) {
    return trips.length ? 'Chưa có chuyến nào sắp tới. Lên kế hoạch cho chuyến tiếp theo nhé?' : 'Bắt đầu bằng việc chọn điểm đến và ngày đi.';
  }
  const { t, start } = upcoming[0];
  const days = Math.round((start - today) / 86400000);
  const when = days < 0 ? 'đang diễn ra' : days === 0 ? 'bắt đầu hôm nay' : days === 1 ? 'bắt đầu ngày mai' : `bắt đầu sau ${days} ngày`;
  const more = upcoming.length > 1 ? ` Bạn có ${upcoming.length} chuyến sắp tới.` : '';
  return `${t.title || 'Chuyến đi gần nhất'} ${when}.${more}`;
}

/** Lời chào cho người đã đăng nhập, đặt trên dải bản đồ hành trình. */
export function HomeGreeting({ user, trips, loading, onExplore }) {
  const name = String(user?.fullName || '').trim();
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/70">
      <JourneyScene className="min-h-[300px]" labels={false}>
        <div className="tp-band-fog pointer-events-none absolute inset-0 z-[2]" />
        <div className="relative z-[5] flex min-h-[300px] max-w-xl flex-col justify-center p-6 sm:p-10">
          <motion.h1 className="text-3xl font-bold text-slate-900 sm:text-4xl"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
            {greeting()}{name && name.length <= 18 ? `, ${name}` : ''}
          </motion.h1>
          <motion.p className="mt-3 min-h-[1.5rem] text-base text-slate-600"
            initial={{ opacity: 0 }} animate={{ opacity: loading ? 0 : 1 }} transition={{ delay: 0.15, duration: 0.4 }}>
            {loading ? '' : upcomingLine(trips)}
          </motion.p>
          <motion.div className="mt-6 flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5, ease: EASE }}>
            <Link to="/plan" className="tp-btn-primary px-5 py-2.5 text-sm"><Plus className="h-4 w-4" /> Lên kế hoạch chuyến mới</Link>
            <button type="button" onClick={onExplore} className="tp-btn-ghost px-5 py-2.5 text-sm"><Search className="h-4 w-4" /> Tra cứu địa điểm</button>
          </motion.div>
        </div>
      </JourneyScene>
    </section>
  );
}

const STEPS = [
  { icon: CalendarDays, when: 'Trước chuyến đi', title: 'Lộ trình theo từng ngày', text: 'Chia chuyến đi theo ngày, ghim địa điểm lên bản đồ, xem giờ mở cửa và nhân bản lịch trình từ cộng đồng.', color: '#ff5645' },
  { icon: Receipt, when: 'Trong chuyến đi', title: 'Chia tiền nhóm tự động', text: 'Ghi lại từng khoản chi, hệ thống tự tính ai cần trả ai bao nhiêu.', color: '#7c5cf0' },
  { icon: Users, when: 'Sau chuyến đi', title: 'Chia sẻ với cộng đồng', text: 'Đăng hành trình, đánh giá địa điểm và theo dõi những người đi cùng sở thích.', color: '#0f7d68' },
];

function StepCar() {
  return (
    <svg width="34" height="18" viewBox="-17 -9 34 18" aria-hidden="true">
      <rect x="-15" y="-6" width="30" height="14" rx="5" fill="#1c2421" opacity=".15" />
      <rect x="-15" y="-8" width="30" height="14" rx="5" fill="#ff5645" />
      <rect x="3" y="-6" width="7" height="10" rx="2" fill="#1c2421" opacity=".5" />
      <rect x="-11" y="-6" width="5" height="10" rx="1.5" fill="#1c2421" opacity=".35" />
      <circle cx="14.4" cy="-4.5" r="1.4" fill="#fff4c2" /><circle cx="14.4" cy="2.5" r="1.4" fill="#fff4c2" />
    </svg>
  );
}

/** Ba chặng của một chuyến đi, nối bằng con đường; xe chạy qua từng chặng rồi khuất ở cuối đường. */
export function JourneySteps() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: '-15% 0px' });
  const reduce = useReducedMotion();
  const stopsAt = ['16.6%', '50%', '83.3%'];

  return (
    <section className="border-t border-slate-100 bg-[var(--tp-paper)]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl md:text-center">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">Một nơi cho cả chuyến đi</h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            Từ lúc lên ý tưởng đến lúc quay về, mọi phần của chuyến đi đều nằm trong cùng một chỗ.
          </p>
        </div>

        <div ref={ref} className="relative mt-14">
          {/* Con đường nối ba chặng (màn rộng) */}
          <div className="absolute left-0 right-0 top-6 hidden h-3 md:block" aria-hidden="true">
            <div className="absolute inset-0 rounded-full bg-white shadow-[inset_0_0_0_1.5px_#e4dbcf]" />
            <svg className="absolute inset-x-3 top-1/2 h-1 -translate-y-1/2" width="100%" height="4" preserveAspectRatio="none">
              <line x1="0" y1="2" x2="100%" y2="2" stroke="#f0c48f" strokeWidth="1.6" className="tp-road-dash" />
            </svg>
            {!reduce && inView && (
              <motion.div className="absolute top-1/2 -translate-y-1/2"
                style={{ marginLeft: -17 }}
                initial={{ left: '-3%', opacity: 0 }}
                animate={{ left: ['-3%', stopsAt[0], stopsAt[0], stopsAt[1], stopsAt[1], stopsAt[2], stopsAt[2], '103%'], opacity: [0, 1, 1, 1, 1, 1, 1, 0] }}
                transition={{ duration: 8, times: [0, 0.12, 0.22, 0.4, 0.5, 0.68, 0.78, 1], ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.5 }}>
                <StepCar />
              </motion.div>
            )}
          </div>

          <ol className="grid gap-6 md:grid-cols-3 md:gap-8">
            {STEPS.map(({ icon: Icon, when, title, text, color }, i) => (
              <motion.li key={title} className="relative flex flex-col items-start md:items-center md:text-center"
                initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-10% 0px' }}
                transition={{ delay: i * 0.12, duration: 0.6, ease: EASE }}>
                <span className="relative z-10 flex h-[60px] w-[60px] items-center justify-center rounded-full border-4 border-[var(--tp-paper)] text-white shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 12px 24px -14px ${color}` }}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="mt-4 text-sm font-semibold" style={{ color }}>{when}</span>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{title}</h3>
                <p className="mt-2 max-w-xs text-[0.95rem] leading-relaxed text-slate-600">{text}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-white">
      <div className="tp-footer-ribbon" aria-hidden="true" />
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6 lg:px-8">
        <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[var(--tp-coral)]" /> © 2026 TravelPlatform. Khám phá theo cách của bạn.</p>
        <p>
          Bạn kinh doanh quán ăn, lưu trú hay điểm tham quan?{' '}
          <Link to="/tro-thanh-doi-tac" className="font-semibold text-[var(--tp-coral-deep)] hover:underline">Trở thành đối tác</Link>
        </p>
      </div>
    </footer>
  );
}
