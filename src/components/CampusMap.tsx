/**
 * 校园地图（v2.6 场景化）：全屏覆盖层，地标图钉叠在 bg-campus.svg 上。
 * 主线关卡绑定到对应地点（选课→教务处、社团→学生活动中心…），点亮的图钉点击进关；
 * 文案来自 ui.json 的 map 段；坐标与资产 bg-campus.svg 的建筑落位对齐。
 */
import React from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6" onClick={onClose}>
      <div
        className="relative w-full max-w-[1100px] overflow-hidden rounded-2xl shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imgSrc}
          onError={() => imgSrc !== '/assets/bg-campus.svg' && setImgSrc('/assets/bg-campus.svg')}
          alt=""
          className="block w-full select-none"
          draggable={false}
        />
        {/* 顶部标题条：深棕玻璃 + 衬线标题（与傍晚底图同色系） */}
        <div className="absolute left-4 top-4 rounded-xl border border-cream/15 bg-dusk/80 px-4 py-2 text-cream shadow-glass backdrop-blur-md">
          <div className="font-display text-[16px] font-semibold tracking-[0.2em]">{map['title']}</div>
          <div className="text-[11px] text-cream-soft">{map['sub']}</div>
        </div>
        <button
          className="absolute right-4 top-4 rounded-xl border border-cream/20 bg-dusk/80 px-3.5 py-2 text-sm text-cream shadow-glass backdrop-blur-md transition hover:border-ember/60 hover:text-ember"
          onClick={onClose}
        >
          {map['close']}
        </button>

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
                className={`group flex flex-col items-center ${!isDorm && !active ? 'cursor-default' : ''}`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-[15px] transition ${
                    active
                      ? 'animate-ember-breathe border-cream/70 bg-gradient-to-b from-ember to-ember-deep font-bold text-dusk shadow-ember-glow'
                      : done
                        ? 'border-cream/25 bg-dusk/70 text-cream-soft shadow-glass'
                        : isDorm
                          ? 'border-cream/35 bg-dusk/75 text-cream shadow-glass'
                          : 'border-cream/10 bg-dusk/40 text-cream-soft/40'
                  }`}
                >
                  {active ? '!' : done ? '✓' : isDorm ? '🏠' : '·'}
                </span>
                <span
                  className={`mt-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] tracking-wide backdrop-blur-sm ${
                    active
                      ? 'border-ember/60 bg-ember font-semibold text-dusk shadow-ember-glow'
                      : 'border-cream/15 bg-dusk/75 text-cream shadow-glass'
                  }`}
                >
                  {map[`loc-${loc.id}`] ?? loc.id}
                </span>
                {active && (
                  <span className="mt-0.5 whitespace-nowrap rounded-md border border-ember/50 bg-dusk/85 px-2 py-0.5 text-[11px] font-medium text-ember shadow-glass backdrop-blur-sm">
                    {active.label}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
