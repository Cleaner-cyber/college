/**
 * 通用 AI 对话脚本引擎：教学关的拟真对话由一个 ChatStep[] 脚本驱动。
 * 支持：学长旁白 / NPC 消息卡 / 提示词 chip（打字动画）/ 多选 chips /
 * 文件拖拽投喂 / AI 回复（思考动画 + 流式 Markdown + 配图 + 打钩）/ 阶段按钮。
 * 所有文案经 FlowAPI.copy 从关卡内容 JSON 取。
 */
import React, { useEffect, useRef, useState } from 'react';
import type { FlowAPI } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { renderMarkdown } from '@/components/ui/Markdown';
import { SenpaiAvatar, NpcAvatar } from '@/components/ui/SpeakerTag';

export type ChatStep =
  | { type: 'senpai'; key: string }
  | { type: 'npc'; key: string; nameKey?: string; appKey?: string }
  | { type: 'chip'; labelKey: string; promptKey: string; check?: string }
  | {
      type: 'chips';
      titleKey?: string;
      options: { labelKey: string; msgKey: string; setVar?: [string, string] }[];
      check?: string;
    }
  | { type: 'file'; id: string; nameKey: string; metaKey: string }
  | { type: 'ai'; key: string; img?: string; check?: string; stream?: boolean }
  | { type: 'button'; labelKey: string };

type Msg =
  | { kind: 'file'; nameKey: string }
  | { kind: 'user'; text: string }
  | { kind: 'ai'; text: string; done: boolean; img?: string }
  | { kind: 'senpai'; text: string }
  | { kind: 'npc'; text: string; name: string; app: string };

interface ChatScriptProps {
  api: FlowAPI;
  steps: ChatStep[];
  assets: Record<string, string>;
  onDone: () => void;
}

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

