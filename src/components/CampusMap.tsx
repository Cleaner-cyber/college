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
  // cover 铺满视口：按图片原始宽高比算出覆盖框尺寸，图钉挂在框内百分比坐标上（不裁偏、不滚动）
  const natural = React.useRef({ w: 1600, h: 1000 });
  const [box, setBox] = React.useState({ w: window.innerWidth, h: window.innerHeight });
  const compute = React.useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { w, h } = natural.current;
    const s = Math.max(vw / w, vh / h);
    setBox({ w: w * s, h: h * s });
  }, []);
  React.useEffect(() => {
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
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
      {/* cover 覆盖框：图与图钉同一坐标系 */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
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

        {/* 当期建筑高亮：琥珀光斑呼吸（垫在图钉层下） */}
        {LOCATIONS.map((loc) => {
          if (loc.id === 'dorm') return null;
          const { active } = locState(loc.id);
          if (!active) return null;
          return (
            <div
              key={`halo-${loc.id}`}
              aria-hidden
              className="pointer-events-none absolute h-56 w-56 -translate-x-1/2 -translate-y-1/2 animate-halo"
              style={{
                left: `${loc.x}%`,
                top: `${loc.y}%`,
                background:
                  'radial-gradient(circle, rgba(255,179,92,0.38) 0%, rgba(255,179,92,0.14) 45%, transparent 68%)',
              }}
            />
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
