/**
 * 鼠标跟随暖光（调研自 React Bits SpotlightCard；按其性能建议改为
 * 「ref 写 CSS 变量」版，不走 setState——卡片网格里逐帧重渲染是上游已知坑）。
 * 用法：元素加 className「fx-spotlight relative」+ onMouseMove={spotlightMove}；
 * 光斑样式在 fx.css（::after 径向渐变，hover 淡入，reduced-motion 下无动画只有静光）。
 */
import type React from 'react';

export function spotlightMove(e: React.MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--fx-x', `${e.clientX - r.left}px`);
  el.style.setProperty('--fx-y', `${e.clientY - r.top}px`);
}
