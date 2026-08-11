/**
 * 海报关 v2：教学「生图与迭代」。主线必修 · 演出素材为真实 AI 生图。
 * 流程：读学姐需求单 → 照单写提示词（选对比例）→ v1 深色动漫版 → 学姐进阶挑战
 * （改清新校园插画风 + 拖 logo 参考图）→ v2 → 学姐要二维码 → AI 画码翻车（黑马赛克）
 * → 剪映后期合成教学（含去水印技巧）→ 终稿交付。
 * 任意时刻可点 [问学长] 跳过，产物入库并标记 borrowed。
 */
import React, { useEffect, useRef, useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { ui, interpolate } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { SenpaiAvatar, NpcAvatar } from '@/components/ui/SpeakerTag';
import { ClipboardList, Droplet, Image as ImageIcon, Scissors } from 'lucide-react';
import { Writing } from '@/components/fx/Writing';
import { Compare } from '@/components/fx/Compare';

type Stage =
  | 'build' // 照需求单拼提示词（选比例）
  | 'think1'
  | 'v1' // 首版出图，[发给学姐]
  | 'challenge' // 学姐进阶挑战：改风格 + 拖 logo
  | 'think2'
  | 'v2' // 清新校园版，[发给学姐]
  | 'qr' // 学姐要二维码
  | 'thinkqr'
  | 'qrfail'; // AI 画码翻车 → [打开剪映]

type Msg =
  | { kind: 'user'; text: string; param?: string; prefix?: string }
  | { kind: 'ai'; text: string; img?: string; fakeQr?: boolean; tag?: string }
  | { kind: 'compare' } // v1/v2 对比滑块（迭代教学的落点）
  | { kind: 'file'; text: string }
  | { kind: 'qrfile' } // 学姐发来的真实报名二维码
  | { kind: 'senpai'; text: string }
  | { kind: 'xuejie'; text: string };

/** 出图气泡；fakeQr 时在左下二维码区叠一块"扫不出来的黑马赛克" */
const PosterImage: React.FC<{ src?: string; fakeQr?: boolean; tag?: string }> = ({
  src,
  fakeQr = false,
  tag,
}) => (
  <div className="relative w-full max-w-[250px]">
    {src && (
      <img
        src={src}
        alt=""
        style={{ aspectRatio: '3 / 4' }}
        className="w-full rounded-lg border border-line object-cover shadow-soft"
      />
    )}
    {fakeQr && (
      <>
        <span
          className="absolute bottom-[4.5%] left-[6.5%] h-[13%] w-[24%] rounded-sm border border-black/60"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,#0a0a0a 0 5px,#2e2e2e 5px 9px,#000 9px 15px),repeating-linear-gradient(90deg,#000 0 6px,#242424 6px 10px,#0f0f0f 10px 17px)',
            backgroundBlendMode: 'multiply',
          }}
        />
        {tag && (
          <span className="absolute bottom-[19%] left-[6%] rounded bg-ink/80 px-1.5 py-0.5 text-[10px] text-paper">
            ⚠ {tag}
          </span>
        )}
      </>
    )}
  </div>
);

/** 假生成等待：铅笔 + 分步清单（Aceternity Multi Step Loader 的零依赖重写，见 docs/13）。
 * 步骤按 THINK_MS 均分点亮，勾用 .fx-tick 画出来。 */
const THINK_MS = 2600;
const Thinking: React.FC<{ label: string; tip: string; steps: string[] }> = ({
  label,
  tip,
  steps,
}) => {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const per = THINK_MS / (steps.length + 1); // 最后留一段"出图"余量，不让清单先全亮
    const t = window.setInterval(() => setDone((d) => Math.min(steps.length, d + 1)), per);
    return () => window.clearInterval(t);
  }, [steps.length]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[13px] text-cream-soft">
        <Writing />
        {label}
      </div>
      <ul className="flex flex-col gap-1.5 pl-1">
        {steps.map((s, i) => {
          const isDone = i < done;
          return (
            <li key={s} className="flex items-center gap-2 text-[12px]">
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors duration-300 ${
                  isDone ? 'border-ember bg-ember' : 'border-cream/25 bg-transparent'
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" aria-hidden>
                  <path
                    d="M4.5 12.5 L9.5 17.5 L19.5 6.5"
                    stroke="#26180F"
                    strokeWidth={3.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="fx-tick"
                    style={{ strokeDasharray: 26, strokeDashoffset: isDone ? 0 : 26 }}
                  />
                </svg>
              </span>
              <span className={isDone ? 'text-cream' : 'text-cream-soft/60'}>{s}</span>
            </li>
          );
        })}
      </ul>
      <span className="text-[11.5px] text-cream-soft/70">{tip}</span>
    </div>
  );
};

