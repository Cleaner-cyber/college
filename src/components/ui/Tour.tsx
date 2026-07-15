/**
 * Home 新手引导：聚光灯高亮 + 气泡说明，可跳过。
 * 目标元素用 data-tour="步骤名" 标记；步骤文案在 content/ui/ui.json 的 tour 段。
 */
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ui, interpolate } from '@/engine/content';
import { Button } from './Button';

const tour = ui.tour as Record<string, string>;

export const TOUR_KEY = 'unisim_tour_v1';
export const VN_HINT_KEY = 'unisim_vnhint_v1';

const STEPS = ['mainline', 'electives', 'rail', 'nav', 'settle'] as const;

const BUBBLE_W = 340;

export const HomeTour: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const measure = useCallback(() => {
    const el = document.querySelector(`[data-tour="${STEPS[idx]}"]`);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [idx]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const finish = () => {
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch {
      /* ignore */
    }
    onClose();
  };

  const isLast = idx === STEPS.length - 1;

  // 气泡位置：优先目标下方，放不下则上方；水平方向夹在视口内
  const bubbleTop = rect
    ? rect.bottom + 320 < window.innerHeight
      ? rect.bottom + 14
      : Math.max(16, rect.top - 240)
    : window.innerHeight / 2 - 120;
  const bubbleLeft = rect
    ? Math.min(Math.max(rect.left, 16), window.innerWidth - BUBBLE_W - 16)
    : window.innerWidth / 2 - BUBBLE_W / 2;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* 聚光灯：高亮框 + 环形遮罩 */}
      {rect && (
        <div
          className="pointer-events-none fixed rounded-2xl border-2 border-accent transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(28,27,24,0.5)',
          }}
        />
      )}
      {!rect && <div className="fixed inset-0 bg-ink/50" />}

      {/* 气泡 */}
      <div
        className="fixed rounded-2xl border border-line bg-paper p-5 shadow-pop animate-pop-in"
        style={{ top: bubbleTop, left: bubbleLeft, width: BUBBLE_W }}
        key={idx}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="text-[15px] font-semibold text-accent">
            {tour[`step-${STEPS[idx]}-title`]}
          </h4>
          <span className="text-xs text-ink-soft">
            {interpolate(tour['progress'], { step: idx + 1, total: STEPS.length })}
          </span>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed">{tour[`step-${STEPS[idx]}-body`]}</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            className="text-xs text-ink-soft underline underline-offset-4"
            onClick={finish}
          >
            {tour['skip']}
          </button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === idx ? 'bg-accent' : 'bg-line'}`}
              />
            ))}
          </div>
          <Button onClick={() => (isLast ? finish() : setIdx((i) => i + 1))}>
            {isLast ? tour['done'] : tour['next']}
          </Button>
        </div>
      </div>
    </div>
  );
};
