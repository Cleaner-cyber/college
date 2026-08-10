/**
 * 轻 3D 倾斜卡（调研自 Aceternity 3d-card 的机制，零依赖）：
 * perspective 容器 + 鼠标位置直接写 style.transform（不走 setState，无重渲染）。
 * 驯化参数：除数 40（≈最大 5°，上游默认 25 太浮夸）、回弹 ease-out 300ms。
 * 桌面端专属交互（项目 1280px 基准）；prefers-reduced-motion 下完全不动。
 */
import React, { useRef } from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** 越大越克制（角度=偏移px/divisor），默认 40 */
  divisor?: number;
}

export const TiltCard: React.FC<TiltCardProps> = ({ children, className = '', divisor = 40 }) => {
  const inner = useRef<HTMLDivElement>(null);
  const reduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = inner.current;
    if (!el || reduced.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) / divisor;
    const y = (e.clientY - r.top - r.height / 2) / divisor;
    el.style.transition = 'transform 80ms linear';
    el.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  };

  const onLeave = () => {
    const el = inner.current;
    if (!el) return;
    el.style.transition = 'transform 300ms ease-out';
    el.style.transform = 'rotateY(0deg) rotateX(0deg)';
  };

  return (
    <div style={{ perspective: '900px' }} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div
        ref={inner}
        className={className}
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
      >
        {children}
      </div>
    </div>
  );
};
