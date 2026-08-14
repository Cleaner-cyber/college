/**
 * 开局仪式（滑动启封）：一封录取通知书信封，按住滑块向右拖——
 * 封面沿锯齿撕裂线分成上下两半撕开，露出里面的通知书，随后进入序章 VN。
 * 纯演出层：不触碰 store，文案全部来自 prologue.json 的 copy。
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronsRight } from 'lucide-react';

/** 撕裂线：上下两半 clip-path 共用同一组锯齿点位，合上时严丝合缝，分开即撕口 */
const TEAR: [number, number][] = [
  [0, 52], [6, 49], [13, 54], [20, 50], [27, 55], [34, 51], [41, 56],
  [48, 50], [55, 55], [62, 51], [69, 56], [76, 50], [83, 54], [90, 49], [100, 52],
];
const tearPts = TEAR.map(([x, y]) => `${x}% ${y}%`);
const CLIP_TOP = `polygon(0% 0%, 100% 0%, ${[...tearPts].reverse().join(', ')})`;
const CLIP_BOTTOM = `polygon(${tearPts.join(', ')}, 100% 100%, 0% 100%)`;

/** 封面一半：内容在两半里各画一份，被 clip-path 各裁走一半——分开时字和火漆都被「撕」开 */
const CoverHalf: React.FC<{
  clip: string;
  style: React.CSSProperties;
  copy: Record<string, string>;
}> = ({ clip, style, copy }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0"
    style={{ clipPath: clip, ...style }}
  >
    {/* fx-paper 自带 position:relative 且晚于工具类加载，会吃掉 absolute——这里必须 !absolute */}
    <div className="fx-paper !absolute inset-0 rounded-2xl border border-cream-soft/50 bg-gradient-to-b from-parchment to-cream shadow-lift" />
    {/* 信封斜线纹（封套的「V」形折线，极淡） */}
    <svg className="absolute inset-0 h-full w-full opacity-[0.07]" preserveAspectRatio="none" viewBox="0 0 100 100">
      <path d="M0 0 L50 34 L100 0" fill="none" stroke="#26180F" strokeWidth="0.6" />
      <path d="M0 100 L50 66 L100 100" fill="none" stroke="#26180F" strokeWidth="0.6" />
    </svg>
    <span className="absolute inset-x-0 top-[17%] text-center text-[11px] uppercase tracking-[0.42em] text-ink-soft/70">
      {copy['envelope-en']}
    </span>
    <span className="absolute inset-x-0 top-[70%] text-center font-display text-[15px] tracking-[0.5em] text-ink-soft/80">
      {copy['envelope-title']}
    </span>
    {/* 火漆印：骑在撕裂线上，撕开时一分为二 */}
    <span className="absolute left-1/2 top-[52%] flex h-[64px] w-[64px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent shadow-pop ring-4 ring-accent-deep/40">
      <span className="font-display text-[26px] font-semibold text-milk">{copy['envelope-seal']}</span>
    </span>
  </div>
);

