/**
 * PPT 成品翻页查看器：全屏灯箱，左右翻页（点击两侧/按钮/方向键）+ 底部缩略图条。
 * 用于展示真实 AI 工具生成的 PPT 成品（逐页 JPG）。文案由调用方传入。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SlideViewerLabels {
  close: string;
  counter: string; // 形如 "{n} / {total}"
  hint: string;
}

function interp(tmpl: string, vars: Record<string, string | number>): string {
  return tmpl.replace(/\{(\w+)\}/g, (raw, k: string) =>
    vars[k] === undefined ? raw : String(vars[k]),
  );
}

export const SlideViewer: React.FC<{
  title: string;
  note?: string;
  pages: string[];
  labels: SlideViewerLabels;
  onClose: () => void;
}> = ({ title, note, pages, labels, onClose }) => {
  const [n, setN] = useState(0);

  const step = useCallback(
    (d: number) => setN((v) => Math.min(pages.length - 1, Math.max(0, v + d))),
    [pages.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="flex h-[92dvh] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl bg-card shadow-pop animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <header className="flex items-center gap-3 border-b border-line bg-paper/70 px-5 py-3">
          <span className="text-xl">📽️</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold">{title}</h2>
            {note && <p className="truncate text-[11px] text-ink-soft">{note}</p>}
          </div>
          <span className="rounded bg-accent-soft px-2 py-0.5 text-[12px] font-medium tabular-nums text-accent">
            {interp(labels.counter, { n: n + 1, total: pages.length })}
          </span>
          <button
            onClick={onClose}
            className="rounded-full border border-line bg-card px-3 py-1 text-xs text-ink-soft transition hover:border-accent/50 hover:text-ink"
          >
            ✕ {labels.close}
          </button>
        </header>

        {/* 大图区：点击左右半屏翻页 */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-ink/5 px-14 py-3">
          <img
            src={pages[n]}
            alt=""
            className="max-h-full max-w-full rounded-lg border border-line bg-white shadow-lift"
          />
          <button
            onClick={() => step(-1)}
            disabled={n === 0}
            aria-label="prev"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-line bg-card px-3 py-2 text-lg shadow-soft transition hover:shadow-lift disabled:opacity-30"
          >
            ‹
          </button>
          <button
            onClick={() => step(1)}
            disabled={n === pages.length - 1}
            aria-label="next"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-line bg-card px-3 py-2 text-lg shadow-soft transition hover:shadow-lift disabled:opacity-30"
          >
            ›
          </button>
        </div>

        {/* 底部：缩略图条 + 提示 */}
        <footer className="border-t border-line bg-paper/60 px-4 py-2.5">
          <div className="flex items-center justify-center gap-1.5 overflow-x-auto">
            {pages.map((p, i) => (
              <button
                key={i}
                onClick={() => setN(i)}
                className={`h-11 shrink-0 overflow-hidden rounded border-2 transition ${
                  i === n ? 'border-accent shadow-glow' : 'border-line opacity-60 hover:opacity-100'
                }`}
              >
                <img src={p} alt="" loading="lazy" className="h-full w-auto" />
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-ink-soft">{labels.hint}</p>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