export const ChatScript: React.FC<ChatScriptProps> = ({ api, steps, assets, onDone }) => {
  const [idx, setIdx] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [fed, setFed] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [streamCount, setStreamCount] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  const step = steps[idx] as ChatStep | undefined;
  const fileSteps = steps.filter((s): s is Extract<ChatStep, { type: 'file' }> => s.type === 'file');

  const advance = () => setIdx((i) => i + 1);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, streamCount, thinking, inputText, idx]);

  // 结束
  useEffect(() => {
    if (idx >= steps.length && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // 自动步骤：senpai / npc / ai
  useEffect(() => {
    if (!step) return;
    if (step.type === 'senpai') {
      const t = window.setTimeout(() => {
        setMsgs((m) => [...m, { kind: 'senpai', text: api.copy(step.key) }]);
        advance();
      }, 380);
      return () => window.clearTimeout(t);
    }
    if (step.type === 'npc') {
      const t = window.setTimeout(() => {
        setMsgs((m) => [
          ...m,
          {
            kind: 'npc',
            text: api.copy(step.key),
            name: api.copy(step.nameKey ?? 'npc-name'),
            app: api.copy(step.appKey ?? 'npc-msg-app'),
          },
        ]);
        advance();
      }, 500);
      return () => window.clearTimeout(t);
    }
    if (step.type === 'ai') {
      setThinking(true);
      const t = window.setTimeout(() => {
        setThinking(false);
        const stream = step.stream !== false; // 默认流式
        setMsgs((m) => [
          ...m,
          {
            kind: 'ai',
            text: api.copy(step.key),
            done: !stream,
            img: step.img ? assets[step.img] : undefined,
          },
        ]);
        if (stream) {
          setStreamCount(0);
          setStreaming(true);
        } else {
          if (step.check) api.check(step.check);
          advance();
        }
      }, 1400);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // 流式输出
  useEffect(() => {
    if (!streaming || !step || step.type !== 'ai') return;
    const full = api.copy(step.key);
    if (streamCount >= full.length) {
      setMsgs((m) => m.map((msg) => (msg.kind === 'ai' ? { ...msg, done: true } : msg)));
      setStreaming(false);
      if (step.check) api.check(step.check);
      advance();
      return;
    }
    const t = window.setTimeout(() => setStreamCount((c) => Math.min(full.length, c + 9)), 14);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, streamCount, idx]);

  // chip 打字动画 → 发送
  const [typingText, setTypingText] = useState<string | null>(null);
  useEffect(() => {
    if (typingText === null) return;
    let i = 0;
    const t = window.setInterval(() => {
      i = Math.min(typingText.length, i + 4);
      setInputText(typingText.slice(0, i));
      if (i >= typingText.length) {
        window.clearInterval(t);
        window.setTimeout(() => {
          setInputText('');
          setMsgs((m) => [...m, { kind: 'user', text: typingText }]);
          setTypingText(null);
          advance();
        }, 420);
      }
    }, 20);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingText]);

  const feed = (fileId: string) => {
    if (!step || step.type !== 'file' || step.id !== fileId || fed.includes(fileId)) return;
    setFed((f) => [...f, fileId]);
    setMsgs((m) => [...m, { kind: 'file', nameKey: step.nameKey }]);
    advance();
  };

  const waitingFile = step?.type === 'file' ? step.id : null;
  const hints = ui.hints as Record<string, string>;

  // 提示词打字时输入框自动滚到最新一行，避免长提示词被卡住不可见
  const inputRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = inputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [inputText]);

  return (
    <div className={fileSteps.length > 0 ? 'grid grid-cols-[220px_minmax(0,1fr)] gap-5' : ''}>
      {/* 文件面板（有文件步骤才显示） */}
      {fileSteps.length > 0 && (
        <aside>
          <div className="mb-2 text-[11px] tracking-widest text-ink-soft">
            {api.copy('files-title')}
          </div>
          <div className="flex flex-col gap-2.5">
            {fileSteps.map((f) => {
              const isFed = fed.includes(f.id);
              const active = waitingFile === f.id;
              return (
                <div
                  key={f.id}
                  draggable={!isFed}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', f.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onDoubleClick={() => feed(f.id)}
                  className={`select-none rounded-xl border bg-card p-3 shadow-soft transition ${
                    isFed
                      ? 'border-line opacity-50 shadow-none'
                      : active
                        ? 'cursor-grab border-accent shadow-glow hover:-translate-y-0.5 hover:shadow-lift'
                        : 'cursor-grab border-line'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-xl">📄</span>
                    <div className="min-w-0">
                      <div className="break-all text-[12.5px] font-medium leading-snug">
                        {api.copy(f.nameKey)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-ink-soft">{api.copy(f.metaKey)}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px]">
                    {isFed ? (
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">
                        ✓ {api.copy('file-fed-tag')}
                      </span>
                    ) : (
                      active && (
                        <span className="text-accent animate-fade-up">
                          ← {api.copy('file-drag-hint')}
                        </span>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {waitingFile && (
            <p className="mt-3 rounded-xl bg-accent-soft/60 p-2.5 text-[11.5px] leading-relaxed text-ink-soft">
              {hints['files-drag']}
            </p>
          )}
        </aside>
      )}

      {/* 对话框 */}
      <div
        onDragOver={(e) => {
          if (!waitingFile) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          feed(e.dataTransfer.getData('text/plain'));
        }}
        className={`flex h-[560px] flex-col overflow-hidden rounded-2xl border-2 bg-card shadow-soft transition-colors ${
          dragOver ? 'border-accent bg-accent-soft/40' : waitingFile ? 'border-dashed border-line' : 'border-line'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-line bg-paper/60 px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="h-2 w-2 rounded-full bg-line" />
            <span className="h-2 w-2 rounded-full bg-line" />
          </span>
          <span className="ml-1 text-[13px] font-medium">{api.copy('chat-title')}</span>
          {streaming && (
            <span className="ml-auto text-[11px] text-ink-soft">{api.copy('chat-skip-hint')}</span>
          )}
        </div>

        {/* 消息区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {msgs.length === 0 && waitingFile && (
            <div className="flex h-full items-center justify-center text-sm text-ink-soft">
              {dragOver ? api.copy('chat-drop-active') : api.copy('chat-empty-hint')}
            </div>
          )}
          <div className="flex flex-col gap-3">
            {msgs.map((m, i) => {
              if (m.kind === 'file') {
                return (
                  <div key={i} className="flex justify-end animate-fade-up">
                    <span className="flex max-w-[75%] items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px]">
                      📄 <span className="break-all">{api.copy(m.nameKey)}</span>
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
              if (m.kind === 'npc') {
                return (
                  <div key={i} className="mx-auto w-[88%] animate-fade-up">
                    <div className="rounded-2xl border border-line bg-paper p-3.5 shadow-soft">
                      <div className="mb-1.5 flex items-center gap-2">
                        <NpcAvatar name={m.name} size={24} />
                        <span className="text-[11px] tracking-widest text-ink-soft">{m.app}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                );
              }
              const isLast = i === msgs.length - 1;
              const shown = !m.done && isLast && streaming ? m.text.slice(0, streamCount) : m.text;
              return (
                <div key={i} className="flex justify-start animate-fade-up">
                  <div
                    onClick={() => {
                      if (!m.done && streaming) setStreamCount(m.text.length);
                    }}
                    className="flex max-w-[92%] flex-col gap-2.5 rounded-2xl rounded-tl-md border border-line/70 bg-paper px-4 py-3 shadow-soft"
                  >
                    {renderMarkdown(shown)}
                    {m.img && m.done && (
                      <img
                        src={m.img}
                        alt=""
                        className="w-full max-w-[520px] rounded-lg border border-line shadow-soft"
                      />
                    )}
                    {!m.done && isLast && <span className="animate-pulse text-accent">▍</span>}
                  </div>
                </div>
              );
            })}
            {thinking && <Thinking label={api.copy('chat-thinking')} />}
          </div>
        </div>

        {/* 输入区 */}
        <div className="border-t border-line px-4 py-3">
          {step?.type === 'chip' && typingText === null && (
            <button
              onClick={() => {
                if (step.check) api.check(step.check);
                setTypingText(api.copy(step.promptKey));
              }}
              className="mb-2.5 rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-soft animate-fade-up"
            >
              {api.copy(step.labelKey)}
            </button>
          )}
          {step?.type === 'chips' && typingText === null && (
            <div className="mb-2.5 animate-fade-up">
              {step.titleKey && (
                <p className="mb-2 text-[12.5px] text-ink-soft">{api.copy(step.titleKey)}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {step.options.map((opt) => (
                  <button
                    key={opt.labelKey}
                    onClick={() => {
                      if (opt.setVar) api.setVar(opt.setVar[0], opt.setVar[1]);
                      if (step.check) api.check(step.check);
                      setTypingText(api.copy(opt.msgKey));
                    }}
                    className="rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    {api.copy(opt.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step?.type === 'button' && (
            <div className="mb-2.5 animate-fade-up">
              <Button onClick={advance}>{api.copy(step.labelKey)}</Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div
              ref={inputRef}
              className={`max-h-[130px] min-h-[42px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px] leading-relaxed ${
                inputText ? 'text-ink' : 'text-ink-soft/60'
              }`}
            >
              {inputText || api.copy('chat-input-placeholder', '…')}
              {typingText !== null && <span className="animate-pulse text-accent">▍</span>}
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
  );
};
