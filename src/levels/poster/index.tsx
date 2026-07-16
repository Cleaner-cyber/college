/**
 * 海报关：教学「生图与迭代」。主线必修 · 全预设演出。
 * S3 是拟真的 AI 生图对话：左侧喂料面板实时拼装提示词 → 发送出图 →
 * 学姐消息驳回 → 在原提示词末尾追加改动再生成 → 提示词不变换尺寸参数出 16:9。
 * 任意时刻可点 [问学长] 跳过，产物入库并标记 borrowed。
 */
import React, { useEffect, useRef, useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { ui, interpolate } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { SenpaiAvatar, NpcAvatar } from '@/components/ui/SpeakerTag';

const STYLE_KEYS = ['jj', 'sh', 'sy'] as const;
const SIZES = ['3:4', '16:9', '1:1'] as const;
const REVISIONS = ['down', 'dark', 'reroll'] as const;

type Stage =
  | 'build' // 拼提示词
  | 'think1'
  | 'v1' // 首版出图，[发给学姐]
  | 'reject' // 学姐消息 + 修改选项
  | 'think2'
  | 'v2' // 修正版，[改 16:9]
  | 'think3'
  | 'v169'; // 16:9 出图，[交付]

type Msg =
  | { kind: 'user'; text: string; param?: string; prefix?: string }
  | { kind: 'ai'; text: string; img?: string; club?: string }
  | { kind: 'senpai'; text: string }
  | { kind: 'xuejie'; text: string };

/** 出图气泡里的海报（社团名以文字层叠加） */
const PosterImage: React.FC<{ src?: string; club?: string; wide?: boolean }> = ({
  src,
  club,
  wide = false,
}) => (
  <div className={`relative ${wide ? 'w-full max-w-[380px]' : 'w-full max-w-[230px]'}`}>
    {src && <img src={src} alt="" className="w-full rounded-lg border border-line shadow-soft" />}
    {club && (
      <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/55 px-2 py-0.5 text-xs text-white">
        {club}
      </span>
    )}
  </div>
);

const Thinking: React.FC<{ label: string; tip: string }> = ({ label, tip }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-2 text-[13px] text-ink-soft">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
            style={{ animationDelay: `${i * 0.25}s` }}
          />
        ))}
      </span>
      {label}
    </div>
    <span className="text-[11.5px] text-ink-soft/70">{tip}</span>
  </div>
);

