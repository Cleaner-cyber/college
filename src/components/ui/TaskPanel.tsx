import React, { useState } from 'react';
import type { ChecklistItem } from '@/contracts';
import { ui, interpolate } from '@/engine/content';

interface TaskPanelProps {
  items: ChecklistItem[];
  checked: string[];
}

/** 验收清单（任务面板）：折叠角标 + 展开列表 */
export const TaskPanel: React.FC<TaskPanelProps> = ({ items, checked }) => {
  const [open, setOpen] = useState(false);
  const done = items.filter((i) => checked.includes(i.id)).length;

  return (
    <div className="fixed right-3 top-16 z-20 text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-line bg-card px-3 py-1.5 shadow-sm"
      >
        {ui.checklist.title}{' '}
        <span className="font-semibold text-accent">
          {interpolate(ui.checklist.progress, { done, total: items.length })}
        </span>
      </button>
      {open && (
        <ul className="mt-2 w-52 rounded-xl border border-line bg-card p-3 shadow-sm animate-fade-up">
          {items.map((item) => {
            const isDone = checked.includes(item.id);
            return (
              <li key={item.id} className="flex items-center gap-2 py-1">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                    isDone ? 'border-accent bg-accent text-white' : 'border-line bg-paper'
                  }`}
                >
                  {isDone ? '✓' : ''}
                </span>
                <span className={isDone ? 'text-ink' : 'text-ink-soft'}>{item.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
