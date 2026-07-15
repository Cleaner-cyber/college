/**
 * PPT 关：教学「结构化生成」。大一下主线必修 · 全预设演出。
 * S3 拟真 AI 对话：①只要大纲（先骨架后血肉）→ ②拖入乱素材洗成两张表 →
 * ③按大纲一次成稿（10页预览图）→ 学姐消息驳回 → ④只改第 7 页完成迭代。
 */
import React, { useEffect, useRef, useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { ui, interpolate } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { renderMarkdown } from '@/components/ui/Markdown';
import { SenpaiAvatar, NpcAvatar } from '@/components/ui/SpeakerTag';

type Stage =
  | 'chip-outline'
  | 'typing-outline'
  | 'think-outline'
  | 'stream-outline'
  | 'need-file'
  | 'chip-table'
  | 'typing-table'
  | 'think-table'
  | 'stream-table'
  | 'chip-pages'
  | 'typing-pages'
  | 'think-pages'
  | 'deck-v1'
  | 'reject'
  | 'think-fix'
  | 'done';

type Msg =
  | { kind: 'file' }
  | { kind: 'user'; text: string }
  | { kind: 'ai'; text: string; done: boolean; img?: string }
  | { kind: 'senpai'; text: string }
  | { kind: 'xuejie'; text: string };

const ROUND: Record<string, { q: string; a: string }> = {
  outline: { q: 'q-outline', a: 'a-outline' },
  table: { q: 'q-table', a: 'a-table' },
  pages: { q: 'q-pages', a: 'ai-pages' },
};

const Thinking: React.FC<{ label: string }> = ({ label }) => (
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
);

const StructChat: React.FC<{ api: FlowAPI; assets: Record<string, string> }> = ({
  api,
  assets,
}) => {
  const [stage, setStage] = useState<Stage>('chip-outline');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [fed, setFed] = useState(false);
  const [inputText, setInputText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [streamCount, setStreamCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const round = stage.includes('outline') ? 'outline' : stage.includes('table') ? 'table' : 'pages';
  const thinking = stage.startsWith('think');
  const streaming = stage.startsWith('stream');

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, streamCount, stage, inputText]);

  // 提示词打字动画 → 发送
  useEffect(() => {
    if (!stage.startsWith('typing-')) return;
    const q = api.copy(ROUND[round].q);
    let i = 0;
    const t = window.setInterval(() => {
      i = Math.min(q.length, i + 4);
      setInputText(q.slice(0, i));
      if (i >= q.length) {
        window.clearInterval(t);
        window.setTimeout(() => {
          setInputText('');
          setMsgs((m) => [...m, { kind: 'user', text: q }]);
          setStage(`think-${round}` as Stage);
        }, 420);
      }
    }, 20);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // 思考 → 输出
  useEffect(() => {
    if (!thinking && stage !== 'think-fix') return;
    const t = window.setTimeout(() => {
      if (stage === 'think-outline' || stage === 'think-table') {
        setMsgs((m) => [...m, { kind: 'ai', text: api.copy(ROUND[round].a), done: false }]);
        setStreamCount(0);
        setStage(`stream-${round}` as Stage);
      } else if (stage === 'think-pages') {
        setMsgs((m) => [
          ...m,
          { kind: 'ai', text: api.copy('ai-pages'), done: true, img: assets['ppt-deck-v1'] },
        ]);
        api.check('ck-pages');
        setStage('deck-v1');
      } else if (stage === 'think-fix') {
        setMsgs((m) => [
          ...m,
          { kind: 'ai', text: api.copy('ai-fix'), done: true, img: assets['ppt-deck-v2'] },
          { kind: 'senpai', text: api.copy('senpai-wrap') },
        ]);
        api.check('ck-fix');
        setStage('done');
      }
    }, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // 流式输出
  useEffect(() => {
    if (!streaming) return;
    const full = api.copy(ROUND[round].a);
    if (streamCount >= full.length) {
      setMsgs((m) => m.map((msg) => (msg.kind === 'ai' ? { ...msg, done: true } : msg)));
      if (stage === 'stream-outline') {
        api.check('ck-outline');
        setMsgs((m) => [...m, { kind: 'senpai', text: api.copy('senpai-tip-2') }]);
        setStage('need-file');
      } else {
        api.check('ck-table');
        setMsgs((m) => [...m, { kind: 'senpai', text: api.copy('senpai-tip-3') }]);
        setStage('chip-pages');
      }
      return;
    }
    const t = window.setTimeout(() => setStreamCount((c) => Math.min(full.length, c + 9)), 14);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, streamCount]);

  const feed = () => {
    if (fed || stage !== 'need-file') return;
    setFed(true);
    setMsgs((m) => [...m, { kind: 'file' }]);
    setStage('chip-table');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-accent-soft/60 p-2.5 text-[12px] leading-relaxed text-ink-soft">
        {api.copy('s3-steps')}
      </p>
      <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-5">
        {/* 素材面板 */}
        <aside>
          <div className="mb-2 text-[11px] tracking-widest text-ink-soft">
            {api.copy('files-title')}
          </div>
          <div
            draggable={!fed}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', 'mat');
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onDoubleClick={feed}
            className={`select-none rounded-xl border bg-card p-3 transition ${
              fed
                ? 'border-line opacity-50'
                : stage === 'need-file'
                  ? 'cursor-grab border-accent shadow-sm hover:-translate-y-0.5 hover:shadow-md'
                  : 'cursor-grab border-line'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 text-xl">📄</span>
              <div className="min-w-0">
                <div className="break-all text-[12.5px] font-medium leading-snug">
                  {api.copy('file-mat-name')}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-soft">{api.copy('file-mat-meta')}</div>
              </div>
            </div>
            <div className="mt-2 text-[11px]">
              {fed ? (
                <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">
                  ✓ {api.copy('file-fed-tag')}
                </span>
              ) : (
                stage === 'need-file' && (
                  <span className="text-accent animate-fade-up">
                    ← {api.copy('file-drag-hint')}
                  </span>
                )
              )}
            </div>
          </div>
          {stage === 'need-file' && (
            <p className="mt-3 rounded-xl bg-accent-soft/60 p-2.5 text-[11.5px] leading-relaxed text-ink-soft">
              {(ui.hints as Record<string, string>)['files-drag']}
            </p>
          )}
        </aside>

        {/* AI 对话框 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.getData('text/plain') === 'mat') feed();
          }}
          className={`flex h-[560px] flex-col overflow-hidden rounded-2xl border-2 bg-card transition-colors ${
            dragOver
              ? 'border-accent bg-accent-soft/40'
              : stage === 'need-file'
                ? 'border-dashed border-line'
                : 'border-line'
          }`}
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="text-[13px] font-medium">{api.copy('chat-title')}</span>
            {streaming && (
              <span className="ml-auto text-[11px] text-ink-soft">
                {api.copy('chat-skip-hint')}
              </span>
            )}
          </div>

          {/* 消息区 */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-3">
              {msgs.map((m, i) => {
                if (m.kind === 'file') {
                  return (
                    <div key={i} className="flex justify-end animate-fade-up">
                      <span className="flex max-w-[75%] items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px]">
                        📄 <span className="break-all">{api.copy('file-mat-name')}</span>
                      </span>
                    </div>
                  );
                }
                if (m.kind === 'user') {
                  return (
                    <div key={i} className="flex justify-end animate-fade-up">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[13px] leading-relaxed text-paper">
                        {m.text}
                      </div>
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
                      <div className="rounded-2xl border border-line bg-paper p-3.5 shadow-sm">
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
                const isLast = i === msgs.length - 1;
                const shown =
                  !m.done && isLast && streaming ? m.text.slice(0, streamCount) : m.text;
                return (
                  <div key={i} className="flex justify-start animate-fade-up">
                    <div
                      onClick={() => {
                        if (!m.done && streaming) setStreamCount(m.text.length);
                      }}
                      className="flex max-w-[92%] flex-col gap-2.5 rounded-2xl rounded-tl-md border border-line bg-paper px-4 py-3"
                    >
                      {renderMarkdown(shown)}
                      {m.img && (
                        <img
                          src={m.img}
                          alt=""
                          className="w-full max-w-[520px] rounded-lg border border-line shadow-sm"
                        />
                      )}
                      {!m.done && isLast && <span className="animate-pulse text-accent">▍</span>}
                    </div>
                  </div>
                );
              })}
              {(thinking || stage === 'think-fix') && (
                <Thinking label={api.copy('chat-thinking')} />
              )}
            </div>
          </div>

          {/* 输入区 */}
          <div className="border-t border-line px-4 py-3">
            {stage === 'chip-outline' && (
              <button
                onClick={() => setStage('typing-outline')}
                className="mb-2.5 rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-sm animate-fade-up"
              >
                {api.copy('chip-outline')}
              </button>
            )}
            {stage === 'chip-table' && (
              <button
                onClick={() => setStage('typing-table')}
                className="mb-2.5 rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-sm animate-fade-up"
              >
                {api.copy('chip-table')}
              </button>
            )}
            {stage === 'chip-pages' && (
              <button
                onClick={() => setStage('typing-pages')}
                className="mb-2.5 rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-sm animate-fade-up"
              >
                {api.copy('chip-pages')}
              </button>
            )}
            {stage === 'deck-v1' && (
              <div className="mb-2.5 animate-fade-up">
                <Button
                  onClick={() => {
                    setMsgs((m) => [...m, { kind: 'xuejie', text: api.copy('xuejie-reject') }]);
                    setStage('reject');
                  }}
                >
                  {api.copy('btn-to-xuejie')}
                </Button>
              </div>
            )}
            {stage === 'reject' && (
              <div className="mb-2.5 animate-fade-up">
                <p className="mb-2 text-[12.5px] text-ink-soft">{api.copy('revise-title')}</p>
                <button
                  onClick={() => {
                    setMsgs((m) => [...m, { kind: 'user', text: api.copy('chip-fix') }]);
                    setStage('think-fix');
                  }}
                  className="rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  {api.copy('chip-fix')}
                </button>
              </div>
            )}
            {stage === 'done' && (
              <div className="mb-2.5 animate-fade-up">
                <Button onClick={api.advance}>{api.copy('btn-deliver')}</Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div
                className={`min-h-[42px] flex-1 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  inputText ? 'text-ink' : 'text-ink-soft/60'
                }`}
              >
                {inputText || '…'}
                {stage.startsWith('typing-') && (
                  <span className="animate-pulse text-accent">▍</span>
                )}
              </div>
              <button
                disabled
                className="rounded-xl bg-ink px-4 py-2.5 text-[13px] text-paper opacity-40"
              >
                {ui.common.confirm}
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
  return (
    <div className="flex flex-col gap-5">
      <img
        src={assets[escape ? 'ppt-senpai' : 'ppt-deck-v2']}
        alt=""
        className="w-full rounded-lg border border-line shadow-sm animate-fade-up"
      />
      {!escape && (
        <p className="text-center text-sm font-medium text-accent">
          {interpolate(api.copy('s10-checklist-done'), { done: api.checked.length, total })}
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

const EscapeOverlay: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [confirming, setConfirming] = useState(false);
  if (api.screen.id !== 'S3') return null;
  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="fixed bottom-5 right-4 z-20 rounded-full border border-line bg-card px-4 py-2 text-sm text-ink-soft shadow-sm"
      >
        {api.copy('esc-button')}
      </button>
      {confirming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-paper p-6 animate-fade-up">
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

const PptComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    // PPT 是表达型工作：满勾给表达+2，其余+1
    deltas: { expression: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['structured-gen'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'ppt-deck',
        levelId: 'ppt',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
        assetRef: borrowed ? 'ppt-senpai' : 'ppt-deck-v2',
      },
      {
        // 学完即沉淀：结构化生成模板入库
        id: 'prompt-structured-gen',
        levelId: 'ppt',
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
          S3: (api) => <StructChat api={api} assets={assets} />,
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

export const PptLevel: LevelModule = { id: 'ppt', Component: PptComponent };
