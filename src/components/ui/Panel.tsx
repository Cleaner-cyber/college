import React from 'react';

interface PanelProps {
  title?: string;
  sub?: string;
  className?: string;
  children: React.ReactNode;
}

/** 桌面端通用面板卡片 */
export const Panel: React.FC<PanelProps> = ({ title, sub, className = '', children }) => (
  <section className={`rounded-2xl border border-line bg-card p-5 ${className}`}>
    {title && (
      <header className="mb-4">
        <h2 className="text-[15px] font-semibold tracking-wide">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
      </header>
    )}
    {children}
  </section>
);
