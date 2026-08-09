/**
 * 飞书文档式查看器：左侧标题目录栏 + 右侧正文（Markdown），带字数/章节统计。
 * 目录点击滚动到对应章节；用于展示 AI 生成的长文档交付物。
 */
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ui } from '@/engine/content';
import { extractToc, renderMarkdown } from './Markdown';
import { FileText } from 'lucide-react';

const doc = ui.doc as Record<string, string>;

function interp(tmpl: string, vars: Record<string, string | number>): string {
  return tmpl.replace(/\{(\w+)\}/g, (raw, k: string) => (vars[k] === undefined ? raw : String(vars[k])));
}

export const DocViewer: React.FC<{ title: string; md: string; onClose: () => void }> = ({
  title,
  md,
  onClose,
}) => {
  const toc = useMemo(() => extractToc(md), [md]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const jump = (i: number) => {
    setActiveIdx(i);
    const el = bodyRef.current?.querySelectorAll('[data-md-heading]')[i];
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const chars = md.replace(/[\s|#*-]/g, '').length;
  const sections = toc.filter((t) => t.level === 1).length;

  // Portal 到 body：避免被带 transform 的祖先（页面过渡动画）困住 fixed 定位
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex h-[90dvh] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl bg-card shadow-pop animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 文档头 */}
        <header className="flex items-center gap-3 border-b border-line bg-paper/70 px-5 py-3">
          <FileText size={20} strokeWidth={1.75} className="text-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold">{title}</h2>
            <p className="text-[11px] text-ink-soft">
              {interp(doc['stats'], { chars: chars.toLocaleString('zh-CN'), sections })}
            </p>
          </div>
          <span className="rounded bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
            {doc['ai-tag']}
          </span>
          <button
            onClick={onClose}
            className="rounded-full border border-line bg-card px-3 py-1 text-xs text-ink-soft transition hover:border-accent/50 hover:text-ink"
          >
            ✕ {doc['close']}
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[232px_minmax(0,1fr)]">
          {/* 左侧目录栏 */}
          <nav className="overflow-y-auto border-r border-line bg-paper/50 px-3 py-4">
            <div className="mb-2 px-2 text-[11px] tracking-widest text-ink-soft">{doc['toc']}</div>
            <ol className="flex flex-col gap-0.5">
              {toc.map((t, i) => (
                <li key={i}>
                  <button
                    onClick={() => jump(i)}
                    className={`w-full truncate rounded-lg px-2 py-1.5 text-left transition ${
                      t.level === 1 ? 'text-[12.5px] font-medium' : 'pl-5 text-[12px] text-ink-soft'
                    } ${i === activeIdx ? 'bg-accent-soft text-accent' : 'hover:bg-line/50'}`}
                  >
                    {t.text}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          {/* 正文 */}
          <div ref={bodyRef} className="overflow-y-auto scroll-pt-4 px-8 py-6">
            <h1 className="mb-4 text-[22px] font-semibold leading-snug">{title}</h1>
            {renderMarkdown(md)}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
