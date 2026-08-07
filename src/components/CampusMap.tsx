/**
 * 校园地图（v2.7 全屏场景页）：不是弹窗——点「出门」后整屏接管，底图 cover 铺满视口，
 * 图钉挂在按 cover 缩放后的图面坐标上（分辨率无关，不出现滚动条）。
 * 主线关卡绑定地点；当期可做关卡的建筑有琥珀光斑高亮 + 发光图钉；建筑名常显。
 * 文案来自 ui.json 的 map 段；图标用 lucide 细线（与傍晚玻璃 UI 同气质）。
 */
import React from 'react';
import {
  Briefcase,
  Check,
  DoorOpen,
  Drama,
  FlaskConical,
  Home,
  Landmark,
  Languages,
  Library,
  Rocket,
  School,
  Waves,
} from 'lucide-react';
import type { PlayerState } from '@/contracts';
import { getBoard, ui } from '@/engine/content';

const map = (ui as Record<string, unknown>)['map'] as Record<string, string>;

/** 地标表：坐标为相对底图 bg-campus.jpg 的百分比（按成图建筑落位校准；换图后需复核） */
const LOCATIONS: { id: string; x: number; y: number }[] = [
  { id: 'gate', x: 24, y: 82 },
  { id: 'jiaowu', x: 28, y: 30 },
  { id: 'teach', x: 50, y: 17 },
  { id: 'lib', x: 78, y: 27 },
  { id: 'lab', x: 88, y: 47 },
  { id: 'activity', x: 18, y: 46 },
  { id: 'lake', x: 52, y: 46 },
  { id: 'lang', x: 40, y: 66 },
  { id: 'career', x: 60, y: 72 },
  { id: 'innov', x: 84, y: 76 },
  { id: 'dorm', x: 13, y: 68 },
];

const LOC_ICONS: Record<string, React.ReactNode> = {
  gate: <DoorOpen size={16} strokeWidth={1.75} />,
  jiaowu: <Landmark size={16} strokeWidth={1.75} />,
  teach: <School size={16} strokeWidth={1.75} />,
  lib: <Library size={16} strokeWidth={1.75} />,
  lab: <FlaskConical size={16} strokeWidth={1.75} />,
  activity: <Drama size={16} strokeWidth={1.75} />,
  lake: <Waves size={16} strokeWidth={1.75} />,
  lang: <Languages size={16} strokeWidth={1.75} />,
  career: <Briefcase size={16} strokeWidth={1.75} />,
  innov: <Rocket size={16} strokeWidth={1.75} />,
  dorm: <Home size={16} strokeWidth={1.75} />,
};

/** 建筑轮廓多边形（% 坐标，按 bg-campus.jpg 网格描点；换图后需重描）：
 * 高亮时用 clip-path 把该建筑的像素单独提亮并沿轮廓打光——等效抠图，无需图片切割 */
const BUILDING_POLY: Record<string, string> = {
  teach: '40% 28%, 40% 17%, 48.5% 16%, 49% 5.5%, 52.5% 5.5%, 53% 16%, 56.5% 17%, 56.5% 28%',
  lib: '63% 32%, 64% 22%, 71% 18%, 88% 18%, 93% 24%, 93% 33%, 82% 37%, 68% 36%',
  jiaowu: '21% 32%, 21% 27%, 24% 24%, 33% 24%, 36% 27%, 36% 33%, 29% 35%',
  lab: '80% 53%, 80% 43%, 84% 40%, 93% 40%, 95% 44%, 95% 55%, 88% 57%',
  activity: '10% 50%, 10% 43%, 13% 39%, 20% 38%, 24% 42%, 24% 50%, 18% 53%',
  lake: '45% 49%, 46% 42%, 50% 40%, 54% 41%, 56% 45%, 55% 49%, 50% 51%',
  lang: '32% 71%, 32% 64%, 36% 60%, 43% 60%, 46% 64%, 46% 72%, 40% 75%',
  career: '53% 76%, 53% 68%, 56% 64%, 63% 64%, 65% 68%, 65% 77%, 59% 80%',
  innov: '74% 83%, 74% 73%, 79% 68%, 90% 69%, 94% 75%, 93% 86%, 83% 89%',
  dorm: '1% 78%, 1% 62%, 6% 58%, 17% 57%, 26% 63%, 26% 78%, 14% 83%',
  gate: '19% 88%, 19% 80%, 22% 76%, 29% 76%, 31% 80%, 31% 89%, 25% 91%',
};