const GenChat: React.FC<{ api: FlowAPI; assets: Record<string, string> }> = ({ api, assets }) => {
  const [stage, setStage] = useState<Stage>('build');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [ratio, setRatio] = useState<'' | 'portrait' | 'landscape'>('');
  const [styleAdded, setStyleAdded] = useState(false);
  const [logoFed, setLogoFed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const building = stage === 'build';
  const challenge = stage === 'challenge';
  const thinking = stage.startsWith('think');
  const hints = ui.hints as Record<string, string>;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    // 出图消息的图片加载完成后内容会再长高一截，滚动要补一次，
    // 否则图片下面的消息（对比滑块等）会被顶出视口
    const t = window.setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 450);
    return () => window.clearTimeout(t);
  }, [msgs, stage, styleAdded, logoFed]);

  // 思考 → 出图
  useEffect(() => {
    if (!thinking) return;
    const t = window.setTimeout(() => {
      if (stage === 'think1') {
        api.check('ck-copy');
        setMsgs((m) => [
          ...m,
          { kind: 'ai', text: api.copy('ai-v1'), img: assets['poster-acg-v1'] },
          { kind: 'senpai', text: api.copy('senpai-v1') },
        ]);
        setStage('v1');
      } else if (stage === 'think2') {
        setMsgs((m) => [
          ...m,
          { kind: 'ai', text: api.copy('ai-v2'), img: assets['poster-acg-v2'] },
          { kind: 'senpai', text: api.copy('compare-note') },
          { kind: 'compare' },
        ]);
        setStage('v2');
      } else {
        setMsgs((m) => [
          ...m,
          {
            kind: 'ai',
            text: api.copy('ai-qr'),
            img: assets['poster-acg-v2'],
            fakeQr: true,
            tag: api.copy('qr-fake-tag'),
          },
          { kind: 'senpai', text: api.copy('senpai-qr-fail') },
        ]);
        setStage('qrfail');
      }
    }, THINK_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const generateV1 = () => {
    setMsgs((m) => [
      ...m,
      {
        kind: 'user',
        text: api.copy('p-v1'),
        param: interpolate(api.copy('param-tag'), { size: api.copy('size-portrait') }),
      },
    ]);
    setStage('think1');
  };

  const sendToXuejie = () => {
    setMsgs((m) => [...m, { kind: 'xuejie', text: api.copy('xuejie-1') }, { kind: 'senpai', text: api.copy('senpai-challenge') }]);
    setStage('challenge');
  };

  const addStyle = () => {
    if (styleAdded) return;
    setStyleAdded(true);
    api.check('ck-style');
    setMsgs((m) => [
      ...m,
      { kind: 'user', text: api.copy('rev-style'), prefix: api.copy('user-revise-prefix') },
    ]);
  };

  const feedLogo = () => {
    if (!challenge || logoFed) return;
    setLogoFed(true);
    api.check('ck-logo');
    setMsgs((m) => [...m, { kind: 'file', text: api.copy('msg-logo') }]);
  };

  const generateV2 = () => {
    if (!styleAdded || !logoFed) return;
    setStage('think2');
  };

  const sendV2 = () => {
    setMsgs((m) => [...m, { kind: 'xuejie', text: api.copy('xuejie-2') }, { kind: 'qrfile' }]);
    setStage('qr');
  };

  const tryQr = () => {
    setMsgs((m) => [...m, { kind: 'user', text: api.copy('q-qr') }]);
    setStage('thinkqr');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="self-start rounded-full border border-cream/15 bg-dusk/70 px-4 py-1.5 text-[12px] tracking-wide text-cream-soft shadow-glass backdrop-blur-md">
        {api.copy('s3-steps')}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[264px_minmax(0,1fr)] md:gap-5">
        {/* 需求单 + 参数面板 */}
        <aside className="flex flex-col gap-3">
          <div className="fx-paper rounded-2xl border border-accent/30 bg-parchment/95 p-4 text-ink shadow-lift">
            <div className="mb-2.5 font-display text-[13px] font-bold tracking-widest text-accent">
              <ClipboardList size={14} strokeWidth={1.75} className="inline align-[-2px]" /> {api.copy('req-title')}
            </div>
            <ul className="space-y-2.5 text-[12px] leading-relaxed text-ink">
              {['req-theme', 'req-sub', 'req-ratio', 'req-copy', 'req-qr'].map((k, i) => (
                <li key={k} className="flex gap-1.5">
                  <span className="shrink-0 font-semibold text-accent/70">{i + 1}.</span>
                  <span className="whitespace-pre-wrap">{api.copy(k)}</span>
                </li>
              ))}
            </ul>
          </div>

          {building && (
            <div className="rounded-2xl border border-cream/12 bg-dusk/80 p-4 shadow-glass backdrop-blur-md">
              <div className="mb-1.5 font-display text-[12px] tracking-widest text-cream-soft">
                {api.copy('s3-size-label')}
              </div>
              <div className="flex flex-col gap-1.5">
                {(['portrait', 'landscape'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRatio(r);
                      if (r === 'portrait') api.check('ck-ratio');
                    }}
                    className={`rounded-lg border-2 px-2.5 py-1.5 text-[12.5px] transition ${
                      ratio === r
                        ? 'border-ember bg-ember/15 text-ember'
                        : 'border-cream/20 bg-dusk-2/60 text-cream hover:border-ember/50'
                    }`}
                  >
                    {api.copy(`size-${r}`)}
                  </button>
                ))}
              </div>
              {ratio === 'landscape' && (
                <p className="mt-1.5 text-[11px] text-ember animate-fade-up">
                  {api.copy('s3-size-warn')}
                </p>
              )}
              <p className="mt-1.5 text-[11px] leading-relaxed text-cream-soft">
                {api.copy('s3-size-note')}
              </p>
            </div>
          )}

          {/* 挑战阶段：logo 参考图文件卡 */}
          {challenge && !logoFed && (
            <div className="animate-fade-up">
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', 'club-logo');
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onDoubleClick={feedLogo}
                className="cursor-grab select-none rounded-xl border border-accent bg-milk p-3 text-ink shadow-glow transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-start gap-2.5">
                  <img
                    src={assets['club-logo']}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-lg border border-line bg-white object-contain"
                  />
                  <div className="min-w-0">
                    <div className="break-all text-[12.5px] font-medium leading-snug">
                      {api.copy('file-logo-name')}
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-soft">
                      {api.copy('file-logo-meta')}
                    </div>
                    <div className="mt-1 text-[11px] text-accent animate-fade-up">
                      ← {api.copy('file-logo-hint')}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 rounded-xl border border-cream/15 bg-dusk/70 p-2.5 text-[11.5px] leading-relaxed text-cream-soft shadow-glass backdrop-blur-md">
                {hints['files-drag']}
              </p>
            </div>
          )}
          {!building && !challenge && (
            <p className="rounded-xl border border-cream/15 bg-dusk/70 p-2.5 text-[11.5px] leading-relaxed text-cream-soft shadow-glass backdrop-blur-md">
              {api.copy('builder-locked')}
            </p>
          )}
        </aside>

        {/* AI 生图对话框 */}
        <div
          onDragOver={(e) => {
            if (!challenge || logoFed) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.getData('text/plain') === 'club-logo') feedLogo();
          }}
          className={`fx-paper flex h-[560px] flex-col overflow-hidden rounded-2xl border-2 bg-dusk/85 shadow-glass backdrop-blur-md transition-colors ${
            dragOver
              ? 'border-ember bg-dusk-2/85'
              : challenge && !logoFed
                ? 'border-dashed border-cream/25'
                : 'border-cream/12'
          }`}
        >
          <div className="flex items-center gap-2 border-b border-cream/10 bg-dusk-2/70 px-4 py-2.5">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="h-2 w-2 rounded-full bg-cream/20" />
              <span className="h-2 w-2 rounded-full bg-cream/20" />
            </span>
            <span className="ml-1 font-display text-[13.5px] font-medium tracking-wide text-cream">
              {api.copy('chat-title')}
            </span>
          </div>

          {/* 消息区 */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-3">
              {msgs.map((m, i) => {
                if (m.kind === 'user') {
                  return (
                    <div key={i} className="flex flex-col items-end gap-1 animate-fade-up">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md border border-ember/30 bg-dusk-2 px-4 py-2.5 text-[13px] leading-relaxed text-cream">
                        {m.prefix && <span className="mr-1 opacity-60">{m.prefix}</span>}
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      </div>
                      {m.param && (
                        <span className="rounded-full border border-cream/15 bg-dusk-2/70 px-2.5 py-0.5 text-[11px] text-cream-soft">
                          ⚙ {m.param}
                        </span>
                      )}
                    </div>
                  );
                }
                if (m.kind === 'file') {
                  return (
                    <div key={i} className="flex justify-end animate-fade-up">
                      <span className="flex max-w-[75%] items-center gap-2 rounded-xl border border-line-warm bg-parchment/95 px-3 py-2 text-[12.5px] text-ink">
                        <ImageIcon size={14} strokeWidth={1.75} className="shrink-0 text-accent" /> <span>{m.text}</span>
                      </span>
                    </div>
                  );
                }
                if (m.kind === 'qrfile') {
                  return (
                    <div key={i} className="mx-auto w-[88%] animate-fade-up">
                      <div className="flex items-center gap-3 rounded-2xl border border-line-warm bg-parchment/95 p-3 text-ink shadow-soft">
                        <img
                          src={assets['qr-signup']}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-lg border border-line bg-white object-contain"
                        />
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium">{api.copy('qr-file-name')}</div>
                          <div className="mt-0.5 text-[11px] text-ink-soft">
                            {api.copy('qr-file-meta')}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (m.kind === 'compare') {
                  return (
                    <div key={i} className="flex justify-start animate-fade-up">
                      <div className="w-full max-w-[250px] rounded-2xl rounded-tl-md border border-line-warm bg-parchment/95 p-2.5">
                        <Compare
                          before={assets['poster-acg-v1']}
                          after={assets['poster-acg-v2']}
                          beforeLabel={api.copy('compare-before')}
                          afterLabel={api.copy('compare-after')}
                          hint={api.copy('compare-hint')}
                        />
                      </div>
                    </div>
                  );
                }
                if (m.kind === 'senpai') {
                  return (
                    <div key={i} className="flex items-start gap-2 py-1 animate-fade-up">
                      <SenpaiAvatar size={26} />
                      <p className="whitespace-pre-wrap pt-0.5 text-[12.5px] leading-relaxed text-ember">
                        {m.text}
                      </p>
                    </div>
                  );
                }
                if (m.kind === 'xuejie') {
                  return (
                    <div key={i} className="mx-auto w-[88%] animate-fade-up">
                      <div className="rounded-2xl border border-line-warm bg-parchment/95 p-3.5 text-ink shadow-soft">
                        <div className="mb-1.5 flex items-center gap-2">
                          <NpcAvatar name={api.copy('xuejie-name')} size={24} avatar={assets['avatar-xuejie']} />
                          <span className="text-[11px] tracking-widest text-ink-soft">
                            {api.copy('xuejie-msg-app')}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.text}</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex justify-start animate-fade-up">
                    <div className="flex max-w-[92%] flex-col gap-2.5 rounded-2xl rounded-tl-md border border-line-warm bg-parchment/95 px-4 py-3 text-ink">
                      <p className="text-[13px] leading-relaxed">{m.text}</p>
                      {m.img && <PosterImage src={m.img} fakeQr={m.fakeQr} tag={m.tag} />}
                    </div>
                  </div>
                );
              })}
              {thinking && (
                <Thinking
                  label={api.copy('gen-thinking')}
                  tip={api.copy('gen-tip')}
                  steps={['gen-step-1', 'gen-step-2', 'gen-step-3'].map((k) => api.copy(k))}
                />
              )}
            </div>
          </div>

          {/* 输入区（阶段操作） */}
          <div className="border-t border-cream/10 px-4 py-3">
            {stage === 'v1' && (
              <div className="mb-2.5 animate-fade-up">
                <Button onClick={sendToXuejie}>{api.copy('btn-to-xuejie')}</Button>
              </div>
            )}
            {challenge && (
              <div className="mb-2.5 flex flex-wrap items-center gap-2 animate-fade-up">
                {!styleAdded && (
                  <button
                    onClick={addStyle}
                    className="rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    {api.copy('chip-style')}
                  </button>
                )}
                {styleAdded && logoFed ? (
                  <Button onClick={generateV2}>{api.copy('btn-regen')}</Button>
                ) : (
                  <span className="text-[11.5px] text-ink-soft">{api.copy('regen-need-both')}</span>
                )}
              </div>
            )}
            {stage === 'v2' && (
              <div className="mb-2.5 animate-fade-up">
                <Button onClick={sendV2}>{api.copy('btn-to-xuejie-2')}</Button>
              </div>
            )}
            {stage === 'qr' && (
              <button
                onClick={tryQr}
                className="mb-2.5 rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-soft animate-fade-up"
              >
                {api.copy('chip-qr')}
              </button>
            )}
            {stage === 'qrfail' && (
              <div className="mb-2.5 animate-fade-up">
                <Button onClick={api.advance}>{api.copy('btn-jianying')}</Button>
              </div>
            )}

            {/* 提示词预览：build 阶段展示待发送的完整提示词 */}
            <div className="flex items-end gap-2">
              <div className="max-h-[150px] min-h-[64px] flex-1 overflow-y-auto rounded-xl border border-cream/12 bg-dusk-2/70 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-cream">
                {building ? (
                  <>
                    <div className="mb-1 text-[10.5px] tracking-widest text-ember">
                      {api.copy('prompt-preview-label')}
                    </div>
                    <p className="whitespace-pre-wrap">{api.copy('p-v1')}</p>
                  </>
                ) : (
                  <span className="text-cream-soft/40">…</span>
                )}
              </div>
              <button
                disabled={!building || ratio !== 'portrait'}
                onClick={generateV1}
                className="rounded-xl bg-ember px-4 py-2.5 text-[13px] font-medium text-dusk transition hover:brightness-105 disabled:opacity-40"
              >
                {api.copy('s3-generate')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** S4：剪映二维码合成教学。第 5 步是真操作：把学姐发的真二维码拖进海报虚线框。 */
const JianyingSteps: React.FC<{ api: FlowAPI; assets: Record<string, string> }> = ({
  api,
  assets,
}) => {
  const [step, setStep] = useState(0);
  const [dropOver, setDropOver] = useState(false);
  const STEPS = ['jy-1', 'jy-2', 'jy-3', 'jy-4', 'jy-5', 'jy-6'];
  const DRAG_STEP = 4; // jy-5：拖二维码
  const done = step >= STEPS.length;
  const qrPlaced = step > DRAG_STEP;

  const next = () => {
    const n = step + 1;
    setStep(n);
    if (n >= STEPS.length) api.check('ck-qr');
  };

  const placeQr = () => {
    if (step === DRAG_STEP) {
      setDropOver(false);
      next();
    }
  };

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_300px] md:gap-6">
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="font-display text-xl font-bold tracking-wide text-cream">
            <Scissors size={20} strokeWidth={1.75} className="inline text-cream-soft" /> {api.copy('jy-title')}
          </h1>
          <p className="mt-1 text-[13px] text-cream-soft">{api.copy('jy-sub')}</p>
        </header>
        <ol className="flex flex-col gap-2">
          {STEPS.map((k, i) => {
            const state = i < step ? 'done' : i === step ? 'now' : 'todo';
            return (
              <li
                key={k}
                className={`flex items-center gap-3 rounded-xl border p-3 backdrop-blur-md transition ${
                  state === 'done'
                    ? 'border-cream/10 bg-dusk/60 opacity-70'
                    : state === 'now'
                      ? 'border-ember/60 bg-dusk/85 shadow-glass'
                      : 'border-cream/10 bg-dusk/60 opacity-45'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                    state === 'done'
                      ? 'bg-ember text-dusk'
                      : state === 'now'
                        ? 'bg-accent text-white shadow-glow'
                        : 'bg-cream/15 text-cream-soft'
                  }`}
                >
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <span className="flex-1 text-[13.5px] leading-relaxed text-cream">{api.copy(k)}</span>
                {state === 'now' && i !== DRAG_STEP && (
                  <Button onClick={next} className="shrink-0 !px-3 !py-1.5 text-[12.5px]">
                    {api.copy('jy-next')}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
        {/* 第 5 步的素材：学姐发的真二维码（拖进右侧海报虚线框） */}
        {step === DRAG_STEP && (
          <div className="flex items-center gap-4 rounded-2xl border border-accent bg-milk p-3.5 text-ink shadow-glow animate-fade-up">
            <img
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', 'qr-signup');
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onDoubleClick={placeQr}
              src={assets['qr-signup']}
              alt=""
              className="h-20 w-20 shrink-0 cursor-grab rounded-lg border border-line bg-white object-contain"
            />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">{api.copy('jy-qr-title')}</div>
              <div className="mt-1 text-[12px] text-accent animate-fade-up">
                → {api.copy('jy-qr-hint')}
              </div>
            </div>
          </div>
        )}
        <div className="rounded-xl border border-cream/12 bg-dusk/70 p-3.5 text-[12.5px] leading-relaxed text-cream shadow-glass backdrop-blur-md">
          <span className="mr-2 font-semibold text-ember"><Droplet size={13} strokeWidth={1.75} className="inline" /> {api.copy('jy-tip-title')}</span>
          {api.copy('jy-tip')}
        </div>
        {done && (
          <div className="animate-fade-up">
            <p className="mb-3 rounded-xl border border-cream/12 bg-dusk/70 p-3.5 text-[13.5px] leading-relaxed text-cream shadow-glass backdrop-blur-md">
              <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">
                {ui.board['senpai-prefix']}
              </span>
              {api.copy('jy-done-line')}
            </p>
            <Button full onClick={api.advance}>
              {api.copy('btn-deliver')}
            </Button>
          </div>
        )}
      </div>
      {/* 右侧：合成预览。第 5 步时左下虚线框是投放区；放入后切换为带真码的终稿 */}
      <div
        className="relative self-start"
        onDragOver={(e) => {
          if (step !== DRAG_STEP) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDropOver(true);
        }}
        onDragLeave={() => setDropOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.getData('text/plain') === 'qr-signup') placeQr();
        }}
      >
        <img
          key={qrPlaced ? 'final' : 'v2'}
          src={qrPlaced ? assets['poster-acg-final'] : assets['poster-acg-v2']}
          alt=""
          className="w-full rounded-xl border border-line shadow-lift animate-fade-up"
        />
        {step === DRAG_STEP && (
          <span
            className={`absolute bottom-[4%] left-[5%] h-[14%] w-[26%] rounded-md border-2 border-dashed transition ${
              dropOver ? 'border-accent bg-accent-soft/50 shadow-glow' : 'border-accent/70'
            } animate-breathe`}
          />
        )}
      </div>
    </div>
  );
};

/** S10 / ESC 交付屏 */
const Deliver: React.FC<{
  api: FlowAPI;
  assets: Record<string, string>;
  total: number;
  escape?: boolean;
  onDone: () => void;
}> = ({ api, assets, total, escape = false, onDone }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const img = escape ? assets['poster-senpai-34'] : assets['poster-acg-final'];

  return (
    <div className="fx-paper fx-washi fx-leafshadow flex flex-col gap-5 rounded-2xl border border-line-warm bg-parchment/95 p-6 text-ink shadow-lift">
      <img
        src={img}
        alt=""
        className="mx-auto w-full max-w-[320px] rounded-lg border border-line-warm shadow-lift animate-fade-up"
      />
      {!escape && (
        <p className="text-center text-sm font-medium text-accent">
          {interpolate(api.copy('s10-checklist-done'), { done: api.checked.length, total })}
        </p>
      )}
      <p className="whitespace-pre-wrap text-[16px] leading-relaxed">{api.t(api.screen.text ?? '')}</p>
      {!escape && (
        <div className="text-[15px] leading-relaxed text-ink-soft">
          <p>{api.copy('s10-npc-line')}</p>
          <p>{api.copy('s10-senpai-line')}</p>
        </div>
      )}
      {!escape && (
        <button
          className="text-left text-sm text-accent underline underline-offset-4"
          onClick={() => setShowPrompt((v) => !v)}
        >
          {api.copy('s10-show-prompt')}
        </button>
      )}
      {showPrompt && (
        <div className="whitespace-pre-wrap rounded-xl border border-line-warm bg-parchment/60 p-3.5 text-[13px] leading-relaxed text-ink-soft shadow-soft animate-fade-up">
          {api.copy('s10-full-prompt')}
        </div>
      )}
      <Button full onClick={onDone}>
        {api.nextLabel}
      </Button>
    </div>
  );
};

/** [问学长] 浮动按钮 + 确认弹层 */
const EscapeOverlay: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [confirming, setConfirming] = useState(false);
  if (api.screen.id !== 'S3' && api.screen.id !== 'S4') return null;
  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="fixed bottom-5 right-4 z-20 rounded-full border border-cream/20 bg-dusk/80 px-4 py-2 font-display text-sm text-cream shadow-glass backdrop-blur-md transition hover:-translate-y-0.5 hover:border-ember/60 hover:text-ember"
      >
        {api.copy('esc-button')}
      </button>
      {confirming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl bg-milk p-6 text-ink shadow-pop animate-pop-in">
            <p className="text-[16px] font-medium">{api.copy('esc-confirm-title')}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                full
                onClick={() => {
                  setConfirming(false);
                  api.goto('ESC');
                }}
              >
                {api.copy('esc-confirm-yes')}
              </Button>
              <Button variant="secondary" full onClick={() => setConfirming(false)}>
                {api.copy('esc-confirm-no')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const PosterComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { portfolio: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['image-gen'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'poster-y1',
        levelId: 'poster',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
        assetRef: borrowed ? 'poster-senpai-34' : 'poster-acg-final.jpg',
      },
      {
        // 学完即沉淀：生图提示词模板入库（走[问学长]也给——模板是知识，不打借条）
        id: 'prompt-image-gen',
        levelId: 'poster',
        title: content.copy['prompt-item-title'],
        resumeLine: '',
        borrowed: false,
      },
    ],
  });

  return (
    <>
      <TaskPanel items={checklist} checked={checked} />
      <ScreenPlayer
        content={content}
        globalVars={{ playerName: state.player.name }}
        defaultNextLabel={ui.common.continue}
        senpaiLabel={ui.board['senpai-prefix']}
        wideScreens={['S3', 'S4']}
        onCheckChange={setChecked}
        custom={{
          S3: (api) => <GenChat api={api} assets={assets} />,
          S4: (api) => <JianyingSteps api={api} assets={assets} />,
          S10: (api) => (
            <Deliver
              api={api}
              assets={assets}
              total={checklist.length}
              onDone={() => onComplete(buildResult(false, api.checked.length))}
            />
          ),
          ESC: (api) => (
            <Deliver
              api={api}
              assets={assets}
              total={checklist.length}
              escape
              onDone={() => onEscape(buildResult(true, api.checked.length))}
            />
          ),
        }}
        overlay={(api) => <EscapeOverlay api={api} />}
        onFinish={(r) => onComplete(buildResult(false, r.checked.length))}
      />
    </>
  );
};

export const PosterLevel: LevelModule = { id: 'poster', Component: PosterComponent };
