/**
 * 选课关：教学「投喂长文档」。主线必修 · 不耗行动点。
 * S2 是一个拟真的 AI 对话工作台：把《培养方案》《学生手册》两份真实文件
 * 拖进对话框 → 预设提示词打字输入 → AI 流式输出真实分析结果（含表格）。
 * 分析内容为基于真实浙大文档预先跑出的结果，存于 /content（无运行时 AI 调用）。
 */
import React, { useEffect, useRef, useState } from 'react';
import type { LevelModule, LevelProps } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { interpolate, ui } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';
import { renderMarkdown } from '@/components/ui/Markdown';
import { DocViewer } from '@/components/ui/DocViewer';
import { SenpaiAvatar } from '@/components/ui/SpeakerTag';

type FileId = 'plan' | 'handbook';

type Msg =
  | { kind: 'file'; file: FileId }
  | { kind: 'user'; text: string }
  | { kind: 'ai'; text: string; done: boolean }
  | { kind: 'doc'; n: 1 | 2 }
  | { kind: 'senpai'; text: string };

type Stage =
  | 'need-plan' // 等待拖入培养方案
  | 'chip-q1'
  | 'typing-q1'
  | 'thinking-1'
  | 'stream-a1'
  | 'need-handbook' // 等待拖入学生手册
  | 'chip-q2'
  | 'typing-q2'
  | 'thinking-2'
  | 'stream-a2'
  | 'wrap';

// 每问：q=完整提示词；a=对话内简短交付语；doc=完整长文档（文档查看器展示）
const QA: Record<1 | 2, { q: string; a: string; doc: string; title: string }> = {
  1: { q: 'q1', a: 'a1-chat', doc: 'a1', title: 'doc1-title' },
  2: { q: 'q2', a: 'a2-chat', doc: 'a2', title: 'doc2-title' },
};

/** 文件卡片（HTML5 拖拽源） */
const FileCard: React.FC<{
  id: FileId;
  api: FlowAPI;
  fed: boolean;
  highlight: boolean;
  onFallbackFeed: (id: FileId) => void;
}> = ({ id, api, fed, highlight, onFallbackFeed }) => (
  <div
    draggable={!fed}
    onDragStart={(e) => {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'copy';
    }}
    onDoubleClick={() => !fed && onFallbackFeed(id)}
    className={`select-none rounded-xl border bg-card p-3 transition ${
      fed
        ? 'border-line opacity-50'
        : highlight
          ? 'cursor-grab border-accent shadow-glow hover:-translate-y-0.5 hover:shadow-lift'
          : 'cursor-grab border-line hover:-translate-y-0.5 hover:shadow-lift'
    }`}
  >
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-xl">📄</span>
      <div className="min-w-0">
        <div className="break-all text-[12.5px] font-medium leading-snug">
          {api.copy(`file-${id}-name`)}
        </div>
        <div className="mt-0.5 text-[11px] text-ink-soft">{api.copy(`file-${id}-meta`)}</div>
      </div>
    </div>
    <div className="mt-2 text-[11px]">
      {fed ? (
        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">
          ✓ {api.copy('file-fed-tag')}
        </span>
      ) : (
        highlight && (
          <span className="text-accent animate-fade-up">← {api.copy('file-drag-hint')}</span>
        )
      )}
    </div>
  </div>
);