/** 主线关卡 → 地标（结构映射，非文案） */
export const LEVEL_LOC: Record<string, string> = {
  'course-select': 'jiaowu',
  poster: 'activity',
  ppt: 'teach',
  coding: 'lab',
  mentor: 'teach',
  notes: 'lib',
  dachuang: 'innov',
  gig: 'gate',
  resume: 'career',
  examiner: 'lang',
  fork: 'lake',
  interview: 'career',
  thesis: 'lab',
};

/** 关卡对应的地点显示名（主线卡片上的 📍 徽标用） */
export function levelLocationName(levelId: string): string {
  const loc = LEVEL_LOC[levelId];
  return loc ? (map[`loc-${loc}`] ?? '') : '';
}

interface CampusMapProps {
  state: Readonly<PlayerState>;
  onEnter: (levelId: string) => void;
  onClose: () => void;
}

export const CampusMap: React.FC<CampusMapProps> = ({ state, onEnter, onClose }) => {
  // 底图优先真图 bg-campus.jpg（生图后同名放入 public/assets 即生效），缺省回退占位 SVG
  const [imgSrc, setImgSrc] = React.useState('/assets/bg-campus.jpg');
  // contain 完整显示：按图片原始宽高比算出内接框尺寸（全图必须可见，不裁任何建筑），
  // 视口比例差出的空隙由底层的模糊放大版同图补齐（弥散景深，不露黑边白边）
  const natural = React.useRef({ w: 1600, h: 1000 });
  const [box, setBox] = React.useState({ w: window.innerWidth, h: window.innerHeight });
  const compute = React.useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { w, h } = natural.current;
    const s = Math.min(vw / w, vh / h);
    setBox({ w: w * s, h: h * s });
  }, []);
  React.useEffect(() => {
    compute();
    window.addEventListener('resize', compute);
    // 全屏接管期间锁死页面滚动（防止文档高于视口时滚出底图外的白边）
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', compute);
      document.body.style.overflow = prevOverflow;
    };
  }, [compute]);

  const mainline = getBoard(state.semester).mainline;
  // 每个地标的当期状态：可进入的关卡（顺序解锁）/ 已完成 / 无事发生
  const locState = (locId: string) => {
    let active: { id: string; label: string } | null = null;
    let done = false;
    mainline.forEach((m, i) => {
      if (LEVEL_LOC[m.id] !== locId) return;
      const isDone = state.completedActions.includes(m.id);
      const unlocked = i === 0 || state.completedActions.includes(mainline[i - 1].id);
      if (isDone) done = true;
      else if (unlocked && !active) active = { id: m.id, label: m.label };
    });
    return { active: active as { id: string; label: string } | null, done };
  };

  return (
    <div className="fixed inset-0 z-50 animate-map-in overflow-hidden bg-dusk font-display">
      {/* 弥散补边层：同图放大模糊铺满视口，主图 contain 后的空隙不露黑白边 */}
      <img
        aria-hidden
        src={imgSrc}
        alt=""
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-xl"
        draggable={false}
      />
      <div aria-hidden className="absolute inset-0 bg-dusk/35" />
      {/* contain 内接框：全图完整可见，图与图钉同一坐标系 */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-pop"
        style={{ width: box.w, height: box.h }}
      >
        <img
          src={imgSrc}
          onLoad={(e) => {
            natural.current = {
              w: e.currentTarget.naturalWidth || 1600,
              h: e.currentTarget.naturalHeight || 1000,
            };
            compute();
          }}
          onError={() => imgSrc !== '/assets/bg-campus.svg' && setImgSrc('/assets/bg-campus.svg')}
          alt=""
          className="h-full w-full select-none"
          draggable={false}
        />

        {/* 当期建筑高亮：clip-path 抠出该建筑像素单独提亮 + 沿轮廓琥珀光晕呼吸（垫在图钉层下） */}
        {LOCATIONS.map((loc) => {
          if (loc.id === 'dorm') return null;
          const { active } = locState(loc.id);
          const poly = BUILDING_POLY[loc.id];
          if (!active || !poly) return null;
          // 箭头位置：建筑轮廓最低点下方（从下往上指向建筑，弹跳引导视线）
          const maxY = Math.max(...poly.split(',').map((p) => parseFloat(p.trim().split(/\s+/)[1])));
          return (
            <React.Fragment key={`hl-${loc.id}`}>
              {/* 贴纸式高亮：建筑像素提亮 + 奶油白粗描边 + 琥珀外发光（静态，不闪） */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  filter:
                    'drop-shadow(0 0 8px rgba(255,179,92,0.9)) drop-shadow(0 0 24px rgba(255,166,77,0.55))',
                }}
              >
                <div className="absolute inset-0" style={{ clipPath: `polygon(${poly})` }}>
                  <img
                    src={imgSrc}
                    alt=""
                    draggable={false}
                    className="h-full w-full select-none"
                    style={{ filter: 'brightness(1.32) saturate(1.15)' }}
                  />
                </div>
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <polygon
                    points={poly.replace(/%/g, '')}
                    fill="none"
                    stroke="#FFF3DC"
                    strokeWidth="0.55"
                    strokeLinejoin="round"
                    opacity="0.95"
                  />
                </svg>
              </div>
              {/* 弹跳箭头：从建筑下方指向建筑 */}
              <div
                aria-hidden
                className="pointer-events-none absolute -translate-x-1/2 animate-arrow-bob"
                style={{ left: `${loc.x}%`, top: `${Math.min(maxY + 2.5, 93)}%` }}
              >
                <svg width="44" height="44" viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 3px 6px rgba(20,8,2,0.5))' }}>
                  <defs>
                    <linearGradient id={`ar-${loc.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFD97A" />
                      <stop offset="100%" stopColor="#F0A030" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M12 3 L20.5 13 H15.5 V21 H8.5 V13 H3.5 Z"
                    fill={`url(#ar-${loc.id})`}
                    stroke="#7A4512"
                    strokeWidth="1.1"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </React.Fragment>
          );
        })}

        {LOCATIONS.map((loc) => {
          const { active, done } = loc.id === 'dorm' ? { active: null, done: false } : locState(loc.id);
          const isDorm = loc.id === 'dorm';
          return (
            <div
              key={loc.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
            >
              <button
                onClick={() => (isDorm ? onClose() : active && onEnter(active.id))}
                disabled={!isDorm && !active}
                className={`flex flex-col items-center ${!isDorm && !active ? 'cursor-default' : ''}`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                    active
                      ? 'animate-ember-breathe border-cream/70 bg-gradient-to-b from-ember to-ember-deep text-dusk shadow-ember-glow'
                      : done
                        ? 'border-cream/25 bg-dusk/70 text-cream-soft shadow-glass backdrop-blur-sm'
                        : isDorm
                          ? 'border-cream/35 bg-dusk/75 text-cream shadow-glass backdrop-blur-sm'
                          : 'border-cream/20 bg-dusk/55 text-cream-soft/80 shadow-glass backdrop-blur-sm'
                  }`}
                >
                  {done ? <Check size={16} strokeWidth={2.25} /> : LOC_ICONS[loc.id]}
                </span>
                {/* 建筑名常显：玩家不 hover 也知道每栋楼是什么 */}
                <span
                  className={`mt-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[12px] tracking-wide backdrop-blur-sm ${
                    active
                      ? 'border-ember/60 bg-ember font-semibold text-dusk shadow-ember-glow'
                      : 'border-cream/15 bg-dusk/70 text-cream shadow-glass'
                  }`}
                >
                  {map[`loc-${loc.id}`] ?? loc.id}
                </span>
                {active && (
                  <span className="mt-0.5 whitespace-nowrap rounded-md border border-ember/50 bg-dusk/85 px-2 py-0.5 text-[12px] font-medium text-ember shadow-glass backdrop-blur-sm">
                    {active.label}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 顶部标题条与回宿舍（固定在视口，不随图缩放） */}
      <div className="absolute left-5 top-5 rounded-xl border border-cream/15 bg-dusk/80 px-4 py-2 text-cream shadow-glass backdrop-blur-md backdrop-saturate-125">
        <div className="text-[17px] font-bold tracking-[0.2em]">{map['title']}</div>
        <div className="text-[12px] text-cream-soft">{map['sub']}</div>
      </div>
      <button
        className="absolute right-5 top-5 flex items-center gap-1.5 rounded-xl border border-cream/20 bg-dusk/80 px-3.5 py-2 text-sm text-cream shadow-glass backdrop-blur-md backdrop-saturate-125 transition hover:border-ember/60 hover:text-ember"
        onClick={onClose}
      >
        <Home size={15} strokeWidth={1.75} />
        {map['close']}
      </button>
    </div>
  );
};
