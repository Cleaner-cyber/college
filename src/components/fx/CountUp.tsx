/**
 * 数字滚动（调研自 React Bits CountUp 的机制，重写为零依赖版）：
 * rAF + easeOutCubic，直接写 textContent 不触发重渲染；挂载时起跑一次。
 * 上游实现依赖 framer-motion（~50KB gz）——为一个数字动画引入引擎不值，30 行自己写。
 * prefers-reduced-motion 下直接落终值。
 */
import React, { useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  /** 小数位（GPA 用 2，概率/整数用 0） */
  decimals?: number;
  /** 动画时长 ms（默认 900，结算条动画是 700，略慢一拍收尾） */
  duration?: number;
  /** 起跑延迟 ms */
  delay?: number;
  className?: string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const CountUp: React.FC<CountUpProps> = ({
  to,
  decimals = 0,
  duration = 900,
  delay = 0,
  className,
}) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (v: number) => v.toFixed(decimals);
    // 减motion偏好 / 零时长：直接落终值
    if (
      duration <= 0 ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      el.textContent = fmt(to);
      return;
    }
    el.textContent = fmt(0);
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      el.textContent = fmt(to * easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const t = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [to, decimals, duration, delay]);

  // 初始渲染即带终值：JS 禁用/异常时也不至于空白
  return (
    <span ref={ref} className={className}>
      {to.toFixed(decimals)}
    </span>
  );
};
