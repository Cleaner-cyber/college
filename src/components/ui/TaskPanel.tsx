import React, { useState } from 'react';
import type { ChecklistItem } from '@/contracts';
import { ui, interpolate } from '@/engine/content';

interface TaskPanelProps {
  items: ChecklistItem[];
  checked: string[];
  title?: string; // 覆盖默认标题（默认「学姐的要求」，按关卡的派活人改）
}

/** 验收清单（任务面板）：折叠角标 + 展开列表 */
export const TaskPanel: React.FC<TaskPanelProps> = ({ items, checked, title }) => {
  const [open, setOpen] = useState(false);
  const done = items.filter((i) => checked.includes(i.id)).length;

  return (
    <div className="fixed right-6 top-20 z-20 text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-cream/20 bg-dusk/80 px-3.5 py-1.5 font-display text-cream shadow-glass backdrop-blur-md transition hover:-translate-y-0.5 hover:border-ember/60"
      >
        {title || ui.checklist.title}{' '}
        <span className="font-sans font-semibold text-ember">
          {interpolate(ui.checklist.progress, { done, total: items.length })}
        </span>
      </button>
      {open && (
        <ul className="mt-2 w-52 rounded-xl border border-cream/15 bg-dusk/85 p-3 text-cream shadow-glass backdrop-blur-md animate-pop-in">
          {items.map((item) => {
            const isDone = checked.includes(item.id);
            return (
              <li key={item.id} className="flex items-center gap-2 py-1">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors duration-300 ${
                    isDone ? 'border-ember bg-ember' : 'border-cream/30 bg-transparent'
                  }`}
                >
                  {/* 勾像笔画一样画出来（dashoffset 24→0），比瞬时打勾更有"完成一项"的手感 */}
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden>
                    <path
                      d="M4.5 12.5 L9.5 17.5 L19.5 6.5"
                      stroke="#26180F"
                      strokeWidth={3.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="fx-tick"
                      style={{ strokeDasharray: 26, strokeDashoffset: isDone ? 0 : 26 }}
                    />
                  </svg>
                </span>
                <span className={isDone ? 'text-cream' : 'text-cream-soft'}>{item.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
