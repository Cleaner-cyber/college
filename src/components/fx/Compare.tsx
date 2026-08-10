import React, { useCallback, useRef, useState } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

interface CompareProps {
  before: string; // 左半（改前）
  after: string; // 右半（改后）
  beforeLabel: string;
  afterLabel: string;
  hint?: string; // aria-label 用
  className?: string;
}

/** 改前/改后对比滑块（Aceternity Compare 机制的零依赖重写，见 docs/13）。
 * 指针拖动或 ←→ 键移动中线；线左边是改前、右边是改后。
 * 两张图必须同尺寸（上层保证）。无循环动画，天然满足动效纪律。 */
export const Compare: React.FC<CompareProps> = ({
  before,
  after,
  beforeLabel,
  afterLabel,
  hint,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [pos, setPos] = useState(50);

  const moveTo = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.min(96, Math.max(4, ((clientX - r.left) / r.width) * 100)));
  }, []);

  return (
    <div
      ref={ref}
      role="slider"
      aria-label={hint}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPos((p) => Math.max(4, p - 4));
        if (e.key === 'ArrowRight') setPos((p) => Math.min(96, p + 4));
      }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && moveTo(e.clientX)}
      onPointerUp={() => {
        dragging.current = false;
      }}
      className={`relative cursor-ew-resize touch-none select-none overflow-hidden rounded-lg border border-line shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-ember/70 ${className}`}
    >
      <img src={after} alt="" draggable={false} className="block w-full" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt="" draggable={false} className="block h-full w-full" />
      </div>
      {/* 分割线 + 手柄 */}
      <div className="pointer-events-none absolute bottom-0 top-0" style={{ left: `${pos}%` }}>
        <div className="absolute bottom-0 top-0 w-[2px] -translate-x-1/2 bg-cream/90 shadow-[0_0_6px_rgba(38,24,15,0.45)]" />
        <span className="absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-milk text-ink shadow-soft">
          <ChevronsLeftRight size={14} strokeWidth={2} />
        </span>
      </div>
      <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] text-paper">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] text-paper">
        {afterLabel}
      </span>
    </div>
  );
};