const ThinkingDots: React.FC<{ label: string }> = ({ label }) => (
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

const AiChat: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [stage, setStage] = useState<Stage>('need-plan');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [fed, setFed] = useState<FileId[]>([]);
  const [inputText, setInputText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [streamCount, setStreamCount] = useState(0);
  const [openDoc, setOpenDoc] = useState<1 | 2 | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  // 提示词打字时输入框自动滚到最新一行，避免长提示词被卡住不可见
  useEffect(() => {
    const el = inputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [inputText]);

  const round: 1 | 2 = stage.includes('2') || stage === 'need-handbook' ? 2 : 1;

  // 自动滚到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, streamCount, stage, inputText]);

  // 提示词打字动画 → 发送
  useEffect(() => {
    if (!stage.startsWith('typing-')) return;
    const q = api.copy(QA[round].q);
    let i = 0;
    const t = window.setInterval(() => {
      i = Math.min(q.length, i + 4);
      setInputText(q.slice(0, i));
      if (i >= q.length) {
        window.clearInterval(t);
        window.setTimeout(() => {
          setInputText('');
          setMsgs((m) => [...m, { kind: 'user', text: q }]);
          setStage(`thinking-${round}` as Stage);
        }, 450);
      }
    }, 22);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // 思考 → 开始流式输出
  useEffect(() => {
    if (!stage.startsWith('thinking-')) return;
    const t = window.setTimeout(() => {
      setMsgs((m) => [...m, { kind: 'ai', text: api.copy(QA[round].a), done: false }]);
      setStreamCount(0);
      setStage(`stream-a${round}` as Stage);
    }, 1400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // 流式输出
  useEffect(() => {
    if (!stage.startsWith('stream-')) return;
    const full = api.copy(QA[round].a);
    if (streamCount >= full.length) {
      finishStream();
      return;
    }
    const t = window.setTimeout(() => setStreamCount((c) => Math.min(full.length, c + 9)), 14);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, streamCount]);

  const finishStream = () => {
    setMsgs((m) => m.map((msg) => (msg.kind === 'ai' ? { ...msg, done: true } : msg)));
    if (stage === 'stream-a1') {
      setMsgs((m) => [
        ...m,
        { kind: 'doc', n: 1 },
        { kind: 'senpai', text: api.copy('senpai-tip-2') },
      ]);
      setStage('need-handbook');
    } else if (stage === 'stream-a2') {
      setMsgs((m) => [
        ...m,
        { kind: 'doc', n: 2 },
        { kind: 'senpai', text: api.copy('senpai-wrap') },
      ]);
      setStage('wrap');
    }
  };

  const feed = (id: FileId) => {
    if (fed.includes(id)) return;
    if (id === 'plan' && stage === 'need-plan') {
      setFed((f) => [...f, id]);
      setMsgs((m) => [
        ...m,
        { kind: 'file', file: id },
        { kind: 'senpai', text: api.copy('senpai-tip-1') },
      ]);
      setStage('chip-q1');
    } else if (id === 'handbook' && stage === 'need-handbook') {
      setFed((f) => [...f, id]);
      setMsgs((m) => [...m, { kind: 'file', file: id }]);
      setStage('chip-q2');
    }
  };

  const chipStage = stage === 'chip-q1' || stage === 'chip-q2';
  const streaming = stage.startsWith('stream-');
  const thinking = stage.startsWith('thinking-');
  const needFile: FileId | null =
    stage === 'need-plan' ? 'plan' : stage === 'need-handbook' ? 'handbook' : null;

  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-5">
      {/* 文件面板 */}
      <aside>
        <div className="mb-2 text-[11px] tracking-widest text-ink-soft">
          {api.copy('files-title')}
        </div>
        <div className="flex flex-col gap-2.5">
          <FileCard
            id="plan"
            api={api}
            fed={fed.includes('plan')}
            highlight={needFile === 'plan'}
            onFallbackFeed={feed}
          />
          <FileCard
            id="handbook"
            api={api}
            fed={fed.includes('handbook')}
            highlight={needFile === 'handbook'}
            onFallbackFeed={feed}
          />
        </div>
        {/* 保姆级拖拽提示（对刚拿到电脑的新生） */}
        {needFile && (
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
          feed(e.dataTransfer.getData('text/plain') as FileId);
        }}
        className={`flex h-[560px] flex-col overflow-hidden rounded-2xl border-2 bg-card transition-colors ${
          dragOver ? 'border-accent bg-accent-soft/40' : needFile ? 'border-dashed border-line' : 'border-line'
        }`}
      >
        {/* 对话框标题栏 */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <span className="text-[13px] font-medium">{api.copy('chat-title')}</span>
          {streaming && (
            <span className="ml-auto text-[11px] text-ink-soft">{api.copy('chat-skip-hint')}</span>
          )}
        </div>

        {/* 消息区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {msgs.length === 0 && (
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
                      📄 <span className="break-all">{api.copy(`file-${m.file}-name`)}</span>
                    </span>
                  </div>
                );
              }
              if (m.kind === 'user') {
                return (
                  <div key={i} className="flex justify-end animate-fade-up">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[13.5px] leading-relaxed text-paper">
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
              if (m.kind === 'doc') {
                const md = api.copy(QA[m.n].doc);
                const sections = md.split('\n').filter((l) => l.startsWith('## ')).length;
                return (
                  <div key={i} className="flex justify-start animate-fade-up">
                    <button
                      onClick={() => setOpenDoc(m.n)}
                      className="flex w-[340px] max-w-[92%] items-center gap-3 rounded-2xl rounded-tl-md border border-accent/40 bg-card p-3.5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl">
                        📄
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">
                          {api.copy(QA[m.n].title)}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-ink-soft">
                          {interpolate((ui.doc as Record<string, string>)['card-stats'], {
                            chars: md.replace(/[\s|#*-]/g, '').length.toLocaleString('zh-CN'),
                            sections,
                          })}
                          {' · '}
                          <span className="text-accent">
                            {(ui.doc as Record<string, string>)['open-hint']}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-ink-soft">›</span>
                    </button>
                  </div>
                );
              }
              // ai
              const isLast = i === msgs.length - 1;
              const shown = !m.done && isLast && streaming ? m.text.slice(0, streamCount) : m.text;
              return (
                <div key={i} className="flex justify-start animate-fade-up">
                  <div
                    onClick={() => {
                      if (!m.done && streaming) setStreamCount(m.text.length);
                    }}
                    className="max-w-[92%] rounded-2xl rounded-tl-md border border-line bg-paper px-4 py-3"
                  >
                    {renderMarkdown(shown)}
                    {!m.done && isLast && <span className="animate-pulse text-accent">▍</span>}
                  </div>
                </div>
              );
            })}
            {thinking && <ThinkingDots label={api.copy('chat-thinking')} />}
          </div>
        </div>

        {/* 输入区 */}
        <div className="border-t border-line px-4 py-3">
          {chipStage && (
            <button
              onClick={() => setStage(`typing-q${round}` as Stage)}
              className="mb-2.5 rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-soft animate-fade-up"
            >
              {api.copy(`chip-q${round}`)}
            </button>
          )}
          {stage === 'wrap' && (
            <div className="mb-2.5 animate-fade-up">
              <Button onClick={api.advance}>{api.copy('to-deliver')}</Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div
              ref={inputRef}
              className={`max-h-[130px] min-h-[42px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px] leading-relaxed ${
                inputText ? 'text-ink' : 'text-ink-soft/60'
              }`}
            >
              {inputText || api.copy('chat-input-placeholder')}
              {stage.startsWith('typing-') && <span className="animate-pulse text-accent">▍</span>}
            </div>
            <button
              disabled
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] text-paper opacity-40"
            >
              {api.copy('chat-send')}
            </button>
          </div>
        </div>
      </div>

      {openDoc && (
        <DocViewer
          title={api.copy(QA[openDoc].title)}
          md={api.copy(QA[openDoc].doc)}
          onClose={() => setOpenDoc(null)}
        />
      )}
    </div>
  );
};

const DeliverList: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [typed, setTyped] = useState(false);
  return (
    <div>
      <div className="rounded-2xl border border-accent/40 bg-card p-5 shadow-lift">
        <div className="text-base font-semibold">{api.copy('s6-card-title')}</div>
        <ul className="mt-3 space-y-2.5 text-[14px] leading-relaxed">
          {[1, 2, 3, 4, 5]
            .map((n) => api.copy(`s6-card-line${n}`))
            .filter(Boolean)
            .map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">✓</span>
                {line}
              </li>
            ))}
        </ul>
      </div>
      <p className="mt-2 text-center text-xs text-ink-soft">{api.copy('s6-footer')}</p>
      <div className="mt-6">
        <Typewriter
          text={api.t(api.screen.text ?? '')}
          onDone={() => setTyped(true)}
          className="text-[16px]"
        />
      </div>
      {typed && (
        <Button full className="mt-8 animate-fade-up" onClick={api.advance}>
          {api.nextLabel}
        </Button>
      )}
    </div>
  );
};

const CourseSelectComponent: React.FC<LevelProps> = ({ state, content, onComplete }) => {
  return (
    <ScreenPlayer
      content={content}
      globalVars={{ playerName: state.player.name }}
      defaultNextLabel={ui.common.continue}
      senpaiLabel={ui.board['senpai-prefix']}
      wideScreens={['S2']}
      custom={{
        S2: (api) => <AiChat api={api} />,
        S6: (api) => <DeliverList api={api} />,
      }}
      onFinish={() =>
        onComplete({
          deltas: {},
          abilityUnlocks: ['doc-feeding'],
          archiveItems: [
            {
              id: 'course-map',
              levelId: 'course-select',
              title: content.copy['archive-title'],
              resumeLine: '',
              borrowed: false,
            },
            // 两份 AI 生成的长文档进作品集（点开走文档查看器）
            {
              id: 'doc-course-rules',
              levelId: 'course-select',
              title: content.copy['doc1-title'],
              resumeLine: content.copy['archive-doc1-line'],
              borrowed: false,
              assetRef: 'ai-doc',
            },
            {
              id: 'doc-summer-plan',
              levelId: 'course-select',
              title: content.copy['doc2-title'],
              resumeLine: content.copy['archive-doc2-line'],
              borrowed: false,
              assetRef: 'ai-doc',
            },
            {
              // 学完即沉淀：可复用的提示词模板入库
              id: 'prompt-doc-feeding',
              levelId: 'course-select',
              title: content.copy['prompt-item-title'],
              resumeLine: '',
              borrowed: false,
            },
          ],
        })
      }
    />
  );
};

export const CourseSelectLevel: LevelModule = {
  id: 'course-select',
  Component: CourseSelectComponent,
};
