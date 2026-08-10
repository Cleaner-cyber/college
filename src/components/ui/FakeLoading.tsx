import React, { useEffect, useState } from 'react';

interface FakeLoadingProps {
  ms: number;
  tips: string[];
  onDone: () => void;
}

/** 假生成等待：进度条 + 学长旁批轮播。demo 的「AI 生成」全部是演出。 */
export const FakeLoading: React.FC<FakeLoadingProps> = ({ ms, tips, onDone }) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms]);

  useEffect(() => {
    if (tips.length <= 1) return;
    const interval = window.setInterval(
      () => setTipIndex((i) => (i + 1) % tips.length),
      Math.max(900, ms / tips.length),
    );
    return () => window.clearInterval(interval);
  }, [tips, ms]);

  return (
    <div className="flex flex-col items-center gap-4 py-10 animate-fade-up">
      {/* 翻书加载器：假生成的"学长在翻资料"演出（Uiverse 机制重着色，见 docs/13） */}
      <div aria-hidden className="fx-book mb-1">
        <div className="fx-book-page" />
        <div className="fx-book-page fx-book-page2" />
      </div>
      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-line shadow-inner">
        <div
          className="h-full rounded-full bg-accent shadow-glow transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      {tips.length > 0 && (
        <p
          key={tipIndex}
          className="rounded-full border border-cream/15 bg-dusk/70 px-4 py-1.5 text-sm text-cream-soft shadow-glass backdrop-blur-md animate-fade-up"
        >
          {tips[tipIndex]}
        </p>
      )}
    </div>
  );
};
