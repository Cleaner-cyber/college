import React from 'react';

interface PanelProps {
  title?: string;
  sub?: string;
  className?: string;
  children: React.ReactNode;
}

/** 桌面端通用面板卡片：深棕玻璃 + 奶油字。
 * 这些面板一律叠在傍晚实景底图上，用浅色半透明卡的话场景和热点按钮会直接透出来，
 * 文字压在晚霞上读不清——所以走和 HUD / 校园地图同一套深色玻璃。 */
export const Panel: React.FC<PanelProps> = ({ title, sub, className = '', children }) => (
  <section
    className={`rounded-2xl border border-cream/15 bg-dusk/90 p-5 text-cream shadow-glass backdrop-blur-xl backdrop-saturate-125 ${className}`}
  >
    {title && (
      <header className="mb-4">
        <h2 className="font-display text-[15px] font-semibold tracking-wide text-cream">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-cream-soft">{sub}</p>}
      </header>
    )}
    {children}
  </section>
);
