import React from 'react';

interface PanelProps {
  title?: string;
  sub?: string;
  className?: string;
  children: React.ReactNode;
}

/** 桌面端通用面板卡片（半透明 + 毛玻璃：叠在场景背景上仍可读） */
export const Panel: React.FC<PanelProps> = ({ title, sub, className = '', children }) => (
  <section className={`rounded-2xl border border-line/70 bg-card/85 p-5 shadow-soft backdrop-blur-md ${className}`}>
    {title && (
      <header className="mb-4">
        <h2 className="text-[15px] font-semibold tracking-wide">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
      </header>
    )}
    {children}
  </section>
);
