import React from 'react';
import type { PlayerState } from '@/contracts';
import { ui } from '@/engine/content';

const VISIBLE_AXES = ['academic', 'portfolio', 'expression', 'cash'] as const;
const AXIS_MAX = 8; // 迷你条满刻度

interface HUDProps {
  header: string;
  state: Readonly<PlayerState>;
  maxPoints?: number;
}

/** 行动板顶部 HUD：学期 + 行动点 ●●● + 四轴迷你条（精力为隐藏轴，不展示） */
export const HUD: React.FC<HUDProps> = ({ header, state, maxPoints = 3 }) => {
  return (
    <div className="sticky top-0 z-10 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-app items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold tracking-wide">{header}</div>
          <div className="mt-1 flex items-center gap-1.5" aria-label={ui.hud['action-points']}>
            <span className="text-xs text-ink-soft">{ui.hud['action-points']}</span>
            {Array.from({ length: maxPoints }).map((_, i) => (
              <span
                key={i}
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  i < state.actionPoints ? 'bg-accent' : 'border border-line bg-card'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {VISIBLE_AXES.map((axis) => (
            <div key={axis} className="flex items-center gap-1.5">
              <span className="w-7 text-right text-[11px] text-ink-soft">{ui.axes[axis]}</span>
              <div className="h-1 w-12 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-ink transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (state.axes[axis] / AXIS_MAX) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