export const EnvelopeIntro: React.FC<{
  copy: Record<string, string>;
  onOpen: () => void;
}> = ({ copy, onOpen }) => {
  const [p, setP] = useState(0); // 0..1 启封进度
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const complete = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setDragging(false);
    setP(1);
    setDone(true);
    window.setTimeout(onOpen, reduced ? 200 : 950);
  };

  useEffect(
    () => () => {
      doneRef.current = true;
    },
    [],
  );

  const posToP = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const r = track.getBoundingClientRect();
    const pad = 24; // 轨道两端半个滑块的余量
    return Math.min(1, Math.max(0, (clientX - r.left - pad) / (r.width - pad * 2)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (done) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    setP(posToP(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || done) return;
    setP(posToP(e.clientX));
  };
  const onPointerUp = () => {
    if (done) return;
    setDragging(false);
    if (p >= 0.85) complete();
    else setP(0);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (done) return;
    if (e.key === 'ArrowRight') setP((v) => (v + 0.15 >= 1 ? (complete(), 1) : v + 0.15));
    if (e.key === 'ArrowLeft') setP((v) => Math.max(0, v - 0.15));
    if (e.key === 'Enter' || e.key === 'End') complete();
  };

  // 撕开位移：完成后两半继续飞出画面并淡出
  const shift = done ? 96 : p * 44;
  const halfTransition = dragging
    ? 'none'
    : 'transform 0.55s cubic-bezier(0.22, 0.9, 0.3, 1), opacity 0.55s ease';
  const halfOpacity = done ? 0 : 1;

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-12 bg-dusk px-6"
      style={{
        backgroundImage:
          'radial-gradient(820px 480px at 50% 38%, rgba(255,179,92,0.10), transparent 70%)',
      }}
    >
      {/* 信封舞台 */}
      <div className="relative h-[340px] w-full max-w-[560px] select-none">
        {/* 信里的通知书：随启封进度亮起、坐正 */}
        <div
          className="fx-paper !absolute inset-x-8 inset-y-5 flex flex-col items-center justify-center gap-3 rounded-xl bg-milk text-center shadow-lift"
          style={{
            transform: `scale(${0.92 + (done ? 1 : p) * 0.08})`,
            opacity: 0.35 + (done ? 1 : p) * 0.65,
            transition: dragging ? 'none' : 'transform 0.55s ease, opacity 0.55s ease',
          }}
        >
          <span className="text-[10.5px] uppercase tracking-[0.42em] text-ink-soft/70">
            {copy['envelope-en']}
          </span>
          <span className="font-display text-[34px] font-semibold tracking-[0.18em] text-ink">
            {copy['envelope-title']}
          </span>
          <span className="h-px w-24 bg-line-warm" />
          <span className="text-[13.5px] leading-relaxed text-ink-soft">{copy['envelope-sub']}</span>
          <span className="text-[11.5px] tracking-[0.3em] text-ink-soft/60">{copy['envelope-date']}</span>
        </div>

        <CoverHalf
          clip={CLIP_TOP}
          copy={copy}
          style={{
            transform: `translateY(-${shift}%) rotate(${-(done ? 3 : p * 2.5)}deg)`,
            opacity: halfOpacity,
            transition: halfTransition,
          }}
        />
        <CoverHalf
          clip={CLIP_BOTTOM}
          copy={copy}
          style={{
            transform: `translateY(${shift}%) rotate(${done ? 2 : p * 1.5}deg)`,
            opacity: halfOpacity,
            transition: halfTransition,
          }}
        />
      </div>

      {/* 启封滑块（reduced-motion 降级为一键点击） */}
      {reduced ? (
        <button
          onClick={complete}
          className="rounded-full border border-cream/25 bg-dusk-2/70 px-8 py-3 text-[15px] text-cream transition hover:border-ember/60 hover:text-ember"
        >
          {copy['envelope-open-btn']}
        </button>
      ) : (
        <div
          className="flex flex-col items-center gap-3 transition-opacity duration-500"
          style={{ opacity: done ? 0 : 1 }}
        >
          <div
            ref={trackRef}
            className="relative h-14 w-[340px] overflow-hidden rounded-full border border-cream/20 bg-dusk-2/70 shadow-glass"
          >
            {/* 进度暖光 */}
            <div
              className="absolute inset-y-0 left-0 bg-ember/15"
              style={{ width: `${8 + p * 92}%`, transition: dragging ? 'none' : 'width 0.45s ease' }}
            />
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center pl-10 text-[13px] tracking-wide text-cream-soft/70"
              style={{ opacity: 1 - p * 1.6 }}
            >
              {copy['envelope-hint']}
            </span>
            <div
              role="slider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(p * 100)}
              aria-label={copy['envelope-hint']}
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              className="absolute top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full bg-ember text-dusk shadow-pop outline-none ring-ember/40 focus-visible:ring-4 active:cursor-grabbing"
              style={{
                left: `calc(6px + ${p} * (100% - 56px))`,
                transition: dragging ? 'none' : 'left 0.45s cubic-bezier(0.22, 0.9, 0.3, 1)',
              }}
            >
              <ChevronsRight size={22} strokeWidth={2.25} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