const GenChat: React.FC<{ api: FlowAPI; assets: Record<string, string> }> = ({ api, assets }) => {
  const [stage, setStage] = useState<Stage>('build');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [club, setClub] = useState('');
  const [style, setStyle] = useState('');
  const [size, setSize] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const clubName = club.trim() || api.copy('s3-club-default');
  const styleName = style ? api.copy(`s3-style-${style}`) : '';
  const building = stage === 'build';
  const thinking = stage.startsWith('think');

  // 实时拼装的提示词三句话
  const pSubject = interpolate(api.copy('p-subject'), { clubName });
  const pLayout = api.copy('p-layout');
  const pStyle = style
    ? interpolate(api.copy('p-style'), { styleName })
    : api.copy('p-style-empty');
  const fullPrompt = `${pSubject}\n${pLayout}\n${style ? interpolate(api.copy('p-style'), { styleName }) : ''}`;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, stage]);

  // 思考 → 出图
  useEffect(() => {
    if (!thinking) return;
    const t = window.setTimeout(() => {
      if (stage === 'think1') {
        setMsgs((m) => [
          ...m,
          {
            kind: 'ai',
            text: api.copy('ai-v1'),
            img: assets[`poster-${style}-34-v1`],
            club: clubName,
          },
          { kind: 'senpai', text: api.copy('senpai-v1') },
        ]);
        api.check('ck-name');
        setStage('v1');
      } else if (stage === 'think2') {
        setMsgs((m) => [
          ...m,
          {
            kind: 'ai',
            text: api.copy('ai-v2'),
            img: assets[`poster-${style}-34-v2`],
            club: clubName,
          },
        ]);
        setStage('v2');
      } else {
        setMsgs((m) => [
          ...m,
          { kind: 'ai', text: api.copy('ai-169'), img: assets[`poster-${style}-169`] },
          { kind: 'senpai', text: api.copy('senpai-169') },
        ]);
        api.check('ck-169');
        setStage('v169');
      }
    }, 2600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const generate = () => {
    api.setVar('clubName', clubName);
    api.setVar('style', style);
    api.setVar('styleName', styleName);
    setMsgs((m) => [
      ...m,
      { kind: 'user', text: fullPrompt.trim(), param: interpolate(api.copy('param-tag'), { size: '3:4' }) },
    ]);
    setStage('think1');
  };

  const sendToXuejie = () => {
    setMsgs((m) => [...m, { kind: 'xuejie', text: api.copy('xuejie-reject') }]);
    setStage('reject');
  };

  const revise = (key: (typeof REVISIONS)[number]) => {
    api.setVar('revision', key);
    api.check('ck-space');
    setMsgs((m) => [
      ...m,
      {
        kind: 'user',
        text: api.copy(`rev-${key}`),
        prefix: api.copy('user-revise-prefix'),
        param: interpolate(api.copy('param-tag'), { size: '3:4' }),
      },
    ]);
    setStage('think2');
  };

  const to169 = () => {
    setMsgs((m) => [
      ...m,
      {
        kind: 'user',
        text: api.copy('user-169'),
        param: interpolate(api.copy('param-tag'), { size: '16:9' }),
      },
    ]);
    setStage('think3');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-accent-soft/60 p-2.5 text-[12px] leading-relaxed text-ink-soft">
        {api.copy('s3-steps')}
      </p>
      <div className="grid grid-cols-[250px_minmax(0,1fr)] gap-5">
        {/* 喂料面板 */}
        <aside className={building ? '' : 'pointer-events-none opacity-45'}>
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
            <div>
              <div className="mb-1.5 text-[11px] tracking-widest text-ink-soft">
                {api.copy('s3-club-label')}
              </div>
              <input
                value={club}
                maxLength={12}
                onChange={(e) => setClub(e.target.value)}
                placeholder={api.copy('s3-club-default')}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] outline-none focus:border-accent"
              />
              <p className="mt-1 text-[11px] text-ink-soft">{api.copy('s3-club-hint')}</p>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] tracking-widest text-ink-soft">
                {api.copy('s3-style-label')}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {STYLE_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => setStyle(key)}
                    className={`rounded-lg border-2 p-1 transition ${
                      style === key ? 'border-accent' : 'border-line'
                    }`}
                  >
                    <img
                      src={assets[`poster-${key}-34-v1`]}
                      alt={api.copy(`s3-style-${key}`)}
                      className="aspect-[3/4] w-full rounded object-cover"
                    />
                    <div className="mt-0.5 text-center text-[11.5px]">
                      {api.copy(`s3-style-${key}`)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] tracking-widest text-ink-soft">
                {api.copy('s3-size-label')}
              </div>
              <div className="flex gap-1.5">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSize(s);
                      if (s === '3:4') api.check('ck-ratio');
                    }}
                    className={`rounded-lg border-2 px-2.5 py-1.5 text-[12.5px] transition ${
                      size === s ? 'border-accent bg-accent-soft' : 'border-line bg-paper'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {size !== '' && size !== '3:4' && (
                <p className="mt-1.5 text-[11px] text-accent animate-fade-up">
                  {api.copy('s3-size-warn')}
                </p>
              )}
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                {api.copy('s3-size-note')}
              </p>
            </div>
          </div>
          {!building && (
            <p className="mt-2 rounded-xl bg-accent-soft/60 p-2.5 text-[11.5px] leading-relaxed text-ink-soft">
              {api.copy('builder-locked')}
            </p>
          )}
        </aside>

        {/* AI 生图对话框 */}
        <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border-2 border-line bg-card">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[13px] font-medium">{api.copy('chat-title')}</span>
          </div>

          {/* 消息区 */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-3">
              {msgs.map((m, i) => {
                if (m.kind === 'user') {
                  return (
                    <div key={i} className="flex flex-col items-end gap-1 animate-fade-up">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[13px] leading-relaxed text-paper">
                        {m.prefix && <span className="mr-1 opacity-60">{m.prefix}</span>}
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      </div>
                      {m.param && (
                        <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-[11px] text-ink-soft">
                          ⚙ {m.param}
                        </span>
                      )}
                    </div>
                  );
                }
                if (m.kind === 'senpai') {
                  return (
                    <div key={i} className="flex items-start gap-2 py-1 animate-fade-up">
                      <SenpaiAvatar size={26} />
                      <p className="pt-0.5 text-[12.5px] leading-relaxed text-accent">{m.text}</p>
                    </div>
                  );
                }
                if (m.kind === 'xuejie') {
                  return (
                    <div key={i} className="mx-auto w-[88%] animate-fade-up">
                      <div className="rounded-2xl border border-line bg-paper p-3.5 shadow-soft">
                        <div className="mb-1.5 flex items-center gap-2">
                          <NpcAvatar name={api.copy('xuejie-name')} size={24} />
                          <span className="text-[11px] tracking-widest text-ink-soft">
                            {api.copy('xuejie-msg-app')}
                          </span>
                        </div>
                        <p className="text-[13.5px] leading-relaxed">{m.text}</p>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex justify-start animate-fade-up">
                    <div className="flex max-w-[92%] flex-col gap-2.5 rounded-2xl rounded-tl-md border border-line bg-paper px-4 py-3">
                      <p className="text-[13px] leading-relaxed">{m.text}</p>
                      {m.img && (
                        <PosterImage src={m.img} club={m.club} wide={m.img.includes('169')} />
                      )}
                    </div>
                  </div>
                );
              })}
              {thinking && (
                <Thinking label={api.copy('gen-thinking')} tip={api.copy('gen-tip')} />
              )}
            </div>
          </div>

          {/* 输入区 */}
          <div className="border-t border-line px-4 py-3">
            {/* 阶段操作 */}
            {stage === 'v1' && (
              <div className="mb-2.5 animate-fade-up">
                <Button onClick={sendToXuejie}>{api.copy('btn-to-xuejie')}</Button>
              </div>
            )}
            {stage === 'reject' && (
              <div className="mb-2.5 animate-fade-up">
                <p className="mb-2 text-[12.5px] text-ink-soft">{api.copy('revise-title')}</p>
                <div className="flex flex-wrap gap-2">
                  {REVISIONS.map((key) => (
                    <button
                      key={key}
                      onClick={() => revise(key)}
                      className="rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-soft"
                    >
                      {api.copy(`rev-${key}-label`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {stage === 'v2' && (
              <button
                onClick={to169}
                className="mb-2.5 rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-soft animate-fade-up"
              >
                {api.copy('chip-169')}
              </button>
            )}
            {stage === 'v169' && (
              <div className="mb-2.5 animate-fade-up">
                <Button onClick={api.advance}>{api.copy('btn-deliver')}</Button>
              </div>
            )}

            {/* 提示词输入框：build 阶段实时拼装展示 */}
            <div className="flex items-end gap-2">
              <div className="min-h-[74px] flex-1 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[12.5px] leading-relaxed">
                {building ? (
                  <>
                    <div className="mb-1 text-[10.5px] tracking-widest text-accent">
                      {api.copy('prompt-preview-label')}
                    </div>
                    <p>{pSubject}</p>
                    <p>{pLayout}</p>
                    <p className={style ? '' : 'text-ink-soft/50'}>{pStyle}</p>
                  </>
                ) : (
                  <span className="text-ink-soft/50">…</span>
                )}
              </div>
              <button
                disabled={!building || !style || size !== '3:4'}
                onClick={generate}
                className="rounded-xl bg-ink px-4 py-2.5 text-[13px] text-paper transition disabled:opacity-40"
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

/** S10 / ESC 交付屏 */
const Deliver: React.FC<{
  api: FlowAPI;
  assets: Record<string, string>;
  total: number;
  escape?: boolean;
  onDone: () => void;
}> = ({ api, assets, total, escape = false, onDone }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const imgA = escape ? assets['poster-senpai-34'] : assets[api.t('poster-{style}-34-v2')];
  const imgB = escape ? assets['poster-senpai-169'] : assets[api.t('poster-{style}-169')];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-3 animate-fade-up">
        <img src={imgA} alt="" className="w-[46%] rounded-lg border border-line shadow-soft" />
        <img src={imgB} alt="" className="w-1/2 rounded-lg border border-line shadow-soft" />
      </div>
      {!escape && (
        <p className="text-center text-sm font-medium text-accent">
          {interpolate(api.copy('s10-checklist-done'), {
            done: api.checked.length,
            total,
          })}
        </p>
      )}
      <p className="whitespace-pre-wrap text-[16px] leading-relaxed">
        {api.t(api.screen.text ?? '')}
      </p>
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
        <div className="rounded-xl bg-card p-3 text-[13px] leading-relaxed text-ink-soft animate-fade-up">
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
  if (api.screen.id !== 'S3') return null;
  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="fixed bottom-5 right-4 z-20 rounded-full border border-line bg-card px-4 py-2 text-sm text-ink-soft shadow-soft"
      >
        {api.copy('esc-button')}
      </button>
      {confirming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl bg-paper p-6 shadow-pop animate-pop-in">
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

  const buildResult = (borrowed: boolean, done: number, style?: string): LevelResult => ({
    deltas: { portfolio: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['image-gen'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'poster-y1',
        levelId: 'poster',
        title: borrowed
          ? content.copy['archive-title-borrowed']
          : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
        assetRef: borrowed ? 'poster-senpai-34' : style ? `poster-${style}-34-v2` : undefined,
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
        wideScreens={['S3']}
        onCheckChange={setChecked}
        custom={{
          S3: (api) => <GenChat api={api} assets={assets} />,
          S10: (api) => (
            <Deliver
              api={api}
              assets={assets}
              total={checklist.length}
              onDone={() => onComplete(buildResult(false, api.checked.length, api.vars.style))}
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
        onFinish={(r) => onComplete(buildResult(false, r.checked.length, r.vars.style))}
      />
    </>
  );
};

export const PosterLevel: LevelModule = { id: 'poster', Component: PosterComponent };
