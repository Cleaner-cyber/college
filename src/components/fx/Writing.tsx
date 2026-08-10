import React from 'react';
import { Pencil } from 'lucide-react';

/** 「学长正在写…」：铅笔画线的加载指示（Uiverse 铅笔机制简化版，见 docs/13）。
 * 加载指示是无限循环动画唯一的正当场合；reduced-motion 下降级为静态铅笔+整线。 */
export const Writing: React.FC = () => (
  <span aria-hidden className="fx-write">
    <span className="fx-write-line" />
    <Pencil size={12} strokeWidth={2} className="fx-write-pencil" />
  </span>
);
